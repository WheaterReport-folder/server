import 'dotenv/config';
import { migrate } from './runMigration.js';

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('마이그레이션 실패:', err);
    process.exit(1);
  });
