import { randomInt } from 'node:crypto'
import { Context, Next } from "koa";
import { GoogleJWTPayload, LoginRequest, PasswordResetsTable, RegisterRequest, UserTable } from "../types";
import { database } from "../config/database";
import { compareHash, createHash } from "../config/hash";
import { createToken, verifyToken } from "../config/jwt";
import { sendMail } from "../config/mailer";
import { JwtPayload, decode } from "jsonwebtoken";
import { hash } from 'bcrypt';

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
        const Payload: JwtPayload = {
            sub: `${user.id}`,
            attributes: {
                name: user.name,
                email: user.email
            }
        }
        const token = createToken(Payload)
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
            const Payload: JwtPayload = {
                sub: `${user.id}`,
                attributes: {
                    name: user.name,
                    email: user.email
                }
            }
            const token = createToken(Payload)
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


/**
 * Handle password reset request.
 * 
 */
export const sendPasswordResetInstructions = async (ctx: Context) => {
    try {
        const email = ctx.request.body.email
        const user = await database<UserTable>('users').where({ email }).first()
        if (user) {
            const code = randomInt(99999, 1000000)
            const codeHash = await createHash(code.toString())
            const date = new Date()
            const currentMinutes = date.getMinutes();
            date.setMinutes(currentMinutes + 60);
            await database<PasswordResetsTable>('password_resets')
                .insert({
                    user_id: user.id,
                    code: codeHash,
                    expires_at: date
                })
            await sendMail({
                template: 'passwordreset',
                subject: 'Password reset notification',
                receipient: user.email,
                data: {
                    code
                }
            })

            ctx.body = {
                message: "Check your email."
            }
        }
    } catch (error) {
        console.log(error);
       ctx.throw('Server Error')
    }
}

/**
 * Handle social auth
 */
export const socialAuth = async (ctx: Context) => {
    const provider = ctx.params.provider

    switch (provider) {
        case 'google':
            await handleGoogleAuth()
            break;
        default:
            invalidProvidererror()
            break;
    }

    async function handleGoogleAuth() {
        const token = ctx.request.body
        console.log(token);
        if (!token) {
            return missingTokenError()
        }

        const userInfo = decode(token) as GoogleJWTPayload
        const email = userInfo.email
        const userInDb = await database<UserTable>('users').where('email', email).first()

        if (userInDb) {
            const Payload: JwtPayload = {
                sub: `${userInDb.id}`,
                attributes: {
                    name: userInDb.name,
                    email: userInDb.email
                }
            }

            const token = createToken(Payload)
            ctx.body = {
                token
            }
            return
        }

        const [userId] = await database<UserTable>('users').insert({
            name: userInfo.name,
            email: userInfo.email,
            password: '',
        })

        const Payload: JwtPayload = {
            sub: `${userId}`,
            attributes: {
                name: userInfo.name,
                email: userInfo.email
            }
        }
        const token2 = createToken(Payload)
        ctx.body = {
            token: token2
        }
        sendMail({
            subject: "Welcome to Static Mailer",
            receipient: userInfo.email,
            template: "welcome",
            data: {
                userInfo
            }
        })

        return
    }

    function missingTokenError() {
        ctx.status = 400
        ctx.body = {
            errors: [
                {
                    status: 400,
                    title: "Missing token",
                    detail: "Token missing from request body."
                }
            ]
        };
        return
    }

    function invalidProvidererror() {
        ctx.status = 400
        return ctx.body = {
            errors: [
                {
                    status: 400,
                    title: 'Invalid provider',
                    detail: 'The provider is not supported. The supported provider is Google'
                }
            ]
        };
    }
}
