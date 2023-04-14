const request = require('supertest')
const app = require('../dist/app')
const application = app.default.callback()
const { faker } = require('@faker-js/faker')

describe('Email delivery test', () => {
    test('Deliver an email', async () => {
        const response = await request(application)
            .post('/api/v1/deliver')
            .send({
                subject: faker.lorem.sentence(),
                email: faker.internet.email(),
                message: faker.lorem.paragraphs()
            })
        expect(response.status).toEqual(200)
    })
})