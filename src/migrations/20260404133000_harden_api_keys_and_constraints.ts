import { Knex } from 'knex'

export const up = async (knex: Knex): Promise<void> => {
	await knex.schema.alterTable('api_keys', (table) => {
		table.string('key_hash')
		table.string('key_last4', 4)
	})

	await knex('api_keys')
		.whereNotNull('key')
		.update({
			key_hash: knex.raw('SHA2(`key`, 256)'),
			key_last4: knex.raw('RIGHT(`key`, 4)')
		})

	await knex.schema.alterTable('api_keys', (table) => {
		table.string('key_hash').notNullable().alter()
		table.string('key_last4', 4).notNullable().alter()
		table.unique(['key_hash'], {
			indexName: 'API_KEY_HASH_INDEX'
		})
		table.string('key').nullable().alter()
	})

	await knex.raw(`
		DELETE email_submissions
		FROM email_submissions
		LEFT JOIN api_keys ON email_submissions.key_uuid = api_keys.uuid
		WHERE api_keys.uuid IS NULL
	`)

	await knex.schema.alterTable('email_submissions', (table) => {
		table.string('key_uuid').notNullable().alter()
		table.foreign('key_uuid', 'email_submissions_key_uuid_foreign')
			.references('api_keys.uuid')
			.onDelete('CASCADE')
	})

	await knex.raw(`
		DELETE password_resets
		FROM password_resets
		LEFT JOIN users ON password_resets.user_id = users.id
		WHERE users.id IS NULL
	`)

	await knex.schema.alterTable('password_resets', (table) => {
		table.bigInteger('user_id').unsigned().notNullable().alter()
		table.string('code').notNullable().alter()
		table.timestamp('expires_at').notNullable().alter()
		table.foreign('user_id', 'password_resets_user_id_foreign')
			.references('users.id')
			.onDelete('CASCADE')
	})
}

export const down = async (knex: Knex): Promise<void> => {
	await knex.schema.alterTable('password_resets', (table) => {
		table.dropForeign(['user_id'], 'password_resets_user_id_foreign')
		table.bigInteger('user_id').unsigned().nullable().alter()
		table.string('code').nullable().alter()
		table.timestamp('expires_at').nullable().alter()
	})

	await knex.schema.alterTable('email_submissions', (table) => {
		table.dropForeign(['key_uuid'], 'email_submissions_key_uuid_foreign')
	})

	await knex.schema.alterTable('api_keys', (table) => {
		table.dropUnique(['key_hash'], 'API_KEY_HASH_INDEX')
		table.string('key').notNullable().alter()
		table.dropColumn('key_hash')
		table.dropColumn('key_last4')
	})
}
