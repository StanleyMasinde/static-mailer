import { describe, expect, it } from 'vitest';
import { database } from '../src/config/database';

describe('Database tests', () => {
  it('Database connection', async () => {
    const query = database('users').select().toSQL();
    expect(query.sql).toBe('select * from `users`');
    expect(query.method).toBe('select');
    expect(query.bindings).toEqual([]);
    await database.destroy();
  });
});
