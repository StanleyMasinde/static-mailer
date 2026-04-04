import 'dotenv/config'

import Koa from 'koa'
import { koaBody } from 'koa-body'
import cors from '@koa/cors'
import * as Sentry from '@sentry/node'
import { indexRoutes, allowedIndexMethods } from './routes/index.js'
import { publicApiRoutes, allowedPublicApiMethods } from './routes/publicapi.js'
import { authRoutes, allowedAuthMethods } from './routes/auth.js'
import { userRoutes, allowedUserMethods } from './routes/user.js'
import { getCorsAllowlist, validateEnvironment } from './config/env.js'
import { setJsonApiError } from './utils/http.js'


validateEnvironment()

const app = new Koa({ proxy: true })
const JSON_API_MEDIA_TYPE = 'application/vnd.api+json'
const sentryDsn = process.env.SENTRY_DSN
const corsAllowlist = new Set(getCorsAllowlist())
const JSON_API_ALLOWED_PARAMS = new Set(['ext', 'profile'])

function isJsonApiRoute(path: string): boolean {
	return path === '/v1'
		|| path.startsWith('/v1/')
		|| path === '/api/v1'
		|| path.startsWith('/api/v1/')
}

function parseParameters(parts: string[]): Map<string, string> {
	const params = new Map<string, string>()
	for (const rawPart of parts) {
		const part = rawPart.trim()
		if (!part) {
			continue
		}
		const equalsIndex = part.indexOf('=')
		const key = (equalsIndex === -1 ? part : part.slice(0, equalsIndex)).trim().toLowerCase()
		const rawValue = equalsIndex === -1 ? '' : part.slice(equalsIndex + 1).trim()
		const value = rawValue.startsWith('"') && rawValue.endsWith('"')
			? rawValue.slice(1, -1)
			: rawValue
		params.set(key, value)
	}
	return params
}

function hasOnlyJsonApiAllowedParams(params: Map<string, string>, allowedExtraKeys: Set<string> = new Set()): boolean {
	for (const key of params.keys()) {
		if (allowedExtraKeys.has(key)) {
			continue
		}
		if (!JSON_API_ALLOWED_PARAMS.has(key)) {
			return false
		}
	}
	return true
}

function acceptsJsonApi(acceptHeader: string): boolean {
	return acceptHeader
		.split(',')
		.some((rawValue) => {
			const [rawMediaType, ...rawParams] = rawValue.split(';')
			const mediaType = rawMediaType.trim().toLowerCase()
			const params = parseParameters(rawParams)
			const quality = params.has('q') ? Number(params.get('q')) : 1
			if (!Number.isFinite(quality) || quality <= 0) {
				return false
			}

			if (mediaType === '*/*' || mediaType === 'application/*') {
				return true
			}

			if (mediaType !== JSON_API_MEDIA_TYPE) {
				return false
			}

			return hasOnlyJsonApiAllowedParams(params, new Set(['q']))
		})
}

function isSupportedJsonApiContentType(contentType: string): boolean {
	const [rawMediaType, ...rawParams] = contentType.split(';')
	const mediaType = rawMediaType.trim().toLowerCase()
	if (mediaType !== JSON_API_MEDIA_TYPE) {
		return false
	}
	const params = parseParameters(rawParams)
	return hasOnlyJsonApiAllowedParams(params)
}

function buildAllowHeaderFromMatchedRoutes(ctx: Koa.Context): string | null {
	const matched = (ctx as Koa.Context & { matched?: Array<{ methods?: string[] }> }).matched
	if (!matched || matched.length === 0) {
		return null
	}

	const methods = new Set<string>()
	for (const route of matched) {
		for (const method of route.methods || []) {
			methods.add(method.toUpperCase())
		}
	}

	if (methods.size === 0) {
		return null
	}
	return Array.from(methods).join(', ')
}

if (sentryDsn) {
	Sentry.init({ dsn: sentryDsn })

	app.on('error', (err, ctx) => {
		Sentry.withScope(function (scope) {
			scope.setContext('request', {
				method: ctx.request.method,
				url: ctx.request.url,
				headers: ctx.request.headers,
				query: ctx.request.query
			})
			Sentry.captureException(err)
		})
	})
}


// Middlewares
app.use(async (ctx, next) => {
	try {
		await next()
	} catch (error) {
		const err = error as { status?: number, expose?: boolean, message?: string, headers?: Record<string, string | string[]> }
		const status = typeof err.status === 'number' ? err.status : 500
		const isExposedError = err.expose === true
		if (err.headers) {
			for (const [headerName, headerValue] of Object.entries(err.headers)) {
				ctx.set(headerName, headerValue)
			}
		}
		if ((status === 405 || status === 501) && !ctx.response.header.allow) {
			const allow = buildAllowHeaderFromMatchedRoutes(ctx)
			if (allow) {
				ctx.set('Allow', allow)
			}
		}

		if (isJsonApiRoute(ctx.path)) {
			if (status === 401 && !ctx.response.header['www-authenticate']) {
				ctx.set('WWW-Authenticate', 'Bearer')
			}
			setJsonApiError(ctx, status, {
				title: status === 500 ? 'Internal Server Error' : 'Request error',
				detail: isExposedError ? err.message : 'Internal Server Error'
			})
		} else {
			ctx.status = status
			ctx.body = {
				error: isExposedError ? err.message : 'Internal Server Error'
			}
		}

		ctx.app.emit('error', error as Error, ctx)
	}
})

app.use(cors({
	origin: (ctx) => {
		const requestOrigin = ctx.get('Origin')
		if (!requestOrigin) {
			return '*'
		}
		if (corsAllowlist.has(requestOrigin)) {
			return requestOrigin
		}
		return ''
	}
}))
app.use(koaBody())
app.use(async (ctx, next) => {
	if (!isJsonApiRoute(ctx.path)) {
		await next()
		return
	}

	const accept = ctx.get('Accept')
	if (accept && !acceptsJsonApi(accept)) {
		setJsonApiError(ctx, 406, {
			title: 'Not Acceptable',
			detail: `This endpoint only serves ${JSON_API_MEDIA_TYPE}.`
		})
		return
	}

	const contentType = ctx.get('Content-Type')
	if (contentType && ['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
		if (!isSupportedJsonApiContentType(contentType)) {
			setJsonApiError(ctx, 415, {
				title: 'Unsupported Media Type',
				detail: `This endpoint only accepts ${JSON_API_MEDIA_TYPE} request bodies.`
			})
			return
		}
	}

	await next()
})
// Routes
app.use(indexRoutes())
	.use(allowedIndexMethods())
	.use(publicApiRoutes())
	.use(allowedPublicApiMethods())
	.use(authRoutes())
	.use(allowedAuthMethods())
	.use(userRoutes())
	.use(allowedUserMethods())
	.use((ctx) => {
		if (isJsonApiRoute(ctx.path)) {
			setJsonApiError(ctx, 404, {
				code: 'not-found',
				title: 'Not Found',
				detail: 'The requested resource could not be found.'
			})
			return
		}

		ctx.status = 404
		ctx.body = { error: 'Not Found' }
	})

export default app
