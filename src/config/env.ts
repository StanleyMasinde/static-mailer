const REQUIRED_ENV_VARS = [
	'APP_URL',
	'DATABASE_CLIENT',
	'DATABASE_HOST',
	'DATABASE_USER',
	'DATABASE_PASSWORD',
	'DATABASE_SCHEMA',
	'MAILER_HOST',
	'MAILER_PORT',
	'JWT_SECRET'
] as const

function env(name: string): string {
	return process.env[name]?.trim() || ''
}

function parseAllowlist(rawAllowlist: string): string[] {
	return rawAllowlist
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean)
}

export function getCorsAllowlist(): string[] {
	const rawAllowlist = env('CORS_ALLOWLIST')
	if (rawAllowlist) {
		return parseAllowlist(rawAllowlist)
	}
	const appUrl = env('APP_URL')
	return appUrl ? [appUrl] : []
}

export function validateEnvironment(): void {
	const missing: string[] = []
	for (const variableName of REQUIRED_ENV_VARS) {
		if (!env(variableName)) {
			missing.push(variableName)
		}
	}

	const issues: string[] = []
	if (missing.length > 0) {
		issues.push(`Missing required environment variables: ${missing.join(', ')}`)
	}

	const mailerPort = Number.parseInt(env('MAILER_PORT'), 10)
	if (!Number.isInteger(mailerPort) || mailerPort < 1 || mailerPort > 65535) {
		issues.push('MAILER_PORT must be a valid TCP port (1-65535).')
	}

	const mailerSecure = env('MAILER_SECURE')
	if (mailerSecure && !['true', 'false'].includes(mailerSecure)) {
		issues.push('MAILER_SECURE must be either "true" or "false".')
	}

	const mailerRequireTls = env('MAILER_REQUIRE_TLS')
	if (mailerRequireTls && !['true', 'false'].includes(mailerRequireTls)) {
		issues.push('MAILER_REQUIRE_TLS must be either "true" or "false".')
	}

	const mailerUsername = env('MAILER_USERNAME')
	const mailerPassword = env('MAILER_PASSWORD')
	if ((mailerUsername && !mailerPassword) || (!mailerUsername && mailerPassword)) {
		issues.push('MAILER_USERNAME and MAILER_PASSWORD must either both be set or both be empty.')
	}

	const mailerFromEmail = env('MAILER_FROM_EMAIL')
	if (mailerFromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailerFromEmail)) {
		issues.push('MAILER_FROM_EMAIL must be a valid email address.')
	}

	const appPort = env('APP_PORT')
	if (appPort) {
		const parsedAppPort = Number.parseInt(appPort, 10)
		if (!Number.isInteger(parsedAppPort) || parsedAppPort < 1 || parsedAppPort > 65535) {
			issues.push('APP_PORT must be a valid TCP port (1-65535).')
		}
	}

	const jwtSecret = env('JWT_SECRET')
	if (process.env.NODE_ENV !== 'test' && jwtSecret.length < 32) {
		issues.push('JWT_SECRET must be at least 32 characters outside test environments.')
	}

	for (const origin of getCorsAllowlist()) {
		try {
			const parsed = new URL(origin)
			if (!['http:', 'https:'].includes(parsed.protocol)) {
				issues.push(`CORS_ALLOWLIST contains invalid protocol for origin "${origin}".`)
			}
		} catch {
			issues.push(`CORS_ALLOWLIST contains invalid origin "${origin}".`)
		}
	}

	if (issues.length > 0) {
		throw new Error(`Invalid environment configuration:\n- ${issues.join('\n- ')}`)
	}
}
