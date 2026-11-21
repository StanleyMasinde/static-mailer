import { v4 as uuidv4 } from 'uuid'
import { Context } from 'koa'
import { database } from '../config/database.js'
import { ApiKey } from '../config/models.js'
import { JwtPayload } from 'jsonwebtoken'
import { generateRawApiKey, getApiKeyLast4, hashApiKey } from '../config/apiKeys.js'
import { requireObjectBody, setJsonApiData, setJsonApiError, setJsonApiNoContent } from '../utils/http.js'

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

		// Mevn's create() reloads by id, while API keys have a UUID primary key.
		await database<Pick<ApiKey, 'uuid' | 'name' | 'key' | 'key_hash' | 'key_last4' | 'user_id'>>(ApiKey.currentTable).insert({
			uuid,
			name: body.name,
			key: null,
			key_hash: keyHash,
			key_last4: keyLast4,
			user_id: ctx.state.user.sub
		})

		const apiKey = await ApiKey.where({ uuid })
			.first(['uuid', 'name', 'created_at', 'updated_at', 'last_used_at', 'key_last4'])
		if (!apiKey?.uuid) {
			ctx.throw(500, 'Failed to load newly created API key.')
		}
		setJsonApiData(ctx, 201, {
			type: 'api_keys',
			id: apiKey.uuid,
			attributes: {
				name: apiKey.name,
				key_last4: apiKey.key_last4 || null,
				created_at: apiKey.created_at,
				updated_at: apiKey.updated_at,
				last_used_at: apiKey.last_used_at
			}
		}, {
			raw_key: rawKey
		})
	} catch (error) {
		if ((error as { status?: number }).status) {
			throw error
		}
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
		if (user.sub === undefined) {
			ctx.throw(500, 'Internal Server Error')
		}

		const apiKeys = await ApiKey.where({ user_id: user.sub })
			.all(['uuid', 'name', 'key_last4', 'created_at', 'updated_at', 'last_used_at'])

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
				type: 'api_keys',
				id: apiKey.uuid,
				attributes
			}
		})

		setJsonApiData(ctx, 200, data)
	} catch (error) {
		// Handle the error appropriately (e.g., log, send error response)
		console.error(error)
		if ((error as { status?: number }).status) {
			throw error
		}
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
		const apiKey = await ApiKey.where({ uuid: apiKeyParam }).first('user_id')

		if (!apiKey) {
			return sendNotFoundResponse(apiKeyParam)
		}

		if (apiKey.user_id == ctx.state.user.sub) {
			await ApiKey.where({ uuid: apiKeyParam, user_id: apiKey.user_id }).destroy()
			setJsonApiNoContent(ctx)
			return
		}

		sendUnauthorizedResponse()

	} catch (error) {
		// Handle the error appropriately (e.g., log, send error response)
		console.error(error)
		if ((error as { status?: number }).status) {
			throw error
		}
		ctx.throw(500, 'Internal Server Error')
	}

	function sendNotFoundResponse(apiKeyParam: string) {
		setJsonApiError(ctx, 404, {
			source: { parameter: 'uuid' },
			title: 'API key not found',
			detail: `API key with id ${apiKeyParam} was not found.`
		})
	}

	function sendUnauthorizedResponse() {
		setJsonApiError(ctx, 403, {
			status: 403,
			title: 'Forbidden',
			detail: 'You are not authorised to delete this API key.'
		})
	}
}
