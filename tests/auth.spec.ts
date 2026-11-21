import 'dotenv/config'
import request from 'supertest'
import app from '../src/app'
import { faker } from '@faker-js/faker'
import { database } from '../src/config/database'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as mailer from '../src/config/mailer'
import * as googleAuth from '../src/config/googleAuth'
import * as githubAuth from '../src/config/githubAuth'
import { createHash } from '../src/config/hash'

const application = request(app.callback())
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'

const user = {
	name: faker.person.fullName(),
	email: faker.internet.email(),
	password: faker.internet.password()
}

let token = ''
let refreshToken = ''
let userId: number
let keyUuid = ''

function withJsonApiHeaders(req: request.Test): request.Test {
	return req
		.set('Accept', JSON_API_MEDIA_TYPE)
		.set('Content-Type', JSON_API_MEDIA_TYPE)
}

describe('Authentication tests', () => {
	afterAll(async () => {
		await database.destroy()
	})

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('Throw a 400 when the request body is missing', async () => {
		const response = await application
			.post('/v1/register')
			.set('Accept', JSON_API_MEDIA_TYPE)
		expect(response.status).toBe(400)
	})

	it('User registration succeeds with valid data', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/register')
		)
			.send(user)

		expect(response.status).toBe(201)
		expect(response.body.meta).toHaveProperty('token')
		expect(response.body.meta).toHaveProperty('refresh_token')
		expect(response.body.data.attributes.email).toBe(user.email)
	})

	it('User registration fails when email exists', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/register')
		)
			.send(user)

		expect(response.status).toBe(422)
		expect(response.body).toHaveProperty('errors')
		expect(response.body.errors[0].detail).toBe('This email is already registered.')
	})

	it('User registration fails without request body', async () => {
		const response = await application
			.post('/v1/register')
			.set('Accept', JSON_API_MEDIA_TYPE)
		expect(response.status).toBe(400)
	})

	it('User registration fails with invalid data', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/register')
		)
			.send({
				email: 'foo'
			})

		expect(response.status).toBe(422)
	})

	it('User can login with valid credentials', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/login')
		)
			.send({
				email: user.email,
				password: user.password
			})

		expect(response.status).toBe(200)
		expect(response.body.data.attributes).toHaveProperty('token')
		expect(response.body.data.attributes).toHaveProperty('refresh_token')
		token = response.body.data.attributes.token
		refreshToken = response.body.data.attributes.refresh_token
	})

	it('Refresh endpoint rotates refresh tokens and returns a new access token', async () => {
		const responses = await Promise.all(
			Array.from({ length: 2 }, () =>
				withJsonApiHeaders(application.post('/v1/token/refresh'))
					.send({ refresh_token: refreshToken })
			)
		)
		expect(responses.map(({ status }) => status).sort()).toEqual([200, 401])

		const response = responses.find(({ status }) => status === 200)!
		expect(response.body.data.attributes).toHaveProperty('token')
		expect(response.body.data.attributes).toHaveProperty('refresh_token')
		expect(response.body.data.attributes.refresh_token).not.toBe(refreshToken)

		const oldTokenReuse = await withJsonApiHeaders(
			application.post('/v1/token/refresh')
		)
			.send({
				refresh_token: refreshToken
			})
		expect(oldTokenReuse.status).toBe(401)

		token = response.body.data.attributes.token
		refreshToken = response.body.data.attributes.refresh_token
	})

	it('User login fails without request body', async () => {
		const response = await application
			.post('/v1/login')
			.set('Accept', JSON_API_MEDIA_TYPE)
		expect(response.status).toBe(400)
	})

	it('User login fails with incorrect credentials', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/login')
		)
			.send({
				email: 'foo@bar.com',
				password: 'wrong password'
			})

		expect(response.status).toBe(401)
	})

	it('Get the current user', async () => {
		const response = await application
			.get('/v1/me')
			.set('Accept', JSON_API_MEDIA_TYPE)
			.set('Authorization', `Bearer ${token}`)

		expect(response.body).toHaveProperty('data')
		expect(response.body.data.type).toBe('users')
		userId = Number(response.body.data.id)
	})

	it('Get user API KEYS', async () => {
		const createResponse = await withJsonApiHeaders(
			application
				.post('/v1/apiKeys')
				.set('Authorization', `Bearer ${token}`)
		)
			.send({ name: faker.lorem.word() })
		expect(createResponse.status).toBe(201)
		keyUuid = createResponse.body.data.id

		const response = await application
			.get('/v1/apiKeys')
			.set('Accept', JSON_API_MEDIA_TYPE)
			.set('Authorization', `Bearer ${token}`)

		expect(response.body.data.length).toBe(1)
		expect(response.body.data[0].attributes).toHaveProperty('key_last4')
		expect(response.body.data[0].attributes).not.toHaveProperty('key')
	})

	it('Delete an API KEY', async () => {
		const response = await application
			.delete(`/v1/apiKeys/${keyUuid}`)
			.set('Accept', JSON_API_MEDIA_TYPE)
			.set('Authorization', `Bearer ${token}`)
		expect(response.status).toBe(204)
	})

	it('Reject API key listing without authorization', async () => {
		const response = await application
			.get('/v1/apiKeys')
			.set('Accept', JSON_API_MEDIA_TYPE)
		expect(response.status).toBe(401)
		expect(response.headers['www-authenticate']).toBe('Bearer')
	})

	it('Reject deleting another user API key', async () => {
		const secondUser = {
			name: faker.person.fullName(),
			email: faker.internet.email(),
			password: faker.internet.password()
		}
		const registerResponse = await withJsonApiHeaders(
			application.post('/v1/register')
		)
			.send(secondUser)
		expect(registerResponse.status).toBe(201)

		const createKeyResponse = await withJsonApiHeaders(
			application
				.post('/v1/apiKeys')
				.set('Authorization', `Bearer ${registerResponse.body.meta.token}`)
		)
			.send({ name: faker.lorem.word() })
		expect(createKeyResponse.status).toBe(201)

		const deleteResponse = await application
			.delete(`/v1/apiKeys/${createKeyResponse.body.data.id}`)
			.set('Accept', JSON_API_MEDIA_TYPE)
			.set('Authorization', `Bearer ${token}`)
		expect(deleteResponse.status).toBe(403)
	})

	it('Password reset returns a generic response for unknown users', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/password-reset')
		)
			.send({ email: faker.internet.email() })
		expect(response.status).toBe(200)
		expect(response.body.data.attributes.message).toBe('If the account exists, password reset instructions have been sent.')
	})

	it('Password reset creates an expiring code for a known user', async () => {
		vi.spyOn(mailer, 'sendMail').mockResolvedValue(undefined)
		const response = await withJsonApiHeaders(
			application.post('/v1/password-reset')
		)
			.send({ email: user.email })
		expect(response.status).toBe(200)
		expect(response.body.data.attributes.message).toBe('If the account exists, password reset instructions have been sent.')

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

		const response = await withJsonApiHeaders(
			application.post('/v1/password-update')
		)
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

		const password = faker.internet.password()
		const responses = await Promise.all(
			Array.from({ length: 2 }, () =>
				withJsonApiHeaders(application.post('/v1/password-update'))
					.send({ email: user.email, code: validCode, password })
			)
		)
		expect(responses.map(({ status }) => status).sort()).toEqual([200, 422])

		const resetRows = await database('password_resets').where('user_id', userId)
		expect(resetRows.length).toBe(0)

		const refreshRows = await database('refresh_tokens').where('user_id', userId)
		expect(refreshRows.length).toBe(0)
	})

	it('Social auth rejects unsupported providers', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/twitter')
		)
			.send({ token: 'abc' })
		expect(response.status).toBe(400)
	})

	it('Social auth rejects missing tokens', async () => {
		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/google')
		)
			.send({})
		expect(response.status).toBe(400)
	})

	it('Social auth rejects invalid tokens', async () => {
		vi.spyOn(googleAuth, 'verifyGoogleIdToken').mockRejectedValue(new Error('Invalid token'))
		process.env.GOOGLE_CLIENT_ID = 'test-client'
		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/google')
		)
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

		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/google')
		)
			.send({ token: 'valid-token' })
		expect(response.status).toBe(201)
		expect(response.body.data.attributes).toHaveProperty('token')
		expect(response.body.data.attributes).toHaveProperty('refresh_token')
	})

	it('Social auth links existing users and reuses provider identity', async () => {
		const providerUserId = faker.string.uuid()
		const updatedProviderEmail = faker.internet.email()
		vi.spyOn(googleAuth, 'verifyGoogleIdToken')
			.mockResolvedValueOnce({
				iss: 'https://accounts.google.com',
				aud: 'test-client',
				sub: providerUserId,
				email: user.email,
				email_verified: true,
				azp: 'test-client',
				name: user.name,
				given_name: faker.person.firstName(),
				family_name: faker.person.lastName(),
				iat: Math.floor(Date.now() / 1000) - 60,
				exp: Math.floor(Date.now() / 1000) + 3600
			})
			.mockResolvedValueOnce({
				iss: 'https://accounts.google.com',
				aud: 'test-client',
				sub: providerUserId,
				email: updatedProviderEmail,
				email_verified: true,
				azp: 'test-client',
				name: faker.person.fullName(),
				given_name: faker.person.firstName(),
				family_name: faker.person.lastName(),
				iat: Math.floor(Date.now() / 1000) - 60,
				exp: Math.floor(Date.now() / 1000) + 3600
			})
		process.env.GOOGLE_CLIENT_ID = 'test-client'

		const firstResponse = await withJsonApiHeaders(
			application.post('/v1/social-auth/google')
		)
			.send({ token: 'provider-token-1' })
		expect(firstResponse.status).toBe(200)
		expect(Number(firstResponse.body.data.id)).toBe(userId)

		const linkedAccount = await database('social_accounts')
			.where({
				provider: 'google',
				provider_user_id: providerUserId,
				user_id: userId
			})
			.first()
		expect(linkedAccount).toBeTruthy()
		expect(linkedAccount.provider_email).toBe(user.email)

		const secondResponse = await withJsonApiHeaders(
			application.post('/v1/social-auth/google')
		)
			.send({ token: 'provider-token-2' })
		expect(secondResponse.status).toBe(200)
		expect(Number(secondResponse.body.data.id)).toBe(userId)

		const socialRows = await database('social_accounts')
			.where({
				provider: 'google',
				provider_user_id: providerUserId,
				user_id: userId
			})
		expect(socialRows.length).toBe(1)
		expect(socialRows[0].provider_email).toBe(updatedProviderEmail)
	})

	it('Social auth rejects invalid GitHub tokens', async () => {
		vi.spyOn(githubAuth, 'verifyGitHubAccessToken').mockRejectedValue(new Error('Invalid token'))
		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/github')
		)
			.send({ token: 'bad-token' })
		expect(response.status).toBe(400)
	})

	it('Social auth issues a token for valid GitHub payloads', async () => {
		vi.spyOn(mailer, 'sendMail').mockResolvedValue(undefined)
		vi.spyOn(githubAuth, 'verifyGitHubAccessToken').mockResolvedValue({
			sub: faker.string.numeric(8),
			email: faker.internet.email(),
			name: faker.person.fullName()
		})

		const response = await withJsonApiHeaders(
			application.post('/v1/social-auth/github')
		)
			.send({ token: 'valid-token' })
		expect(response.status).toBe(201)
		expect(response.body.data.attributes).toHaveProperty('token')
		expect(response.body.data.attributes).toHaveProperty('refresh_token')
	})

	it('GitHub social auth links existing users and reuses provider identity', async () => {
		const providerUserId = faker.string.numeric(8)
		const updatedProviderEmail = faker.internet.email()
		vi.spyOn(githubAuth, 'verifyGitHubAccessToken')
			.mockResolvedValueOnce({
				sub: providerUserId,
				email: user.email,
				name: user.name
			})
			.mockResolvedValueOnce({
				sub: providerUserId,
				email: updatedProviderEmail,
				name: faker.person.fullName()
			})

		const firstResponse = await withJsonApiHeaders(
			application.post('/v1/social-auth/github')
		)
			.send({ token: 'provider-token-1' })
		expect(firstResponse.status).toBe(200)
		expect(Number(firstResponse.body.data.id)).toBe(userId)

		const linkedAccount = await database('social_accounts')
			.where({
				provider: 'github',
				provider_user_id: providerUserId,
				user_id: userId
			})
			.first()
		expect(linkedAccount).toBeTruthy()
		expect(linkedAccount.provider_email).toBe(user.email)

		const secondResponse = await withJsonApiHeaders(
			application.post('/v1/social-auth/github')
		)
			.send({ token: 'provider-token-2' })
		expect(secondResponse.status).toBe(200)
		expect(Number(secondResponse.body.data.id)).toBe(userId)

		const socialRows = await database('social_accounts')
			.where({
				provider: 'github',
				provider_user_id: providerUserId,
				user_id: userId
			})
		expect(socialRows.length).toBe(1)
		expect(socialRows[0].provider_email).toBe(updatedProviderEmail)
	})
})
