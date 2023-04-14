import { Context, Next } from "koa";
import { RegisterRequest, UserTable } from "../types";
import { database } from "../config/database";
import { createHash } from "../config/hash";
import { createToken } from "../config/jwt";

/**
 * Register a new user
 * @param ctx Koa context
 */
export const register = async (ctx: Context) => {
    const requestBody = ctx.request.body as RegisterRequest
    if (!requestBody) {
        ctx.status = 400
        ctx.body = {
            message: 'Bad request'
        }
        return
    }
    const password = await createHash(requestBody.password)

    const [userId] = await database<UserTable>('users')
        .insert({
            'name': requestBody.name,
            'email': requestBody.email,
            'password': password
        })
    const user = await database<UserTable>('users').where('id', userId).first('id', 'name', 'email')
    if (user) {
        const token = createToken(user)
        ctx.body = {
            user,
            token
        }
        return
    }

    ctx.throw("Error registering user")
}

export const login = (ctx: Context) => {

}

export const authorize = (ctx: Context, next: Next) => {

}
