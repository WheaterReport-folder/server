import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { ssl } from '../db.js';

const here = dirname(fileURLToPath(import.meta.url));

// 로컬 전용: 대상 DB가 없으면 유지관리용 "postgres" DB에서 생성
async function ensureDatabase() {
  const url = new URL(process.env.DATABASE_URL);
  const targetDb = url.pathname.slice(1);

  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = '/postgres';

  const admin = new pg.Client({
    connectionString: maintenanceUrl.toString(),
    ssl,
  });
  await admin.connect();
  const exists = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [targetDb],
  );
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
    console.log(`데이터베이스 생성: ${targetDb}`);
  }
  await admin.end();
}

async function applySchema() {
  const schema = await readFile(join(here, 'schema.sql'), 'utf8');
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });
  await client.connect();
  await client.query(schema);
  await client.end();
  console.log('스키마 적용 완료');
}

// 배포 환경: DB가 이미 있으면 스키마만 적용. 로컬: 없으면 생성 후 적용.
export async function migrate() {
  try {
    await applySchema();
  } catch (err) {
    if (err.code === '3D000') {
      console.log('대상 DB 없음 -> 생성 시도 (로컬)');
      await ensureDatabase();
      await applySchema();
    } else {
      throw err;
    }
  }
}
