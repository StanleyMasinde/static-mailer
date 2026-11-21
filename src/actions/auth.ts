import { createHash, randomBytes, randomInt } from 'node:crypto'
import { Context, Next } from 'koa'
import { transaction, type TransactionContext } from 'mevn-orm'
import { JwtPayload } from 'jsonwebtoken'
import { GitHubAuthPayload, GoogleJWTPayload, LoginRequest, RegisterRequest, ChangePasswordRequest } from '../types.js'
import { PasswordReset, RefreshToken, SocialAccount, User } from '../config/models.js'
import { compareHash, createHash as createPasswordHash } from '../config/hash.js'
import { createAccessToken, verifyToken } from '../config/jwt.js'
import { sendMail } from '../config/mailer.js'
import { verifyGoogleIdToken } from '../config/googleAuth.js'
import { verifyGitHubAccessToken } from '../config/githubAuth.js'
import { getBearerToken, requireObjectBody, setJsonApiData, setJsonApiError } from '../utils/http.js'

function buildUserTokenPayload(user: Pick<User, 'id' | 'name' | 'email'>): JwtPayload {
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

async function issueTokenPair(user: Pick<User, 'id' | 'name' | 'email'>, trx?: TransactionContext): Promise<{ token: string, refreshToken: string }> {
	const token = createAccessToken(buildUserTokenPayload(user))
	const refreshToken = randomBytes(48).toString('base64url')
	const attributes = {
		user_id: user.id,
		token_hash: buildRefreshTokenHash(refreshToken),
		expires_at: getRefreshTokenExpiry()
	}

	if (trx) {
		await trx.model(RefreshToken).create(attributes)
	} else {
		await RefreshToken.create(attributes)
	}

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

	const userExists = await User.where({ email: requestBody.email }).exists()
	if (userExists) {
		setJsonApiError(ctx, 422, {
			source: {
				pointer: '/email'
			},
			title: 'Invalid email',
			detail: 'This email is already registered.'
		})
		return
	}

	const user = await User.create({
		name: requestBody.name,
		email: requestBody.email,
		password
	})

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
		data: { id: user.id, name: user.name, email: user.email }
	})
}

/**
 * Login a user and return a token
 * @param ctx Koa context
 */
export const login = async (ctx: Context) => {
	const requestBody = requireObjectBody(ctx) as unknown as LoginRequest
	const user = await User.where({ email: requestBody.email }).first(['id', 'name', 'email', 'password'])
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
	if (userInToken.sub === undefined) {
		sendUnauthorizedResponse(ctx)
		return
	}

	const user = await User.find(userInToken.sub, ['id', 'name', 'email', 'created_at', 'updated_at'])
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

		const user = await User.where({ email: body.email }).first(['id', 'email'])
		if (user) {
			const code = randomInt(99999, 1000000).toString()
			const codeHash = await createPasswordHash(code.toString())
			const date = new Date()
			date.setMinutes(date.getMinutes() + 60)
			await PasswordReset.create({
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
		const userId = await transaction(async (trx) => {
			const users = trx.model(User)
			const user = await users.where({ email: requestBody.email }).forUpdate().first('id')
			if (!user) {
				return undefined
			}

			const resets = trx.model(PasswordReset)
			const now = new Date()
			// Match the MySQL client's local timestamp binding for the Date filter.
			const mysqlNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
			const resetCode = await resets.where({ user_id: user.id })
				.where('expires_at', '>', mysqlNow)
				.orderBy('id', 'desc')
				.forUpdate()
				.first(['id', 'code'])
			if (!resetCode || !await compareHash(requestBody.code, resetCode.code)) {
				return undefined
			}

			const password = await createPasswordHash(requestBody.password)
			await users.where({ id: user.id }).update({ password })
			await resets.where({ user_id: user.id }).destroy()
			await trx.model(RefreshToken).where({ user_id: user.id }).destroy()

			return user.id
		})

		if (userId === undefined) {
			sendInvalidPasswordResetCodeResponse(ctx)
			return
		}

		setJsonApiData(ctx, 200, {
			id: `${userId}`,
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
	case 'github':
		await handleGitHubAuth()
		break
	default:
		setJsonApiError(ctx, 400, {
			status: 400,
			title: 'Invalid provider',
			detail: 'The provider is not supported. Supported providers are Google and GitHub.'
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

		const providerUserId = typeof userInfo.sub === 'string' ? userInfo.sub.trim() : ''
		if (!providerUserId) {
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Invalid token',
				detail: 'The provided token is invalid.'
			})
			return
		}

		const isNewUser = await signInWithSocialAccount('google', providerUserId, userInfo)

		if (isNewUser) {
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

	async function handleGitHubAuth() {
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

		let userInfo: GitHubAuthPayload
		try {
			userInfo = await verifyGitHubAccessToken(token)
		} catch {
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Invalid token',
				detail: 'The provided token is invalid.'
			})
			return
		}

		const providerUserId = typeof userInfo.sub === 'string' ? userInfo.sub.trim() : ''
		if (!providerUserId) {
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Invalid token',
				detail: 'The provided token is invalid.'
			})
			return
		}

		const isNewUser = await signInWithSocialAccount('github', providerUserId, userInfo)

		if (isNewUser) {
			sendMail({
				subject: 'Welcome to Static Mailer',
				receipient: userInfo.email,
				template: 'welcome',
				data: {
					name: userInfo.name,
					email: userInfo.email
				}
			})
		}
	}
	async function signInWithSocialAccount(provider: SocialAccount['provider'], providerUserId: string, userInfo: Pick<User, 'name' | 'email'>) {
		const result = await transaction(async (trx) => {
			const accounts = trx.model(SocialAccount)
			const users = trx.model(User)
			const account = await accounts.where({ provider, provider_user_id: providerUserId }).first()
			let user = account
				? await account.user().first(['id', 'name', 'email'])
				: await users.where({ email: userInfo.email }).first(['id', 'name', 'email'])

			if (account && !user) {
				return undefined
			}

			const isNewUser = !user
			user ??= await users.create({ name: userInfo.name, email: userInfo.email, password: '' })

			if (!account) {
				await accounts.create({
					user_id: user.id,
					provider,
					provider_user_id: providerUserId,
					provider_email: userInfo.email
				})
			} else if (account.provider_email !== userInfo.email) {
				await accounts.where({ id: account.id }).update({ provider_email: userInfo.email })
			}

			const tokens = await issueTokenPair(user, trx)
			return { userId: user.id, isNewUser, tokens }
		})

		if (!result) {
			setJsonApiError(ctx, 401, {
				title: 'Authentication error',
				detail: 'These credentials do not match our records.'
			})
			return false
		}

		setJsonApiData(ctx, result.isNewUser ? 201 : 200, {
			type: 'tokens',
			id: `${result.userId}`,
			attributes: {
				token: result.tokens.token,
				refresh_token: result.tokens.refreshToken
			}
		})

		return result.isNewUser
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
	const userId = await RefreshToken.where({ token_hash: tokenHash }).value('user_id')
	const tokens = userId === undefined ? undefined : await transaction(async (trx) => {
		// Lock the user first, in the same order as password reset.
		const user = await trx.model(User).where({ id: userId })
			.forUpdate()
			.first(['id', 'name', 'email'])
		const refreshTokens = trx.model(RefreshToken)
		const existingToken = await refreshTokens.where({ token_hash: tokenHash, user_id: userId })
			.whereNull('revoked_at')
			.forUpdate()
			.first(['id', 'expires_at'])
		if (!existingToken || new Date(existingToken.expires_at) <= new Date()) {
			return undefined
		}

		await refreshTokens.where({ id: existingToken.id }).update({ revoked_at: new Date() })
		return user ? issueTokenPair(user, trx) : undefined
	})

	if (!tokens) {
		setJsonApiError(ctx, 401, {
			title: 'Authentication error',
			detail: 'The refresh token is invalid or has expired.'
		})
		return
	}

	setJsonApiData(ctx, 200, {
		type: 'tokens',
		id: `${userId}`,
		attributes: {
			token: tokens.token,
			refresh_token: tokens.refreshToken
		}
	})
}
