var URL = require('url')
var jsonBody = require('body/json')
const { OAuth2Client } = require('google-auth-library')

var Tokens = require('./tokens')
var Users = require('./users')

var clientErrors = {
  'User Exists': 400,
  'ConfirmUrl Not Provided': 400,
  'ChangeUrl Not Provided': 400,
  'Invalid Email': 400,
  'Invalid Password': 400,
  'User Not Confirmed': 401,
  'Token Mismatch': 401,
  'Already Confirmed': 400,
  'Password Mismatch': 401,
  'User Not Found': 401,
  'Token Expired': 400
}

var API = (module.exports = function (opts) {
  if (!(this instanceof API)) return new API(opts)

  this.sendEmail = opts.sendEmail
  this.Tokens = Tokens(opts)
  this.Users = Users(opts.db)

  var googleClientId = opts.googleClientId
  var googleClientSecret = opts.googleClientSecret
  var googleRedirectUrl = opts.googleRedirectUrl
  var shouldGoogle = googleClientId && googleClientSecret && googleRedirectUrl

  if (shouldGoogle) {
    this.googleClient = new OAuth2Client(
      googleClientId,
      googleClientSecret,
      googleRedirectUrl
    )
  }

  return this
})

API.prototype.publicKey = function (req, res, opts, cb) {
  res.end(
    JSON.stringify({
      success: true,
      data: {
        publicKey: this.Tokens.publicKey
      }
    })
  )
}

API.prototype.signup = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var pass = userData.password
    var confirmUrl = userData.confirmUrl

    self.Users.createUser(email, pass, function (err, user) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      if (confirmUrl) {
        var urlObj = URL.parse(confirmUrl, true)
        urlObj.query.confirmToken = user.data.confirmToken
        urlObj.query.email = email
        confirmUrl = URL.format(urlObj)
      }

      var emailOpts = {}
      Object.keys(userData).forEach(function (k) {
        if (k !== 'password') emailOpts[k] = userData[k]
      })

      emailOpts.type = 'signup'
      emailOpts.email = email
      emailOpts.confirmUrl = confirmUrl
      emailOpts.confirmToken = user.data.confirmToken

      self.sendEmail(emailOpts, function (err) {
        if (err) return cb(err)

        res.writeHead(201, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            message: 'User created. Check email for confirmation link.',
            data: {
              email: user.email,
              createdDate: user.createdDate
            }
          })
        )
      })
    })
  })
}

API.prototype.confirm = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var confirmToken = userData.confirmToken

    self.Users.confirmUser(email, confirmToken, function (err) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var token = self.Tokens.encode(email)
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'User confirmed.',
          data: {
            authToken: token
          }
        })
      )
    })
  })
}

API.prototype.login = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var pass = userData.password

    self.Users.checkPassword(email, pass, function (err, user) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var isConfirmed = (user.data || {}).emailConfirmed
      if (!isConfirmed) {
        err = new Error('User Not Confirmed')
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var token = self.Tokens.encode(email)
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'Login successful.',
          data: {
            authToken: token
          }
        })
      )
    })
  })
}

API.prototype.changePasswordRequest = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var changeUrl = userData.changeUrl

    self.Users.createChangeToken(email, function (err, changeToken) {
      if (err) return cb(err)

      if (changeUrl) {
        var urlObj = URL.parse(changeUrl, true)
        urlObj.query.changeToken = changeToken
        urlObj.query.email = email
        changeUrl = URL.format(urlObj)
      }

      var emailOpts = {}
      Object.keys(userData).forEach(function (k) {
        emailOpts[k] = userData[k]
      })

      emailOpts.type = 'change-password-request'
      emailOpts.email = email
      emailOpts.changeUrl = changeUrl
      emailOpts.changeToken = changeToken

      self.sendEmail(emailOpts, function (err) {
        if (err) return cb(err)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            message:
              'Change password request received. Check email for confirmation link.'
          })
        )
      })
    })
  })
}

API.prototype.changePassword = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var password = userData.password
    var changeToken = userData.changeToken

    self.Users.changePassword(
      email,
      password,
      changeToken,
      function (err, something) {
        if (err) {
          err.statusCode = clientErrors[err.message] || 500
          return cb(err)
        }

        self.Users.checkPassword(email, password, function (err, user) {
          if (err) return cb(err)

          var authToken = self.Tokens.encode(email)

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              success: true,
              message: 'Password changed.',
              data: {
                authToken: authToken
              }
            })
          )
        })
      }
    )
  })
}

API.prototype.magicRequest = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var magicUrl = userData.magicUrl

    self.Users.createMagicToken(email, function (err, magicToken) {
      if (err) return cb(err)

      if (magicUrl) {
        var urlObj = URL.parse(magicUrl, true)
        urlObj.query.magicToken = magicToken
        urlObj.query.email = email
        magicUrl = URL.format(urlObj)
      }

      var emailOpts = {}
      Object.keys(userData).forEach(function (k) {
        emailOpts[k] = userData[k]
      })

      emailOpts.type = 'magic-request'
      emailOpts.email = email
      emailOpts.magicUrl = magicUrl
      emailOpts.magicToken = magicToken

      self.sendEmail(emailOpts, function (err) {
        if (err) return cb(err)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            message:
              'Magic login request received. Check email for confirmation link.'
          })
        )
      })
    })
  })
}

API.prototype.magicLogin = function (req, res, opts, cb) {
  var self = this

  parseBody(req, res, function (err, userData) {
    if (err) return cb(err)

    var email = userData.email
    var magicToken = userData.magicToken

    self.Users.checkMagicToken(email, magicToken, function (err, user) {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      var authToken = self.Tokens.encode(email)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'Magic login successful.',
          data: {
            authToken: authToken
          }
        })
      )
    })
  })
}

API.prototype.googleAuth = function (req, res, opts, cb) {
  var reqUrl = URL.parse(req.url, true)

  var redirectUrl = reqUrl.query.redirectUrl
  var redirectParam = reqUrl.query.redirectParam || 'jwt'

  if (!redirectUrl) {
    return cb(new Error('redirectUrl is required'))
  }

  var scopes = ['https://www.googleapis.com/auth/userinfo.email']

  var authUrl = this.googleClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'select_account',
    scope: scopes
  })

  res.writeHead(302, {
    Location: authUrl,
    'Set-Cookie': [
      `redirectUrl=${redirectUrl}; Path=/; HttpOnly; SameSite=Lax`,
      `redirectParam=${redirectParam}; Path=/; HttpOnly; SameSite=Lax`
    ]
  })

  res.end()
}

API.prototype.googleCallback = function (req, res, opts, cb) {
  const googleClient = this.googleClient
  const cookies = parseCookies(req)
  const redirectUrl = cookies.redirectUrl
  const redirectParam = cookies.redirectParam

  var reqUrl = URL.parse(req.url, true)
  var { code } = reqUrl.query
  googleClient
    .getToken(code)
    .catch(cb)
    .then(({ tokens }) => {
      googleClient.setCredentials({ tokens })
      googleClient
        .getTokenInfo(tokens.access_token)
        .catch(cb)
        .then(userInfo => {
          var authToken = this.Tokens.encode(userInfo.email)

          const destUrl = URL.parse(redirectUrl, true)
          destUrl.query[redirectParam] = authToken
          const destinationUrl = URL.format(destUrl)

          res.writeHead(302, { Location: destinationUrl })
          res.end()
        })
    })
}

function parseBody (req, res, cb) {
  jsonBody(req, res, function (err, parsed) {
    if (typeof (parsed || {}).email === 'string') {
      parsed.email = parsed.email.toLowerCase()
    }
    cb(err, parsed)
  })
}

function parseCookies (request) {
  const list = {}
  const cookieHeader = request.headers.cookie

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=')
      list[parts.shift().trim()] = decodeURI(parts.join('='))
    })
  }

  return list
}
