# AuthenticServer #

This is the server component of Authentic. This provides endpoints for signup, login, confirm, and password change.

## Example ##

```js
var fs = require('fs')
var http = require('http')
var Authentic = require('authentic-server')

var auth = Authentic({
  db: __dirname + '/users/',
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  sendEmail: function (opts, cb) {
    console.log(email)
    setImmediate(cb)
  }
})

var server = http.createServer(function (req, res) {
  auth(req, res, next)

  function next (req, res) {
    // not an authentic route, send 404 or send to another route
    res.end('Not an authentic route =)')
  }
})

server.listen(1337)
console.log('Authentic enabled server listening on port', 1337)

```

## Module API ##

### Authentic(opts) ###

This is the main entry poin. Accepts an options object and returns a handler function.

```js
var auth = Authentic({
  db: __dirname + '/users/',
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  sendEmail: function (emailOpts, done) {
    console.log(email)
    setImmediate(done)
  }
})

// auth is now a function that accepts req and res arguments
var server = http.createServer(function(req, res){
  auth(req, res)
})

// or simply
var server = http.createServer(auth)
```

#### options ####

`Authentic()` takes an options object as its first argument, several of them are required:

* `db`: either a `levelDB` compatible db instance OR a string location of one on disk (will create one if it doesn't exist)
* `privateKey`: RSA private key in PEM format. Can be created with the command: `openssl genrsa 4096 > rsa-private.pem`
* `publicKey`: RSA public key in PEM format. Can be created with the command: `openssl rsa -in rsa-private.pem -pubout > rsa-public.pem`
* `sendEmail(emailOpts, done)`: a function that sends email. Use the provided `emailOpts` to create and send  email and call `done(err)` when finished. If `err` is null or undefined, `authentic-server` will treat it as a success. `emailOpts` will come in one of two flavors depending on if it's a signup or a change password request:

```js
{ type: 'signup',
  email: 'david@scalehaus.io',
  confirmUrl: 'https://scalehaus.io/confirm?confirmToken=9a1dccd9f...' }
```

OR

```js
{ type: 'change-password-request',
  email: 'david@scalehaus.io',
  changeUrl: 'https://scalehaus.io/change-password?changeToken=0b4fa5904752b...' }
```

Optional:

* `prefix`: defaults to `/auth`. This is the path prefix for all `authentic-server` API endpoints. For example if you set prefix to `/awesome`, the endpoints will be `/awesome/signup`, `/awesome/login`, `/awesome/confirm`, etc...

## Server API ##

### POST `/auth/signup`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "password": "notswordfish",
    "confirmUrl": "https://yourwebapp.com/path/to/confirmation"
}
```

This endpoint will create the user in an "unconfirmed" state (can't login), and it will email the user with the specified url with an additional `?confirmToken=d619f2d02...` parameter added. On success will respond:

```
{
    "success": true,
    "message": "User created. Check email for confirmation link.",
    "data": {
        "email": "david@scalehaus.io",
        "createdDate": "2015-11-05T22:39:22.994Z"
    }
}
```

### POST `/auth/confirm`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "confirmToken": "d619f2d02aea5b091afba5ae01b8183203215c880b327cbc290562ecbd66"
}
```

If the `confirmToken` is correct, will set the user as "confirmed" (can now login), and will also respond with an `authToken` for immediate use:

```
{
    "success": true,
    "message": "User confirmed.",
    "data": { "authToken": "eyJ0e..." }
}
```

### POST `/auth/login`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "password": "notswordfish"
}
```

This endpoint will check the email/password and will respond with an `authToken` if correct:

```
{
    "success": true,
    "message": "Login successful.",
    "data": {
        "authToken": "eyJ0eXAiOiJ..."
    }
}
```

### POST `/auth/change-password-request`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "changeUrl": "https://yourwebapp.com/path/to/change-password"
}
```

This endpoint will add a `changeToken` to the user, and it will email the user with the specified url with an additional `?changeToken=560ada2...` parameter added. On success will respond:

```
{
    "success": true,
    "message": "Change password request received. Check email for confirmation link."
}
```

### POST `/auth/change-password`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "password": "newawesomepassword",
    "changeToken": "560ada2..."
}
```
This endpoint will check if the `changeToken` is correct, and if it is it will change the user's password to the one provided and will respond with an `authToken`:

```
{
    "success": true,
    "message": "Password changed.",
    "data": {
        "authToken": "eyJ0eXAiOiJ..."
    }
}
```

### GET `/auth/public-key`

Responds with the server's public key. This is what allows your other services to decrypt the `authToken` and know who the user is and that the data was encrypted by this server.

```
{
    "success": true,
    "data": {
        "publicKey": "-----BEGIN PUBLIC KEY-----\nMIICIjANB..."
    }
}
```

# License #

MIT
