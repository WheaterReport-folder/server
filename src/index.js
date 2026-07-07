import express from 'express';
import 'dotenv/config';
import { devicesRouter } from './routes/devices.js';
import { calendarEventsRouter } from './routes/calendarEvents.js';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api', devicesRouter);
app.use('/api', calendarEventsRouter);

// 공통 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});
