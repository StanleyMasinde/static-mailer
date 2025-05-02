import knex from 'knex'

export const database = knex.knex({
	client: process.env.DATABASE_CLIENT || 'mysql2',
	connection: {
		host: process.env.DATABASE_HOST || '127.0.0.1',
		user: process.env.DATABASE_USER || 'root',
		password: process.env.DATABASE_PASSWORD || 'root',
		database: process.env.DATABASE_SCHEMA || 'staticsend'
	},
	migrations: {
		directory: 'db/migrations',
		tableName: 'migrations'
	}
})
