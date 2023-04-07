require('dotenv').config()
const { database } = require('../dist/config/database')

describe('Database tests', () => {
    test('Database connection', async () => {
        const results = database('users').select().toSQL().sql
        expect(results).toBe('select * from `users`')
    })
})