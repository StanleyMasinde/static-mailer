import { Context, Next } from 'koa'
import { ValidationMessage, ValidationRuleFactory } from '../types'

function required(value: string | number): boolean {
	return value !== null && value !== undefined && value.toString().length > 0
}

function email(value: string | number): boolean {
	const rgx = new RegExp(/[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/)
	const input = value as string
	return rgx.test(input)
}

function phone(value: string | number): boolean {
	const rgx = new RegExp(/^\+[1-9]\d{1,14}$/)
	const input = value as string
	return rgx.test(input)
}

function array(value: string | number): boolean {
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

		if (!body) {
			ctx.set('Content-Type', 'application/vnd.api+json')
			ctx.status = 400
			ctx.body = {
				errors: [
					{
						status: 400,
						title: 'Bad request.',
						detail: 'Request body missing.',
					},
				],
			}
			return
		}

		for (const key in param) {
			const rules: Array<string> = param[key].split('|')
			for (const rule of rules) {
				const factory: ValidationRuleFactory = ruleFactories[rule]
				if (!factory) {
					ctx.throw(500, `Rule ${rule} not found`)
				}
				if (!factory.validator(body[key])) {
					errors.push({
						source: `/data/attributes/${key}`,
						title: factory.title,
						message: factory.detail.replace('{field}', key),
					})
				}
			}
		}

		if (errors.length > 0) {
			ctx.status = 422
			ctx.set('Content-Type', 'application/vnd.api+json')
			ctx.body = {
				errors,
			}
			return
		}

		await next()
	}
}
