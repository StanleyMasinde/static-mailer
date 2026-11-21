import { Model } from 'mevn-orm'

export class User extends Model {
	declare id: number
	declare name: string
	declare email: string
	declare password: string
	declare created_at?: Date
	declare updated_at?: Date

	override hidden = ['password']
}

export class RefreshToken extends Model {
	declare id: number
	declare user_id: number
	declare token_hash: string
	declare expires_at: Date
	declare revoked_at?: Date | null
}

export class PasswordReset extends Model {
	declare id: number
	declare user_id: number
	declare code: string
	declare expires_at: Date
}

export class SocialAccount extends Model {
	declare id: number
	declare user_id: number
	declare provider: 'google' | 'github'
	declare provider_user_id: string
	declare provider_email: string

	user() {
		return this.belongsTo(User)
	}
}

export class ApiKey extends Model {
	declare uuid: string
	declare user_id: number | string
	declare name: string
	declare key: string | null
	declare key_hash: string
	declare key_last4: string
	declare created_at: Date
	declare updated_at: Date
	declare last_used_at: Date | null

	override hidden = ['key', 'key_hash']
}

export class EmailSubmission extends Model {
	declare key_uuid: string
	declare subject: string
	declare message: string
	declare delivery_status: 'accepted' | 'failed'
	declare delivered_at: Date
	declare sender_ip: string
}
