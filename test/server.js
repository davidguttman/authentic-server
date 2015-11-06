var http = require('http')

module.exports = function (auth) {
  return http.createServer(function (req, res) {
    auth(req, res, next)

    function next (req, res) {
      // not an authentic route, send 404 or send to another route
      res.end('Not an authentic route =)')
    }
  })
}
