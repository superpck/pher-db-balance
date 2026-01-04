require('dotenv').config({ path: '../../.env' });

module.exports = {
  master: {
    client: 'mysql2',
    connection: {
      host: process.env.MASTER_DB_HOST,
      port: process.env.MASTER_DB_PORT,
      user: process.env.MASTER_DB_USER,
      password: process.env.MASTER_DB_PASSWORD,
      database: process.env.MASTER_DB_NAME,
      connectTimeout: 60000
      // typeCast: function (field, next) {
      //   if (field.type === 'JSON') {
      //     return null;
      //   }
      //   return next();
      // }
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000,
      createTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      directory: '../migrations/master',
      tableName: 'knex_migrations'
    }
  },
  slave: {
    client: 'mysql2',
    connection: {
      host: process.env.SLAVE_DB_HOST,
      port: process.env.SLAVE_DB_PORT,
      user: process.env.SLAVE_DB_USER,
      password: process.env.SLAVE_DB_PASSWORD,
      database: process.env.SLAVE_DB_NAME,
      connectTimeout: 60000
      // typeCast: function (field, next) {
      //   if (field.type === 'JSON') {
      //     return null;
      //   }
      //   return next();
      // }
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000,
      createTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      directory: '../migrations/master',
      tableName: 'knex_migrations'
    }
  },
  offline: {
    client: 'mysql2',
    connection: {
      host: process.env.OFFLINE_DB_HOST,
      port: process.env.OFFLINE_DB_PORT,
      user: process.env.OFFLINE_DB_USER,
      password: process.env.OFFLINE_DB_PASSWORD,
      database: process.env.OFFLINE_DB_NAME,
      connectTimeout: 60000,
      // typeCast: function (field, next) {
      //   if (field.type === 'JSON') {
      //     return null;
      //   }
      //   return next();
      // }
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 60000,
      idleTimeoutMillis: 600000,
      createTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    },
    migrations: {
      directory: '../migrations/offline',
      tableName: 'knex_migrations'
    }
  }
};
