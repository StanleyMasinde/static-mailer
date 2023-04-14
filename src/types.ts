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

export interface UserTable {
    id: number,
    name: string,
    email: string,
    password: string,
    created_at: string,
    updated_at: string
}
