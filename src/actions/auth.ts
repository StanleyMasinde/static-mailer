import { createHash, randomBytes, randomInt } from 'node:crypto'
import { Context, Next } from 'koa'
import { JwtPayload } from 'jsonwebtoken'
import { GoogleJWTPayload, LoginRequest, PasswordResetsTable, RefreshTokenTable, RegisterRequest, UserTable, ChangePasswordRequest } from '../types.js'
import { database } from '../config/database.js'
import { compareHash, createHash as createPasswordHash } from '../config/hash.js'
import { createAccessToken, verifyToken } from '../config/jwt.js'
import { sendMail } from '../config/mailer.js'
import { verifyGoogleIdToken } from '../config/googleAuth.js'
import { getBearerToken, requireObjectBody, setJsonApiData, setJsonApiError } from '../utils/http.js'

function buildUserTokenPayload(user: Pick<UserTable, 'id' | 'name' | 'email'>): JwtPayload {
	return {
		sub: `${user.id}`,
		token_type: 'access',
		attributes: {
			name: user.name,
			email: user.email
		}
	}
}

const parsedRefreshTokenTtlDays = Number.parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10)
const REFRESH_TOKEN_TTL_DAYS = Number.isFinite(parsedRefreshTokenTtlDays) && parsedRefreshTokenTtlDays > 0
	? parsedRefreshTokenTtlDays
	: 30

function getRefreshTokenExpiry(): Date {
	const expiresAt = new Date()
	expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_TTL_DAYS)
	return expiresAt
}

function buildRefreshTokenHash(rawRefreshToken: string): string {
	return createHash('sha256').update(rawRefreshToken).digest('hex')
}

async function issueTokenPair(user: Pick<UserTable, 'id' | 'name' | 'email'>): Promise<{ token: string, refreshToken: string }> {
	const token = createAccessToken(buildUserTokenPayload(user))
	const refreshToken = randomBytes(48).toString('base64url')
	await database<RefreshTokenTable>('refresh_tokens').insert({
		user_id: user.id,
		token_hash: buildRefreshTokenHash(refreshToken),
		expires_at: getRefreshTokenExpiry()
	})
	return {
		token,
		refreshToken
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
	const password = await createPasswordHash(requestBody.password)

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

	const tokens = await issueTokenPair(user)
	setJsonApiData(ctx, 201, {
		type: 'users',
		id: `${user.id}`,
		attributes: {
			name: user.name,
			email: user.email
		}
	}, {
		token: tokens.token,
		refresh_token: tokens.refreshToken
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
			const tokens = await issueTokenPair(user)
			setJsonApiData(ctx, 200, {
				type: 'tokens',
				id: `${user.id}`,
				attributes: {
					token: tokens.token,
					refresh_token: tokens.refreshToken
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
		if (user.token_type && user.token_type !== 'access') {
			throw new Error('Invalid access token type')
		}
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
			const codeHash = await createPasswordHash(code.toString())
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

		const newPassword = await createPasswordHash(requestBody.password)
		await database<UserTable>('users').where('id', user.id).update({ password: newPassword })
		await database<PasswordResetsTable>('password_resets').where('user_id', user.id).delete()
		await database<RefreshTokenTable>('refresh_tokens').where('user_id', user.id).delete()
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
			const tokens = await issueTokenPair(userInDb)
			setJsonApiData(ctx, 200, {
				type: 'tokens',
				id: `${userInDb.id}`,
				attributes: {
					token: tokens.token,
					refresh_token: tokens.refreshToken
				}
			})
			return
		}

		const [userId] = await database<UserTable>('users').insert({
			name: userInfo.name,
			email: userInfo.email,
			password: ''
		})

		const tokens = await issueTokenPair({
			id: userId,
			name: userInfo.name,
			email: userInfo.email
		} as Pick<UserTable, 'id' | 'name' | 'email'>)
		setJsonApiData(ctx, 201, {
			type: 'tokens',
			id: `${userId}`,
			attributes: {
				token: tokens.token,
				refresh_token: tokens.refreshToken
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

/**
 * Rotate a refresh token and return a new token pair.
 */
export const refreshAccessToken = async (ctx: Context) => {
	const requestBody = requireObjectBody(ctx)
	const refreshToken = typeof requestBody.refresh_token === 'string'
		? requestBody.refresh_token.trim()
		: ''

	if (!refreshToken) {
		setJsonApiError(ctx, 400, {
			title: 'Invalid refresh token',
			detail: 'The refresh_token field is required.'
		})
		return
	}

	const tokenHash = buildRefreshTokenHash(refreshToken)
	const existingToken = await database<RefreshTokenTable>('refresh_tokens')
		.where('token_hash', tokenHash)
		.first()

	if (!existingToken || existingToken.revoked_at || new Date(existingToken.expires_at) <= new Date()) {
		setJsonApiError(ctx, 401, {
			title: 'Authentication error',
			detail: 'The refresh token is invalid or has expired.'
		})
		return
	}

	const user = await database<UserTable>('users')
		.where('id', existingToken.user_id)
		.first('id', 'name', 'email')

	if (!user) {
		await database<RefreshTokenTable>('refresh_tokens')
			.where('id', existingToken.id)
			.update({ revoked_at: new Date() })
		setJsonApiError(ctx, 401, {
			title: 'Authentication error',
			detail: 'The refresh token is invalid or has expired.'
		})
		return
	}

	const tokens = await issueTokenPair(user)
	await database<RefreshTokenTable>('refresh_tokens')
		.where('id', existingToken.id)
		.update({ revoked_at: new Date() })

	setJsonApiData(ctx, 200, {
		type: 'tokens',
		id: `${user.id}`,
		attributes: {
			token: tokens.token,
			refresh_token: tokens.refreshToken
		}
	})
}
