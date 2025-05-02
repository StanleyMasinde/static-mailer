import jsonwebtoken from 'jsonwebtoken'

const secret: jsonwebtoken.Secret = process.env.JWT_SECRET || 'secret'

/**
 * Create a new JWT
 * @param payload The payload to be included in the token
 * @returns The generated JWT
 */
export const createToken = (payload: jsonwebtoken.JwtPayload): string => {
	return jsonwebtoken.sign(payload, secret, {
		expiresIn: '2 days',
	})
}

/**
 * Verify a token and return the decoded payload
 * @param token The token to be verified
 * @returns The decoded payload if the token is valid
 */
export const verifyToken = (token: string): jsonwebtoken.JwtPayload => {
	return jsonwebtoken.verify(token, secret) as jsonwebtoken.JwtPayload
}
