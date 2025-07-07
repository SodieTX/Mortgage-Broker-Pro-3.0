// Simple Node.js script to test Postgres connection using pg
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', typeof process.env.DB_PASSWORD === 'string' ? '*'.repeat(process.env.DB_PASSWORD.length) : process.env.DB_PASSWORD);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);

client.connect()
  .then(() => {
    console.log('Postgres connection successful!');
    return client.end();
  })
  .catch((err) => {
    console.error('Postgres connection failed:', err);
    process.exit(1);
  });
