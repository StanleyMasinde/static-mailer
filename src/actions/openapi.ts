import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { Context } from 'koa'

const OPENAPI_FILE_PATH = resolve(process.cwd(), 'openapi.yaml')

export const serveOpenApiSpec = async (ctx: Context) => {
	try {
		await access(OPENAPI_FILE_PATH, constants.R_OK)
		const spec = await readFile(OPENAPI_FILE_PATH, 'utf8')
		ctx.status = 200
		ctx.set('Content-Type', 'text/yaml; charset=utf-8')
		ctx.body = spec
	} catch {
		ctx.status = 404
		ctx.body = {
			error: 'OpenAPI specification not found'
		}
	}
}
