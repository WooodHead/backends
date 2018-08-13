const grantsLib = require('../../../lib/grants')

module.exports = async (_, args, { pgdb, user }) => {
  const { campaignId, email } = args

  const transaction = await pgdb.transactionBegin()

  try {
    const result = await grantsLib.grant(user, campaignId, email, pgdb)
    await transaction.transactionCommit()

    return result
  } catch (e) {
    await transaction.transactionRollback()

    throw e
  }
}
