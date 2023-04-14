import { Context, Next } from "koa";
import { LoginRequest, RegisterRequest, UserTable } from "../types";
import { database } from "../config/database";
import { compareHash, createHash } from "../config/hash";
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

/**
 * Login a user and return a token
 * @param ctx Koa context
 */
export const login = async (ctx: Context) => {
    const requestBody = ctx.request.body as LoginRequest
    const user = await database<UserTable>('users').where('email', requestBody.email).first()
    // The user exists we now check if the password matches
    if (user) {
        const passwordMatches = await compareHash(requestBody.password, user.password)
        // The password matches so we generate a JWT
        if (passwordMatches) {
            const token = createToken({ id: user.id, name: user.name, email: user.email })
            ctx.body = {
                token
            }
            return
        }
        // The password did not match send a failed auth response
        return sendFailedAuthResponse();
    }
    return sendFailedAuthResponse()

    function sendFailedAuthResponse() {
        ctx.status = 401;
        ctx.body = {
            message: 'These credentials do match our records'
        };
        return
    }
}

export const authorize = (ctx: Context, next: Next) => {

}
