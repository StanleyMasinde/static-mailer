import { Context } from 'koa'
import { resolve } from 'node:path'
import { renderFile } from 'pug'

const DOCS_TEMPLATE_PATH = resolve(process.cwd(), 'templates/docs.pug')

export const docs = (ctx: Context) => {
	ctx.status = 200
	ctx.set('Content-Type', 'text/html; charset=utf-8')
	ctx.body = renderFile(DOCS_TEMPLATE_PATH, {
		specUrl: '/openapi.yaml'
	})
}
