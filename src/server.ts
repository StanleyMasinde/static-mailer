import { createSecureServer } from 'node:http2'
import { readFileSync } from 'node:fs'
import app from './app'

let port: number
if (process.env.APP_PORT) {
    port = +process.env.APP_PORT
} else {
    port = 3000
}

const server = createSecureServer({
    cert: readFileSync('./keys/localhost-cert.pem'),
    key: readFileSync('./keys/localhost-privkey.pem'),
    allowHTTP1: true
}, app.callback())

server
    .listen(port, '127.0.0.1', () => {
        console.log(`Application running on https://localhost:${port}`)
    })
