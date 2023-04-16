require('dotenv').config()
const request = require('supertest')
const app = require('../dist/app')
const application = app.default.callback()
const { faker } = require('@faker-js/faker')
const user = {
    name: faker.name.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password()
}

describe('Email delivery test', () => {
    test('Deliver an email', async () => {
        const response = await request(application)
        .post('/auth/register')
        .send(user)
    const token = response.body.token
    console.log('token', token)
    const createApiKey = await request(application)
        .post('/user/apiKeys')
        .set('authorization', `Bearer ${token}`)
        .send({
            name: faker.lorem.words(),
        })
        
        console.log('apiKeyResponse', createApiKey.body)
    
        const deliveryResponse = await request(application)
            .post(`/api/v1/deliver/${createApiKey.body.apiKey.key}`)
            .send({
                subject: faker.lorem.sentence(),
                email: faker.internet.email(),
                message: faker.lorem.paragraphs()
            })
        expect(deliveryResponse.status).toEqual(200)
    })
})
