import { configureDatabase } from 'mevn-orm'

export const database = configureDatabase({
	dialect: (process.env.DATABASE_CLIENT as 'mysql2' | undefined) || 'mysql2',
	host: process.env.DATABASE_HOST || '127.0.0.1',
	user: process.env.DATABASE_USER || 'root',
	password: process.env.DATABASE_PASSWORD || 'root',
	database: process.env.DATABASE_SCHEMA || 'staticsend'
})

export const migrationConfig = {
	directory: 'dist/migrations',
	extension: 'js',
	tableName: 'migrations'
}
