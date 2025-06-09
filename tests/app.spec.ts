import request from 'supertest'
import app from '../src/app'
import { database } from '../src/config/database'
import { describe, expect, test, } from 'vitest'
const application = app.callback()

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
