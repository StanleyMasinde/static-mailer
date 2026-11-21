export interface EmailRequest {
    subject: string,
    email: string,
    message: string
}

export interface RegisterRequest {
    name: string,
    email: string,
    password: string
}

export interface LoginRequest {
    email: string,
    password: string
}

export interface ValidationMessage {
    source: {
        pointer: string
    },
    title: string
    detail: string
}

export interface ValidationRuleFactory {
    validator: (value: unknown) => boolean,
    title: string,
    detail: string
}

export interface EmailOptions {
    subject: string,
    receipient: string,
    template: string,
    data: Record<string, string | number | Date>
}

export interface GoogleJWTPayload {
    iss?: string,
    aud?: string,
    sub?: string,
    email: string,
    email_verified: boolean,
    azp: string,
    name: string,
    picture?: string,
    given_name: string,
    family_name: string,
    iat: number,
    exp: number
}

export interface GitHubAuthPayload {
	sub: string
	email: string
	name: string
}

export interface ChangePasswordRequest {
    /**
     * The email of the user.
     * This will be used to find the user who is making
     * The change request. We cannot use the code since is hashed.
     */
    email: string,
    /**
     * The unique code that was sent to the user
     * This should be validated and authenticated.
     */
    code: string,
    /**
     * The new password that the user has chosen.
     */
    password: string
}
