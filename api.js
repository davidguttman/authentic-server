var URL = require('url')
var jsonBody = require('body/json')

var Tokens = require('./tokens')
var Users = require('./users')

var clientErrors = {
  'User Exists': 400,
  'ConfirmUrl Not Provided': 400,
  'ChangeUrl Not Provided': 400,
  'Invalid Email': 400,
  'Invalid Password': 400,
  'Token Mismatch': 401,
  'Already Confirmed': 400,
  'Password Mismatch': 401,
  'User Not Found': 401,
  'Token Expired': 400
}

var API = module.exports = function (opts) {
  if (!(this instanceof API)) return new API(opts)

  this.sendEmail = opts.sendEmail
  this.Tokens = Tokens(opts)
  this.Users = Users(opts.db)

  return this
}

API.prototype.publicKey = function (req, res, opts, cb) {
  res.end(JSON.stringify({
    success: true,
    data: {
      publicKey: this.Tokens.publicKey
    }
  }))
}

API.prototype.signup = function (req, res, opts, cb) {
  var self = this

  jsonBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var pass = userData.password
    var confirmUrl = userData.confirmUrl

    if (!confirmUrl) {
      err = new Error('ConfirmUrl Not Provided')
      err.statusCode = clientErrors[err.message] || 500
      return cb(err)
    }

    self.Users.createUser(email, pass, function (err, user) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var urlObj = URL.parse(confirmUrl, true)
      urlObj.query.confirmToken = user.data.confirmToken
      confirmUrl = URL.format(urlObj)

      var emailOpts = {
        type: 'signup',
        email: email,
        confirmUrl: confirmUrl,
        confirmToken: user.data.confirmToken
      }

      self.sendEmail(emailOpts, function (err) {
        if (err) return cb(err)

        res.writeHead(201, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({
          success: true,
          message: 'User created. Check email for confirmation link.',
          data: {
            email: user.email,
            createdDate: user.createdDate
          }
        }))
      })
    })
  })
}

API.prototype.confirm = function (req, res, opts, cb) {
  var self = this

  jsonBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var confirmToken = userData.confirmToken

    self.Users.confirmUser(email, confirmToken, function (err) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var token = self.Tokens.encode(email)
      res.writeHead(202, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({
        success: true,
        message: 'User confirmed.',
        data: {
          authToken: token
        }
      }))
    })
  })
}

API.prototype.login = function (req, res, opts, cb) {
  var self = this

  jsonBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var pass = userData.password

    self.Users.checkPassword(email, pass, function (err, user) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var token = self.Tokens.encode(email)
      res.writeHead(202, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({
        success: true,
        message: 'Login successful.',
        data: {
          authToken: token
        }
      }))
    })
  })
}

API.prototype.changePasswordRequest = function (req, res, opts, cb) {
  var self = this

  jsonBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var changeUrl = userData.changeUrl

    if (!changeUrl) {
      err = new Error('ChangeUrl Not Provided')
      err.statusCode = clientErrors[err.message] || 500
      return cb(err)
    }

    self.Users.createChangeToken(email, function (err, changeToken) {
      if (err) return cb(err)

      var urlObj = URL.parse(changeUrl, true)
      urlObj.query.changeToken = changeToken
      changeUrl = URL.format(urlObj)

      var emailOpts = {
        type: 'change-password-request',
        email: email,
        changeUrl: changeUrl,
        changeToken: changeToken
      }

      self.sendEmail(emailOpts, function (err) {
        if (err) return cb(err)

        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({
          success: true,
          message: 'Change password request received. Check email for confirmation link.'
        }))
      })
    })
  })
}

API.prototype.changePassword = function (req, res, opts, cb) {
  var self = this

  jsonBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var password = userData.password
    var changeToken = userData.changeToken

    self.Users.changePassword(email, password, changeToken, function (err, something) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      self.Users.checkPassword(email, password, function (err, user) {
        if (err) return cb(err)

        var authToken = self.Tokens.encode(email)

        res.writeHead(200, {'Content-Type': 'application/json'})
        res.end(JSON.stringify({
          success: true,
          message: 'Password changed.',
          data: {
            authToken: authToken
          }
        }))
      })
    })
  })
}
