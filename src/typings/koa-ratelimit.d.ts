declare module 'koa-ratelimit' {
	import { Middleware, ParameterizedContext } from 'koa'

	interface HeadersConfig {
		remaining?: string
		reset?: string
		total?: string
	}

	interface RateLimitOptions {
		driver?: 'memory' | 'redis'
		db: Map<string, unknown> | unknown
		duration?: number
		max?: number
		id?: (ctx: ParameterizedContext) => string | false
		namespace?: string
		errorMessage?: string
		headers?: HeadersConfig
		disableHeader?: boolean
		throw?: boolean
		status?: number
		whitelist?: (ctx: ParameterizedContext) => boolean | Promise<boolean>
		blacklist?: (ctx: ParameterizedContext) => boolean | Promise<boolean>
		onLimited?: (ctx: ParameterizedContext) => void
	}

	export default function ratelimit(options: RateLimitOptions): Middleware
}
