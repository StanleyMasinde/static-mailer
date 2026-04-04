import koaRouter from '@koa/router'
import { deliverEmail } from '../actions/deliver.js'
import { validate } from '../actions/validate.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = new koaRouter()

router.post('/api/v1/deliver/:apiKey',
	rateLimit({ keyPrefix: 'deliver', windowMs: 60_000, maxRequests: 30 }),
	validate({
		subject: 'required',
		email: 'required|email',
		message: 'required'
	}),
	deliverEmail)

export const publicApiRoutes = () => router.routes()
export const allowedPublicApiMethods = () => router.allowedMethods()
