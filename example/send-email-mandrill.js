const powerdrill = require('powerdrill')('your-api-key-here')

module.exports = function sendEmail (emailOpts, done) {
  const message = powerdrill()

  const to = emailOpts.email
  const from = 'Authentic Accounts <email@domain.com>'

  let subject, html
  if (emailOpts.type === 'signup') {
    subject = 'Confirm Your Account'
    html = `Please <a href="${emailOpts.confirmUrl}">confirm your account to continue</a>.`
  } else if (emailOpts.type === 'change-password-request') {
    subject = 'Password Reset'
    html = `If you would like to reset your password <a href="${emailOpts.changeUrl}">you may do so here</a>.`
  } else {
    return done(new Error('Unknown email type'))
  }

  message.to(to).from(from).subject(subject).html(html).trackClicks(false)

  message.send(done)
}
