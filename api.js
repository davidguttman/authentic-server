var fs = require('fs')
var URL = require('url')
var jsonBody = require('body/json')

var clientErrors = {
  'User Exists':             400,
  'ConfirmUrl Not Provided': 400,
  'ChangeUrl Not Provided':  400,
  'Invalid Email':           400,
  'Invalid Password':        400,
  'Token Mismatch':          401,
  'Already Confirmed':       400,
  'Password Mismatch':       401,
  'User Not Found':          401,
  'Token Expired':           400
}

module.exports = function (opts) {
  var Email = opts.sendEmail
  var Tokens = require('./tokens')(opts)
  var Users = require('./users')(opts.db)

  return {
    publicKey: function (req, res, opts, cb) {
      res.end(JSON.stringify({
        success: true,
        data: {
          publicKey: Tokens.publicKey
        }
      }))
    },

    signup: function (req, res, opts, cb) {
      jsonBody(req, res, function (err, userData) {
        if (err) return cb(err)

        var email = userData.email
        var pass = userData.password
        var confirmUrl = userData.confirmUrl

        if (!confirmUrl) {
          var err = new Error('ConfirmUrl Not Provided')
          err.statusCode = clientErrors[err.message] || 500
          return cb(err)
        }

        Users.createUser(email, pass, function (err, user) {
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
            confirmUrl: confirmUrl
          }

          Email(emailOpts, function (err) {
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
    },

    confirm: function (req, res, opts, cb) {
      jsonBody(req, res, function (err, userData) {
        if (err) return cb(err)

        var email = userData.email
        var confirmToken = userData.confirmToken
        console.log('confirmToken', confirmToken)

        Users.confirmUser(email, confirmToken, function(err) {
          if (err) {
            err.statusCode = clientErrors[err.message] || 500
            return cb(err)
          }

          var token = Tokens.encode(email)
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
    },

    login: function (req, res, opts, cb) {
      jsonBody(req, res, function (err, userData) {
        if (err) return cb(err)

        var email = userData.email
        var pass = userData.password

        Users.checkPassword(email, pass, function (err, user) {
          if (err) {
            err.statusCode = clientErrors[err.message] || 500
            return cb(err)
          }

          var token = Tokens.encode(email)
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
    },

    changePasswordRequest: function (req, res, opts, cb) {
      jsonBody(req, res, function (err, userData) {
        if (err) return cb(err)

        var email = userData.email
        var changeUrl = userData.changeUrl

        if (!changeUrl) {
          var err = new Error('ChangeUrl Not Provided')
          err.statusCode = clientErrors[err.message] || 500
          return cb(err)
        }

        Users.createChangeToken(email, function (err, changeToken) {
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

          Email(emailOpts, function (err) {
            if (err) return cb(err)

            res.writeHead(200, {'Content-Type': 'application/json'})
            res.end(JSON.stringify({
              success: true,
              message: 'Change password request received. Check email for confirmation link.'
            }))
          })
        })

      })
    },

    changePassword: function (req, res, opts, cb) {
      jsonBody(req, res, function (err, userData) {
        if (err) return cb(err)

        var email = userData.email
        var password = userData.password
        var changeToken = userData.changeToken

        Users.changePassword(email, password, changeToken, function (err, something) {
          if (err) {
            err.statusCode = clientErrors[err.message] || 500
            return cb(err)
          }

          Users.checkPassword(email, password, function (err, user) {
            if (err) return cb(err)

            var authToken = Tokens.encode(email)

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
  }
}


