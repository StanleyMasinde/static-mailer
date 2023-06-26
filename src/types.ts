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
    key: string
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
    validator: (value: string | number) => boolean,
    title: string,
    detail: string
}

export interface EmailOptions {
    subject: string,
    receipient: string,
    template: string,
    data: { [key: string]: any }
}

export interface GoogleJWTPayload {
    email: string,
    email_verified: boolean,
    azp: string,
    name: string
    picture?: string,
    given_name: string,
    family_name: string,
    iat: number
    exp: number
}
