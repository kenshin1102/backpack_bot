"use strict";
Object.defineProperty(exports, "__esModule", {value: true});
const backpack_client_1 = require("./backpack_client");

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

//当前年份日期时分秒
function getNowFormatDate() {
    var date = new Date();
    var seperator1 = "-";
    var seperator2 = ":";
    var month = date.getMonth() + 1;
    var strDate = date.getDate();
    var strHour = date.getHours();
    var strMinute = date.getMinutes();
    var strSecond = date.getSeconds();
    if (month >= 1 && month <= 9) {
        month = "0" + month;
    }
    if (strDate >= 0 && strDate <= 9) {
        strDate = "0" + strDate;
    }
    if (strHour >= 0 && strHour <= 9) {
        strHour = "0" + strHour;
    }
    if (strMinute >= 0 && strMinute <= 9) {
        strMinute = "0" + strMinute;
    }
    if (strSecond >= 0 && strSecond <= 9) {
        strSecond = "0" + strSecond;
    }
    return date.getFullYear() + seperator1 + month + seperator1 + strDate
        + " " + strHour + seperator2 + strMinute
        + seperator2 + strSecond;
}

let successbuy = 0;
let sellbuy = 0;

const init = async (client) => {
    try {
        console.log(`Number of successful purchases: ${successbuy}, Number of successful sales: ${sellbuy}`);
        if (successbuy !== 0 || sellbuy !== 0) {
            // console.log(getNowFormatDate(), `success buy = ${successbuy}, sellbuy = ${sellbuy}`);
            console.log(`By success, End bot`);
            return;
            await delay(3000);
        }

        console.log(getNowFormatDate(), "Retrieving account information...");
        let userbalance = await client.Balance();
        console.log('userbalance =' + userbalance)
        //Determine whether the account USDC balance is greater than 5
        if (userbalance?.USDC?.available > 5) {
            console.log('start buy ....')
            await buyfun(client);
        } else {
            console.log('start sell ....')
            await sellfun(client);
        }
    } catch (e) {
        console.log(getNowFormatDate(), "The pending order failed, the order is being placed again end script ....");
        console.log(getNowFormatDate(), "wait 10 seconds...");
        await delay(3000);
        await init(client)
    }
}


const sellfun = async (client) => {
    //Cancel all outstanding orders
    let GetOpenOrders = await client.GetOpenOrders({symbol: "SOL_USDC"});
    if (GetOpenOrders.length > 0) {
        console.log(getNowFormatDate(), "wait 10 seconds before cancel order ...");
        await delay(10000);
        await client.CancelOpenOrders({symbol: "SOL_USDC"});
        console.log(getNowFormatDate(), "All pending orders canceled");
    } else {
        console.log(getNowFormatDate(), "The account order is normal and there is no need to cancel the pending order.");
    }
    console.log(getNowFormatDate(), "Retrieving account information...");
    //Get account information
    let userbalance2 = await client.Balance();
    console.log(getNowFormatDate(), "account information:", userbalance2);
    console.log(getNowFormatDate(), "Getting the current market price of sol_usdc...");
    //Get current
    let {lastPrice: lastPriceask} = await client.Ticker({symbol: "SOL_USDC"});
    const askSellPrice = (lastPriceask - 0.01).toFixed(2);
    console.log(getNowFormatDate(), "Current market price of sol_usdc:", lastPriceask);
    console.log(getNowFormatDate(), "askSellPrice of sol_usdc:", askSellPrice);
    let quantitys = (userbalance2.SOL.available - 0.05).toFixed(2).toString();
    console.log(getNowFormatDate(), `Selling... ${quantitys}个SOL`);

    let orderResultAsk = await client.ExecuteOrder({
        orderType: "Limit",
        price: askSellPrice.toString(),
        quantity: quantitys,
        side: "Ask",
        symbol: "SOL_USDC",
        timeInForce: "IOC"
    })

    if (orderResultAsk?.status === "Filled" && orderResultAsk?.side === "Ask") {
        console.log(getNowFormatDate(), "Sold successfully");
        sellbuy += 1;
        console.log(getNowFormatDate(), "order details:", `selling price:${orderResultAsk.price}, Sell quantity:${orderResultAsk.quantity}, order number:${orderResultAsk.id}`);
        await init(client);
    } else {
        console.log(getNowFormatDate(), "Selling failed");
        throw new Error("Selling failed");
    }
}

const buyfun = async (client) => {
    //Cancel all outstanding orders
    let GetOpenOrders = await client.GetOpenOrders({symbol: "SOL_USDC"});
    if (GetOpenOrders.length > 0) {
        await delay(10000);
        await client.CancelOpenOrders({symbol: "SOL_USDC"});
        console.log(getNowFormatDate(), "All pending orders canceled");
    } else {
        console.log(getNowFormatDate(), "The account order is normal and there is no need to cancel the pending order.");
    }
    console.log(getNowFormatDate(), "Retrieving account information...");
    //获取账户信息
    let userbalance = await client.Balance();
    console.log(getNowFormatDate(), "account information:", userbalance);
    console.log(getNowFormatDate(), "Getting the current market price of sol_usdc...");
    //获取当前
    let {lastPrice} = await client.Ticker({symbol: "SOL_USDC"});
    const askBuyPrice = (lastPrice + 0.01).toFixed(2);
    console.log(getNowFormatDate(), "Current market price of sol_usdc:", lastPrice);
    console.log(getNowFormatDate(), "askBuyPrice sol_usdc:", askBuyPrice);
    console.log(getNowFormatDate(), `Buying now... ${(userbalance.USDC.available - 2).toFixed(2).toString()}, Buy SOL with USDC`);
    let quantitys = ((userbalance.USDC.available - 2) / askBuyPrice).toFixed(2).toString();
    console.log("quantitys = ", quantitys);
    let orderResultBid = await client.ExecuteOrder({
        orderType: "Limit",
        price: askBuyPrice.toString(),
        quantity: quantitys,
        side: "Bid",
        symbol: "SOL_USDC",
        timeInForce: "IOC"
    })
    if (orderResultBid?.status === "Filled" && orderResultBid?.side === "Bid") {
        console.log(getNowFormatDate(), "successfully ordered");
        successbuy += 1;
        console.log(getNowFormatDate(), "successfully ordered:", `price:${orderResultBid.price}, Purchase quantity:${orderResultBid.quantity}, order number:${orderResultBid.id}`);
        await init(client);
    } else {
        console.log(getNowFormatDate(), "Order failed");
        throw new Error("Buy failed");
    }
}

(async () => {

    const client = new backpack_client_1.BackpackClient(apisecret, apikey);
    await init(client);
})()
