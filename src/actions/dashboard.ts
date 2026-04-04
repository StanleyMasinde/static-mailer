import { Context } from 'koa'
import { setJsonApiError } from '../utils/http.js'

function withQueryString(targetUrl: string, queryString: string): string {
	if (!queryString) {
		return targetUrl
	}
	const separator = targetUrl.includes('?') ? '&' : '?'
	return `${targetUrl}${separator}${queryString}`
}

export const dashboard = async (ctx: Context) => {
	const dashboardUrl = process.env.DASHBOARD_URL
	if (!dashboardUrl) {
		setJsonApiError(ctx, 404, {
			code: 'not-found',
			title: 'Not Found',
			detail: 'Dashboard URL not configured. Set DASHBOARD_URL in environment.'
		})
		return
	}

	const analyticsEvent = {
		event: 'dashboard_redirect',
		at: new Date().toISOString(),
		path: ctx.path,
		query: ctx.query,
		ip: ctx.ip,
		user_agent: ctx.get('user-agent') || null,
		referer: ctx.get('referer') || null
	}
	console.info('[analytics]', JSON.stringify(analyticsEvent))

	ctx.redirect(withQueryString(dashboardUrl, ctx.querystring))
}
