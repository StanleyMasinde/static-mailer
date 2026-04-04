import 'dotenv/config'
import request from 'supertest'
import app from '../src/app'
import { faker } from '@faker-js/faker'
import { database } from '../src/config/database'
import { afterAll, describe, expect, it } from 'vitest'
const application = request(app.callback())

const user = {
	name: faker.person.fullName(),
	email: faker.internet.email(),
	password: faker.internet.password()
};

let token = ''
let userId = null
let keyUiid = faker.string.uuid()

describe('Authentication tests', () => {
	afterAll(async () => {
		await database.destroy();
	});

	it('Throw a 400 when the request body is missing', async () => {
		const response = await application.post('/v1/register');
		expect(response.status).toBe(400);
	});

	it('User registration succeeds with valid data', async () => {
		const response = await application
			.post('/v1/register')
			.send(user);

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('token');
		expect(response.body.user.email).toBe(user.email);
	});

	it('User registration fails when email exists', async () => {
		const response = await application
			.post('/v1/register')
			.send(user);

		expect(response.status).toBe(422);
		expect(response.body).toHaveProperty('errors');
		expect(response.body.errors[0].message).toBe('This email is already registered');
	});

	it('User registration fails without request body', async () => {
		const response = await application.post('/v1/register');
		expect(response.status).toBe(400);
	});

	it('User registration fails with invalid data', async () => {
		const response = await application
			.post('/v1/register')
			.send({
				email: 'foo'
			});

		expect(response.status).toBe(422);
	});

	it('User can login with valid credentials', async () => {
		const response = await application
			.post('/v1/login')
			.send({
				email: user.email,
				password: user.password
			});

		expect(response.status).toBe(200);
		expect(response.body).toHaveProperty('token');
		token = response.body.token
	});

	it('User login fails without request body', async () => {
		const response = await application.post('/v1/login');
		expect(response.status).toBe(400);
	});

	it('User login fails with incorrect credentials', async () => {
		const response = await application
			.post('/v1/login')
			.send({
				email: 'foo@bar.com',
				password: 'wrong password'
			});

		expect(response.status).toBe(401);
	});

	it('Get the current user', async () => {
		const response = await application
			.get('/v1/me')
			.set('Authorization', `Bearer ${token}`)

		expect(response.body).toHaveProperty('user')
		userId = response.body.user.id
	})

	it('Get user API KEYS', async () => {
		await database('api_keys')
			.insert({
				uuid: keyUiid,
				key: faker.string.alphanumeric(16),
				user_id: userId
			})
		const response = await application
			.get('/v1/apiKeys')
			.set('Authorization', `Bearer ${token}`)

		expect(response.body.data.length).toBe(1)
	})

	it('Delete an API KEY', async () => {
		const response = await application
			.delete(`/v1/apiKeys/${keyUiid}`)
			.set('Authorization', `Bearer ${token}`)
		expect(response.status).toBe(200)
		expect(response.body.data).toBe('Key deleted.')
	})
});
