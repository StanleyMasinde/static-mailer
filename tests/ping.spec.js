const request = require('supertest')
const app = require('../dist/app')
const application = app.default.callback()

describe('Ping tests', () => {
    test('Should respond with 200', async () => {
        const response = await request(application)
            .get('/ping')
        expect(response.status).toEqual(200)
    })
})