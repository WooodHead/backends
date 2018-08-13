const debug = require('debug')('grant-memberships:lib:campaigns')
const moment = require('moment')

const findAvailable = (pgdb) => {
  debug('findAvailable')
  return pgdb.public.membershipGrantCampaigns.find({
    'beginAt <=': moment(),
    'endAt >': moment()
  })
}

const findByGrant = (grant, pgdb) => {
  debug('findByGrant')
  return pgdb.public.membershipGrantCampaigns.findOne({
    id: grant.membershipGrantCampaignId
  })
}

const findOne = (id, pgdb) => {
  debug('findOne')
  return pgdb.public.membershipGrantCampaigns.findOne({
    id,
    'beginAt <=': moment(),
    'endAt >': moment()
  })
}

module.exports = {
  findAvailable,
  findByGrant,
  findOne
}
