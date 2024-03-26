var jwt = require('jsonwebtoken')

var Tokens = (module.exports = function (opts) {
  if (!(this instanceof Tokens)) return new Tokens(opts)

  this.publicKey = opts.publicKey.toString()
  this.privateKey = opts.privateKey.toString()
  this.expiresIn = opts.expiresIn || '30d'

  return this
})

Tokens.prototype.encode = function (email) {
  var payload = { email: email }
  var token = jwt.sign(payload, this.privateKey, {
    algorithm: 'RS256',
    expiresIn: this.expiresIn
  })
  return token
}

Tokens.prototype.decode = function (token, cb) {
  jwt.verify(token, this.publicKey, { algorithms: ['RS256'] }, cb)
}
