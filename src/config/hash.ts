import { compare, hash } from 'bcrypt'

const saltRounds: number = 10

/**
 * Hash a password
 * @param {string} password the password to hash
 * @returns {Promise<String>} password hash
 */
export const createHash = async (password: string): Promise<string> => await hash(password, saltRounds)

/**
 * Compare password hash
 * @param {string} password
 * @param {string} hash 
 * @returns {Promise<Boolean>} password match
 */
export const compareHash = async (password: string, hash: string): Promise<boolean> => await compare(password, hash)
