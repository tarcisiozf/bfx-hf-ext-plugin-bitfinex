const syncTradesRange = require('./lib/models/trade/sync_range')
const tradeSchema = require('./lib/models/trade/schema')

module.exports = {
  models: {
    trade: {
      schema: tradeSchema,
      syncRange: syncTradesRange,
    },
  },
}
