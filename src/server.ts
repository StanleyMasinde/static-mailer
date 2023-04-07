import { createSecureServer } from 'node:http2'
import { readFileSync } from 'node:fs'
import app from './app'

const server = createSecureServer({
    cert: readFileSync('./keys/localhost-cert.pem'),
    key: readFileSync('./keys/localhost-privkey.pem')
}, app.callback())

server
    .listen(3000, 'localhost', () => {
        console.log('Application running on https://localhost:3000')
    })
