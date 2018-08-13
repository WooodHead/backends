const grantsLib = require('../../lib/grants')

module.exports = {
  id: (membershipGrantCampaign, args, context) => {
    return membershipGrantCampaign.id
  },
  name: (membershipGrantCampaign, args, context) => {
    return membershipGrantCampaign.name
  },
  label: (membershipGrantCampaign, args, { t }) => {
    return t(membershipGrantCampaign.name)
  },
  description: (membershipGrantCampaign, args, { t }) => {
    return t(membershipGrantCampaign.name)
  },
  grants: async (membershipGrantCampaign, args, { pgdb, user }) => {
    const grantee = membershipGrantCampaign.user
      ? membershipGrantCampaign.user
      : user // Use "me" user ID

    const grants =
      await grantsLib.findByGrantee(grantee, membershipGrantCampaign, pgdb)

    return grants
  }
}
