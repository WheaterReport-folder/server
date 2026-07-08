import pg from 'pg';
import 'dotenv/config';

// Render 등 관리형 PostgreSQL 외부 연결은 SSL이 필요할 수 있음.
// 내부(같은 리전) 연결이나 로컬은 불필요 -> 환경변수로 제어.
export const ssl =
  process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});
