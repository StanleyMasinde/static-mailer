import { Context } from 'koa'
import ratelimit from 'koa-ratelimit'
import { setJsonApiError } from '../utils/http.js'

interface RateLimitOptions {
	windowMs: number
	maxRequests: number
	keyPrefix: string
	keyResolver?: (ctx: Context) => string
}

const memoryStore = new Map()

export function rateLimit(options: RateLimitOptions) {
	const {
		windowMs,
		maxRequests,
		keyPrefix,
		keyResolver = (ctx: Context) => ctx.ip
	} = options

	return ratelimit({
		driver: 'memory',
		db: memoryStore,
		duration: windowMs,
		max: maxRequests,
		namespace: keyPrefix,
		id: keyResolver,
		errorMessage: 'Rate limit exceeded. Please retry later.',
		onLimited: (ctx: Context) => {
			setJsonApiError(ctx, 429, {
				status: 429,
				title: 'Too many requests',
				detail: 'Rate limit exceeded. Please retry later.'
			})
		}
	})
}
