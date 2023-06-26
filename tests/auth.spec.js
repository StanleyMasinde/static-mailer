require('dotenv').config()
const request = require('supertest')
const app = require('../dist/app')
const { faker } = require('@faker-js/faker')
const { sign } = require('jsonwebtoken')
const application = request(app.default.callback())

const user = {
    name: faker.name.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password()
}

describe('Authentication tests', () => {
    test('Throw a 400 when the request body is missing', async () => {
        const response = await application
            .post('/v1/register')
        expect(response.status).toBe(400)
    })

    test('User registration', async () => {
        const response = await application
            .post('/v1/register')
            .send(user)

        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('token')
        expect(response.body.user).toHaveProperty('id', 'name', 'email')
    })

    test('User registration without body fails', async () => {
        const response = await application
            .post('/v1/register')

        expect(response.status).toBe(400)
        // expect(response.body.message).toBe('Bad request')
    })

    test('User registration validation', async () => {
        const response = await application
            .post('/v1/register')
            .send({
                email: 'foo',
            })

        expect(response.status).toBe(422)
    })

    test('User can login', async () => {
        const response = await application
            .post('/v1/login')
            .send({
                email: user.email,
                password: user.password
            })
            console.log(response.body);
        expect(response.status).toBe(200)
        expect(response.body).toHaveProperty('token')
    })

    test('User login without request body fails', async () => {
        const response = await application
            .post('/v1/login')

        expect(response.status).toBe(400)
        // expect(response.body.errors[0]).toBe({
        //     status: '400',
        //     title: 'Bad request.',
        //     detail: 'Request body missing.'
        // })
    })

    test('User login with wrong credentials fails', async () => {
        const response = await application
            .post('/v1/login')
            .send({
                email: 'foo@bar.com',
                password: 'wrong password'
            })
        expect(response.status).toBe(401)
        // expect(response.body.errors).toBe(Array)
    })


    // test('Handle Google reg', async () => {
    //     const response = await application
    //     .post('/v1/social-auth/google')
    //     .send({
    //         token: sign({
    //             sub: faker.random.numeric(),
    //             email: faker.internet.email(),
    //             name: faker.name.fullName()
    //         }, 'secret')
    //     })
    //     expect(response.body).toHaveProperty('token')
    // })


    // test('Handle Google login', async () => {
    //     const response = await application
    //     .post('/v1/social-auth/google')
    //     .send({
    //         token: sign({
    //             sub: faker.random.numeric(),
    //             email: user.email,
    //             name: user.password
    //         }, 'secret')
    //     })

    //     expect(response.body).toHaveProperty('token')
    // })

    // test('Get the current user', async () => { // TODO This is pointless in the functionality is is here to test authorisation
    //     const response = await application
    //         .post('/v1/login')
    //         .send({
    //             email: user.email,
    //             password: user.password
    //         })
    //     expect(response.status).toBe(200)
    //     expect(response.body).toHaveProperty('token')

    //     const authPasses = await application
    //         .get('/v1/me')
    //         .set('authorization', `Bearer ${response.body.token}`)

    //     console.log("Response", authPasses.body);
    // })
})
