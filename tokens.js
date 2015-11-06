var jwt = require('jsonwebtoken')

var expireTime = '30d'

module.exports = function (opts) {
  var secretPublic = opts.publicKey
  var secretPrivate = opts.privateKey

  return {
    encode: function (email) {
      var payload = {email: email, expiresIn: expireTime}
      var token = jwt.sign(payload, secretPrivate, {algorithm: 'RS256'})
      return token
    },

    decode: function (token, cb) {
      jwt.verify(token, secretPublic, {algorithms: ['RS256']}, cb)
    },

    publicKey: secretPublic.toString()
  }
}
