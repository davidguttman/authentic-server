var crypto = require('crypto')
var ulevel = require('ix-level-userdb')

var Users = module.exports = function (db) {
  if (!(this instanceof Users)) return new Users(db)

  this.db = ulevel(db)

  return this
}

Users.prototype.findUser = function (email, cb) {
  email = email || ''
  this.db.findUser(email.toLowerCase(), function (err, user) {
    if (err && err.notFound) {
      err = new Error('User Not Found')
    }
    cb(err, user)
  })
}

Users.prototype.checkPassword = function (email, pass, cb) {
  email = email || ''
  pass = pass || ''
  this.db.checkPassword(email.toLowerCase(), pass, function (err, user) {
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
}

Users.prototype.createUser = function (email, password, cb) {
  if (!validEmail(email)) return cb(new Error('Invalid Email'))
  if (!validPassword(password)) return cb(new Error('Invalid Password'))

  var self = this

  this.findUser(email, function (err, user) {
    if (!err && user) return cb(new Error('User Exists'))

    generateToken(30, function (err, token) {
      if (err) return cb(err)

      var data = {emailConfirmed: false, confirmToken: token}

      self.db.addUser(email, password, data, function (err) {
        if (err) return cb(err)

        self.findUser(email, cb)
      })
    })
  })
}

Users.prototype.confirmUser = function (email, token, cb) {
  var self = this
  this.findUser(email, function (err, user) {
    if (err) return cb(err)

    if (user.data.emailConfirmed === true) return cb(new Error('Already Confirmed'))

    if (user.data.confirmToken !== token) return cb(new Error('Token Mismatch'))

    user.data.emailConfirmed = true
    user.data.confirmToken = undefined

    self.db.modifyUser(email, user.data, cb)
  })
}

Users.prototype.changePassword = function (email, password, token, cb) {
  if (!token) return cb(new Error('Invalid Token'))
  if (!validPassword(password)) return cb(new Error('Invalid Password'))

  var self = this

  this.findUser(email, function (err, user) {
    if (err) return cb(err)

    if (!user.data.changeToken) return cb(new Error('Token Expired'))

    if (user.data.changeToken !== token) return cb(new Error('Token Mismatch'))

    if (!(user.data.changeExpires > Date.now())) {
      return cb(new Error('Token Expired'))
    }

    self.db.changePassword(email, password, function (err) {
      if (err) return cb(err)

      user.data.changeToken = undefined
      user.data.changeExpires = undefined
      user.data.emailConfirmed = true

      self.db.modifyUser(email, user.data, cb)
    })
  })
}

Users.prototype.createChangeToken = function (email, expires, cb) {
  var self = this

  if (typeof expires === 'function') {
    cb = expires
    expires = Date.now() + 2 * 24 * 3600 * 1000
  }

  this.findUser(email, function (err, user) {
    if (err) {
      if (err.message === 'User Not Found') {
        // Create user and try again
        return self.createWithPasswordChange(email, expires, cb)
      }
      return cb(err)
    }

    generateToken(30, function (err, token) {
      if (err) return cb(err)
      if (user.data == null) user.data = {}

      user.data.changeToken = token
      user.data.changeExpires = expires

      self.db.modifyUser(email, user.data, function (err) {
        if (err) return cb(err)

        cb(null, token)
      })
    })
  })
}

Users.prototype.createWithPasswordChange = function (email, expires, cb) {
  var self = this

  if (typeof expires === 'function') {
    cb = expires
    expires = Date.now() + 90 * 24 * 3600 * 1000
  }

  generateToken(16, function (err, pw) {
    if (err) return cb(err)
    self.createUser(email, pw, function (err, user) {
      if (err) return cb(err)

      self.confirmUser(email, user.data.confirmToken, function (err) {
        if (err) return cb(err)

        self.createChangeToken(email, expires, cb)
      })
    })
  })
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
