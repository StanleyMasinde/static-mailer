import 'dotenv/config'
import request from 'supertest'
import app from '../src/app'
import { database } from '../src/config/database'
import { faker } from '@faker-js/faker'
import * as mailer from '../src/config/mailer'
import { afterAll, beforeEach, describe, it, vi } from 'vitest'
import { expect } from 'vitest'

const application = app.callback()
const requester = request(application)
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'
const user = {
	name: faker.person.fullName(),
	email: faker.internet.email(),
	password: faker.internet.password(),
}

function withJsonApiHeaders(req: request.Test): request.Test {
	return req
		.set('Accept', JSON_API_MEDIA_TYPE)
		.set('Content-Type', JSON_API_MEDIA_TYPE)
}

describe('Email delivery test', () => {
	afterAll(async () => {
		await database.destroy()
	})

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('Deliver an email', async () => {
		const registerUserRequest = await withJsonApiHeaders(
			requester.post('/v1/register')
		).send(user)

		expect(registerUserRequest.status).toBe(201)
		expect(registerUserRequest.body.meta).toHaveProperty('token')
		expect(registerUserRequest.body.data.attributes.email).toBe(user.email)

		const createApiKeyRequest = await withJsonApiHeaders(
			requester
				.post('/v1/apiKeys')
				.set('authorization', `Bearer ${registerUserRequest.body.meta.token}`)
		).send({
			name: faker.lorem.words(),
		})

		expect(createApiKeyRequest.status).toBe(201)
		expect(createApiKeyRequest.body).toHaveProperty('data')
		expect(createApiKeyRequest.body).toHaveProperty('meta')
		expect(createApiKeyRequest.body.data.attributes).toHaveProperty('key_last4')
		expect(createApiKeyRequest.body.data.attributes).not.toHaveProperty('key')

		const deliveryResponse = await withJsonApiHeaders(
			requester.post(`/api/v1/deliver/${createApiKeyRequest.body.meta.raw_key}`)
		).send({
			subject: faker.lorem.sentence(),
			email: faker.internet.email(),
			message: faker.lorem.paragraphs(),
		})

		expect(deliveryResponse.status).toBe(202)

		const keyUuid = createApiKeyRequest.body.data.id
		const submission = await database('email_submissions')
			.where('key_uuid', keyUuid)
			.orderBy('id', 'desc')
			.first()
		expect(submission).toBeTruthy()
		expect(submission.delivery_status).toBe('accepted')
		expect(submission.sender_ip).toBeTruthy()

		const keyRecord = await database('api_keys')
			.where('uuid', keyUuid)
			.first()
		expect(keyRecord.last_used_at).toBeTruthy()
	})

	it('Rejects delivery requests with missing subject', async () => {
		const deliveryResponse = await withJsonApiHeaders(
			requester.post('/api/v1/deliver/some-key')
		).send({
			email: faker.internet.email(),
			message: faker.lorem.paragraphs(),
		})

		expect(deliveryResponse.status).toBe(422)
	})

	it('Return 404 when key is not found', async () => {
		const deliveryResponse = await withJsonApiHeaders(
			requester.post('/api/v1/deliver/some-key')
		).send({
			subject: faker.lorem.sentence(),
			email: faker.internet.email(),
			message: faker.lorem.paragraphs(),
		})

		expect(deliveryResponse.status).toBe(404)
		expect(deliveryResponse.body).toHaveProperty('errors')
	})

	it('Records failed delivery status when mail transport fails', async () => {
		const registerUserRequest = await withJsonApiHeaders(
			requester.post('/v1/register')
		).send({
			name: faker.person.fullName(),
			email: faker.internet.email(),
			password: faker.internet.password(),
		})

		const createApiKeyRequest = await withJsonApiHeaders(
			requester
				.post('/v1/apiKeys')
				.set('authorization', `Bearer ${registerUserRequest.body.meta.token}`)
		).send({
			name: faker.lorem.words(),
		})

		vi.spyOn(mailer, 'fowardEmail').mockRejectedValue(new Error('SMTP unavailable'))

		const deliveryResponse = await withJsonApiHeaders(
			requester.post(`/api/v1/deliver/${createApiKeyRequest.body.meta.raw_key}`)
		).send({
			subject: faker.lorem.sentence(),
			email: faker.internet.email(),
			message: faker.lorem.paragraphs(),
		})

		expect(deliveryResponse.status).toBe(502)
		expect(deliveryResponse.body).toHaveProperty('errors')

		const failedSubmission = await database('email_submissions')
			.where('key_uuid', createApiKeyRequest.body.data.id)
			.orderBy('id', 'desc')
			.first()
		expect(failedSubmission.delivery_status).toBe('failed')
	})
})
