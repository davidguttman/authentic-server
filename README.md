# AuthenticServer #

This is the server component of [authentic](https://github.com/davidguttman/authentic). This provides endpoints for signup, login, confirm, and password change.

## Example ##

```js
const fs = require('fs')
const http = require('http')
const Authentic = require('authentic-server')

const auth = Authentic({
  dbUsers: __dirname + '/users/',
  dbExpiry: __dirname + '/expiry',
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  sendEmail: function (emailOpts, cb) {
    // send email however you'd like (nodemailer, powerdrill, etc...)
    // emailOpts.type is either 'signup' or 'change-password-request'
    // emailOpts.email is where to send the email
    // see API docs for more properties like confirmToken and changeToken
    setImmediate(cb)
  },
  // use below if you want Google sign-in
  googleClientId,
  googleClientSecret,
  googleRedirectUrl
})

const server = http.createServer(auth)

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
const auth = Authentic({
  dbUsers: __dirname + '/users/',
  dbExpiry: __dirname + '/expiry/',
  privateKey: fs.readFileSync(__dirname + '/rsa-private.pem'),
  publicKey: fs.readFileSync(__dirname + '/rsa-public.pem'),
  sendEmail: function (emailOpts, done) {
    console.log(emailOpts)
    setImmediate(done)
  }
})

// auth is now a function that accepts req, res, and optional next arguments
const server = http.createServer(function(req, res, next){
  auth(req, res, next)

  function next (req, res) {
    // authentic-server will call next if none of its routes match
    // useful if you want to have other routes on the server
    res.end('Not an authentic route')
  }
})

// or simply
const server = http.createServer(auth)
```

#### options ####

`Authentic()` takes an options object as its first argument, several of them are required:
* `dbUsers`: any of the following:
  * a string location of where to open (or create if it doesn't exist) a [levelDB](https://github.com/level/level) on disk
  * a `levelDB` compatible db instance (e.g. supports the [abstract-level](https://github.com/Level/abstract-level) interface)
  * an object that has `get` and `put` methods that follow this form (see [example/custom-db.js](https://github.com/davidguttman/authentic-server/blob/master/example/custom-db.js) for an example):
    * `get: function (key, cb) { ... }`
    * `put: function (key, value, cb) { ... }`
* `dbExpiry`: Optional, use only if you want the `/auth/expired` endpoint. One of the following
  * a string location of where to open (or create if it doesn't exist) a [levelDB](https://github.com/level/level) on disk
  * a `levelDB` compatible db instance (e.g. supports the [abstract-level]
  * a custom object with `put` and `iterator` functions that behave like `abstract-level` (not recommended)
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

### GET `/auth/google?redirectUrl=&redirectParam=jwt`

Redirects to the Google sign in screen. Requires `googleClientId`, `googleSecret`, and `googleRedirectUrl` to be set.

Accepts a redirectUrl query parameter. This is *not* the same thing as the `googleRedirectUrl` which is not dynamic and must be whitelisted in your Google Console config. This query parameter is where `authentic-server` will redirect the user after all the Google auth is finished and creates an *authentic* JWT. `authentic-server` will redirect the user back to this url and append the JWT for use in the client application.

An example of how this works in practice is that you would have a web app that wants to authenticate a user. If the web app's domain is `webapp.com`, the web app creates a "Sign In With Google" button and it will link to `authentic-server.com/auth/google?redirectUrl=https%3A%2F%2Fwebapp.com%2F%23%2Fauth%2Fjwt` (`redirectUrl` is `https://webapp.com/#/auth/jwt`). 

The user clicks that link and goes to `authentic-server`. `authentic-server` redirects the user to Google to sign in. Google redirects the user back to `authentic-server` with the Google code. `authentic-server` uses the Google code to get a Google token. `authentic-server` uses the Google token to get the user's email. `authentic-server` creates a JWT with their email. _Finally_ `authentic-server` redirects the user back to `https://webapp.com/?jwt=eyJhbG...#/auth/jwt` (the `redirectUrl` with `jwt` query parameter specified by `redirectParam` ).

### GET `/auth/expired`

Returns an object of email hashes and expiration time pairs. Services can use this to deny access to any token that has been issued before the expiration time. Example:

```js
{
  '733e02770582a9c8898ddf61cfc1b0a0128f9105e8e17dc1d24e7623158014ef': 1718648699,
  '4a681d808e8868e50f9aee342083a98a5343e451e5caa611d9324293656b6a0a': 1718648700
}
```

Email hashes are `sha256`. For example:

```js
  email = 'pwchange@example.com'
  require('crypto').createHash('sha256').update(email).digest('hex')
  // '4a681d808e8868e50f9aee342083a98a5343e451e5caa611d9324293656b6a0a'
```

# License #

MIT
