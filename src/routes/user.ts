import koaRouter from '@koa/router'
import { validate } from '../actions/validate.js'
import { createApiKey, deleteApiKey, getUserApiKeys } from '../actions/apiKey.js'
import { authorize } from '../actions/auth.js'

const router = new koaRouter({ prefix: '/v1' })

router
	.post('/apiKeys', authorize, validate({ name: 'required' }), createApiKey)
	.get('/apiKeys', authorize, getUserApiKeys)
	.delete('/apiKeys/:uuid', authorize, deleteApiKey)

export const userRoutes = () => router.routes()
export const allowedUserMethods = () => router.allowedMethods()
