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

export interface UserTable {
    [key: string]: string | number | Date;
    id: number,
    name: string,
    email: string,
    password: string,
    created_at: Date,
    updated_at: Date
}

export interface ApiKeyTable {
    uuid?: string,
    user_id?: number,
    name: string,
    key?: string | null,
    key_hash?: string,
    key_last4?: string,
    created_at: Date,
    updated_at: Date,
    last_used_at: Date
}

export interface ValidationMessage {
    source: string,
    title: string
    message: string
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

export interface EmailSubmissionTable {
    id?: number
    key_uuid?: string
    subject?: string
    message?: string
    delivery_status?: 'accepted' | 'failed'
    delivered_at?: Date
    sender_ip?: string
    created_at?: string
    updated_at?: string
}

export interface ApiKeysUsersJoin {
    email?: string
    uuid?: string
}

export interface PasswordResetsTable {
    id: number,
    user_id: number,
    code: string,
    expires_at: Date
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
