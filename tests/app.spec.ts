import request from 'supertest'
import app from '../src/app'
import { database } from '../src/config/database'
import { describe, expect, test, } from 'vitest'
const application = app.callback()

describe('General route tests', () => {
	test('Serves OpenAPI spec', async () => {
		const response = await request(application)
			.get('/openapi.yaml')
		expect(response.status).toEqual(200)
		expect(response.headers['content-type']).toContain('text/yaml')
		expect(response.text).toContain('openapi: 3.2.0')
		await database.destroy()
	})

	test('Serves Swagger-style docs UI', async () => {
		const response = await request(application)
			.get('/docs')
		expect(response.status).toEqual(200)
		expect(response.headers['content-type']).toContain('text/html')
		expect(response.text).toContain('StaticMailer API Docs')
		expect(response.text).toContain('/openapi.yaml')
		expect(response.text).toContain('SwaggerUIBundle')
		await database.destroy()
	})

	test('Ping should return 200', async () => {
		const response = await request(application)
			.get('/ping')
		expect(response.status).toEqual(200)
		await database.destroy()
	})

	test('Test JSON:API 404 response', async () => {
		const response = await request(application)
			.get('/v1/unknown-route')
			.set('Accept', 'application/vnd.api+json')
		expect(response.status)
			.toEqual(404)

		expect(response.body)
			.toHaveProperty('errors')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})

	test('Test 406 when Accept is not JSON:API', async () => {
		const response = await request(application)
			.post('/v1/register')
			.set('Accept', 'application/json')
			.set('Content-Type', 'application/vnd.api+json')
			.send({
				name: 'Test User',
				email: 'user@example.com',
				password: 'secret'
			})

		expect(response.status).toEqual(406)
		expect(response.body).toHaveProperty('errors')
		expect(response.body.errors[0].status).toBe('406')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})

	test('Test 415 when Content-Type is not JSON:API', async () => {
		const response = await request(application)
			.post('/v1/register')
			.set('Accept', 'application/vnd.api+json')
			.set('Content-Type', 'application/json')
			.send({
				name: 'Test User',
				email: 'user@example.com',
				password: 'secret'
			})

		expect(response.status).toEqual(415)
		expect(response.body).toHaveProperty('errors')
		expect(response.body.errors[0].status).toBe('415')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})

	test('Test 406 when JSON:API in Accept has q=0', async () => {
		const response = await request(application)
			.post('/v1/register')
			.set('Accept', 'application/vnd.api+json;q=0')
			.set('Content-Type', 'application/vnd.api+json')
			.send({
				name: 'Test User',
				email: 'user@example.com',
				password: 'secret'
			})

		expect(response.status).toEqual(406)
		expect(response.body).toHaveProperty('errors')
		expect(response.body.errors[0].status).toBe('406')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})

	test('Test 415 when JSON:API Content-Type has unsupported parameter', async () => {
		const response = await request(application)
			.post('/v1/register')
			.set('Accept', 'application/vnd.api+json')
			.set('Content-Type', 'application/vnd.api+json; charset=utf-8')
			.send({
				name: 'Test User',
				email: 'user@example.com',
				password: 'secret'
			})

		expect(response.status).toEqual(415)
		expect(response.body).toHaveProperty('errors')
		expect(response.body.errors[0].status).toBe('415')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})

	test('Test 405 includes Allow header', async () => {
		const response = await request(application)
			.put('/v1/login')
			.set('Accept', 'application/vnd.api+json')
			.set('Content-Type', 'application/vnd.api+json')
			.send({
				email: 'user@example.com',
				password: 'secret'
			})

		expect(response.status).toEqual(405)
		expect(response.headers).toHaveProperty('allow')
		expect(response.headers.allow).toContain('POST')
		expect(response.body).toHaveProperty('errors')
		expect(response.headers['content-type']).toContain('application/vnd.api+json')
		await database.destroy()
	})
})
