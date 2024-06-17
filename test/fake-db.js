const dbs = {}
const { EventEmitter } = require('events')

module.exports = function (loc = 'default') {
  const store = (dbs[loc] = dbs[loc] || {})

  return {
    get,
    put,
    createReadStream
  }

  function get (key, cb) {
    const val = store[key] ? JSON.parse(store[key]) : undefined
    setImmediate(function () {
      cb(null, val)
    })
  }

  function put (key, val, cb) {
    store[key] = JSON.stringify(val)
    setImmediate(function () {
      cb(null)
    })
  }

  function createReadStream (opts) {
    const emitter = new EventEmitter()
    const keys = Object.keys(store).sort()
    let startIndex = 0
    let endIndex = keys.length

    if (opts) {
      if (opts.gte) {
        startIndex = keys.findIndex(key => key >= opts.gte)
        if (startIndex === -1) {
          startIndex = keys.length
        }
      }
      if (opts.lt) {
        endIndex = keys.findIndex(key => key >= opts.lt)
        if (endIndex === -1) {
          endIndex = keys.length
        }
      }
    }

    setImmediate(() => {
      try {
        for (let index = startIndex; index < endIndex; index++) {
          const key = keys[index]
          const value = JSON.parse(store[key])
          emitter.emit('data', { key, value })
        }
        emitter.emit('end')
      } catch (error) {
        emitter.emit('error', error)
      }
    })

    return emitter
  }
}
