import { randomBytes } from 'node:crypto'
import { v4 } from 'uuid'
import { Context } from "koa";
import { database } from "../config/database";
import { ApiKeyTable, UserTable } from "../types";

/**
 * Create API key
 * @param ctx 
 */
export const createApiKey = async (ctx: Context) => {
    const { body } = ctx.request
    const uuid = v4()
    await database<ApiKeyTable>('api_keys').insert({
        uuid,
        name: body.name,
        key: randomBytes(16).toString('base64url'),
        user_id: ctx.state.user.id
    })

    const apiKey = await database<ApiKeyTable>('api_keys').where('uuid', uuid).first()
    ctx.body = {
        apiKey
    }
}

/**
 * Get all api Keys by a user
 * @param ctx 
 * @returns 
 */
export const getUserApiKeys = async (ctx: Context) => {
    const user = ctx.state.user as UserTable
    const apiKeys = await database<ApiKeyTable>('api_keys')
        .where('user_id', user.id)
        .select('*')

    const data = apiKeys.map((apiKey) => {
        const attributes = apiKey
        delete attributes.uuid
        delete attributes.user_id
        return {
            type: "apiKeys",
            uuid: apiKey.uuid,
            attributes
        }
    })

    ctx.header['content-type'] = 'application/vnd.api+json'
    ctx.body = {
        data
    }
    return
}