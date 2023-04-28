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
    uuid: string,
    user_id: number,
    name: string,
    key: string
    created_at: Date,
    updated_at: Date,
    last_used_at: Date
}

export interface ValidationMessage {
    'field': string,
    'messages': Array<string>
}

export interface ValidationRuleFactory {
    function: (value: string | number) => boolean,
    message: string
}

export interface EmailOptions {
    subject: string,
    receipient: string,
    template: string,
    data: {[key: string]: any}
}
