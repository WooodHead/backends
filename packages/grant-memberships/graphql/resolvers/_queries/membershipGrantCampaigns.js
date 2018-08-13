const campaignsLib = require('../../../lib/campaigns')

module.exports = (_, args, { pgdb }) => campaignsLib.findAvailable(pgdb)
