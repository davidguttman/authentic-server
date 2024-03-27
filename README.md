# AuthenticServer #

This is the server component of [authentic](https://github.com/davidguttman/authentic). This provides endpoints for signup, login, confirm, and password change.

## Example ##

```js
var fs = require('fs')
var http = require('http')
var Authentic = require('authentic-server')

var auth = Authentic({
  db: __dirname + '/users/',
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  sendEmail: function (emailOpts, cb) {
    // send email however you'd like (nodemailer, powerdrill, etc...)
    // emailOpts.type is either 'signup' or 'change-password-request'
    // emailOpts.email is where to send the email
    // see API docs for more properties like confirmToken and changeToken
    setImmediate(cb)
  }
})

var server = http.createServer(auth)

server.listen(1337)
console.log('Authentic enabled server listening on port', 1337)

```

## Installation ##

```
npm install --save authentic-server
```

## Module API ##

### Authentic(opts) ###

This is the main entry point. Accepts an options object and returns a handler function.

```js
var auth = Authentic({
  db: __dirname + '/users/',
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  sendEmail: function (emailOpts, done) {
    console.log(emailOpts)
    setImmediate(done)
  }
})

// auth is now a function that accepts req, res, and optional next arguments
var server = http.createServer(function(req, res, next){
  auth(req, res, next)

  function next (req, res) {
    // authentic-server will call next if none of its routes match
    // useful if you want to have other routes on the server
    res.end('Not an authentic route')
  }
})

// or simply
var server = http.createServer(auth)
```

#### options ####

`Authentic()` takes an options object as its first argument, several of them are required:

* `db`: any of the following:
  * a string location of where to open (or create if it doesn't exist) a [levelDB](https://github.com/level/level) on disk
  * an object that has `get` and `put` methods that follow this form (see [test/fake-db.js](https://github.com/davidguttman/authentic-server/blob/master/test/fake-db.js) for an example):
    * `get: function (key, cb) { ... }`
    * `put: function (key, value, cb) { ... }`
  * a `levelDB` compatible db instance (e.g. [multileveldown](https://github.com/mafintosh/multileveldown) or [levelup](https://github.com/level/levelup) + [sqldown](https://github.com/calvinmetcalf/sqldown), [dynamodown](https://github.com/davidguttman/dynamodown), [redisdown](https://github.com/hmalphettes/redisdown), etc... )
* `privateKey`: RSA private key in PEM format. Can be created with the command: `openssl genrsa 4096 > rsa-private.pem`
* `publicKey`: RSA public key in PEM format. Can be created with the command: `openssl rsa -in rsa-private.pem -pubout > rsa-public.pem`
* `sendEmail(emailOpts, done)`: please provide function that sends email how you'd like. Use the provided `emailOpts` to craft an email, send it, and call `done(err)` when finished.
  * Here's an [example using Mandrill/powerdrill](https://github.com/davidguttman/authentic-server/blob/master/example/send-email-mandrill.js), but [nodemailer](https://github.com/andris9/Nodemailer) or anything else would work great too.
  * Any additional data sent in the POST will be available -- if you'd like to customize the "from" address or provide a "subject" from the client to use here, you may.
  * If `err` is null or undefined, `authentic-server` will treat it as a success.
  * `emailOpts` will come in one of two flavors depending on if it's a signup or a change password request:

```js
{ type: 'signup',
  email: 'david@scalehaus.io',
  confirmToken: '9a1dccd9f...',
  confirmUrl: 'https://scalehaus.io/confirm?confirmToken=9a1dccd9f...', // if provided with POST to /signup
  from: 'Authentic Accounts <auth@authentc.com>' // if provided with the POST to /signup
}
```

OR

```js
{ type: 'change-password-request',
  email: 'david@scalehaus.io',
  changeToken: '0b4fa5904752b...',
  changeUrl: 'https://scalehaus.io/change-password?changeToken=0b4fa5904752b...', // if provided with the POST to /change-password-request
  from: 'Authentic Accounts <auth@authentc.com>' // if provided with the POST to /change-password-request
} }
```

Optional:

* `prefix`: defaults to `/auth`. This is the path prefix for all `authentic-server` API endpoints. For example if you set prefix to `/awesome`, the endpoints will be `/awesome/signup`, `/awesome/login`, `/awesome/confirm`, etc...
* `expiresIn`: defaults to `"30d"`. This is how long it takes before the token expires. Expressed in seconds or a string describing a time span [rauchg/ms](https://github.com/rauchg/ms.js). Eg: `60`, `"2 days"`, `"10h"`, `"7d"`

## Server API ##

### POST `/auth/signup`

Accepts a JSON object:

```js
{
    "email": "david@scalehaus.io", // required
    "password": "notswordfish", // required
    "confirmUrl": "https://yourwebapp.com/path/to/confirmation", // optional, if included will have ?email=${email}&confirmToken=${confirmToken} automatically added
    "from": "Authentic Accounts <auth@authentc.com>", // additional data will be provided to sendEmail
    "provide": "anything you'd like" // you can pass anything you'd like
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

```js
{
    "email": "david@scalehaus.io", // required
    "changeUrl": "https://yourwebapp.com/path/to/change-password", // optional, if included will have ?email=${email}&confirmToken=${confirmToken} automatically added
    "from": "Authentic Accounts <auth@authentc.com>", // additional data will be provided to sendEmail
    "provide": "anything you'd like" // you can pass anything you'd like
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

### POST `/auth/magic-request`

Accepts a JSON object:

```js
{
    "email": "user@example.com",
    "magicUrl": "https://yourwebapp.com/path/to/magic-action",
    "from": "Your Service Name <no-reply@yourdomain.com>",
    "provide": "anything you'd like"
}
```

This endpoint generates a `magicToken` for the user, and if a `magicUrl` is provided, it appends this token along with the user's email to the URL. It then sends an email to the user with the `magicUrl` or instructions for the next steps. On success, it responds with:

```js
{
  "success": true,
  "message": "Magic login request received. Check email for confirmation link."
}
```

This functionality allows for a seamless login or action confirmation process without the need for the user to remember a password, enhancing the user experience by leveraging a "magic link" sent via email.

### POST `/auth/magic-login`

Accepts a JSON object:

```
{
    "email": "david@scalehaus.io",
    "magicToken": "ada2..."
}
```
This endpoint will check if the `magicToken` is correct, and if it is it will respond with an `authToken`:

```
{
    "success": true,
    "message": "Magic login successful.",
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
