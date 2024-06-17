const store = {}

module.exports = {
  get,
  put
}

function get (key, cb) {
  const val = store[key] ? JSON.parse(store[key]) : undefined
  setImmediate(() => {
    cb(null, val)
  })
}

function put (key, val, cb) {
  store[key] = JSON.stringify(val)
  setImmediate(cb)
}
