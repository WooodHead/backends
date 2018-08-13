const debug =
  require('debug')('grant-memberships:lib:constraints:recipientInNoSlot')

const isGrantable = async (args, context) => {
  const { email, grantee, membershipGrantCampaign } = args
  const { pgdb } = context

  const usedSlots = await pgdb.query(`
    SELECT "membershipGrants".id

    FROM "membershipGrants"

    WHERE
      "membershipGrants"."membershipGrantCampaignId" = '${membershipGrantCampaign.id}'
      AND "membershipGrants"."granteeUserId" = '${grantee.id}'
      AND "membershipGrants"."email" = '${email}'
      AND "membershipGrants"."endAt" >= NOW()
      AND "membershipGrants"."revokedAt" IS NULL
  `)

  debug({
    grantee: grantee.id,
    email,
    usedSlots
  })

  return usedSlots.length === 0
}

module.exports = {
  isGrantable
}
