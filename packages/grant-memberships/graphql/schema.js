module.exports = `

schema {
  query: queries
  mutation: mutations
}

type queries {
  """
  A list of granting campaings.
  (Subject to removal)
  """
  membershipGrantCampaigns: [MembershipGrantCampaign]!
}

type mutations {
  """
  Grant a membership
  """
  grantMembershipGrant(
    "An ID of an existing MembershipGrantCampaign"
    campaignId: ID!,
    "Recipient of a membership should be granted to"
    email: String!
  ): MembershipGrant!

  """
  Revoke a granted membership
  """
  revokeMembershipGrant(id: ID!): Boolean!
}

`
