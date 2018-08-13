const debug =
  require('debug')('grant-memberships:lib:constraints:granteeHasValidMembership')

const isGrantable = async (args, context) => {
  const { settings, grantee } = args
  const { pgdb } = context

  const packages = settings.packages.map(pkg => `'${pkg}'`).join(', ')

  const activeMemberships = await pgdb.query(`
    SELECT memberships.id, packages.name
    FROM memberships

    INNER JOIN "membershipPeriods"
      ON memberships.id = "membershipPeriods"."membershipId"

    INNER JOIN pledges
      ON memberships."pledgeId" = pledges.id

    INNER JOIN packages
      ON pledges."packageId" = packages.id

    WHERE
      memberships."userId" = '${grantee.id}'
      AND packages.name IN (${packages})
      AND "beginDate" <= NOW()
      AND "endDate" > NOW()
  `)

  debug({
    grantee: grantee.id,
    packages,
    activeMemberships
  })

  return activeMemberships.length > 0
}

module.exports = {
  isGrantable
}
