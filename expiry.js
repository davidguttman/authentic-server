const { Level } = require('level')

module.exports = Expiry

function Expiry (db) {
  if (!(this instanceof Expiry)) return new Expiry(db)

  this.db = typeof db === 'string' ? createLevelDB(db) : db

  return this
}

Expiry.prototype.set = function (hash, cb) {
  const date = new Date()
  const iso = date.toISOString()
  const ts = Math.floor(date.getTime() / 1000)
  const key = `expiry:${iso}:${hash}`
  const data = { hash, ts, iso }
  this.db.put(key, data, cb)
}

Expiry.prototype.getSince = function (date, cb) {
  const list = {}
  const iso = new Date(date).toISOString()
  const key = `expiry:${iso}:`
  const iterator = this.db.iterator({
    gte: key,
    lt: 'expiry:~'
  })

  const iterate = () => {
    iterator.next((err, key, value) => {
      if (err) return cb(err)
      if (key && value) {
        list[value.hash] = value.ts
        iterate() // Recursively fetch next item
      } else {
        iterator.close((err) => {
          if (err) return cb(err)
          cb(null, list) // End of iteration
        })
      }
    })
  }

  iterate() // Start iteration
}

function createLevelDB (location) {
  return new Level(location, { valueEncoding: 'json' })
}
