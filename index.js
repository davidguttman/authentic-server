var Corsify = require('corsify')
var HttpHashRouter = require('http-hash-router')

var API = require('./api')

module.exports = function (opts) {
  checkInitErrors(opts)

  var routePrefix = opts.routePrefix || '/auth'

  var shouldGoogle = opts.googleClientId && opts.googleClientSecret && opts.googleRedirectUrl

  var api = API(opts)

  var router = HttpHashRouter()
  router.set(routePrefix + '/login', { POST: api.login.bind(api) })
  router.set(routePrefix + '/signup', { POST: api.signup.bind(api) })
  router.set(routePrefix + '/confirm', { POST: api.confirm.bind(api) })
  router.set(routePrefix + '/change-password-request', {
    POST: api.changePasswordRequest.bind(api)
  })
  router.set(routePrefix + '/change-password', {
    POST: api.changePassword.bind(api)
  })
  router.set(routePrefix + '/magic-request', {
    POST: api.magicRequest.bind(api)
  })
  router.set(routePrefix + '/magic-login', { POST: api.magicLogin.bind(api) })
  router.set(routePrefix + '/public-key', { GET: api.publicKey.bind(api) })

  if (shouldGoogle) {
    router.set(routePrefix + '/google', { GET: api.googleAuth.bind(api) })
    router.set(routePrefix + '/google/callback', { GET: api.googleCallback.bind(api) })
  }

  function handler (req, res, next) {
    Corsify(
      {
        'Access-Control-Allow-Headers': 'authorization, accept, content-type'
      },
      function (req, res) {
        router(req, res, {}, onError)
      }
    )(req, res)

    function onError (err) {
      if (!err) return
      if (next && err.statusCode === 404) return next(req, res)

      res.writeHead(err.statusCode || 500, {
        'Content-Type': 'application/json'
      })
      res.end(
        JSON.stringify({
          success: false,
          error: err.message
        })
      )
    }
  }

  return handler
}

function checkInitErrors (opts) {
  if (!opts.db) {
    throw new Error(
      'Authentic: no db given, must have "get" and "put" methods.'
    )
  }

  if (!opts.publicKey || !opts.privateKey) {
    throw new Error('Authentic: no public or private key given')
  }

  if (!opts.sendEmail) {
    throw new Error('Authentic: no "sendEmail" method given')
  }
}
