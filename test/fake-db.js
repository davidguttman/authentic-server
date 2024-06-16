const store = {}

module.exports = {
  get: function (key, cb) {
    const val = store[key] ? JSON.parse(store[key]) : undefined
    setImmediate(function () {
      cb(null, val)
    })
  },

  put: function (key, val, cb) {
    store[key] = JSON.stringify(val)
    setImmediate(function () {
      cb(null)
    })
  }
}
