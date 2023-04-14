import dotenv from 'dotenv'
dotenv.config()

import type { Knex } from "knex";

const config: { [key: string]: Knex.Config } = {
  development: {
    client: process.env.DATABASE_CLIENT || 'mysql2',
    connection: {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'root',
      database: process.env.DATABASE_SCHEMA || 'staticsend'
    },
    migrations: {
      directory: 'dist/migrations',
      tableName: 'migrations'
    }
  },

  production: {
    client: process.env.DATABASE_CLIENT || 'mysql2',
    connection: {
      host: process.env.DATABASE_HOST || '127.0.0.1',
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || 'root',
      database: process.env.DATABASE_SCHEMA || 'staticsend'
    },
    migrations: {
      directory: 'dist/migrations',
      tableName: 'migrations'
    }
  }
};

module.exports = config;
