require('dotenv').config()

const fs = require('fs')
const path = require('path')
const http = require('http')
const Authentic = require('../')

const auth = Authentic({
  db: path.join(__dirname, '/../db/'),
  publicKey: fs.readFileSync(path.join(__dirname, '/rsa-public.pem')),
  privateKey: fs.readFileSync(path.join(__dirname, '/rsa-private.pem')),
  sendEmail: (email, cb) => {
    console.log(email)
    setImmediate(cb)
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleRedirectUrl: process.env.GOOGLE_REDIRECT_URL
})

const server = http.createServer((req, res) => {
  auth(req, res, next)

  function next (req, res) {
    // not an authentic route, send 404 or send to another route
    res.end('Not an authentic route =)')
  }
})

server.listen(3000)
console.log('Authentic enabled server listening on port', 3000)
