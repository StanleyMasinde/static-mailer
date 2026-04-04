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


validateEnvironment()

const app = new Koa({ proxy: true })
const sentryDsn = process.env.SENTRY_DSN
const corsAllowlist = new Set(getCorsAllowlist())

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
		ctx.status = 404
		ctx.body = {
			errors: [
				{
					status: 404,
					code: 'not-found',
					title: 'Not Found',
					detail: 'The requested resource could not be found.'
				}
			]
		}
	})

export default app
