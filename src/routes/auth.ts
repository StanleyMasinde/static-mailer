import koaRouter from '@koa/router'
import { authorize, changeUserPassword, login, me, register, sendPasswordResetInstructions, socialAuth } from '../actions/auth.js'
import { validate } from '../actions/validate.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = new koaRouter({ prefix: '/v1' })

router.post('/register',
	rateLimit({ keyPrefix: 'register', windowMs: 15 * 60_000, maxRequests: 20 }),
	validate({
		name: 'required',
		email: 'required|email',
		password: 'required',
	}),
	register)

router.post('/login',
	rateLimit({ keyPrefix: 'login', windowMs: 15 * 60_000, maxRequests: 10 }),
	validate({
		email: 'required|email',
		password: 'required'
	}),
	login)

router.post('/password-reset',
	rateLimit({ keyPrefix: 'password-reset', windowMs: 15 * 60_000, maxRequests: 5 }),
	validate({
		email: 'required|email'
	}),
	sendPasswordResetInstructions
)

router.post('/password-update',
	validate({
		code: 'required',
		email: 'required|email',
		password: 'required'
	}),
	changeUserPassword
)

router.get('/me', authorize, me)

router.post('/social-auth/:provider', socialAuth)

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
