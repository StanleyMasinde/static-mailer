import { Context } from 'koa'

export interface JsonApiSourceObject {
	pointer?: string
	parameter?: string
	header?: string
}

export interface JsonApiResourceObject {
	type: string
	id?: string
	attributes?: Record<string, unknown>
	relationships?: Record<string, unknown>
	links?: Record<string, unknown>
	meta?: Record<string, unknown>
}

export interface JsonApiErrorObject {
	status?: number | string
	title: string
	detail?: string
	code?: string
	source?: JsonApiSourceObject
	message?: string
	meta?: Record<string, unknown>
}

interface JsonApiDocument {
	data?: JsonApiResourceObject | JsonApiResourceObject[] | null
	errors?: JsonApiErrorObject[]
	meta?: Record<string, unknown>
	links?: Record<string, unknown>
	jsonapi?: {
		version: '1.1'
	}
}

function normalizeStatus(status: number | string): string {
	return `${status}`
}

export function setJsonApiDocument(ctx: Context, status: number, document: JsonApiDocument): void {
	ctx.status = status
	ctx.set('Content-Type', 'application/vnd.api+json')
	ctx.body = {
		jsonapi: {
			version: '1.1'
		},
		...document
	}
}

export function setJsonApiData(
	ctx: Context,
	status: number,
	data: JsonApiResourceObject | JsonApiResourceObject[] | null,
	meta?: Record<string, unknown>
): void {
	setJsonApiDocument(ctx, status, {
		data,
		meta
	})
}

export function setJsonApiErrors(ctx: Context, status: number, errors: JsonApiErrorObject[]): void {
	setJsonApiDocument(ctx, status, {
		errors: errors.map((error) => ({
			status: normalizeStatus(error.status ?? status),
			...error
		}))
	})
}

export function setJsonApiError(ctx: Context, status: number, error: JsonApiErrorObject): void {
	setJsonApiErrors(ctx, status, [error])
}

export function setJsonApiNoContent(ctx: Context): void {
	ctx.status = 204
	ctx.body = null
	ctx.remove('Content-Type')
}

export function requireObjectBody(ctx: Context): Record<string, unknown> {
	const body = ctx.request.body
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		ctx.throw(400, 'The request body must be a JSON object.')
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
