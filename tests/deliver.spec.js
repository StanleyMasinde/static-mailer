require('dotenv').config()
const request = require('supertest')
const app = require('../dist/app')
const application = app.default.callback()
const { faker } = require('@faker-js/faker')

const requester = request(application)
const user = {
    name: faker.name.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password()
}

describe('Email delivery test', () => {
    test('Deliver an email', async () => {
        const registerUserRequest = await requester
            .post('/auth/register')
            .send(user)
        expect(registerUserRequest.status).toBe(200)
        expect(registerUserRequest.body).toHaveProperty('token')
        expect(registerUserRequest.body.user).toHaveProperty('id', 'name', 'email')

        const createApiKeyRequest = await requester
            .post('/user/apiKeys')
            .set('authorization', `Bearer ${registerUserRequest.body.token}`)
            .send({
                name: faker.lorem.words(),
            })

        const deliveryResponse = await requester
            .post(`/api/v1/deliver/${createApiKeyRequest.body.apiKey.key}`)
            .send({
                subject: faker.lorem.sentence(),
                email: faker.internet.email(),
                message: faker.lorem.paragraphs()
            })
        expect(deliveryResponse.status).toEqual(200)
    })
})
