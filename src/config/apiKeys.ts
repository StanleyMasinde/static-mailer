import { createHash, randomBytes } from 'node:crypto'

export function generateRawApiKey(): string {
	return randomBytes(32).toString('base64url')
}

export function hashApiKey(rawKey: string): string {
	return createHash('sha256').update(rawKey).digest('hex')
}

export function getApiKeyLast4(rawKey: string): string {
	return rawKey.slice(-4)
}
