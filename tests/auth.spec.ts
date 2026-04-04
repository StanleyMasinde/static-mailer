import 'dotenv/config'
import request from 'supertest'
import app from '../src/app'
import { faker } from '@faker-js/faker'
import { database } from '../src/config/database'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as mailer from '../src/config/mailer'
import * as googleAuth from '../src/config/googleAuth'
import { createHash } from '../src/config/hash'
const application = request(app.callback())

const user = {
	name: faker.person.fullName(),
	email: faker.internet.email(),
	password: faker.internet.password()
};

let token = ''
let userId: number
let keyUuid = ''

describe('Authentication tests', () => {
	afterAll(async () => {
		await database.destroy();
	});

	beforeEach(() => {
		vi.restoreAllMocks()
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
		const createResponse = await application
			.post('/v1/apiKeys')
			.set('Authorization', `Bearer ${token}`)
			.send({ name: faker.lorem.word() })
		expect(createResponse.status).toBe(200)
		keyUuid = createResponse.body.apiKey.uuid

		const response = await application
			.get('/v1/apiKeys')
			.set('Authorization', `Bearer ${token}`)

		expect(response.body.data.length).toBe(1)
		expect(response.body.data[0].attributes).toHaveProperty('key_last4')
		expect(response.body.data[0].attributes).not.toHaveProperty('key')
	})

	it('Delete an API KEY', async () => {
		const response = await application
			.delete(`/v1/apiKeys/${keyUuid}`)
			.set('Authorization', `Bearer ${token}`)
		expect(response.status).toBe(200)
		expect(response.body.data).toBe('Key deleted.')
	})

	it('Reject API key listing without authorization', async () => {
		const response = await application.get('/v1/apiKeys')
		expect(response.status).toBe(403)
	})

	it('Reject deleting another user API key', async () => {
		const secondUser = {
			name: faker.person.fullName(),
			email: faker.internet.email(),
			password: faker.internet.password()
		}
		const registerResponse = await application
			.post('/v1/register')
			.send(secondUser)
		expect(registerResponse.status).toBe(200)

		const createKeyResponse = await application
			.post('/v1/apiKeys')
			.set('Authorization', `Bearer ${registerResponse.body.token}`)
			.send({ name: faker.lorem.word() })
		expect(createKeyResponse.status).toBe(200)

		const deleteResponse = await application
			.delete(`/v1/apiKeys/${createKeyResponse.body.apiKey.uuid}`)
			.set('Authorization', `Bearer ${token}`)
		expect(deleteResponse.status).toBe(403)
	})

	it('Password reset returns a generic response for unknown users', async () => {
		const response = await application
			.post('/v1/password-reset')
			.send({ email: faker.internet.email() })
		expect(response.status).toBe(200)
		expect(response.body.message).toBe('If the account exists, password reset instructions have been sent.')
	})

	it('Password reset creates an expiring code for a known user', async () => {
		vi.spyOn(mailer, 'sendMail').mockResolvedValue(undefined)
		const response = await application
			.post('/v1/password-reset')
			.send({ email: user.email })
		expect(response.status).toBe(200)
		expect(response.body.message).toBe('If the account exists, password reset instructions have been sent.')

		const resetRow = await database('password_resets')
			.where('user_id', userId)
			.orderBy('id', 'desc')
			.first()
		expect(resetRow).toBeTruthy()
		expect(new Date(resetRow.expires_at).getTime()).toBeGreaterThan(Date.now())
	})

	it('Password update fails for expired reset codes', async () => {
		const expiredCode = faker.string.numeric(6)
		await database('password_resets').insert({
			user_id: userId,
			code: await createHash(expiredCode),
			expires_at: new Date(Date.now() - (60 * 1000))
		})

		const response = await application
			.post('/v1/password-update')
			.send({
				email: user.email,
				code: expiredCode,
				password: faker.internet.password()
			})
		expect(response.status).toBe(422)
	})

	it('Password update succeeds with a valid reset code and invalidates reset rows', async () => {
		const validCode = faker.string.numeric(6)
		await database('password_resets').insert({
			user_id: userId,
			code: await createHash(validCode),
			expires_at: new Date(Date.now() + (60 * 60 * 1000))
		})

		const response = await application
			.post('/v1/password-update')
			.send({
				email: user.email,
				code: validCode,
				password: faker.internet.password()
			})
		expect(response.status).toBe(200)

		const resetRows = await database('password_resets').where('user_id', userId)
		expect(resetRows.length).toBe(0)
	})

	it('Social auth rejects unsupported providers', async () => {
		const response = await application
			.post('/v1/social-auth/twitter')
			.send({ token: 'abc' })
		expect(response.status).toBe(400)
	})

	it('Social auth rejects missing tokens', async () => {
		const response = await application
			.post('/v1/social-auth/google')
			.send({})
		expect(response.status).toBe(400)
	})

	it('Social auth rejects invalid tokens', async () => {
		vi.spyOn(googleAuth, 'verifyGoogleIdToken').mockRejectedValue(new Error('Invalid token'))
		process.env.GOOGLE_CLIENT_ID = 'test-client'
		const response = await application
			.post('/v1/social-auth/google')
			.send({ token: 'bad-token' })
		expect(response.status).toBe(400)
	})

	it('Social auth issues a token for valid Google payloads', async () => {
		vi.spyOn(mailer, 'sendMail').mockResolvedValue(undefined)
		vi.spyOn(googleAuth, 'verifyGoogleIdToken').mockResolvedValue({
			iss: 'https://accounts.google.com',
			aud: 'test-client',
			sub: faker.string.uuid(),
			email: faker.internet.email(),
			email_verified: true,
			azp: 'test-client',
			name: faker.person.fullName(),
			given_name: faker.person.firstName(),
			family_name: faker.person.lastName(),
			iat: Math.floor(Date.now() / 1000) - 60,
			exp: Math.floor(Date.now() / 1000) + 3600
		})
		process.env.GOOGLE_CLIENT_ID = 'test-client'

		const response = await application
			.post('/v1/social-auth/google')
			.send({ token: 'valid-token' })
		expect(response.status).toBe(200)
		expect(response.body).toHaveProperty('token')
	})
});
