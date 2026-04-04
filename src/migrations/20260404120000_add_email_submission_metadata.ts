import { Knex } from 'knex'

export const up = async (knex: Knex): Promise<void> => knex.schema.alterTable('email_submissions', (table) => {
	table.string('delivery_status').notNullable().defaultTo('accepted')
	table.string('sender_ip')
})

export const down = async (knex: Knex): Promise<void> => knex.schema.alterTable('email_submissions', (table) => {
	table.dropColumn('sender_ip')
	table.dropColumn('delivery_status')
})
