const level = require('level')

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
  this.db
    .createReadStream({ gte: key, lt: 'expiry:~' })
    .on('error', cb)
    .on('data', data => {
      list[data.value.hash] = data.value.ts
    })
    .on('end', () => cb(null, list))
}

function createLevelDB (location) {
  return level(location, { valueEncoding: 'json' })
}
