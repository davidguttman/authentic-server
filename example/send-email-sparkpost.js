var SparkPost = require('sparkpost')
var client = new SparkPost('your-api-key-here')

/**
 * SparkPost offers 100K emails/month for free
 * Sign up for your free account at https://sparkpost.com
 * For documentation and resources, see: https://developers.sparkpost.com
 *
 */

module.exports = function sendEmail (emailOpts, done) {

  var subject, html

  if (emailOpts.type === 'signup') {
    subject = 'Confirm Your Account'
    html = 'Please <a href="' + emailOpts.confirmUrl + '">confirm your account to continue</a>.'
  } else if (emailOpts.type === 'change-password-request') {
    subject = 'Password Reset'
    html = 'If you would like to reset your password <a href="' + emailOpts.changeUrl + '">you may do so here</a>.'
  } else {
    return done(new Error('Unknown email type'))
  }

  client.transmissions.send({
    transmissionBody: {
      content: {
        from: 'Authentic Accounts <authentic@your-verified-sending-domain.com>',
        subject: subject,
        html: html
      },
      recipients: [
        { address: emailOpts.email }
      ]
    }
  }, done)

}
