import { Context, Next } from 'koa'
import { ValidationMessage, ValidationRuleFactory } from '../types.js'
import { setJsonApiError, setJsonApiErrors } from '../utils/http.js'

function required(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false
	}
	return value.toString().length > 0
}

function email(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false
	}
	const rgx = new RegExp(/[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/)
	return rgx.test(value)
}

function phone(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false
	}
	const rgx = new RegExp(/^\+[1-9]\d{1,14}$/)
	return rgx.test(value)
}

function array(value: unknown): boolean {
	return Array.isArray(value)
}

const ruleFactories: { [key: string]: ValidationRuleFactory } = {
	required: {
		validator: required,
		title: 'Field required',
		detail: 'The {field} is required',
	},
	email: {
		validator: email,
		title: 'Invalid E-mail',
		detail: 'This field should be a valid email',
	},
	phone: {
		validator: phone,
		title: 'Invalid phone',
		detail: 'The {field} field should be a valid phone number',
	},
	array: {
		validator: array,
		title: 'Invalid array',
		detail: 'The {field} field should be an array',
	},
}

export const validate = (param: Record<string, string>) => {
	return async (ctx: Context, next: Next) => {
		const errors: Array<ValidationMessage> = []
		const body = ctx.request.body

		if (!body || typeof body !== 'object' || Array.isArray(body)) {
			setJsonApiError(ctx, 400, {
				status: 400,
				title: 'Bad request.',
				detail: 'Request body missing.'
			})
			return
		}
		const payload = body as Record<string, unknown>

		for (const key in param) {
			const rules: Array<string> = param[key].split('|')
			for (const rule of rules) {
				const factory: ValidationRuleFactory = ruleFactories[rule]
				if (!factory) {
					ctx.throw(500, `Rule ${rule} not found`)
				}
				if (!factory.validator(payload[key])) {
					errors.push({
						source: `/data/attributes/${key}`,
						title: factory.title,
						message: factory.detail.replace('{field}', key),
					})
				}
			}
		}

		if (errors.length > 0) {
			setJsonApiErrors(ctx, 422, errors)
			return
		}

		await next()
	}
}
