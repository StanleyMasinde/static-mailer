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

function isJsonApiRoute(path: string): boolean {
	return path === '/v1'
		|| path.startsWith('/v1/')
		|| path === '/api/v1'
		|| path.startsWith('/api/v1/')
}

function getMediaType(value: string): string {
	return value.split(';', 1)[0].trim().toLowerCase()
}

function acceptsJsonApi(acceptHeader: string): boolean {
	return acceptHeader
		.split(',')
		.map((value) => getMediaType(value))
		.some((value) =>
			value === '*/*'
			|| value === 'application/*'
			|| value === JSON_API_MEDIA_TYPE
		)
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
		const err = error as { status?: number, expose?: boolean, message?: string }
		const status = typeof err.status === 'number' ? err.status : 500
		const isExposedError = err.expose === true

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
		const mediaType = getMediaType(contentType)
		if (mediaType !== JSON_API_MEDIA_TYPE) {
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
