require('dotenv').config()
const request = require('supertest')
const app = require('../dist/app')
const { faker } = require('@faker-js/faker')
const application = request(app.default.callback())

describe('Authentication tests', () => {
    test('Throw a 400 when the request body is missing', async () => {
        const response = await application
            .post('/auth/register')
        expect(response.status).toBe(400)
    })

    test('User registration', async () => {
        const response = await application
            .post('/auth/register')
            .send({
                name: faker.name.fullName(),
                email: faker.internet.email(),
                password: faker.internet.password()
            })

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('token')
        expect(response.body.user).toHaveProperty('id', 'name', 'email')
    })
})