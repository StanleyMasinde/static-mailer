import { sign, verify, decode, JwtPayload } from 'jsonwebtoken'

const secret: string = process.env.JWT_SECRET || 'secret'

/**
 * Create a new JWT
 * @param payload 
 * @returns 
 */
export const createToken = (payload: { [key: string]: string |number }): string => {
    return sign(payload, secret, {
        expiresIn: '2 days'
    })
}

/**
 * Verify a token
 * @param token 
 */
export const verifyToken = (token: string) => verify(token, secret)