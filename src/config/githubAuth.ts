import { GitHubAuthPayload } from '../types.js'

interface GitHubUserResponse {
	id?: number
	login?: string
	name?: string | null
	email?: string | null
}

interface GitHubEmailResponse {
	email?: string
	primary?: boolean
	verified?: boolean
}

const GITHUB_API_BASE_URL = 'https://api.github.com'
const USER_AGENT = 'StaticMailer'

function normalizeEmail(value: unknown): string {
	return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeName(name: unknown, fallback: string): string {
	if (typeof name === 'string' && name.trim().length > 0) {
		return name.trim()
	}
	return fallback
}

async function fetchGitHubJson<T>(path: string, token: string): Promise<T> {
	const response = await fetch(`${GITHUB_API_BASE_URL}${path}`, {
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': USER_AGENT
		}
	})

	if (!response.ok) {
		throw new Error('GitHub token verification failed')
	}

	return await response.json() as T
}

function pickVerifiedEmail(addresses: GitHubEmailResponse[]): string {
	const verifiedAddresses = addresses
		.map((entry) => ({
			email: normalizeEmail(entry.email),
			primary: entry.primary === true
		}))
		.filter((entry) => entry.email.length > 0)

	const primaryVerified = verifiedAddresses.find((entry) => entry.primary)
	if (primaryVerified) {
		return primaryVerified.email
	}
	return verifiedAddresses[0]?.email || ''
}

export const verifyGitHubAccessToken = async (token: string): Promise<GitHubAuthPayload> => {
	const normalizedToken = token.trim()
	if (!normalizedToken) {
		throw new Error('GitHub access token is required')
	}

	const user = await fetchGitHubJson<GitHubUserResponse>('/user', normalizedToken)
	const providerUserId = typeof user.id === 'number' ? `${user.id}` : ''
	if (!providerUserId) {
		throw new Error('Invalid GitHub user profile')
	}

	const fallbackName = typeof user.login === 'string' && user.login.trim().length > 0
		? user.login.trim()
		: 'GitHub user'

	let email = normalizeEmail(user.email)
	if (!email) {
		const addresses = await fetchGitHubJson<GitHubEmailResponse[]>('/user/emails', normalizedToken)
		email = pickVerifiedEmail(addresses.filter((entry) => entry.verified === true))
	}
	if (!email) {
		throw new Error('No verified email available on GitHub account')
	}

	return {
		sub: providerUserId,
		email,
		name: normalizeName(user.name, fallbackName)
	}
}
