import { randomInt } from 'node:crypto'
import { Context, Next } from 'koa'
import { JwtPayload } from 'jsonwebtoken'
import { GoogleJWTPayload, LoginRequest, PasswordResetsTable, RegisterRequest, UserTable, ChangePasswordRequest } from '../types.js'
import { database } from '../config/database.js'
import { compareHash, createHash } from '../config/hash.js'
import { createToken, verifyToken } from '../config/jwt.js'
import { sendMail } from '../config/mailer.js'
import { verifyGoogleIdToken } from '../config/googleAuth.js'
import { getBearerToken, requireObjectBody, setJsonApiData, setJsonApiError } from '../utils/http.js'

function buildUserTokenPayload(user: Pick<UserTable, 'id' | 'name' | 'email'>): JwtPayload {
	return {
		sub: `${user.id}`,
		attributes: {
			name: user.name,
			email: user.email
		}
	}
}

function sendUnauthorizedResponse(ctx: Context) {
	ctx.set('WWW-Authenticate', 'Bearer')
	setJsonApiError(ctx, 401, {
		title: 'Unauthorized',
		detail: 'A valid bearer token is required to access this resource.'
	})
}

function sendInvalidPasswordResetCodeResponse(ctx: Context) {
	setJsonApiError(ctx, 422, {
		status: '422',
		code: 'invalid_password_reset_code',
		title: 'Invalid Password Reset Code',
		detail: 'The password reset code is invalid or has expired.'
	})
}

/**
 * Register a new user
 * @param ctx Koa context
 */
export const register = async (ctx: Context) => {
	const requestBody = requireObjectBody(ctx) as unknown as RegisterRequest
	const password = await createHash(requestBody.password)

	const userExists = await database<UserTable>('users').where('email', requestBody.email).first()
	if (userExists) {
		setJsonApiError(ctx, 422, {
			source: {
				pointer: '/data/attributes/email'
			},
			title: 'Invalid email',
			detail: 'This email is already registered.'
		})
		return
	}

	const [userId] = await database<UserTable>('users').insert({
		name: requestBody.name,
		email: requestBody.email,
		password
	})
	const user = await database<UserTable>('users').where('id', userId).first('id', 'name', 'email')
	if (!user) {
		ctx.throw('Error registering user')
	}

	const token = createToken(buildUserTokenPayload(user))
	setJsonApiData(ctx, 201, {
		type: 'users',
		id: `${user.id}`,
		attributes: {
			name: user.name,
			email: user.email
		}
	}, {
		token
	})
	sendMail({
		subject: 'Welcome to Static Mailer',
		receipient: user.email,
		template: 'welcome',
		data: user
	})
}

/**
 * Login a user and return a token
 * @param ctx Koa context
 */
export const login = async (ctx: Context) => {
	const requestBody = requireObjectBody(ctx) as unknown as LoginRequest
	const user = await database<UserTable>('users').where('email', requestBody.email).first()
	if (user) {
		const passwordMatches = await compareHash(requestBody.password, user.password)
		if (passwordMatches) {
			const token = createToken(buildUserTokenPayload(user))
			setJsonApiData(ctx, 200, {
				type: 'tokens',
				id: `${user.id}`,
				attributes: {
					token
				}
			})
			return
		}
	}

	setJsonApiError(ctx, 401, {
		title: 'Authentication error',
		detail: 'These credentials do not match our records.'
	})
}

/**
 * Get the currently authenticated user
 * @param ctx Koa.context
 */
export const me = async (ctx: Context) => {
	const bearerToken = getBearerToken(ctx)
	if (!bearerToken) {
		return
	}

	const userInToken = verifyToken(bearerToken)
	const user = await database<UserTable>('users')
		.where('id', userInToken.sub)
		.first()
	if (!user) {
		setJsonApiError(ctx, 404, {
			title: 'Not Found',
			detail: 'The authenticated user could not be found.'
		})
		return
	}

	setJsonApiData(ctx, 200, {
		type: 'users',
		id: `${user.id}`,
		attributes: {
			name: user.name,
			email: user.email,
			created_at: user.created_at,
			updated_at: user.updated_at
		}
	})
}

/**
 * Prevent unauthenticated route access
 * @param ctx
 * @param next
 */
export const authorize = async (ctx: Context, next: Next) => {
	const bearerToken = getBearerToken(ctx)
	if (!bearerToken) {
		sendUnauthorizedResponse(ctx)
		return
	}

	try {
		const user = verifyToken(bearerToken)
		ctx.state.user = user
		await next()
	} catch {
		sendUnauthorizedResponse(ctx)
	}
}

/**
 * Handle password reset request.
 */
export const sendPasswordResetInstructions = async (ctx: Context) => {
	try {
		const body = requireObjectBody(ctx)
		if (typeof body.email !== 'string') {
			ctx.throw(400, 'Invalid request body')
		}

		const user = await database<UserTable>('users').where({ email: body.email }).first()
		if (user) {
			const code = randomInt(99999, 1000000).toString()
			const codeHash = await createHash(code.toString())
			const date = new Date()
			date.setMinutes(date.getMinutes() + 60)
			await database<PasswordResetsTable>('password_resets').insert({
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
						code,
						email: user.email
					}
				})
			} catch (error) {
				ctx.app.emit('error', error as Error, ctx)
			}
		}

		setJsonApiData(ctx, 200, {
			type: 'password_reset_requests',
			attributes: {
				message: 'If the account exists, password reset instructions have been sent.'
			}
		})
	} catch (error) {
		ctx.app.emit('error', error as Error, ctx)
		if ((error as { status?: number }).status) {
			throw error
		}
		ctx.throw('Server Error')
	}
}

/**
 * Change user password.
 */
export const changeUserPassword = async (ctx: Context) => {
	try {
		const requestBody = requireObjectBody(ctx) as unknown as ChangePasswordRequest
		const user = await database<UserTable>('users')
			.where('email', requestBody.email)
			.first()

		if (!user) {
			sendInvalidPasswordResetCodeResponse(ctx)
			return
		}

		const resetCode = await database<PasswordResetsTable>('password_resets')
			.where('user_id', user.id)
			.where('expires_at', '>', new Date())
			.orderBy('id', 'desc')
			.first()

		if (!resetCode) {
			sendInvalidPasswordResetCodeResponse(ctx)
			return
		}

		const codeMatches = await compareHash(requestBody.code, resetCode.code)
		if (!codeMatches) {
			sendInvalidPasswordResetCodeResponse(ctx)
			return
		}

		const newPassword = await createHash(requestBody.password)
		await database<UserTable>('users').where('id', user.id).update({ password: newPassword })
		await database<PasswordResetsTable>('password_resets').where('user_id', user.id).delete()
		setJsonApiData(ctx, 200, {
			id: `${user.id}`,
			type: 'password_resets',
			attributes: {
				status: 'success',
				message: 'Your password has been successfully reset.'
			}
		})
	} catch (error) {
		ctx.app.emit('error', error as Error, ctx)
		if ((error as { status?: number }).status) {
			throw error
		}
		ctx.throw('Something broke!')
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
		setJsonApiError(ctx, 400, {
			status: 400,
			title: 'Invalid provider',
			detail: 'The provider is not supported. The only supported provider is Google.'
		})
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
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Missing token',
				detail: 'Token is missing from the request body.'
			})
			return
		}

		const expectedAudience = process.env.GOOGLE_CLIENT_ID
		if (!expectedAudience) {
			setJsonApiError(ctx, 500, {
				status: 500,
				title: 'Server configuration error',
				detail: 'Google social authentication is not configured.'
			})
			return
		}

		let userInfo: GoogleJWTPayload
		try {
			userInfo = await verifyGoogleIdToken(token, expectedAudience)
		} catch {
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Invalid token',
				detail: 'The provided token is invalid.'
			})
			return
		}

		const userInDb = await database<UserTable>('users').where('email', userInfo.email).first()
		if (userInDb) {
			const authToken = createToken(buildUserTokenPayload(userInDb))
			setJsonApiData(ctx, 200, {
				type: 'tokens',
				id: `${userInDb.id}`,
				attributes: {
					token: authToken
				}
			})
			return
		}

		const [userId] = await database<UserTable>('users').insert({
			name: userInfo.name,
			email: userInfo.email,
			password: ''
		})

		const authToken = createToken(buildUserTokenPayload({
			id: userId,
			name: userInfo.name,
			email: userInfo.email
		} as Pick<UserTable, 'id' | 'name' | 'email'>))
		setJsonApiData(ctx, 201, {
			type: 'tokens',
			id: `${userId}`,
			attributes: {
				token: authToken
			}
		})

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
	}
}
