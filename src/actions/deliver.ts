import { Context } from 'koa'
import { ApiKeysUsersJoin, EmailRequest, EmailSubmissionTable } from '../types.js'
import { fowardEmail } from '../config/mailer.js'
import { database } from '../config/database.js'

/**
 * Receive an email and deliver it to the user's mailbox
 * @param ctx Koa context
 */
export const deliverEmail = async (ctx: Context): Promise<void> => {
	const { apiKey } = ctx.params
	const rawBody = ctx.request.body
	if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
		ctx.throw(400, 'Invalid request body')
	}
	const body = rawBody as unknown as EmailRequest

	try {
		const keyInDB = await database<ApiKeysUsersJoin>('api_keys')
			.join('users', 'users.id', '=', 'api_keys.user_id')
			.where('api_keys.key', apiKey)
			.first(['users.email', 'api_keys.uuid'])

		if (keyInDB) {
			try {
				await fowardEmail(keyInDB.email, body.subject, body.email, body.message)
				await database<EmailSubmissionTable>('email_submissions').insert({
					key_uuid: keyInDB.uuid,
					subject: body.subject,
					message: body.message,
					delivery_status: 'accepted',
					delivered_at: new Date(),
					sender_ip: ctx.ip
				})
				await database('api_keys')
					.where('uuid', keyInDB.uuid)
					.update({ last_used_at: new Date() })
				sendSuccessResponse(ctx)
			} catch (error) {
				await database<EmailSubmissionTable>('email_submissions').insert({
					key_uuid: keyInDB.uuid,
					subject: body.subject,
					message: body.message,
					delivery_status: 'failed',
					delivered_at: new Date(),
					sender_ip: ctx.ip
				})
				sendErrorResponse(ctx, 502, 'Message delivery failed.')
			}
		} else {
			sendNotFoundResponse(ctx)
		}
	} catch (error) {
		console.error('An error occurred while delivering the email:', error)
		sendErrorResponse(ctx, 500, 'Internal Server Error')
	}
}

function sendSuccessResponse(ctx: Context): void {
	ctx.status = 200
	ctx.body = {
		message: 'Message on its way',
	}
}

function sendNotFoundResponse(ctx: Context): void {
	ctx.status = 404
	ctx.set('Content-Type', 'application/vnd.api+json')
	ctx.body = {
		errors: [
			{
				status: 404,
				title: 'Invalid API key',
				detail: 'The provided API key is invalid.'
			}
		]
	}
}

function sendErrorResponse(ctx: Context, status: number, message: string): void {
	ctx.status = status
	ctx.set('Content-Type', 'application/vnd.api+json')
	ctx.body = {
		errors: [
			{
				status,
				title: 'Delivery error',
				detail: message
			}
		]
	}
}
