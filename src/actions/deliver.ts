import { Context } from 'koa'
import { transaction } from 'mevn-orm'
import { EmailRequest } from '../types.js'
import { fowardEmail } from '../config/mailer.js'
import { database } from '../config/database.js'
import { ApiKey, EmailSubmission, User } from '../config/models.js'
import { hashApiKey } from '../config/apiKeys.js'
import { requireObjectBody, setJsonApiData, setJsonApiError } from '../utils/http.js'

/**
 * Receive an email and deliver it to the user's mailbox
 * @param ctx Koa context
 */
export const deliverEmail = async (ctx: Context): Promise<void> => {
	const { apiKey } = ctx.params
	const apiKeyHash = hashApiKey(apiKey)
	const body = requireObjectBody(ctx) as unknown as EmailRequest

	try {
		const keyInDB = await database<Pick<ApiKey, 'uuid'> & Pick<User, 'email'>>('api_keys')
			.join('users', 'users.id', '=', 'api_keys.user_id')
			.where((queryBuilder) => {
				queryBuilder
					.where('api_keys.key_hash', apiKeyHash)
					.orWhere('api_keys.key', apiKey)
			})
			.first(['users.email', 'api_keys.uuid'])

		if (!keyInDB) {
			sendNotFoundResponse(ctx)
			return
		}

		const submission = {
			key_uuid: keyInDB.uuid,
			subject: body.subject,
			message: body.message,
			sender_ip: ctx.ip
		}

		try {
			await fowardEmail(keyInDB.email, body.subject, body.email, body.message)
		} catch {
			await EmailSubmission.create({
				...submission,
				delivery_status: 'failed',
				delivered_at: new Date()
			})
			sendErrorResponse(ctx, 502, 'Message delivery failed.')
			return
		}

		const acceptedAt = new Date()
		await transaction(async (trx) => {
			await trx.model(ApiKey).where({ uuid: keyInDB.uuid }).update({ last_used_at: acceptedAt })
			await trx.model(EmailSubmission).create({
				...submission,
				delivery_status: 'accepted',
				delivered_at: acceptedAt
			})
		})

		sendSuccessResponse(ctx)
	} catch (error) {
		console.error('An error occurred while delivering the email:', error)
		sendErrorResponse(ctx, 500, 'Internal Server Error')
	}
}

function sendSuccessResponse(ctx: Context): void {
	setJsonApiData(ctx, 202, {
		type: 'deliveries',
		attributes: {
			status: 'accepted',
			message: 'Message accepted for delivery.'
		}
	})
}

function sendNotFoundResponse(ctx: Context): void {
	setJsonApiError(ctx, 404, {
		status: 404,
		title: 'Invalid API key',
		detail: 'The provided API key is invalid.'
	})
}

function sendErrorResponse(ctx: Context, status: number, message: string): void {
	setJsonApiError(ctx, status, {
		status,
		title: 'Delivery error',
		detail: message
	})
}
