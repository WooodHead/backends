const debug = require('debug')('grant-memberships:lib:grants')
const moment = require('moment')

const campaignsLib = require('./campaigns')
const constraints = require('./constraints')

const isGrantable = async (grantee, membershipGrantCampaign, email, pgdb) => {
  let granted = true

  for (const constraint of membershipGrantCampaign.constraints) {
    const name = Object.keys(constraint).shift()
    const settings = constraint[name]

    if (!constraints[name]) {
      throw new Error(`Unable to evalute contraint "${name}"`)
    }

    const result = await constraints[name].isGrantable(
      { settings, grantee, email, membershipGrantCampaign },
      { pgdb }
    )

    debug('isGrantable', {
      name: membershipGrantCampaign.name,
      constraint: name,
      settings,
      result
    })

    if (!result) {
      granted = false
      break
    }
  }

  debug('granted', granted)

  return granted
}

const grant = async (grantee, campaignId, email, pgdb) => {
  const membershipGrantCampaign = await campaignsLib.findOne(campaignId, pgdb)

  console.log(membershipGrantCampaign)

  if (membershipGrantCampaign === undefined) {
    throw new Error(`membershipGrantCampaign "${campaignId}" not found`)
  }

  if (!await isGrantable(grantee, membershipGrantCampaign, email, pgdb)) {
    throw new Error('Unable to grant membership')
  }

  const membershipShare = await pgdb.public.membershipGrants.insertAndGet({
    granteeUserId: grantee.id,
    email,
    membershipGrantCampaignId: membershipGrantCampaign.id,
    beginAt: moment(),
    endAt: moment()
      .add(
        membershipGrantCampaign.intervalCount,
        membershipGrantCampaign.interval
      )
  })

  return membershipShare
}

const revoke = async (id, grantee, pgdb) => {
  const rowsAffected = await pgdb.public.membershipGrants.update(
    { id, revokedAt: null },
    { revokedAt: moment(), updatedAt: moment() }
  )

  return rowsAffected > 0
}

const findByGrantee = async (grantee, membershipGrantCampaign, pgdb) => {
  const membershipShares =
    await pgdb.public.membershipGrants.find({
      granteeUserId: grantee.id,
      membershipGrantCampaignId: membershipGrantCampaign.id,
      revokedAt: null,
      'beginAt <=': moment(),
      'endAt >': moment()
    })

  return membershipShares
}

const findByRecipient = async (recipient, pgdb) => {
  const membershipShares =
    await pgdb.public.membershipGrants.find({
      recipientUserId: recipient.id,
      revokedAt: null,
      'beginAt <=': moment(),
      'endAt >': moment()
    })

  return membershipShares
}

const findUnassigned = async (pgdb) => pgdb.public.membershipGrants.find({
  recipientUserId: null,
  'beginAt <=': moment(),
  'endAt >': moment()
})

const findRevoked = async (pgdb) => pgdb.public.membershipGrants.find({
  'recipientUserId !=': null,
  'revokedAt <': moment()
})

const setRecipient = async (grant, recipient, pgdb) => {
  const result = await pgdb.public.membershipGrants.update(
    { id: grant.id },
    { recipientUserId: recipient.id, updatedAt: moment() }
  )

  debug('setRecipient', {
    id: grant.id,
    recipientUserId: recipient.id,
    updatedAt: moment(),
    result
  })

  return result > 0
}

module.exports = {
  isGrantable,
  grant,
  revoke,
  findByGrantee,
  findByRecipient,
  findUnassigned,
  findRevoked,
  setRecipient
}
