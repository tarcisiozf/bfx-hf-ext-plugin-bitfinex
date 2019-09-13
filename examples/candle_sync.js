'use strict'

process.env.DEBUG = '*'

const debug = require('debug')('bfx:hf:ext-plugin:bitfinex:examples:candle-sync')
const HFDBLowDBAdapter = require('bfx-hf-models-adapter-lowdb')
const { schema: HFDBBitfinexSchema } = require('..')
const HFDB = require('bfx-hf-models')

const DB_PATH = `${__dirname}/../db/example.json`
const SYMBOL = 'tBTCUSD'
const TIME_FRAME = '1m'
const END_MTS = Date.now()
const START_MTS = Date.now() - (60 * 60 * 1000)

const db = new HFDB({
  schema: HFDBBitfinexSchema,
  adapter: HFDBLowDBAdapter({
    dbPath: DB_PATH,
    schema: HFDBBitfinexSchema
  })
})

const run = async () => {
  debug(
    'syncing bitfinex candles in range %s -> %s',
    new Date(START_MTS).toLocaleString(), new Date(END_MTS).toLocaleString()
  )

  const { Candle } = db

  await Candle.syncRange({
    exchange: 'bitfinex',
    type: 'trade',
    symbol: SYMBOL,
    tf: TIME_FRAME,
  }, {
    start: START_MTS,
    end: END_MTS,
  })

  debug('sync complete')

  const bitfinexCandles = await Candle.getInRange([
    ['exchange', '=', 'bitfinex'],
    ['symbol', '=', SYMBOL],
    ['tf', '=', TIME_FRAME]
  ], {
    key: 'mts',
    start: START_MTS,
    end: END_MTS
  })

  debug('loaded %d synced candles', bitfinexCandles.length)
}

try {
  run()
} catch (e) {
  debug('error: %s', e.stack)
}
