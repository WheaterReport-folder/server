import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import 'dotenv/config';

const here = dirname(fileURLToPath(import.meta.url));

async function ensureDatabase() {
  const url = new URL(process.env.DATABASE_URL);
  const targetDb = url.pathname.slice(1); // "/weather_report" -> "weather_report"

  // 대상 DB가 없을 수 있으므로, 먼저 유지관리용 "postgres" DB에 접속해 생성 여부 확인
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';

  const admin = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    targetDb,
  ]);
  if (exists.rowCount === 0) {
    // 식별자는 파라미터화가 안 되므로 큰따옴표로 감싸 인젝션 방지
    await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
    console.log(`데이터베이스 생성: ${targetDb}`);
  } else {
    console.log(`데이터베이스 이미 존재: ${targetDb}`);
  }
  await admin.end();
}

async function applySchema() {
  const schema = await readFile(join(here, 'schema.sql'), 'utf8');
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(schema);
  await client.end();
  console.log('스키마 적용 완료');
}

async function migrate() {
  await ensureDatabase();
  await applySchema();
}

migrate().catch(err => {
  console.error('마이그레이션 실패:', err);
  process.exit(1);
});
