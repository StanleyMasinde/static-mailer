import { randomBytes } from 'node:crypto'
import { v4 } from 'uuid'
import { Context } from "koa";
import { database } from "../config/database";
import { ApiKeyTable } from "../types";

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