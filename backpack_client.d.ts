"use strict";
const axios = require('axios');
const crypto = require('crypto');
const https = require('https');
const moment = require('moment');
const { API_KEY, API_SECRET, BASE_URL, SYMBOL, QUANTITY } = require('./config');

// Tạo Axios instance với HTTPS
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    httpsAgent: new https.Agent({
        keepAlive: true,
        timeout: 5000,
    }),
    headers: {
        'User-Agent': 'Backpack-Scalping-Bot/1.0 (Node.js)',
    },
    timeout: 5000,
});

// Hàm delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Format ngày giờ
const getNowFormatDate = () => moment().format('YYYY-MM-DD HH:mm:ss');

// Hàm retry thủ công
async function retryRequest(fn, retries = 3, delayMs = 4000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            console.error(`${getNowFormatDate()} Retry ${i + 1}/${retries} failed:`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
            if (i === retries - 1) throw error;
            console.log(`${getNowFormatDate()} Thử lại sau ${delayMs / 1000}s...`);
            await delay(delayMs);
        }
    }
}

// Tạo chữ ký HMAC-SHA256
function createSignature(secret, method, endpoint, timestamp, params = {}, body = null) {
    const queryString = new URLSearchParams(params).toString();
    let message = `${method}${endpoint}${timestamp}${queryString}`;
    if (body) {
        message += JSON.stringify(body);
    }
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

// Gửi yêu cầu API
async function sendRequest(method, endpoint, params = {}, body = null) {
    const timestamp = Date.now().toString();
    const signature = createSignature(API_SECRET, method, endpoint, timestamp, params, body);
    const headers = {
        'X-API-Key': API_KEY,
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Window': '5000',
        'Content-Type': 'application/json',
    };

    try {
        const response = await retryRequest(async () => {
            const res = await axiosInstance({
                method,
                url: `${endpoint}${params ? `?${new URLSearchParams(params)}` : ''}`,
                headers,
                data: body,
            });
            return res;
        });
        return response.data;
    } catch (error) {
        console.error(`${getNowFormatDate()} API Error on ${endpoint}:`, {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
        });
        return null;
    }
}

// Lấy giá mới nhất
async function getLatestPrice() {
    const endpoint = '/api/v1/depth';
    const params = { symbol: SYMBOL, limit: 1 };
    const data = await sendRequest('GET', endpoint, params);
    if (data && data.bids && data.bids[0] && data.asks && data.asks[0]) {
        return {
            bid: parseFloat(data.bids[0][0]),
            ask: parseFloat(data.asks[0][0]),
        };
    }
    console.error(`${getNowFormatDate()} Dữ liệu giá không hợp lệ:`, data);
    return null;
}

// Lấy số dư tài khoản
async function getBalance(asset) {
    const endpoint = '/api/v1/balance';
    const data = await sendRequest('GET', endpoint);
    if (data && data[asset]) {
        return parseFloat(data[asset].available);
    }
    console.error(`${getNowFormatDate()} Dữ liệu số dư không hợp lệ:`, data);
    return 0;
}

// Hủy tất cả lệnh mở
async function cancelOpenOrders() {
    const endpoint = '/api/v1/orders';
    const result = await sendRequest('DELETE', endpoint, { symbol: SYMBOL });
    if (result) {
        console.log(`${getNowFormatDate()} Đã hủy tất cả lệnh mở`);
        return true;
    }
    console.error(`${getNowFormatDate()} Hủy lệnh thất bại`);
    return false;
}

// Đặt lệnh spot
async function placeOrder(side, quantity, price) {
    const endpoint = '/api/v1/order';
    const body = {
        symbol: SYMBOL,
        side: side.toLowerCase(),
        type: 'limit',
        quantity: quantity.toString(),
        price: price.toFixed(2),
        timeInForce: 'GTC', // Good Till Cancel thay vì IOC
    };
    const result = await sendRequest('POST', endpoint, {}, body);
    if (result && result.status === 'New') {
        console.log(`${getNowFormatDate()} ${side.toUpperCase()} order: Giá ${price}, Số lượng ${quantity}, ID: ${result.id}`);
        return result;
    }
    console.error(`${getNowFormatDate()} Đặt lệnh ${side} thất bại:`, result);
    return null;
}

// Logic scalping
let lastPrice = 0;
let position = null; // null, { type: "buy", entryPrice: number }
let tradeCount = 0;
let totalVolume = 0;
const THRESHOLD = 0.001; // Biến động giá 0.1%
const MAX_TRADES_PER_MINUTE = 10;
const SL_PERCENT = 0.005; // Stop-loss 0.5%
const TP_PERCENT = 0.003; // Take-profit 0.3%
const POLLING_INTERVAL = 2500; // Polling mỗi 2.5 giây
const RETRY_DELAY = 4000; // Retry sau 4 giây

async function scalpingLogic() {
    // Hủy lệnh mở định kỳ (mỗi 30 giây)
    if (tradeCount === 0) {
        await cancelOpenOrders();
    }

    // Lấy giá
    const prices = await getLatestPrice();
    if (!prices) return;
    const { bid, ask } = prices;
    const currentPrice = (bid + ask) / 2;

    if (!lastPrice) {
        lastPrice = currentPrice;
        return;
    }

    const priceChange = (currentPrice - lastPrice) / lastPrice;

    // Kiểm tra giới hạn lệnh
    if (tradeCount >= MAX_TRADES_PER_MINUTE) {
        console.log(`${getNowFormatDate()} Đạt giới hạn lệnh/phút, tạm nghỉ...`);
        return;
    }

    // Kiểm tra số dư
    const quoteAsset = SYMBOL.split('_')[1]; // USDC
    const baseAsset = SYMBOL.split('_')[0]; // SOL
    const balance = position ? await getBalance(baseAsset) : await getBalance(quoteAsset);
    const requiredBalance = position ? QUANTITY : QUANTITY * ask;
    if (!balance || balance < requiredBalance) {
        console.log(`${getNowFormatDate()} Số dư không đủ (${position ? baseAsset : quoteAsset}: ${balance})`);
        return;
    }

    // Logic mở/đóng lệnh
    if (!position && priceChange > THRESHOLD) {
        // Mở buy
        const result = await placeOrder('buy', QUANTITY, bid);
        if (result) {
            position = { type: 'buy', entryPrice: bid };
            tradeCount++;
            totalVolume += QUANTITY * bid;
        }
    } else if (!position && priceChange < -THRESHOLD) {
        // Mở sell
        const result = await placeOrder('sell', QUANTITY, ask);
        if (result) {
            position = { type: 'sell', entryPrice: ask };
            tradeCount++;
            totalVolume += QUANTITY * ask;
        }
    } else if (position) {
        // Kiểm tra đóng lệnh
        const profitLoss = position.type === 'buy'
          ? (bid - position.entryPrice) / position.entryPrice
          : (position.entryPrice - ask) / position.entryPrice;

        if (profitLoss >= TP_PERCENT || profitLoss <= -SL_PERCENT) {
            const closeSide = position.type === 'buy' ? 'sell' : 'buy';
            const closePrice = closeSide === 'sell' ? ask : bid;
            const result = await placeOrder(closeSide, QUANTITY, closePrice);
            if (result) {
                console.log(`${getNowFormatDate()} Đóng ${position.type}: Giá ${closePrice}, P/L: ${(profitLoss * 100).toFixed(2)}%`);
                position = null;
                tradeCount++;
                totalVolume += QUANTITY * closePrice;
            }
        }
    }

    lastPrice = currentPrice;
    console.log(`${getNowFormatDate()} Total Volume: ${totalVolume.toFixed(2)} ${quoteAsset}`);
}

// Reset tradeCount mỗi phút
setInterval(() => {
    tradeCount = 0;
}, 60 * 1000);

// Chạy bot
async function startBot() {
    console.log(`${getNowFormatDate()} Khởi động bot scalping...`);

    // Kiểm tra số dư ban đầu
    const quoteAsset = SYMBOL.split('_')[1];
    const balance = await getBalance(quoteAsset);
    console.log(`${getNowFormatDate()} Số dư ${quoteAsset}: ${balance}`);

    // Polling giá
    async function pollPrice() {
        try {
            await scalpingLogic();
        } catch (error) {
            console.error(`${getNowFormatDate()} Polling Error:`, {
                message: error.message,
                status: error.response?.status,
                data: error.response?.data,
            });
            await delay(RETRY_DELAY);
        }
        setTimeout(pollPrice, POLLING_INTERVAL);
    }

    pollPrice();

    // Log volume mỗi 5 phút
    setInterval(() => {
        console.log(`${getNowFormatDate()} Volume giao dịch (5 phút): ${totalVolume.toFixed(2)} ${quoteAsset}`);
    }, 5 * 60 * 1000);
}

startBot();
