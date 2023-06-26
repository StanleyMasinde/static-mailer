import { sign, verify, decode, JwtPayload, Secret } from 'jsonwebtoken';

const secret: Secret = process.env.JWT_SECRET || 'secret';

/**
 * Create a new JWT
 * @param payload The payload to be included in the token
 * @returns The generated JWT
 */
export const createToken = (payload: JwtPayload): string => {
  try {
    return sign(payload, secret, {
      expiresIn: '2 days',
    });
  } catch (error) {
    console.error('An error occurred while creating the JWT:', error);
    throw error;
  }
};

/**
 * Verify a token and return the decoded payload
 * @param token The token to be verified
 * @returns The decoded payload if the token is valid
 */
export const verifyToken = (token: string): JwtPayload => {
  try {
    return verify(token, secret) as JwtPayload;
  } catch (error) {
    console.error('An error occurred while verifying the JWT:', error);
    throw error;
  }
};
