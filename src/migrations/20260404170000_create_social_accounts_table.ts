import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable('social_accounts', (table) => {
		table.bigIncrements('id').primary().unsigned()
		table.bigInteger('user_id').unsigned().notNullable()
		table.string('provider', 32).notNullable()
		table.string('provider_user_id', 255).notNullable()
		table.string('provider_email').notNullable()
		table.timestamps(true, true)

		table.foreign('user_id').references('users.id').onDelete('CASCADE')
		table.unique(['provider', 'provider_user_id'], {
			indexName: 'social_accounts_provider_provider_user_id_unique'
		})
		table.unique(['provider', 'user_id'], {
			indexName: 'social_accounts_provider_user_id_unique'
		})
		table.index(['user_id'])
		table.index(['provider'])
	})
}

export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('social_accounts')
}
