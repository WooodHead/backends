const grantsLib = require('../../lib/grants')
const campaignsLib = require('../../lib/campaigns')

module.exports = {
  membershipGrants: async (user, args, { pgdb }) => {
    const grants = await grantsLib.findByRecipient(user, pgdb)

    const users =
      grants.length > 0
        ? await pgdb.public.users.find({
          id: grants.map(grant => grant.granteeUserId)
            .concat(grants.map(grant => grant.recipientUserId))
        })
        : []

    return grants.map(grant => ({...grant, users}))
  },

  membershipGrantCampaigns: async (user, args, { pgdb }) => {
    const campaigns = await campaignsLib.findAvailable(pgdb)

    return campaigns.map(campaign => {
      return {...campaign, user}
    })
  }
}
