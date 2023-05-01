import { randomBytes } from 'node:crypto'
import { v4 } from 'uuid'
import { Context } from "koa";
import { database } from "../config/database";
import { ApiKeyTable, UserTable } from "../types";
import { JwtPayload } from 'jsonwebtoken';

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
        user_id: ctx.state.user.sub
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
    const user: JwtPayload = ctx.state.user
    const apiKeys = await database<ApiKeyTable>('api_keys')
        .where('user_id', user.sub)
        .select('*')

    const data = apiKeys.map((apiKey) => {
        const attributes = apiKey
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

/**
 * Delete a given API
 * @param ctx 
 */
export const deleteApiKey = async (ctx: Context) => {
    try {
        const apiKeyParam = ctx.params.uuid
        const apiKey = await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).first()

        if (!apiKey) {
            return sendNotFoundResponse(apiKeyParam);
        }

        if (apiKey.user_id == ctx.state.user.sub) {
            await database<ApiKeyTable>('api_keys').where('uuid', apiKeyParam).delete()
            ctx.body = {
                data: "Key deleted."
            }
            return
        }
    } catch (error) {
        ctx.header['content-type'] = 'application/vnd.api+json';
        ctx.status = 500
        ctx.body = {
            errors: [
                {
                    status: 500,
                    title: "Server error.",
                    detail: "A server error occoured. Try again later."
                }
            ]
        }
    }

    function sendNotFoundResponse(apiKeyParam: any) {
        ctx.status = 404;
        ctx.header['content-type'] = 'application/vnd.api+json';

        ctx.body = {
            errors: [
                {
                    source: { parameter: "uuid" },
                    title: "Not found error.",
                    detail: `API key with id ${apiKeyParam} was not found.`
                }
            ]
        };
        return
    }
}
