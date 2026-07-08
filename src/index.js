import express from 'express';
import 'dotenv/config';
import { devicesRouter } from './routes/devices.js';
import { calendarEventsRouter } from './routes/calendarEvents.js';
import { weatherRouter } from './routes/weather.js';
import { migrate } from './db/runMigration.js';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', devicesRouter);
app.use('/api', calendarEventsRouter);
app.use('/api', weatherRouter);

// 공통 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const port = process.env.PORT || 3000;

// 서버 시작 전에 스키마를 적용(멱등). 실패해도 서버는 뜨도록 함.
migrate()
  .catch(err => console.error('시작 시 마이그레이션 실패:', err))
  .finally(() => {
    app.listen(port, () => {
      console.log(`서버 실행 중: 포트 ${port}`);
    });
  });
