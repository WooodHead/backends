const grantsLib = require('../../../lib/grants')

module.exports = async (_, args, { pgdb, user }) => {
  const { id } = args

  const transaction = await pgdb.transactionBegin()

  try {
    const result = await grantsLib.revoke(id, user, pgdb)
    await transaction.transactionCommit()

    return result
  } catch (e) {
    await transaction.transactionRollback()

    throw e
  }
}
