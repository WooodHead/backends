const debug =
  require('debug')('grant-memberships:lib:constraints:granteeHasFreeSlot')

const isGrantable = async (args, context) => {
  const { settings, grantee, membershipGrantCampaign } = args
  const { pgdb } = context

  const slots = settings.slots

  const usedSlots = await pgdb.query(`
    SELECT "membershipGrants".id

    FROM "membershipGrants"

    WHERE
      "membershipGrants"."membershipGrantCampaignId" = '${membershipGrantCampaign.id}'
      AND "membershipGrants"."granteeUserId" = '${grantee.id}'
      AND "membershipGrants"."endAt" >= NOW()
      AND "membershipGrants"."revokedAt" IS NULL
  `)

  debug({
    grantee: grantee.id,
    slots,
    usedSlots
  })

  return usedSlots.length < slots
}

module.exports = {
  isGrantable
}
