var crypto = require('crypto')
var ulevel = require('ix-level-userdb')

module.exports = function (db) {
  var Users = ulevel(db)
  var Model = {
    _db: Users,

    findUser: function (email, cb) {
      email = email || ''
      Users.findUser(email.toLowerCase(), function (err, user) {
        if (err && err.notFound) {
          err = new Error('User Not Found')
        }
        cb(err, user)
      })
    },

    checkPassword: function (email, pass, cb) {
      email = email || ''
      pass = pass || ''
      Users.checkPassword(email.toLowerCase(), pass, function (err, user) {
        if (err) {
          if (err === 'password mismatch') {
            err = new Error('Password Mismatch')
          }
          if (err === 'could not find user') {
            err = new Error('User Not Found')
          }
          return cb(err)
        }

        return cb(null, user)
      })
    },

    createUser: function (email, password, cb) {
      if (!validEmail(email)) return cb(new Error('Invalid Email'))
      if (!validPassword(password)) return cb(new Error('Invalid Password'))

      Model.findUser(email, function (err, user) {
        if (user) return cb(new Error('User Exists'))

        generateToken(30, function (err, token) {
          var data = {emailConfirmed: false, confirmToken: token}

          Users.addUser(email, password, data, function (err) {
            if (err) return cb(err)

            Model.findUser(email, cb)
          })
        })
      })
    },

    confirmUser: function (email, token, cb) {
      Model.findUser(email, function (err, user) {
        if (err) return cb(err)

        if (user.data.emailConfirmed === true) return cb(new Error('Already Confirmed'))

        if (user.data.confirmToken !== token) return cb(new Error('Token Mismatch'))

        user.data.emailConfirmed = true
        user.data.confirmToken = undefined

        Users.modifyUser(email, user.data, cb)
      })
    },

    changePassword: function(email, password, token, cb) {
      if (!token) return cb(new Error('Invalid Token'))
      if (!validPassword(password)) return cb(new Error('Invalid Password'))

      Model.findUser(email, function(err, user) {
        if (err) return cb(err)

        if (!user.data.changeToken) return cb(new Error('Token Expired'))

        if (user.data.changeToken !== token) return cb(new Error('Token Mismatch'))

        if (!(user.data.changeExpires > Date.now())) {
          return cb(new Error('Token Expired'))
        }

        Users.changePassword(email, password, function(err) {
          if (err) return cb(err)

          user.data.changeToken = undefined
          user.data.changeExpires = undefined
          user.data.emailConfirmed = true

          Users.modifyUser(email, user.data, cb)
        })
      })
    },

    createChangeToken: function(email, expires, cb) {
      if (typeof expires === 'function') {
        cb = expires
        expires = Date.now() + 2 * 24 * 3600 * 1000
      }

      Model.findUser(email, function(err, user) {
        if (err) {
          if (err.message == 'User Not Found') {
            // Create user and try again
            return Model.createWithPasswordChange(email, expires, cb)
          }
          return cb(err)
        }

        generateToken(30, function(err, token) {
          if (user.data == null) user.data = {}

          user.data.changeToken = token
          user.data.changeExpires = expires

          Users.modifyUser(email, user.data, function(err) {
            if (err) return cb(err)

            cb(null, token)
          })
        })
      })
    },

    createWithPasswordChange: function(email, expires, cb) {
      if (typeof expires === 'function') {
        cb = expires
        expires = Date.now() + 90 * 24 * 3600 * 1000
      }

      generateToken(16, function(err, pw) {

        Model.createUser(email, pw, function(err, user) {
          if (err) return cb(err)

          Model.confirmUser(email, user.data.confirmToken, function(err) {
            if (err) return cb(err)

            Model.createChangeToken(email, expires, cb)
          })
        })
      })
    }
  }
  return Model
}


function generateToken (len, encoding, cb) {
  len = len || 1
  if (typeof encoding === 'function') {
    cb = encoding
    encoding = 'hex'
  }
  encoding = encoding || 'hex'

  crypto.randomBytes(len, function (ex, buf) {
    cb(null, buf.toString(encoding))
  })
}

function validEmail (email) {
  email = email || ''
  return /^[^@]+@[^@]+\.\w{2,}$/.test(email)
}

function validPassword (password) {
  password = password || ''
  return password.length >= 6
}
