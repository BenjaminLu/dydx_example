import dotenv from 'dotenv'
import {
  DydxClient,
  ApiKeyCredentials,
  ApiOrder,
  Market,
  OrderSide,
  OrderType,
  TimeInForce
} from '@dydxprotocol/v3-client'
import Web3 from 'web3'
import WebSocket from 'ws'
dotenv.config()

const HTTP_HOST = 'https://api.dydx.exchange'
const WS_HOST = 'wss://api.dydx.exchange/v3/ws'

// NOTE: Set up web3 however your prefer to authenticate to your Ethereum account
const privateKey = process.env.ETHEREUM_PRIVATE_KEY as string
const starkPrivateKey = process.env.STARK_PRIVATE_KEY as string
const web3 = new Web3()
web3.eth.accounts.wallet.add(privateKey)
const wallet = web3.eth.accounts.wallet
console.log(wallet)
console.log(wallet[0].privateKey)
console.log(wallet[0].address)
const address = wallet[0].address

const buildAccountWs = async (
  apiKeyCredentials: ApiKeyCredentials,
  timestamp: string,
  signature: string) => {
  const msg = {
    type: 'subscribe',
    channel: 'v3_accounts',
    accountNumber: '0',
    apiKey: apiKeyCredentials.key,
    signature,
    timestamp,
    passphrase: apiKeyCredentials.passphrase
  }
  const ws = new WebSocket(WS_HOST)
  ws.on('message', (message: any) => {
    const msg = JSON.parse(Buffer.from(message).toString())
    console.log(msg)
    switch (msg.channel) {
      case 'v3_orderbook':
        const pair = msg.id
        console.log(pair)
        const quotes = msg.contents
        console.log(quotes)
        const bids = quotes.bids
        const asks = quotes.asks
        console.log(JSON.stringify(bids))
        console.log(JSON.stringify(asks))
        break;
      default:
        console.log('<', msg)
    }
  })

  ws.on('open', () => {
    console.log('>', msg)
    ws.send(JSON.stringify(msg))
  })

  ws.on('error', (error) => {
    console.log('<', error)
  })

  ws.on('close', () => {
    console.log('Connection closed')
  })
}

const buildOrderBookWs = async () => {
  const subscribeOrderBookMsg = {
    type: 'subscribe',
    channel: 'v3_orderbook',
    id: 'BTC-USD'
  }
  const wsOrderBook = new WebSocket(WS_HOST)
  wsOrderBook.on('message', (message: any) => {
    const msg = JSON.parse(Buffer.from(message).toString())
    console.log(msg)
    switch (msg.channel) {
      case 'v3_orderbook':
        const pair = msg.id
        console.log(pair)
        const quotes = msg.contents
        console.log(quotes)
        const bids = quotes.bids
        const asks = quotes.asks
        console.log(JSON.stringify(bids))
        console.log(JSON.stringify(asks))
        break;
      default:
        console.log('<', msg)
    }
  })

  wsOrderBook.on('open', () => {
    console.log('>', subscribeOrderBookMsg)
    wsOrderBook.send(JSON.stringify(subscribeOrderBookMsg))
  })

  wsOrderBook.on('error', (error) => {
    console.log('<', error)
  })

  wsOrderBook.on('close', () => {
    console.log('Connection closed')
  })
}

const createOrder = async (
  client: DydxClient,
  positionId: string,
) => {
  // @ts-ignore
  const order: ApiOrder = {
    market: Market.BTC_USD,
    side: OrderSide.BUY,
    type: OrderType.LIMIT,
    size: '0.001', // in BTC
    price: '10000',
    postOnly: true,
    limitFee: '0.00100',
    timeInForce: TimeInForce.GTT,
    expiration: new Date('2022-01-01').toISOString()
  }
  // @ts-ignore
  const stopLossOrder: ApiOrder = {
    market: Market.BTC_USD,
    side: OrderSide.SELL,
    type: OrderType.STOP_LIMIT,
    size: '0.001', // in BTC
    triggerPrice: '9700',
    price: '9650',
    postOnly: false,
    limitFee: '0.00100',
    timeInForce: TimeInForce.GTT,
    expiration: new Date('2022-01-01').toISOString()
  }
  try {
    const createResult = await client.private.createOrder(order, positionId)
    const createStopLossResult = await client.private.createOrder(stopLossOrder, positionId)
    console.log(createResult)
    console.log(createStopLossResult)
  } catch (e) {
    console.error(e)
  }
}

const main = async () => {
  try {
    let client = new DydxClient(HTTP_HOST, { web3 })
    const starkKey = await client.onboarding.deriveStarkKey(address)
    console.log(starkKey)
    client = new DydxClient(HTTP_HOST, {
      web3,
      starkPrivateKey: starkKey.privateKey
    })
    const apiCreds: ApiKeyCredentials = await client.onboarding.recoverDefaultApiCredentials(address)
    console.log(apiCreds)
    client.apiKeyCredentials = apiCreds
    // const user = await client.onboarding.createUser({
    //     starkKey: starkKey.publicKey,
    //     starkKeyYCoordinate: starkKey.publicKeyYCoordinate,
    //   }, address)
    // console.log(user)
    const markets = await client.public.getMarkets()
    console.log(markets)
    const user = await client.private.getUser()
    console.log(user)
    const accountResp = await client.private.getAccount(address)
    console.log(accountResp.account)
    const positionId = accountResp.account.positionId
    const timestamp = new Date().toISOString()
    const signature = client.private.sign({
      requestPath: '/ws/accounts',
      // @ts-ignore
      method: 'GET',
      isoTimestamp: timestamp,
    })

    // cancel orders
    const ordersResp = await client.private.getOrders()
    console.log(ordersResp.orders)
    const cancelResult = await client.private.cancelAllOrders()
    console.log(cancelResult)

    buildAccountWs(apiCreds, timestamp, signature)
    // buildOrderBookWs()
    createOrder(client, positionId)
  } catch (e) {
    console.error(e)
  }
}

main().catch(console.error)