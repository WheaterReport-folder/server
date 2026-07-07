import { Router } from 'express';
import { pool } from '../db.js';
import { contentHash } from '../lib/hash.js';
import { classifyEvents } from '../lib/groq.js';
import { geocodeLocation } from '../lib/geocode.js';

export const calendarEventsRouter = Router();

calendarEventsRouter.post('/calendar-events/sync', async (req, res, next) => {
  try {
    const { deviceId, events } = req.body;
    if (!deviceId || !Array.isArray(events)) {
      return res.status(400).json({ error: 'deviceId, events는 필수입니다.' });
    }

    const deviceResult = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1',
      [deviceId],
    );
    const device = deviceResult.rows[0];
    if (!device) {
      return res.status(404).json({
        error: '등록되지 않은 device입니다. /api/devices를 먼저 호출하세요.',
      });
    }

    // 원본 이벤트마다 content hash 계산 (변경 감지용)
    const eventsWithHash = events.map(event => ({
      ...event,
      hash: contentHash(event),
    }));

    // 이미 분류된 이벤트를 조회
    const existingResult = await pool.query(
      `SELECT calendar_event_id, content_hash
       FROM calendar_events
       WHERE device_id = $1 AND calendar_event_id = ANY($2)`,
      [device.id, eventsWithHash.map(e => e.calendarEventId)],
    );
    const existingByEventId = new Map(
      existingResult.rows.map(row => [row.calendar_event_id, row]),
    );

    // 새로 생겼거나 내용이 바뀐 이벤트만 AI 분류 대상
    const needsClassification = eventsWithHash.filter(event => {
      const existing = existingByEventId.get(event.calendarEventId);
      return !existing || existing.content_hash !== event.hash;
    });

    let classifiedResults = [];
    if (needsClassification.length > 0) {
      classifiedResults = await classifyEvents(
        needsClassification.map(
          ({ calendarEventId, title, location, startDate, endDate }) => ({
            calendarEventId,
            title,
            location,
            startDate,
            endDate,
          }),
        ),
      );
    }

    const hashByEventId = new Map(
      eventsWithHash.map(e => [e.calendarEventId, e.hash]),
    );
    const eventByEventId = new Map(
      events.map(e => [e.calendarEventId, e]),
    );

    for (const result of classifiedResults) {
      const hash = hashByEventId.get(result.calendarEventId);
      if (!hash) continue; // 응답에 없던 id가 섞여 오면 무시

      await pool.query(
        `INSERT INTO calendar_events
           (device_id, calendar_event_id, content_hash, is_outdoor, location_name,
            start_date, end_date, classified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         ON CONFLICT (device_id, calendar_event_id)
         DO UPDATE SET content_hash = $3, is_outdoor = $4, location_name = $5,
                       start_date = $6, end_date = $7, classified_at = now(),
                       updated_at = now()`,
        [
          device.id,
          result.calendarEventId,
          hash,
          result.isOutdoor,
          result.locationName,
          result.startDate,
          result.endDate,
        ],
      );

      if (result.isOutdoor) {
        const coords = await geocodeLocation(result.locationName);
        const originalEvent = eventByEventId.get(result.calendarEventId);

        await pool.query(
          `INSERT INTO trips
             (device_id, calendar_event_id, title, location_name, latitude,
              longitude, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (device_id, calendar_event_id)
           DO UPDATE SET title = $3, location_name = $4, latitude = $5,
                         longitude = $6, start_date = $7, end_date = $8,
                         updated_at = now()`,
          [
            device.id,
            result.calendarEventId,
            originalEvent?.title,
            result.locationName,
            coords?.latitude ?? null,
            coords?.longitude ?? null,
            result.startDate,
            result.endDate,
          ],
        );
      } else {
        // 야외 활동이 아니라고 재분류되면 기존 trip 제거
        await pool.query(
          'DELETE FROM trips WHERE device_id = $1 AND calendar_event_id = $2',
          [device.id, result.calendarEventId],
        );
      }
    }

    // 최종 야외 활동 여행 목록 반환
    const tripsResult = await pool.query(
      `SELECT id, title, location_name, latitude, longitude, start_date, end_date
       FROM trips WHERE device_id = $1 ORDER BY start_date`,
      [device.id],
    );

    res.json({
      classified: needsClassification.length,
      trips: tripsResult.rows,
    });
  } catch (err) {
    next(err);
  }
});
