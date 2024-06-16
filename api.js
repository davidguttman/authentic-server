const jsonBody = require('body/json')
const URL = require('@dguttman/node-url')
const { OAuth2Client } = require('google-auth-library')

const Tokens = require('./tokens')
const Users = require('./users')

const clientErrors = {
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

module.exports = API

API.prototype.publicKey = publicKey
API.prototype.signup = signup
API.prototype.confirm = confirm
API.prototype.login = login
API.prototype.changePasswordRequest = changePasswordRequest
API.prototype.changePassword = changePassword
API.prototype.magicRequest = magicRequest
API.prototype.magicLogin = magicLogin
API.prototype.googleAuth = googleAuth
API.prototype.googleCallback = googleCallback

function API (opts) {
  if (!(this instanceof API)) return new API(opts)

  this.sendEmail = opts.sendEmail
  this.Tokens = Tokens(opts)
  this.Users = Users(opts.db)

  const { googleClientId, googleClientSecret, googleRedirectUrl } = opts
  const shouldGoogle = googleClientId && googleClientSecret && googleRedirectUrl

  if (shouldGoogle) {
    this.googleClient = new OAuth2Client(
      googleClientId,
      googleClientSecret,
      googleRedirectUrl
    )
  }
}

function publicKey (req, res, opts, cb) {
  res.end(
    JSON.stringify({
      success: true,
      data: {
        publicKey: this.Tokens.publicKey
      }
    })
  )
}

function signup (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, password: pass, confirmUrl } = userData

    this.Users.createUser(email, pass, (err, user) => {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      let formattedConfirmUrl = confirmUrl
      if (confirmUrl) {
        const urlObj = URL.parse(confirmUrl, true)
        urlObj.query.confirmToken = user.data.confirmToken
        urlObj.query.email = email
        formattedConfirmUrl = URL.format(urlObj)
      }

      const emailOpts = {
        ...userData,
        type: 'signup',
        email,
        confirmUrl: formattedConfirmUrl,
        confirmToken: user.data.confirmToken
      }
      delete emailOpts.password

      this.sendEmail(emailOpts, err => {
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

function confirm (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, confirmToken } = userData

    this.Users.confirmUser(email, confirmToken, err => {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      const token = this.Tokens.encode(email)
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

function login (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, password: pass } = userData

    this.Users.checkPassword(email, pass, (err, user) => {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      const isConfirmed = (user.data || {}).emailConfirmed
      if (!isConfirmed) {
        err = new Error('User Not Confirmed')
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      const token = this.Tokens.encode(email)
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

function changePasswordRequest (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, changeUrl } = userData

    this.Users.createChangeToken(email, (err, changeToken) => {
      if (err) return cb(err)

      let formattedChangeUrl = changeUrl
      if (changeUrl) {
        const urlObj = URL.parse(changeUrl, true)
        urlObj.query.changeToken = changeToken
        urlObj.query.email = email
        formattedChangeUrl = URL.format(urlObj)
      }

      const emailOpts = {
        ...userData,
        type: 'change-password-request',
        email,
        changeUrl: formattedChangeUrl,
        changeToken
      }

      this.sendEmail(emailOpts, err => {
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

function changePassword (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, password, changeToken } = userData

    this.Users.changePassword(email, password, changeToken, err => {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      this.Users.checkPassword(email, password, (err, user) => {
        if (err) return cb(err)

        const authToken = this.Tokens.encode(email)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            success: true,
            message: 'Password changed.',
            data: {
              authToken
            }
          })
        )
      })
    })
  })
}

function magicRequest (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, magicUrl } = userData

    this.Users.createMagicToken(email, (err, magicToken) => {
      if (err) return cb(err)

      let formattedMagicUrl = magicUrl
      if (magicUrl) {
        const urlObj = URL.parse(magicUrl, true)
        urlObj.query.magicToken = magicToken
        urlObj.query.email = email
        formattedMagicUrl = URL.format(urlObj)
      }

      const emailOpts = {
        ...userData,
        type: 'magic-request',
        email,
        magicUrl: formattedMagicUrl,
        magicToken
      }

      this.sendEmail(emailOpts, err => {
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

function magicLogin (req, res, opts, cb) {
  parseBody(req, res, (err, userData) => {
    if (err) return cb(err)

    const { email, magicToken } = userData

    this.Users.checkMagicToken(email, magicToken, (err, user) => {
      if (err) {
        err.statusCode = clientErrors[err.message] || 500
        return cb(err)
      }

      const authToken = this.Tokens.encode(email)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          success: true,
          message: 'Magic login successful.',
          data: {
            authToken
          }
        })
      )
    })
  })
}

function googleAuth (req, res, opts, cb) {
  const reqUrl = URL.parse(req.url, true)

  const { redirectUrl, redirectParam = 'jwt' } = reqUrl.query

  if (!redirectUrl) {
    return cb(new Error('redirectUrl is required'))
  }

  const scopes = ['https://www.googleapis.com/auth/userinfo.email']

  const authUrl = this.googleClient.generateAuthUrl({
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

function googleCallback (req, res, opts, cb) {
  const googleClient = this.googleClient
  const cookies = parseCookies(req)
  const { redirectUrl, redirectParam } = cookies

  const reqUrl = URL.parse(req.url, true)
  const { code } = reqUrl.query
  googleClient
    .getToken(code)
    .catch(cb)
    .then(({ tokens }) => {
      googleClient.setCredentials({ tokens })
      googleClient
        .getTokenInfo(tokens.access_token)
        .catch(cb)
        .then(userInfo => {
          const authToken = this.Tokens.encode(userInfo.email)

          const destUrl = URL.parse(redirectUrl, true)
          destUrl.query[redirectParam] = authToken
          const destinationUrl = URL.format(destUrl)

          res.writeHead(302, { Location: destinationUrl })
          res.end()
        })
    })
}

function parseBody (req, res, cb) {
  jsonBody(req, res, (err, parsed) => {
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
