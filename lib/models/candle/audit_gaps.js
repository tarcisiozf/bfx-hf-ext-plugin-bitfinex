'use strict'

const { TIME_FRAME_WIDTHS } = require('bfx-hf-util')
const _isFinite = require('lodash/isFinite')

// TODO: verify
module.exports = async (candleModel, doc, { start, end }) => {
  const { getInRange } = candleModel
  const gaps = []
  const { symbol, tf } = doc

  const candles = await getInRange([
    ['symbol', '=', symbol],
    ['tf', '=', tf],
  ], {
    key: 'mts',
    start,
    end,
  }, {
    orderBy: 'mts',
    orderDirection: 'desc',
  })

  if (candles.length < 2) {
    return { gaps, candles }
  }

  const width = TIME_FRAME_WIDTHS[tf]

  if (!_isFinite(width)) {
    throw new Error(`invalid time frame [unknown width]: ${tf}`)
  }

  for (let i = 0; i < candles.length - 1; i += 1) {
    if ((candles[i].mts - candles[i + 1].mts) !== width) {
      // console.log(candles[i].mts - candles[i + 1].mts)
      gaps.push(i)
    }
  }

  return { gaps, candles }
}
