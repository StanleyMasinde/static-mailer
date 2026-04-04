import { randomInt } from 'node:crypto'
import { Context, Next } from 'koa'
import { GoogleJWTPayload, LoginRequest, PasswordResetsTable, RegisterRequest, UserTable, ChangePasswordRequest } from '../types.js'
import { database } from '../config/database.js'
import { compareHash, createHash } from '../config/hash.js'
import { createToken, verifyToken } from '../config/jwt.js'
import { sendMail } from '../config/mailer.js'
import { JwtPayload } from 'jsonwebtoken'
import { verifyGoogleIdToken } from '../config/googleAuth.js'

/**
 * Register a new user
 * @param ctx Koa context
 */
export const register = async (ctx: Context) => {
	const body = ctx.request.body
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		ctx.throw(400, 'Invalid request body')
	}
	const requestBody = body as unknown as RegisterRequest
	const password = await createHash(requestBody.password)

	const userExists = await database<UserTable>('users').where('email', requestBody.email).first()
	if (userExists) {
		ctx.status = 422
		ctx.header['content-type'] = 'application/vnd.api+json'
		ctx.body = {
			errors: [
				{
					source: '/data/attributes/email',
					title: 'Invalid E-mail',
					message: 'This email is already registered'
				}
			]
		}
		return
	}
	const [userId] = await database<UserTable>('users')
		.insert({
			'name': requestBody.name,
			'email': requestBody.email,
			'password': password
		})
	const user = await database<UserTable>('users').where('id', userId).first('id', 'name', 'email')
	if (user) {
		const Payload: JwtPayload = {
			sub: `${user.id}`,
			attributes: {
				name: user.name,
				email: user.email
			}
		}
		const token = createToken(Payload)
		ctx.body = {
			user,
			token
		}
		sendMail({
			subject: 'Welcome to Static Mailer',
			receipient: user.email,
			template: 'welcome',
			data: user
		})
		return
	}

	ctx.throw('Error registering user')
}

/**
 * Login a user and return a token
 * @param ctx Koa context
 */
export const login = async (ctx: Context) => {
	const body = ctx.request.body
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		ctx.throw(400, 'Invalid request body')
	}
	const requestBody = body as unknown as LoginRequest
	const user = await database<UserTable>('users').where('email', requestBody.email).first()
	// The user exists we now check if the password matches
	if (user) {
		const passwordMatches = await compareHash(requestBody.password, user.password)
		// The password matches so we generate a JWT
		if (passwordMatches) {
			const Payload: JwtPayload = {
				sub: `${user.id}`,
				attributes: {
					name: user.name,
					email: user.email
				}
			}
			const token = createToken(Payload)
			ctx.body = {
				token
			}
			return
		}
		// The password did not match send a failed auth response
		return sendFailedAuthResponse()
	}
	return sendFailedAuthResponse()

	function sendFailedAuthResponse() {
		ctx.status = 401
		ctx.header['content-type'] = 'application/vnd.api+json'
		ctx.body = {
			errors: [
				{
					status: '401',
					title: 'Authentication error.',
					detail: 'These credentials do not match our records.'
				}
			]
		}
		return
	}
}

/**
 * Get the currently authenticated user
 * @param ctx Koa.context
 */
export const me = async (ctx: Context) => {
	const bearerToken = ctx.request.header['authorization']?.split(' ')[1]

	if (bearerToken) {
		const userInToken = verifyToken(bearerToken)
		const user = await database<UserTable>('users')
			.where('id', userInToken.sub)
			.first()
		ctx.body = {
			user
		}
		return
	}
}

/**
 * Prevent unauthenticated route access
 * @param ctx 
 * @param next 
 */
export const authorize = async (ctx: Context, next: Next) => {
	const bearerToken = ctx.request.header['authorization']?.split(' ')[1]
	if (bearerToken) {
		try {
			const user = verifyToken(bearerToken)
			ctx.state.user = user
			return await next()
		} catch (err) {
			return sendUnauthorizedResponse()
		}
	}

	return sendUnauthorizedResponse()

	function sendUnauthorizedResponse() {
		ctx.status = 403
		ctx.header['content-type'] = 'application/vnd.api+json'
		ctx.body = {
			errors: [
				{
					status: '403',
					title: 'Authorization error.',
					detail: 'You are not allowed to access this resource.'
				}
			]
		}
		return
	}
}


/**
 * Handle password reset request.
 * 
 */
export const sendPasswordResetInstructions = async (ctx: Context) => {
	try {
		const body = ctx.request.body
		if (!body || typeof body !== 'object' || Array.isArray(body) || typeof (body as Record<string, unknown>).email !== 'string') {
			ctx.throw(400, 'Invalid request body')
		}
		const email = (body as { email: string }).email
		const user = await database<UserTable>('users').where({ email }).first()
		if (user) {
			const code = randomInt(99999, 1000000).toString()
			const codeHash = await createHash(code.toString())
			const date = new Date()
			const currentMinutes = date.getMinutes()
			date.setMinutes(currentMinutes + 60)
			await database<PasswordResetsTable>('password_resets')
				.insert({
					user_id: user.id,
					code: codeHash,
					expires_at: date
				})
			try {
				await sendMail({
					template: 'passwordreset',
					subject: 'Password reset notification',
					receipient: user.email,
					data: {
						code
					}
				})
			} catch (error) {
				ctx.app.emit('error', error as Error, ctx)
			}
		}

		ctx.body = {
			message: 'If the account exists, password reset instructions have been sent.'
		}
	} catch (error) {
		ctx.app.emit('error', error as Error, ctx)
		ctx.throw('Server Error')
	}
}

/**
 * Change user password.
 */
export const changeUserPassword = async (ctx: Context) => {
	try {
		const body = ctx.request.body
		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			ctx.throw(400, 'Invalid request body')
		}
		const requestBody = body as unknown as ChangePasswordRequest
		const user = await database<UserTable>('users')
			.where('email', requestBody.email)
			.first()

		if (!user) {
			return sendInvalidPasswordResetCodeResponse(ctx)
		}

		const resetCode = await database<PasswordResetsTable>('password_resets')
			.where('user_id', user.id)
			.where('expires_at', '>', new Date())
			.orderBy('id', 'desc')
			.first()

		if (!resetCode) {
			return sendInvalidPasswordResetCodeResponse(ctx)
		}

		const codeMatches = await compareHash(requestBody.code, resetCode.code)
		if (!codeMatches) {
			return sendInvalidPasswordResetCodeResponse(ctx)
		}

		const newPassword = await createHash(requestBody.password)
		await database<UserTable>('users')
			.where('id', user.id)
			.update({ 'password': newPassword })
		await database<PasswordResetsTable>('password_resets')
			.where('user_id', user.id)
			.delete()
		ctx.header['content-type'] = 'application/vnd.api+json'
		ctx.body = {
			data: {
				id: user.id,
				type: 'password_resets',
				attributes: {
					status: 'success',
					message: 'Your password has been successfully reset.'
				}
			}
		}
		return
	} catch (error) {
		ctx.app.emit('error', error as Error, ctx)
		ctx.throw('Something broke!')
	}
}

function sendInvalidPasswordResetCodeResponse(ctx: Context) {
	ctx.header['content-type'] = 'application/vnd.api+json'
	ctx.status = 422
	ctx.body = {
		errors: [
			{
				status: '422',
				code: 'invalid_password_reset_code',
				title: 'Invalid Password Reset Code',
				detail: 'The password reset code is invalid or has expired.'
			}
		]
	}
}




/**
 * Handle social auth
 */
export const socialAuth = async (ctx: Context) => {
	const provider = ctx.params.provider

	switch (provider) {
	case 'google':
		await handleGoogleAuth()
		break
	default:
		invalidProvidererror()
		break
	}

	async function handleGoogleAuth() {
		const body = ctx.request.body
		const token = typeof body === 'string'
			? body
			: body && typeof body === 'object' && !Array.isArray(body) && typeof (body as Record<string, unknown>).token === 'string'
				? (body as { token: string }).token
				: null
		if (!token) {
			return missingTokenError()
		}

		const expectedAudience = process.env.GOOGLE_CLIENT_ID
		if (!expectedAudience) {
			return socialAuthMisconfiguredError()
		}

		let userInfo: GoogleJWTPayload
		try {
			userInfo = await verifyGoogleIdToken(token, expectedAudience)
		} catch {
			return invalidTokenError()
		}

		const email = userInfo.email
		const userInDb = await database<UserTable>('users').where('email', email).first()

		if (userInDb) {
			const Payload: JwtPayload = {
				sub: `${userInDb.id}`,
				attributes: {
					name: userInDb.name,
					email: userInDb.email
				}
			}

			const token = createToken(Payload)
			ctx.body = {
				token
			}
			return
		}

		const [userId] = await database<UserTable>('users').insert({
			name: userInfo.name,
			email: userInfo.email,
			password: '',
		})

		const Payload: JwtPayload = {
			sub: `${userId}`,
			attributes: {
				name: userInfo.name,
				email: userInfo.email
			}
		}
		const token2 = createToken(Payload)
		ctx.body = {
			token: token2
		}
		sendMail({
			subject: 'Welcome to Static Mailer',
			receipient: userInfo.email,
			template: 'welcome',
			data: {
				name: userInfo.name,
				email: userInfo.email,
				given_name: userInfo.given_name,
				family_name: userInfo.family_name
			}
		})

		return
	}

	function missingTokenError() {
		ctx.status = 400
		ctx.body = {
			errors: [
				{
					status: 400,
					title: 'Missing token',
					detail: 'Token missing from request body.'
				}
			]
		}
		return
	}

	function invalidProvidererror() {
		ctx.status = 400
		return ctx.body = {
			errors: [
				{
					status: 400,
					title: 'Invalid provider',
					detail: 'The provider is not supported. The supported provider is Google'
				}
			]
		}
	}

	function invalidTokenError() {
		ctx.status = 400
		return ctx.body = {
			errors: [
				{
					status: 400,
					title: 'Invalid token',
					detail: 'The provided token is invalid.'
				}
			]
		}
	}

	function socialAuthMisconfiguredError() {
		ctx.status = 500
		return ctx.body = {
			errors: [
				{
					status: 500,
					title: 'Server configuration error',
					detail: 'Google social authentication is not configured.'
				}
			]
		}
	}
}
