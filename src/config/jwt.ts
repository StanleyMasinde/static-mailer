import { sign, verify, decode } from 'jsonwebtoken'

const secret: string = process.env.JWT_SECRET || 'secret'

export const createToken = (payload: { [key: string]: string |number }) => {
    return sign(payload, secret, {
        expiresIn: '2 days'
    })
}