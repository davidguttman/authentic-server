var store = {}

module.exports = {
  get: function (key, cb) {
    var val = store[key] ? JSON.parse(store[key]) : undefined
    setImmediate(cb, null, val)
  },

  put: function (key, val, cb) {
    store[key] = JSON.stringify(val)
    setImmediate(cb, null)
  }
}
