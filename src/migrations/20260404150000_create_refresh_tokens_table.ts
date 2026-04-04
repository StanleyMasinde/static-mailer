import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable('refresh_tokens', (table) => {
		table.bigIncrements('id').primary().unsigned()
		table.bigInteger('user_id').unsigned().notNullable()
		table.string('token_hash', 64).notNullable().unique()
		table.timestamp('expires_at').notNullable()
		table.timestamp('revoked_at').nullable()
		table.timestamps(true, true)

		table.foreign('user_id').references('users.id').onDelete('CASCADE')
		table.index(['user_id'])
		table.index(['expires_at'])
		table.index(['revoked_at'])
	})
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('refresh_tokens')
}
