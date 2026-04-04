import { v4 as uuidv4 } from 'uuid'
import { Context } from 'koa'
import { database } from '../config/database.js'
import { ApiKeyTable } from '../types.js'
import { JwtPayload } from 'jsonwebtoken'
import { generateRawApiKey, getApiKeyLast4, hashApiKey } from '../config/apiKeys.js'
import { requireObjectBody, setJsonApiError } from '../utils/http.js'

/**
 * Create API key
 * @param ctx 
 */
export const createApiKey = async (ctx: Context) => {
	try {
		const body = requireObjectBody(ctx)
		if (typeof body.name !== 'string') {
			ctx.throw(400, 'Invalid request body')
		}
		const uuid = uuidv4()
		const rawKey = generateRawApiKey()
		const keyHash = hashApiKey(rawKey)
		const keyLast4 = getApiKeyLast4(rawKey)

		await database<ApiKeyTable>('api_keys').insert({
			uuid,
			name: body.name,
			key: null,
			key_hash: keyHash,
			key_last4: keyLast4,
			user_id: ctx.state.user.sub
		})

		const apiKey = await database<ApiKeyTable>('api_keys')
			.where('uuid', uuid)
			.first(['uuid', 'name', 'created_at', 'updated_at', 'last_used_at', 'key_last4'])
		ctx.body = {
			apiKey,
			rawKey
		}
	} catch (error) {
		ctx.throw(500, 'Internal Server Error')
	}
}

/**
 * Get all API Keys for a user
 * @param ctx 
 */
export const getUserApiKeys = async (ctx: Context) => {
	try {
		const user: JwtPayload = ctx.state.user
		const apiKeys = await database<ApiKeyTable>('api_keys')
			.where('user_id', user.sub)
			.select('uuid', 'name', 'key_last4', 'created_at', 'updated_at', 'last_used_at')

		const data = apiKeys.map((apiKey) => {
			const attributes = {
				uuid: apiKey.uuid,
				name: apiKey.name,
				key_last4: apiKey.key_last4 || null,
				created_at: apiKey.created_at,
				updated_at: apiKey.updated_at,
				last_used_at: apiKey.last_used_at
			}
			return {
				type: 'apiKeys',
				uuid: apiKey.uuid,
				attributes
			}
		})

		ctx.header['content-type'] = 'application/vnd.api+json'
		ctx.body = {
			data
		}
	} catch (error) {
		// Handle the error appropriately (e.g., log, send error response)
		console.error(error)
		ctx.throw(500, 'Internal Server Error')
	}
}

/**
 * Delete a given API Key
 * @param ctx 
 */
export const deleteApiKey = async (ctx: Context) => {
	try {
		const apiKeyParam = ctx.params.uuid
		const apiKey = await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).first()

		if (!apiKey) {
			return sendNotFoundResponse(apiKeyParam)
		}

		if (apiKey.user_id == ctx.state.user.sub) {
			await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).delete()
			ctx.body = {
				data: 'Key deleted.'
			}
			return
		}

		sendUnauthorizedResponse()

	} catch (error) {
		// Handle the error appropriately (e.g., log, send error response)
		console.error(error)
		ctx.throw(500, 'Internal Server Error')
	}

	function sendNotFoundResponse(apiKeyParam: string) {
		setJsonApiError(ctx, 404, {
			source: { parameter: 'uuid' },
			title: 'Not found error.',
			detail: `API key with id ${apiKeyParam} was not found.`
		})
	}

	function sendUnauthorizedResponse() {
		setJsonApiError(ctx, 403, {
			status: 403,
			title: 'Unauthorized error.',
			detail: 'You are not authorized to delete this API key.'
		})
	}
}
