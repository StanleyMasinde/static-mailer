import { Context } from 'koa'
import { ApiKeysUsersJoin, EmailRequest, EmailSubmissionTable } from '../types'
import { fowardEmail } from '../config/mailer'
import { database } from '../config/database'

/**
 * Receive an email and deliver it to the user's mailbox
 * @param ctx Koa context
 */
export const deliverEmail = async (ctx: Context): Promise<void> => {
	const { apiKey } = ctx.params
	const body = ctx.request.body as EmailRequest

	try {
		const keyInDB = await database<ApiKeysUsersJoin>('api_keys')
			.join('users', 'users.id', '=', 'api_keys.user_id')
			.where('api_keys.key', apiKey)
			.first(['users.email', 'api_keys.uuid'])

		if (keyInDB) {
			await fowardEmail(keyInDB.email, body.subject, body.email, body.message)
			await database<EmailSubmissionTable>('email_submissions').insert({
				key_uuid: keyInDB.uuid,
				subject: body.subject,
				message: body.message,
			})
			sendSuccessResponse(ctx)
		} else {
			sendNotFoundResponse(ctx)
		}
	} catch (error) {
		console.error('An error occurred while delivering the email:', error)
		sendErrorResponse(ctx, 'Internal Server Error')
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
	ctx.body = {
		message: 'The provided API key is invalid',
	}
}

function sendErrorResponse(ctx: Context, message: string): void {
	ctx.status = 500
	ctx.body = {
		message,
	}
}
