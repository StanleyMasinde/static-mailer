import koaRouter from '@koa/router'
import { koaBody } from 'koa-body'
import { authorize, changeUserPassword, login, me, register, sendPasswordResetInstructions, socialAuth } from '../actions/auth'
import { validate } from '../actions/validate'

const router = new koaRouter({ prefix: '/v1' })

router.post('/register',
	validate({
		name: 'required',
		email: 'required|email',
		password: 'required',
	}),
	register)

router.post('/login',
	validate({
		email: 'required|email',
		password: 'required'
	}),
	login)

router.post('/password-reset',
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

router.post('/social-auth/:provider', koaBody(), socialAuth)

export const authRoutes = () => router.routes()
export const allowedAuthMethods = () => router.allowedMethods()
