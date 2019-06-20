'use strict'

const debug = require('debug')('bfx:hf:ext-plugin:bitfinex:models:candle:sync-range')
const PI = require('p-iteration')
const Promise = require('bluebird')
const { RESTv2 } = require('bfx-api-node-rest')
const PromiseThrottle = require('promise-throttle')
const { TIME_FRAME_WIDTHS, preprocessRemoteCandles } = require('bfx-hf-util')

const FETCH_LIMIT = 1000
const rest = new RESTv2({ transform: true })
const pt = new PromiseThrottle({
  requestsPerSecond: 10.0 / 60.0, // taken from docs
  promiseImplementation: Promise
})

module.exports = async (candleModel, {
  exchange, type, symbol, tf
} = {}, { start, end }) => {
  const { getInRange, auditGaps, bulkInsert } = candleModel

  const existingCandles = await getInRange([
    ['exchange', '=', exchange],
    ['symbol', '=', symbol],
    ['tf', '=', tf],
  ], {
    key: 'mts',
    start,
    end,
  })

  const boundsToSync = []

  // sync entire range
  if (existingCandles.length === 0) {
    boundsToSync.push({ start, end })
  } else if (existingCandles.length >= 2 && (
    existingCandles[0].mts === end && _last(existingCandles).mts === start
  )) {
    debug(
      'all candles present (%s -> %s)',
      new Date(start).toLocaleString(),
      new Date(end).toLocaleString()
    )

    return Promise.resolve()
  } else { // sync to fill gaps
    const gapData = await auditGaps({ type, symbol, tf }, { start, end })
    const { gaps } = gapData

    // fill in gaps
    const width = TIME_FRAME_WIDTHS[tf]

    gaps.forEach(gapIndex => (
      boundsToSync.push({ // note candles are descending by mts
        // add half/take-away half of the candle width to make sure we don't
        // download the start/end candle that we already have locally

        // also to download a single candle you can't have the same start/end
        // time; otherwise we get a 400 error
        start: gapData.candles[gapIndex + 1].mts + (width / 2),
        end: gapData.candles[gapIndex].mts - (width / 2)
      })
    ))
  }

  if (boundsToSync.length === 0) {
    debug(
      'all candles present (%s -> %s)',
      new Date(start).toLocaleString(),
      new Date(end).toLocaleString()
    )

    return Promise.resolve()
  }

  debug('-- syncing ranges')
  debug(
    boundsToSync
      .map(({ start, end }) => `${start}-${end}`)
      .join('\n')
  )
  debug('--')

  return PI.mapSeries(boundsToSync, async ({ start, end }) => (
    pt.add(
      rest.candles.bind(rest, {
        timeframe: tf,
        symbol,
        query: {
          limit: FETCH_LIMIT,
          sort: 1,
          start,
          end
        }
      })
    )
  )).then(candleSets => {
    debug('fetched data, processing & saving...')

    return PI.forEachSeries(candleSets, async (candles) => {
      const consistent = preprocessRemoteCandles(tf, candles, true)

      debug('saving %d candles', consistent.length)

      return bulkInsert(consistent.map(c => ({
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        vol: c.volume,
        mts: c.mts,

        exchange,
        symbol,
        // type,
        tf
      })))
    })
  })
}
