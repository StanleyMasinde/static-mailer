import { Context, Next } from "koa";
import { LoginRequest, RegisterRequest, UserTable } from "../types";
import { database } from "../config/database";
import { compareHash, createHash } from "../config/hash";
import { createToken, verifyToken } from "../config/jwt";
import { sendMail } from "../config/mailer";

/**
 * Register a new user
 * @param ctx Koa context
 */
export const register = async (ctx: Context) => {
    const requestBody = ctx.request.body as RegisterRequest
    const password = await createHash(requestBody.password)

    const userExists = await database<UserTable>('users').where('email', requestBody.email).first()
    if (userExists) {
        ctx.status = 422;
        ctx.header["content-type"] = 'application/vnd.api+json'
        ctx.body = {
            errors: [
                {
                    source: '/data/attributes/email',
                    title: 'Invalid E-mail',
                    message: 'This email is already registered'
                }
            ]
        }
        return
    }
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
        sendMail({
            subject: "Welcome to Static Mailer",
            receipient: user.email,
            template: "welcome",
            data: {
                user
            }
        })
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
        ctx.header["content-type"] = 'application/vnd.api+json'
        ctx.body = {
            errors: [
                {
                    status: "401",
                    title: "Authentication error.",
                    detail: "These credentials do not match our records."
                }
            ]
        };
        return
    }
}

/**
 * Get the currently authenticated user
 * @param ctx Koa.context
 */
export const me = (ctx: Context) => {
    const bearerToken = ctx.request.header['authorization']?.split(' ')[1]

    if (bearerToken) {
        const user = verifyToken(bearerToken)
        ctx.body = {
            user
        }
        return
    }
}

/**
 * Prevent unauthenticated route access
 * @param ctx 
 * @param next 
 */
export const authorize = async (ctx: Context, next: Next) => {
    const bearerToken = ctx.request.header['authorization']?.split(' ')[1]
    if (bearerToken) {
        try {
            const user = verifyToken(bearerToken)
            ctx.state.user = user
            return await next()
        } catch (err) {
            return sendUnauthorizedResponse();
        }
    }

    return sendUnauthorizedResponse()

    function sendUnauthorizedResponse() {
        ctx.status = 403;
        ctx.header["content-type"] = 'application/vnd.api+json'
        ctx.body = {
            errors: [
                {
                    status: "403",
                    title: "Authorization error.",
                    detail: "You are not allowed to access this resource."
                }
            ]
        };
        return
    }
}
