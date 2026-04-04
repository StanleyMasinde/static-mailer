import { createPublicKey, KeyObject, verify as verifySignature } from 'node:crypto'
import { GoogleJWTPayload } from '../types.js'

interface GoogleJwk {
	kid: string
	kty: string
	alg: string
	use: string
	n: string
	e: string
}

interface GoogleCertsResponse {
	keys: GoogleJwk[]
}

interface GoogleTokenHeader {
	alg?: string
	kid?: string
	typ?: string
}

interface CachedGoogleKeys {
	byKid: Map<string, KeyObject>
	expiresAt: number
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com'])
const CLOCK_SKEW_SECONDS = 300

let keyCache: CachedGoogleKeys | null = null

function parseMaxAgeSeconds(cacheControl: string | null): number {
	if (!cacheControl) {
		return 300
	}
	const match = cacheControl.match(/max-age=(\d+)/i)
	if (!match) {
		return 300
	}
	return Number.parseInt(match[1], 10)
}

async function fetchGoogleKeys(forceRefresh = false): Promise<Map<string, KeyObject>> {
	const now = Date.now()
	if (!forceRefresh && keyCache && keyCache.expiresAt > now) {
		return keyCache.byKid
	}

	const response = await fetch(GOOGLE_JWKS_URL)
	if (!response.ok) {
		throw new Error('Failed to fetch Google public keys')
	}

	const json = await response.json() as GoogleCertsResponse
	const byKid = new Map<string, KeyObject>()
	for (const jwk of json.keys || []) {
		if (jwk.kty !== 'RSA' || !jwk.kid) {
			continue
		}
		const keyObject = createPublicKey({
			key: jwk,
			format: 'jwk',
		})
		byKid.set(jwk.kid, keyObject)
	}

	const ttlSeconds = parseMaxAgeSeconds(response.headers.get('cache-control'))
	keyCache = {
		byKid,
		expiresAt: now + (ttlSeconds * 1000),
	}
	return byKid
}

function decodeBase64UrlJson<T>(value: string): T {
	const decoded = Buffer.from(value, 'base64url').toString('utf8')
	return JSON.parse(decoded) as T
}

function readTokenParts(token: string): { header: GoogleTokenHeader, payload: GoogleJWTPayload, signature: Buffer, signedData: Buffer } {
	const parts = token.split('.')
	if (parts.length !== 3) {
		throw new Error('Malformed JWT')
	}

	const header = decodeBase64UrlJson<GoogleTokenHeader>(parts[0])
	const payload = decodeBase64UrlJson<GoogleJWTPayload>(parts[1])
	const signature = Buffer.from(parts[2], 'base64url')
	const signedData = Buffer.from(`${parts[0]}.${parts[1]}`)

	return { header, payload, signature, signedData }
}

function validateClaims(payload: GoogleJWTPayload, expectedAudience: string) {
	if (!GOOGLE_ISSUERS.has(payload.iss || '')) {
		throw new Error('Invalid issuer')
	}
	if (payload.aud !== expectedAudience) {
		throw new Error('Invalid audience')
	}
	if (!payload.exp || !payload.iat) {
		throw new Error('Missing token timestamps')
	}
	const nowSeconds = Math.floor(Date.now() / 1000)
	if (payload.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
		throw new Error('Token expired')
	}
	if (payload.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
		throw new Error('Token used too early')
	}
	if (!payload.email || payload.email_verified !== true) {
		throw new Error('Email not verified')
	}
}

export const verifyGoogleIdToken = async (token: string, audience: string): Promise<GoogleJWTPayload> => {
	if (!audience) {
		throw new Error('Google audience is required')
	}

	const { header, payload, signature, signedData } = readTokenParts(token)

	if (header.alg !== 'RS256' || !header.kid) {
		throw new Error('Invalid token header')
	}

	let keys = await fetchGoogleKeys(false)
	let key = keys.get(header.kid)
	if (!key) {
		keys = await fetchGoogleKeys(true)
		key = keys.get(header.kid)
	}
	if (!key) {
		throw new Error('Unknown signing key')
	}

	const isValid = verifySignature('RSA-SHA256', signedData, key, signature)
	if (!isValid) {
		throw new Error('Invalid token signature')
	}

	validateClaims(payload, audience)
	return payload
}
