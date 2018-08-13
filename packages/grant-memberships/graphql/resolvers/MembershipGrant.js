const campaignsLib = require('../../lib/campaigns')

module.exports = {
  id: (membershipGrant, args, context) => {
    return membershipGrant.id
  },
  campaign: (membershipGrant, args, { pgdb }) => {
    return campaignsLib.findByGrant(membershipGrant, pgdb)
  },
  grantee: (membershipGrant, args, context) => {
    return membershipGrant.granteeUserId // find user ID
  },
  email: (membershipGrant, args, context) => {
    return membershipGrant.email
  },
  recipient: (membershipGrant, args, context) => {
    return membershipGrant.recipientUserId // find user ID
  },
  beginAt: (membershipGrant, args, context) => {
    return membershipGrant.beginAt
  },
  endAt: (membershipGrant, args, context) => {
    return membershipGrant.endAt
  },
  revokedAt: (membershipGrant, args, context) => {
    return membershipGrant.revokedAt
  },
  createdAt: (membershipGrant, args, context) => {
    return membershipGrant.createdAt
  },
  updatedAt: (membershipGrant, args, context) => {
    return membershipGrant.updatedAt
  }
}
