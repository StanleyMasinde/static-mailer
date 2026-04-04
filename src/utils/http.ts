import { Context } from 'koa'

export interface JsonApiErrorObject {
	status?: number | string
	title: string
	detail?: string
	code?: string
	source?: unknown
	message?: string
}

export function setJsonApiErrors(ctx: Context, status: number, errors: JsonApiErrorObject[]): void {
	ctx.status = status
	ctx.set('Content-Type', 'application/vnd.api+json')
	ctx.body = {
		errors: errors.map((error) => ({
			status: error.status ?? status,
			...error
		}))
	}
}

export function setJsonApiError(ctx: Context, status: number, error: JsonApiErrorObject): void {
	setJsonApiErrors(ctx, status, [error])
}

export function requireObjectBody(ctx: Context): Record<string, unknown> {
	const body = ctx.request.body
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		ctx.throw(400, 'Invalid request body')
	}
	return body as Record<string, unknown>
}

export function getBearerToken(ctx: Context): string | null {
	const header = ctx.request.header.authorization
	if (!header) {
		return null
	}
	const [scheme, token] = header.split(' ')
	if (scheme?.toLowerCase() !== 'bearer' || !token) {
		return null
	}
	return token
}
