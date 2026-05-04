import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { buildDatabaseUrl } from '../src/utils/database-url.js';

dotenv.config();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = buildDatabaseUrl({
    databaseUrl: process.env.DATABASE_URL,
    mysqlHost: process.env.MYSQL_HOST,
    mysqlPort: process.env.MYSQL_PORT,
    mysqlDatabase: process.env.MYSQL_DATABASE,
    mysqlUser: process.env.MYSQL_USER,
    mysqlPassword: process.env.MYSQL_PASSWORD,
    mysqlSsl: process.env.MYSQL_SSL,
  });
}

const args = process.argv.slice(2);
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const child = spawn(command, ['prisma', ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
