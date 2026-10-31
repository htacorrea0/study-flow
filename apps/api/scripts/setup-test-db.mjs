/**
 * Prepara o banco usado pelos testes de integração.
 *
 * Roda em Node puro (sem shell) para funcionar igual no Linux, no macOS e no
 * PowerShell — um comando com `psql -c "CREATE DATABASE ..."` dependeria de o
 * cliente estar instalado na máquina e de aspas que mudam entre shells.
 *
 * O que faz:
 *   1. deriva a URL do banco de teste a partir da DATABASE_URL do .env;
 *   2. cria o banco se ele ainda não existir;
 *   3. aplica as migrations nele com `prisma migrate deploy`.
 *
 * É idempotente: rodar de novo não apaga nada e não falha.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadDotenv } from 'dotenv';
import pg from 'pg';

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadDotenv({ path: path.join(apiDir, '.env') });

const TEST_DB_NAME = 'studyflow_test';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) {
  console.error(
    'DATABASE_URL não definida. Copie apps/api/.env.example para apps/api/.env antes de rodar os testes de integração.',
  );
  process.exit(1);
}

const testUrl = new URL(baseUrl);
testUrl.pathname = `/${TEST_DB_NAME}`;

// Para criar um banco é preciso estar conectado a outro: usamos o `postgres`,
// que existe em qualquer instalação.
const adminUrl = new URL(baseUrl);
adminUrl.pathname = '/postgres';

const client = new pg.Client({ connectionString: adminUrl.toString() });

try {
  await client.connect();
} catch (error) {
  console.error(
    `\nNão foi possível conectar ao PostgreSQL em ${adminUrl.host}.\n` +
      'Suba o banco antes: npm run db:up\n',
  );
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
  TEST_DB_NAME,
]);

if (rowCount === 0) {
  // O nome é uma constante deste arquivo, não entrada de usuário; ainda
  // assim vai entre aspas duplas, que é a forma correta de citar um
  // identificador no Postgres.
  await client.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  console.log(`Banco de teste "${TEST_DB_NAME}" criado.`);
} else {
  console.log(`Banco de teste "${TEST_DB_NAME}" já existe.`);
}

await client.end();

const migrate = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['prisma', 'migrate', 'deploy'],
  {
    cwd: apiDir,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
  },
);

if (migrate.status !== 0) {
  console.error('\nFalha ao aplicar as migrations no banco de teste.');
  process.exit(migrate.status ?? 1);
}

console.log('Banco de teste pronto.');
