var fs = require('fs')
var http = require('http')
var tape = require('tape')
var servertest = require('servertest')

var Authentic = require('../')

var db = require('./fake-db')
var Users = require('../users')(db)

var publicKey = fs.readFileSync(__dirname + '/rsa-public.pem')
var privateKey = fs.readFileSync(__dirname + '/rsa-private.pem')

var Tokens = require('../tokens')({
  publicKey: publicKey,
  privateKey: privateKey
})

var lastEmail

var auth = Authentic({
  db: db,
  publicKey: publicKey,
  privateKey: privateKey,
  sendEmail: function (email, cb) {
    lastEmail = email
    setImmediate(cb)
  }
})

tape('Auth: should get public-key', function (t) {
  var url = '/auth/public-key'
  var opts = { method: 'GET' }

  servertest(createServer(auth), url, opts, function (err, res) {
    t.ifError(err, 'should not error')
    var data = JSON.parse(res.body)

    t.equal(data.success, true, 'should succeed')
    t.equal(data.data.publicKey.length, 800, 'should have publicKey')

    t.end()
  })
})

tape('Auth: Signup: should be able to sign up', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm'
  }

  post('/auth/signup', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 201)

    var data = JSON.parse(res.body)
    t.equal(data.success, true, 'should succeed')
    t.equal(
      data.message,
      'User created. Check email for confirmation link.',
      'should have message'
    )
    t.equal(data.data.email, 'david@scalehaus.io', 'should have email')
    t.equal(data.data.createdDate.length, 24, 'should have createdDate')

    t.end()
  })
})

tape('Auth: Login: should fail without confirm', function (t) {
  var postData = { email: 'david@scalehaus.io', password: 'swordfish' }

  post('/auth/login', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    var data = JSON.parse(res.body)
    console.log('data', data)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'User Not Confirmed', 'should have error')

    t.end()
  })
})

tape('Auth: Signup: sendEmail should get email options', function (t) {
  var postData = {
    email: 'email@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm',
    from: 'from@somewhere.com',
    subject: 'Client Defined Subject',
    html: '<h1>Welcome</h1><p><a href="{{confirmUrl}}">Confirm</a></p>'
  }

  post('/auth/signup', postData, function (err, res) {
    t.ifError(err, 'should not error')
    t.equal(res.statusCode, 201)

    t.notOk(lastEmail.password, 'should not have password')
    t.equal(lastEmail.from, postData.from, 'should have from')
    t.equal(lastEmail.subject, postData.subject, 'should have subject')
    t.equal(lastEmail.html, postData.html, 'should have html')

    t.end()
  })
})

tape('Auth: Signup: should error for existing user', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm'
  }

  post('/auth/signup', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 400)

    var data = JSON.parse(res.body)
    t.notEqual(data.success, true, 'should not succeed')
    t.equal(data.error, 'User Exists', 'should have error')

    t.end()
  })
})

tape('Auth: Confirm: should error for mismatch', function (t) {
  var postData = { email: 'david@scalehaus.io', confirmToken: 'incorrect' }

  post('/auth/confirm', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Mismatch')

    t.end()
  })
})

tape('Auth: Confirm: should confirm user', function (t) {
  Users.findUser('david@scalehaus.io', function (err, user) {
    t.ifError(err, 'should not error')

    var postData = {
      email: 'david@scalehaus.io',
      confirmToken: user.data.confirmToken
    }

    post('/auth/confirm', postData, function (err, res) {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 202)

      var data = JSON.parse(res.body)
      t.equal(data.success, true, 'should succeed')
      t.equal(data.message, 'User confirmed.', 'should have message')

      Tokens.decode(data.data.authToken, function (err, payload) {
        t.ifError(err, 'should not error')

        t.equal(
          payload.email,
          'david@scalehaus.io',
          'payload should have email'
        )
        t.ok(payload.iat, 'should have iat')

        t.end()
      })
    })
  })
})

tape('Auth: Login: should error for unknown user', function (t) {
  var postData = {
    email: 'notdavid@scalehaus.io',
    password: 'not swordfish'
  }

  post('/auth/login', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'User Not Found', 'should have error message')

    t.end()
  })
})

tape('Auth: Login: should error for wrong pass', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    password: 'not swordfish'
  }

  post('/auth/login', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Password Mismatch', 'should have error message')

    t.end()
  })
})

tape('Auth: Login: should login', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish'
  }

  post('/auth/login', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 202)

    var data = JSON.parse(res.body)
    t.equal(data.success, true, 'should succeed', 'should succeed')
    t.equal(data.message, 'Login successful.', 'should have message')

    Tokens.decode(data.data.authToken, function (err, payload) {
      t.ifError(err, 'should not error')

      t.equal(payload.email, 'david@scalehaus.io', 'payload should have email')
      t.ok(payload.iat, 'should have iat')
      t.ok(payload.exp, 'should have exp')
      t.end()
    })
  })
})

tape('Auth: Change Password Request', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    var data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email, function (err, user) {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape('Auth: Change Password Request should fix case', function (t) {
  var postData = {
    email: 'TitleCase24@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    var data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email.toLowerCase(), function (err, user) {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape('Auth: Change Password Request: will create confirmed user', function (t) {
  var postData = {
    email: 'unknownuser@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    var data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email, function (err, user) {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape(
  'Auth: Change Password Request: sendEmail should get email options',
  function (t) {
    var postData = {
      email: 'email@scalehaus.io',
      changeUrl: 'http://example.com/change',
      from: 'from@somewhere.com',
      subject: 'Change PW Subject',
      html: '<h1>Change PW</h1><p><a href="{{changeUrl}}">Change</a></p>'
    }

    post('/auth/change-password-request', postData, function (err, res) {
      t.ifError(err, 'should not error')
      t.equal(res.statusCode, 200)

      t.equal(lastEmail.from, postData.from, 'should have from')
      t.equal(lastEmail.subject, postData.subject, 'should have subject')
      t.equal(lastEmail.html, postData.html, 'should have html')

      t.end()
    })
  }
)

tape('Auth: Change Password: should error with wrong token', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    changeToken: 'wrong token',
    password: 'newpass'
  }

  post('/auth/change-password', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Mismatch', 'should have error')
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

tape('Auth: Change Password: should change password and login', function (t) {
  Users.findUser('david@scalehaus.io', function (err, user) {
    t.ifError(err, 'should not error')

    var postData = {
      email: 'david@scalehaus.io',
      changeToken: user.data.changeToken,
      password: 'newpass'
    }

    post('/auth/change-password', postData, function (err, res) {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      var data = JSON.parse(res.body)
      t.equal(data.success, true, 'should succeed')
      t.equal(data.message, 'Password changed.', 'should have message')

      Tokens.decode(data.data.authToken, function (err, payload) {
        t.ifError(err, 'should not error')

        t.equal(
          payload.email,
          'david@scalehaus.io',
          'payload should have email'
        )
        t.ok(payload.iat, 'should have iat')
        t.ok(payload.exp, 'should have exp')
        t.end()
      })
    })
  })
})

tape('Auth: Change Password: should error with expired token', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    changeToken: 'expired token',
    password: 'newpass2'
  }

  post('/auth/change-password', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 400)

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Expired', 'should have error')
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

tape('Auth: Magic Request & Login: existing user should be able to get in via magic-request and magic-login', function (t) {
  var postData = {
    email: 'david@scalehaus.io',
    magicUrl: 'http://example.com/magic-login'
  }

  post('/auth/magic-request', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    var data = JSON.parse(res.body)
    t.equal(data.success, true, 'Magic request should succeed')
    t.equal(
      data.message,
      'Magic login request received. Check email for confirmation link.',
      'should have correct message'
    )

    // Simulate clicking the magic link received in the email
    var magicLoginData = {
      email: 'david@scalehaus.io',
      magicToken: lastEmail.magicToken // Assuming lastEmail is accessible and contains the magicToken
    }

    post('/auth/magic-login', magicLoginData, function (err, res) {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      var loginData = JSON.parse(res.body)
      t.equal(loginData.success, true, 'Magic login should succeed')
      t.ok(loginData.data.authToken, 'should have authToken')

      Tokens.decode(loginData.data.authToken, function (err, payload) {
        t.ifError(err, 'should not error')

        t.equal(
          payload.email,
          'david@scalehaus.io',
          'payload should have email'
        )
        t.ok(payload.iat, 'should have iat')
        t.ok(payload.exp, 'should have exp')

        // Test login with password for existing user
        var loginWithPasswordData = {
          email: 'david@scalehaus.io',
          password: 'newpass'
        }

        post('/auth/login', loginWithPasswordData, function (err, res) {
          t.ifError(err, 'should not error on password login')

          t.equal(res.statusCode, 202, 'status code should be 202 for password login')

          var passwordLoginData = JSON.parse(res.body)
          t.equal(passwordLoginData.success, true, 'Password login should succeed')
          t.ok(passwordLoginData.data.authToken, 'should have authToken on password login')

          Tokens.decode(passwordLoginData.data.authToken, function (err, payload) {
            t.ifError(err, 'should not error on decoding authToken from password login')

            t.equal(
              payload.email,
              'david@scalehaus.io',
              'payload from password login should have email'
            )
            t.ok(payload.iat, 'should have iat on password login')
            t.ok(payload.exp, 'should have exp on password login')

            t.end()
          })
        })
      })
    })
  })
})

tape('Auth: Magic Login: unknown user should be able to get in via magic login', function (t) {
  var postData = {
    email: 'unknown@scalehaus.io',
    magicUrl: 'http://example.com/magic-login'
  }

  post('/auth/magic-request', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    var data = JSON.parse(res.body)
    t.equal(data.success, true, 'should succeed')
    t.equal(
      data.message,
      'Magic login request received. Check email for confirmation link.',
      'should have message'
    )

    // Simulate clicking the magic link received in the email
    var magicLoginData = {
      email: 'unknown@scalehaus.io',
      magicToken: lastEmail.magicToken // Assuming lastEmail is accessible and contains the magicToken
    }

    post('/auth/magic-login', magicLoginData, function (err, res) {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      var loginData = JSON.parse(res.body)
      t.equal(loginData.success, true, 'should succeed')
      t.ok(loginData.data.authToken, 'should have authToken')

      Tokens.decode(loginData.data.authToken, function (err, payload) {
        t.ifError(err, 'should not error')

        t.equal(
          payload.email,
          'unknown@scalehaus.io',
          'payload should have email'
        )
        t.ok(payload.iat, 'should have iat')
        t.ok(payload.exp, 'should have exp')
        t.end()
      })
    })
  })
})

tape('Auth: Magic Login: should fail with invalid magic token', function (t) {
  var postData = {
    email: 'unknown@scalehaus.io',
    magicToken: 'invalid-token'
  }

  post('/auth/magic-login', postData, function (err, res) {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401, 'should return 401 Unauthorized')

    var data = JSON.parse(res.body)
    t.equal(data.success, false, 'should fail')
    t.equal(data.error, 'Token Mismatch', 'should return token mismatch message')
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

function post (url, data, cb) {
  var opts = {
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  }

  servertest(createServer(auth), url, opts, cb).end(JSON.stringify(data))
}

function createServer (auth) {
  return http.createServer(auth)
}
