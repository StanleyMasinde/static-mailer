const request = require('supertest')
const app = require('../dist/app')
const { database } = require('../dist/config/database')
const application = app.default.callback()

describe('General route tests', () => {
    test('Ping should return 200', async () => {
        const response = await request(application)
            .get('/ping')
        expect(response.status).toEqual(200)
        await database.destroy()
    })

    test('Test 404 response', async () => {
        const response = await request(application)
            .get('/unknown-route')
        expect(response.status)
            .toEqual(404)

        expect(response.body)
            .toHaveProperty('errors')
        await database.destroy()
    })
})