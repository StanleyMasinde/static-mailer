import { Knex } from 'knex'


/**
 * Run the migrations
 * @param knex 
 * @returns 
 */
export async function up(knex: Knex): Promise<void> {
	return knex.schema.createTable('password_resets', (table) => {
		table.bigIncrements('id').primary().unsigned()
		table.bigInteger('user_id').unsigned()
		table.string('code')
		table.timestamp('expires_at')
	})
}

/**
 * Rollback the migrations
 * @param knex 
 */
export async function down(knex: Knex): Promise<void> {
	return knex.schema.dropTable('password_resets')
}

