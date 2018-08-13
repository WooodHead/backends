const debug = require('debug')('grant-memberships:lib:emails')

const sendRecipientOnboarding = async () => {
  debug('sendRecipientOnboarding')
}

const sendGranteeConfirmation = async () => {
  debug('sendRecipientOnboarding')
}

const sendRecipientExpirationNotice = async () => {
  debug('sendRecipientExpirationNotice')
}

const sendRecipientOffboarding = async () => {
  debug('sendRecipientOffboarding')
}

module.exports = {
  // Recipient
  sendRecipientOnboarding,
  sendGranteeConfirmation,

  //
  sendRecipientExpirationNotice,
  sendRecipientOffboarding
}
