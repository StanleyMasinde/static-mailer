import { Knex } from "knex";


export const up = async (knex: Knex): Promise<void> => knex.schema.createTable('email_submissions', (table) => {
    table.bigIncrements('id', { primaryKey: true }).unique();
    table.string('key_uuid').notNullable().index();
    table.string('subject');
    table.text('message').notNullable();
    table.dateTime('delivered_at');
    table.timestamps();

    // TODO: Research if we can get the delivery status of emails
    // TODO: Should we store the IP address of the sender?
})


export const down = (knex: Knex): Promise<void> =>  knex.schema.dropTable('email_submissions')

