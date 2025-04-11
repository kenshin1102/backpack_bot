"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

// Load environment variables from .env
require("dotenv").config();
const { BackpackClient } = require("./backpack_client");
const moment = require("moment");

// Config from .env
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const SYMBOL = process.env.SYMBOL;

// Constants
const USDC_THRESHOLD = 5;
const DELAY_MS = {
    SHORT: 3000, // 3 giây
    LONG: 10000, // 10 giây
};

// Global counters
let successfulBuys = 0;
let successfulSells = 0;

// Utility functions
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getTimestamp = () => moment().format("YYYY-MM-DD HH:mm:ss");

// Main bot logic
const runBot = async (client) => {
    try {
        console.log(`Successful Buys: ${successfulBuys}, Successful Sells: ${successfulSells}`);

        if (successfulBuys > 0 || successfulSells > 0) {
            console.log(`${getTimestamp()} Completed trades: Buys=${successfulBuys}, Sells=${successfulSells}`);
            await delay(DELAY_MS.SHORT);
        }

        // Fetch account balance
        console.log(`${getTimestamp()} Fetching account balance...`);
        const balance = await client.Balance();
        const usdcBalance = Number(balance?.USDC?.available) || 0;
        console.log(`${getTimestamp()} USDC Balance: ${usdcBalance}`);

        // Decide to buy or sell based on USDC balance
        if (usdcBalance > USDC_THRESHOLD) {
            console.log(`${getTimestamp()} Starting buy process...`);
            await executeBuy(client);
        } else {
            console.log(`${getTimestamp()} Starting sell process...`);
            await executeSell(client);
        }
    } catch (error) {
        console.error(`${getTimestamp()} Order failed: ${error.message}`);
        console.log(`${getTimestamp()} Retrying in ${DELAY_MS.SHORT / 1000} seconds...`);
        await delay(DELAY_MS.SHORT);
        await runBot(client);
    }
};

// Sell function
const executeSell = async (client) => {
    // Cancel any open orders
    const openOrders = await client.GetOpenOrders({ symbol: SYMBOL });
    if (openOrders.length > 0) {
        console.log(`${getTimestamp()} Found ${openOrders.length} open orders, cancelling in ${DELAY_MS.LONG / 1000} seconds...`);
        await delay(DELAY_MS.LONG);
        await client.CancelOpenOrders({ symbol: SYMBOL });
        console.log(`${getTimestamp()} All open orders cancelled`);
    } else {
        console.log(`${getTimestamp()} No open orders to cancel`);
    }

    // Fetch balance and price
    console.log(`${getTimestamp()} Fetching account balance and market price...`);
    const balance = await client.Balance();
    const ticker = await client.Ticker({ symbol: SYMBOL });
    const lastPrice = parseFloat(ticker.lastPrice);
    const sellPrice = (lastPrice - 0.05).toFixed(2);
    const quantity = (balance.SOL.available - 0.05).toFixed(2);

    console.log(`${getTimestamp()} Market Price: ${lastPrice}, Sell Price: ${sellPrice}, Quantity: ${quantity} SOL`);

    // Place sell order
    console.log(`${getTimestamp()} Placing sell order for ${quantity} SOL...`);
    const orderResult = await client.ExecuteOrder({
        orderType: "Limit",
        price: sellPrice,
        quantity: quantity,
        side: "Ask",
        symbol: SYMBOL,
        timeInForce: "IOC",
    });

    // Check order result
    if (orderResult?.status === "Filled" && orderResult?.side === "Ask") {
        successfulSells += 1;
        console.log(`${getTimestamp()} Sell successful! Price: ${orderResult.price}, Quantity: ${orderResult.quantity}, Order ID: ${orderResult.id}`);
        await runBot(client);
    } else {
        console.error(`${getTimestamp()} Sell failed, retrying in ${DELAY_MS.SHORT / 1000} seconds...`);
        throw new Error("Selling failed");
    }
};

// Buy function
const executeBuy = async (client) => {
    // Cancel any open orders
    const openOrders = await client.GetOpenOrders({ symbol: SYMBOL });
    if (openOrders.length > 0) {
        console.log(`${getTimestamp()} Found ${openOrders.length} open orders, cancelling in ${DELAY_MS.LONG / 1000} seconds...`);
        await delay(DELAY_MS.LONG);
        await client.CancelOpenOrders({ symbol: SYMBOL });
        console.log(`${getTimestamp()} All open orders cancelled`);
    } else {
        console.log(`${getTimestamp()} No open orders to cancel`);
    }

    // Fetch balance and price
    console.log(`${getTimestamp()} Fetching account balance and market price...`);
    const balance = await client.Balance();
    const ticker = await client.Ticker({ symbol: SYMBOL });
    const lastPrice = parseFloat(ticker.lastPrice);
    const buyPrice = (lastPrice + 0.05).toFixed(2);
    const usdcToSpend = (balance.USDC.available - 2).toFixed(2);
    const quantity = (usdcToSpend / buyPrice).toFixed(2);

    console.log(`${getTimestamp()} Market Price: ${lastPrice}, Buy Price: ${buyPrice}, USDC to Spend: ${usdcToSpend}, Quantity: ${quantity} SOL`);

    // Place buy order
    console.log(`${getTimestamp()} Placing buy order for ${quantity} SOL...`);
    const orderResult = await client.ExecuteOrder({
        orderType: "Limit",
        price: buyPrice,
        quantity: quantity,
        side: "Bid",
        symbol: SYMBOL,
        timeInForce: "IOC",
    });

    // Check order result
    if (orderResult?.status === "Filled" && orderResult?.side === "Bid") {
        successfulBuys += 1;
        console.log(`${getTimestamp()} Buy successful! Price: ${orderResult.price}, Quantity: ${orderResult.quantity}, Order ID: ${orderResult.id}`);
        await runBot(client);
    } else {
        console.error(`${getTimestamp()} Buy failed:`, orderResult);
        throw new Error("Buy failed");
    }
};

// Start the bot
(async () => {
    // Validate environment variables
    if (!API_KEY || !API_SECRET || !SYMBOL) {
        console.error("Missing required environment variables: API_KEY, API_SECRET, or SYMBOL");
        process.exit(1);
    }

    const client = new BackpackClient(API_SECRET, API_KEY);
    await runBot(client);
})();
