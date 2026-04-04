import 'dotenv/config'

import { migrateLatest, setMigrationConfig } from 'mevn-orm'
import { database, migrationConfig } from '../config/database.js'

const run = async () => {
	setMigrationConfig(migrationConfig)
	await migrateLatest()
	await database.destroy()
}

run().catch(async (error) => {
	console.error(error)
	await database.destroy()
	process.exit(1)
})
