import { Knex } from "knex";


export const up = (knex: Knex): Promise<void> => knex.schema.createTable('api_keys', (table) => {
    table.uuid('uuid').unique().primary()
    table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users')
    table.string('name')
    table.string('key').unique().notNullable().index('API_KEY_INDEX')
    table.timestamp('last_used_at')
    table.timestamps(true, true)
})


export const down = (knex: Knex): Promise<void> => knex.schema.dropTable('api_keys')

