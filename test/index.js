const fs = require('fs')
const http = require('http')
const path = require('path')
const tape = require('tape')
const servertest = require('dg-servertest')

const Authentic = require('../')

const dbUsers = require('./fake-db')('users')
const dbExpiry = require('./fake-db')('expiry')

const Users = require('../users')(dbUsers)

const publicKey = fs.readFileSync(path.join(__dirname, 'rsa-public.pem'))
const privateKey = fs.readFileSync(path.join(__dirname, 'rsa-private.pem'))

const Tokens = require('../tokens')({
  publicKey,
  privateKey
})

let lastEmail

const auth = Authentic({
  dbUsers,
  dbExpiry,
  publicKey,
  privateKey,
  sendEmail: (email, cb) => {
    lastEmail = email
    setImmediate(cb)
  }
})

tape('Auth: should get public-key', t => {
  const url = '/auth/public-key'
  const opts = { method: 'GET' }

  servertest(createServer(auth), url, opts, (err, res) => {
    t.ifError(err, 'should not error')
    const data = JSON.parse(res.body)

    t.equal(data.success, true, 'should succeed')
    t.equal(data.data.publicKey.length, 800, 'should have publicKey')

    t.end()
  })
})

tape('Auth: Signup: should be able to sign up', t => {
  const postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm'
  }

  post('/auth/signup', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 201)

    const data = JSON.parse(res.body)
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

tape('Auth: Login: should fail without confirm', t => {
  const postData = { email: 'david@scalehaus.io', password: 'swordfish' }

  post('/auth/login', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    const data = JSON.parse(res.body)
    console.log('data', data)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'User Not Confirmed', 'should have error')

    t.end()
  })
})

tape('Auth: Signup: sendEmail should get email options', t => {
  const postData = {
    email: 'email@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm',
    from: 'from@somewhere.com',
    subject: 'Client Defined Subject',
    html: '<h1>Welcome</h1><p><a href="{{confirmUrl}}">Confirm</a></p>'
  }

  post('/auth/signup', postData, (err, res) => {
    t.ifError(err, 'should not error')
    t.equal(res.statusCode, 201)

    t.notOk(lastEmail.password, 'should not have password')
    t.equal(lastEmail.from, postData.from, 'should have from')
    t.equal(lastEmail.subject, postData.subject, 'should have subject')
    t.equal(lastEmail.html, postData.html, 'should have html')

    t.end()
  })
})

tape('Auth: Signup: should error for existing user', t => {
  const postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish',
    confirmUrl: 'http://example.com/confirm'
  }

  post('/auth/signup', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 400)

    const data = JSON.parse(res.body)
    t.notEqual(data.success, true, 'should not succeed')
    t.equal(data.error, 'User Exists', 'should have error')

    t.end()
  })
})

tape('Auth: Confirm: should error for mismatch', t => {
  const postData = { email: 'david@scalehaus.io', confirmToken: 'incorrect' }

  post('/auth/confirm', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Mismatch')

    t.end()
  })
})

tape('Auth: Confirm: should confirm user', t => {
  Users.findUser('david@scalehaus.io', (err, user) => {
    t.ifError(err, 'should not error')

    const postData = {
      email: 'david@scalehaus.io',
      confirmToken: user.data.confirmToken
    }

    post('/auth/confirm', postData, (err, res) => {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 202)

      const data = JSON.parse(res.body)
      t.equal(data.success, true, 'should succeed')
      t.equal(data.message, 'User confirmed.', 'should have message')

      Tokens.decode(data.data.authToken, (err, payload) => {
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

tape('Auth: Login: should error for unknown user', t => {
  const postData = {
    email: 'notdavid@scalehaus.io',
    password: 'not swordfish'
  }

  post('/auth/login', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'User Not Found', 'should have error message')

    t.end()
  })
})

tape('Auth: Login: should error for wrong pass', t => {
  const postData = {
    email: 'david@scalehaus.io',
    password: 'not swordfish'
  }

  post('/auth/login', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Password Mismatch', 'should have error message')

    t.end()
  })
})

tape('Auth: Login: should login', t => {
  const postData = {
    email: 'david@scalehaus.io',
    password: 'swordfish'
  }

  post('/auth/login', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 202)

    const data = JSON.parse(res.body)
    t.equal(data.success, true, 'should succeed', 'should succeed')
    t.equal(data.message, 'Login successful.', 'should have message')

    Tokens.decode(data.data.authToken, (err, payload) => {
      t.ifError(err, 'should not error')

      t.equal(payload.email, 'david@scalehaus.io', 'payload should have email')
      t.ok(payload.iat, 'should have iat')
      t.ok(payload.exp, 'should have exp')
      t.end()
    })
  })
})

tape('Auth: Change Password Request', t => {
  const postData = {
    email: 'david@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    const data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email, (err, user) => {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape('Auth: Change Password Request should fix case', t => {
  const postData = {
    email: 'TitleCase24@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    const data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email.toLowerCase(), (err, user) => {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape('Auth: Change Password Request: will create confirmed user', t => {
  const postData = {
    email: 'unknownuser@scalehaus.io',
    changeUrl: 'http://example.com/change'
  }

  post('/auth/change-password-request', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 200)

    const data = JSON.parse(res.body)
    t.ok(data.success, 'should succeed')
    t.equal(
      data.message,
      'Change password request received. Check email for confirmation link.'
    )

    Users.findUser(postData.email, (err, user) => {
      t.ifError(err, 'should not error')

      t.equal(user.data.emailConfirmed, true, 'email should be confirmed')
      t.equal(user.data.changeToken.length, 60, 'should have change token')
      t.ok(user.data.changeExpires > Date.now(), 'should have changeExpires')

      t.end()
    })
  })
})

tape('Auth: Change Password Request: sendEmail should get email options', t => {
  const postData = {
    email: 'email@scalehaus.io',
    changeUrl: 'http://example.com/change',
    from: 'from@somewhere.com',
    subject: 'Change PW Subject',
    html: '<h1>Change PW</h1><p><a href="{{changeUrl}}">Change</a></p>'
  }

  post('/auth/change-password-request', postData, (err, res) => {
    t.ifError(err, 'should not error')
    t.equal(res.statusCode, 200)

    t.equal(lastEmail.from, postData.from, 'should have from')
    t.equal(lastEmail.subject, postData.subject, 'should have subject')
    t.equal(lastEmail.html, postData.html, 'should have html')

    t.end()
  })
})

tape('Auth: Change Password: should error with wrong token', t => {
  const postData = {
    email: 'david@scalehaus.io',
    changeToken: 'wrong token',
    password: 'newpass'
  }

  post('/auth/change-password', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401)

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Mismatch', 'should have error')
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

tape('Auth: Change Password: should change password and login', t => {
  Users.findUser('david@scalehaus.io', (err, user) => {
    t.ifError(err, 'should not error')

    const postData = {
      email: 'david@scalehaus.io',
      changeToken: user.data.changeToken,
      password: 'newpass'
    }

    post('/auth/change-password', postData, (err, res) => {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      const data = JSON.parse(res.body)
      t.equal(data.success, true, 'should succeed')
      t.equal(data.message, 'Password changed.', 'should have message')

      Tokens.decode(data.data.authToken, (err, payload) => {
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

tape('Auth: Change Password: should error with expired token', t => {
  const postData = {
    email: 'david@scalehaus.io',
    changeToken: 'expired token',
    password: 'newpass2'
  }

  post('/auth/change-password', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 400)

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should not succeed')
    t.equal(data.error, 'Token Expired', 'should have error')
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

tape(
  'Auth: Magic Request & Login: existing user should be able to get in via magic-request and magic-login',
  t => {
    const postData = {
      email: 'david@scalehaus.io',
      magicUrl: 'http://example.com/magic-login'
    }

    post('/auth/magic-request', postData, (err, res) => {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      const data = JSON.parse(res.body)
      t.equal(data.success, true, 'Magic request should succeed')
      t.equal(
        data.message,
        'Magic login request received. Check email for confirmation link.',
        'should have correct message'
      )

      // Simulate clicking the magic link received in the email
      const magicLoginData = {
        email: 'david@scalehaus.io',
        magicToken: lastEmail.magicToken // Assuming lastEmail is accessible and contains the magicToken
      }

      post('/auth/magic-login', magicLoginData, (err, res) => {
        t.ifError(err, 'should not error')

        t.equal(res.statusCode, 200)

        const loginData = JSON.parse(res.body)
        t.equal(loginData.success, true, 'Magic login should succeed')
        t.ok(loginData.data.authToken, 'should have authToken')

        Tokens.decode(loginData.data.authToken, (err, payload) => {
          t.ifError(err, 'should not error')

          t.equal(
            payload.email,
            'david@scalehaus.io',
            'payload should have email'
          )
          t.ok(payload.iat, 'should have iat')
          t.ok(payload.exp, 'should have exp')

          // Test login with password for existing user
          const loginWithPasswordData = {
            email: 'david@scalehaus.io',
            password: 'newpass'
          }

          post('/auth/login', loginWithPasswordData, (err, res) => {
            t.ifError(err, 'should not error on password login')

            t.equal(
              res.statusCode,
              202,
              'status code should be 202 for password login'
            )

            const passwordLoginData = JSON.parse(res.body)
            t.equal(
              passwordLoginData.success,
              true,
              'Password login should succeed'
            )
            t.ok(
              passwordLoginData.data.authToken,
              'should have authToken on password login'
            )

            Tokens.decode(passwordLoginData.data.authToken, (err, payload) => {
              t.ifError(
                err,
                'should not error on decoding authToken from password login'
              )

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
  }
)

tape(
  'Auth: Magic Login: unknown user should be able to get in via magic login',
  t => {
    const postData = {
      email: 'unknown@scalehaus.io',
      magicUrl: 'http://example.com/magic-login'
    }

    post('/auth/magic-request', postData, (err, res) => {
      t.ifError(err, 'should not error')

      t.equal(res.statusCode, 200)

      const data = JSON.parse(res.body)
      t.equal(data.success, true, 'should succeed')
      t.equal(
        data.message,
        'Magic login request received. Check email for confirmation link.',
        'should have message'
      )

      // Simulate clicking the magic link received in the email
      const magicLoginData = {
        email: 'unknown@scalehaus.io',
        magicToken: lastEmail.magicToken // Assuming lastEmail is accessible and contains the magicToken
      }

      post('/auth/magic-login', magicLoginData, (err, res) => {
        t.ifError(err, 'should not error')

        t.equal(res.statusCode, 200)

        const loginData = JSON.parse(res.body)
        t.equal(loginData.success, true, 'should succeed')
        t.ok(loginData.data.authToken, 'should have authToken')

        Tokens.decode(loginData.data.authToken, (err, payload) => {
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
  }
)

tape('Auth: Magic Login: should fail with invalid magic token', t => {
  const postData = {
    email: 'unknown@scalehaus.io',
    magicToken: 'invalid-token'
  }

  post('/auth/magic-login', postData, (err, res) => {
    t.ifError(err, 'should not error')

    t.equal(res.statusCode, 401, 'should return 401 Unauthorized')

    const data = JSON.parse(res.body)
    t.equal(data.success, false, 'should fail')
    t.equal(
      data.error,
      'Token Mismatch',
      'should return token mismatch message'
    )
    t.notOk((data.data || {}).authToken, 'should not have token')

    t.end()
  })
})

tape('Auth: Password Change Tracking', t => {
  // Step 1: Create a user
  const userData = {
    email: 'pwchange@example.com',
    password: 'initialPassword',
    confirmUrl: 'http://example.com/confirm'
  }
  post('/auth/signup', userData, (err, res) => {
    t.error(err, 'No error on signup')
    t.equal(res.statusCode, 201, 'User created')

    // Step 2: Retrieve the confirmation token
    Users.findUser(userData.email, (err, user) => {
      t.ifError(err, 'should not error')

      const confirmData = {
        email: userData.email,
        confirmToken: user.data.confirmToken
      }

      // Step 3: Confirm the user
      post('/auth/confirm', confirmData, (err, res) => {
        t.error(err, 'No error on confirmation')
        t.equal(res.statusCode, 202, 'User confirmed')

        // Step 4: Check that the user is not in the recent changes list
        get('/auth/expired', (err, res) => {
          t.error(err, 'No error fetching password changes')
          const data = JSON.parse(res.body)
          const hash = Users.hashEmail(userData.email)
          t.equal(data[hash], undefined, 'User should not be in the list initially')

          // Step 5: Request a password change
          const changeRequestData = {
            email: userData.email,
            changeUrl: 'http://example.com/change-password'
          }
          post('/auth/change-password-request', changeRequestData, (err, res) => {
            t.error(err, 'No error on change password request')
            t.equal(res.statusCode, 200, 'Change password request received')

            // Step 6: Retrieve the change token
            Users.findUser(userData.email, (err, user) => {
              t.ifError(err, 'should not error')

              const updateData = {
                email: userData.email,
                password: 'newPassword',
                changeToken: user.data.changeToken
              }

              // Step 7: Change the user's password
              post('/auth/change-password', updateData, (err, res) => {
                t.error(err, 'No error on password change')
                t.equal(res.statusCode, 200, 'Password changed')

                // Step 8: Check that the user is now in the recent changes list
                get('/auth/expired', (err, res) => {
                  t.error(err, 'No error fetching password changes after update')
                  const data = JSON.parse(res.body)
                  t.ok(data[hash], 'User should be in the list after password change')

                  t.end()
                })
              })
            })
          })
        })
      })
    })
  })
})

function post (url, data, cb) {
  const opts = {
    method: 'POST',
    headers: { 'content-type': 'application/json' }
  }

  servertest(createServer(auth), url, opts, cb).end(JSON.stringify(data))
}

function get (url, callback) {
  const opts = { method: 'GET' }
  servertest(createServer(auth), url, opts, callback)
}

function createServer (auth) {
  return http.createServer(auth)
}
