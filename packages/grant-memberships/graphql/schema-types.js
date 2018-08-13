module.exports = `

extend type User {
  """
  List of memberships a User was granted
  """
  membershipGrants: [MembershipGrant]!

  """
  List of granted memberships by User
  """
  membershipGrantCampaigns: [MembershipGrantCampaign]!
}

"""
Entity describing ability and terms of granting a membership
"""
type MembershipGrantCampaign {
  id: ID!
  name: String!,
  label: String,
  description: String,
  grants: [MembershipGrant]!
}

"""
Entity representing a future, current or passed granted membership
"""
type MembershipGrant {
  id: ID!
  "Campaign this membership grant belongs to"
  campaign: MembershipGrantCampaign!
  "User entity who granted membership"
  grantee: User!
  """
  Original recipient email address of grant.
  Is eventually matched to a User (see recipient).
  """
  email: String!
  "User entity who received granted membership"
  recipient: User
  "Beginning of sharing period"
  beginAt: DateTime!
  "Ending of sharing period"
  endAt: DateTime!
  """
  Date when grant was revoked.
  Set if grant was revoked prematurly.
  """
  revokedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

`
