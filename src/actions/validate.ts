import { Context, Next } from 'koa'
import { ValidationMessage, ValidationRuleFactory } from '../types'
/**
 * Validate a required field
 * @param field the field to validate
 * @returns bool
 */
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
    'required': {
        function: required,
        title: 'Field required',
        detail: 'The {field} is required'
    },
    'email': {
        function: email,
        title: 'Invalid E-mail',
        detail: 'This field should be a valid email'
    },
    'phone': {
        function: phone,
        title: 'Invalid phone',
        detail: 'The {field} fieled should be a valid phone number'
    },
    'array': {
        function: array,
        title: 'Invalid array',
        detail: 'The {field} field should be an array'
    }
}
export const validate = (param: { [key: string]: string }) => {
    return async (ctx: Context, next: Next) => {
        const errors: Array<ValidationMessage> = []
        const body = ctx.request.body
        if (!body) {
            ctx.header['content-type'] = 'application/vnd.api+json'
            ctx.status = 400
            ctx.body = {
                errors: [
                    {
                        status: "400",
                        title: "Bad request.",
                        detail: "Request body missing."
                    }
                ]
            }
            return
        }

        for (const key in param) {
            const rules: Array<string> = param[key].split('|')
            rules.forEach((rule: string) => {
                const factory: ValidationRuleFactory = ruleFactories[rule]
                if (!factory) {
                    return ctx.throw(new Error(`Rule ${rule} not found`))
                }
                if (!factory.function(body[key])) {
                    return errors.push({
                        source: `/data/attributes/${key}`,
                        title: factory.title,
                        message: factory.detail.replace('{field}', key)
                    })
                }
            })
        }

        if (errors.length > 0) {
            ctx.status = 422
            ctx.header['content-type'] = 'application/vnd.api+json'
            ctx.body = {
                errors
            }
            return
        }

        await next()
    }
}
