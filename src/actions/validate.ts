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
        message: 'The {field} is required'
    },
    'email': {
        function: email,
        message: 'This field should be a valid email'
    },
    'phone': {
        function: phone,
        message: 'The {field} fieled should be a valid phone number'
    },
    'array': {
        function: array,
        message: 'The {field} field should be an array'
    }
}
export const validate = (param: { [key: string]: string }) => {
    return async (ctx: Context, next: Next) => {
        const errors: Array<ValidationMessage> = []
        const body = ctx.request.body
        if(!body) {
            ctx.status = 400
            ctx.body = {
                message: 'Bad request'
            }
            return
        }
        
        for (const key in param) {
            const rules: Array<string> = param[key].split('|')
            rules.forEach((rule: string) => {
                const factory: ValidationRuleFactory = ruleFactories[rule]
                if (!factory) {
                    ctx.throw(new Error(`Rule ${rule} not found`))
                }
                if (!factory.function(body[key])) {
                    const errExists: ValidationMessage = errors.filter((e: ValidationMessage) => {
                        return e.field == key
                    })[0]

                    if (errExists) {
                        return errExists.messages.push(factory.message.replace('{field}', key))
                    }

                    return errors.push({
                        field: key,
                        messages: [factory.message.replace('{field}', key)]
                    })
                }
            })
        }

        if (errors.length > 0) {
            ctx.status = 422
            ctx.body = {
                message: 'Validation errors',
                errors
            }
            return
        }

        await next()
    }
}
