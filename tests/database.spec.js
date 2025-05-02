import 'dotenv/config'
import { database } from '../dist/config/database';

describe('Database tests', () => {
  test('Database connection', async () => {
    const query = database('users').select().toSQL();
    expect(query.sql).toBe('select * from `users`');
    expect(query.method).toBe('select');
    expect(query.bindings).toEqual([]);
    await database.destroy();
  });
});
