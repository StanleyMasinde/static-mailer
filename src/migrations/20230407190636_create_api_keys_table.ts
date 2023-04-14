import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    return knex
        .schema
        .createTable('api_keys', (table) => {
            table.uuid('uuid').unique().primary()
            table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users')
            table.string('name')
            table.string('key').unique().notNullable().index('API_KEY_INDEX')
            table.timestamp('last_used_at')
            table.timestamps(true, true)
        })
}


export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('api_keys')
}

