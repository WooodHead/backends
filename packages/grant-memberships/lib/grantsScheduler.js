const cron = require('cron')
const debug = require('debug')('grant-memberships:lib:grantsScheduler')

const PgDb = require('@orbiting/backend-modules-base/lib/pgdb')

const grantsLib = require('./grants')

const init = async () => {
  debug('init')

  const pgdb = await PgDb.connect()

  const run = async () => {
    debug('run')

    const ping = await pgdb.query('SELECT \'Ping?\'')
    debug('run', 'result', ping)

    const unassigned = await grantsLib.findUnassigned(pgdb)
    debug('run', 'unassigned', unassigned)

    for (const grant of unassigned) {
      const user = await pgdb.public.users.findOne({ email: grant.email })

      if (user) {
        await grantsLib.setRecipient(grant, user, pgdb)
      }
    }

    /*
    const revoked = await grantsLib.findRevoked(pgdb)
    debug('run', 'revoked', revoked)
    */

    // find expired, unrevoked grants
    // find revoked grants
    // find new grants -> OK
  }

  const job = new cron.CronJob({
    cronTime: '*/2 * * * * *',
    onTick: run,
    start: true
  })

  debug('job', job)
}

module.exports = {
  init
}
