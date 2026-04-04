import jsonwebtoken from 'jsonwebtoken'

const secret = process.env.JWT_SECRET
const accessTokenTtl = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as jsonwebtoken.SignOptions['expiresIn']

if (!secret) {
	throw new Error('JWT_SECRET is required.')
}

/**
 * Create a new access JWT
 * @param payload The payload to be included in the token
 * @returns The generated JWT
 */
export const createAccessToken = (payload: jsonwebtoken.JwtPayload): string => {
	return jsonwebtoken.sign(payload, secret, {
		expiresIn: accessTokenTtl,
	})
}

export const createToken = createAccessToken

/**
 * Verify a token and return the decoded payload
 * @param token The token to be verified
 * @returns The decoded payload if the token is valid
 */
export const verifyToken = (token: string): jsonwebtoken.JwtPayload => {
	return jsonwebtoken.verify(token, secret) as jsonwebtoken.JwtPayload
}
