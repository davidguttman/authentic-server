curl 'http://localhost:1337/auth/signup' -X POST -d '{
    "email": "chet@scalehaus.io",
    "password": "notswordfish",
    "confirmUrl": "http://admin.scalehaus.io/#/confirm"
}' -H 'Content-Type: application/json'
