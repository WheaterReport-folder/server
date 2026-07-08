import { Router } from 'express';
import { pool } from '../db.js';
import { getShortTermForecast } from '../lib/kma.js';
import { resolveMidRegion } from '../lib/midRegion.js';
import { getMidForecastForDate } from '../lib/kmaMid.js';

export const weatherRouter = Router();

// yyyymmdd 문자열 -> Date
function kmaDateToDate(kmaStr) {
  return new Date(
    `${kmaStr.slice(0, 4)}-${kmaStr.slice(4, 6)}-${kmaStr.slice(6, 8)}T00:00:00`,
  );
}

// yyyy-mm-dd -> yyyymmdd (기상청 형식)
function toKmaDate(dateInput) {
  const d = new Date(dateInput);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromDate, toKmaDateStr) {
  const to = new Date(
    `${toKmaDateStr.slice(0, 4)}-${toKmaDateStr.slice(4, 6)}-${toKmaDateStr.slice(6, 8)}`,
  );
  const from = new Date(
    `${fromDate.getFullYear()}-${fromDate.getMonth() + 1}-${fromDate.getDate()}`,
  );
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

weatherRouter.get('/trips/:tripId/weather', async (req, res, next) => {
  try {
    console.log(`[trips/weather] tripId=${req.params.tripId} 날씨 조회 요청`);

    const tripResult = await pool.query(
      'SELECT title, location_name, latitude, longitude, start_date, end_date FROM trips WHERE id = $1',
      [req.params.tripId],
    );
    const trip = tripResult.rows[0];
    if (!trip || trip.latitude === null || trip.longitude === null) {
      console.log(`[trips/weather] tripId=${req.params.tripId} 위치 정보 없음`);
      return res.status(404).json({ error: '위치 정보가 없는 여행입니다.' });
    }

    const today = new Date();
    const startDaysAway = daysBetween(today, toKmaDate(trip.start_date));
    const endDaysAway = daysBetween(today, toKmaDate(trip.end_date));

    console.log(
      `[trips/weather] ${trip.title} @ ${trip.location_name} | 여행 시작까지 ${startDaysAway}일`,
    );

    // 여행 시작이 단기예보 범위(오늘~+2일) 밖이고 10일 이내면 중기예보 사용
    if (startDaysAway > 2 && startDaysAway <= 10) {
      console.log('[trips/weather] 단기예보 범위 밖 (3~10일 이내) - 중기예보 조회');

      const midRegion = await resolveMidRegion(trip.latitude, trip.longitude);
      if (!midRegion) {
        return res.json({
          status: 'region_unresolved',
          message: '중기예보 지역코드를 찾지 못했습니다.',
        });
      }

      console.log(
        `[trips/weather] 중기예보 지역: ${midRegion.matchedName} (기온 ${midRegion.taRegId} / 육상 ${midRegion.landRegId})`,
      );

      // 여행 시작~종료일 각 날짜에 대해 중기예보 조회
      const midForecast = [];
      const startDate = kmaDateToDate(toKmaDate(trip.start_date));
      const endDate = kmaDateToDate(toKmaDate(trip.end_date));
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const day = await getMidForecastForDate(
          midRegion.landRegId,
          midRegion.taRegId,
          new Date(d),
        );
        if (day) {
          const dateStr = toKmaDate(d);
          console.log(
            `  - ${dateStr} | 하늘 ${day.sky} | 강수확률 오전 ${day.rainAm}% 오후 ${day.rainPm}% | 최고 ${day.taMax}℃ 최저 ${day.taMin}℃`,
          );
          midForecast.push({ date: dateStr, ...day });
        }
      }

      if (midForecast.length === 0) {
        return res.json({
          status: 'not_yet_published',
          message: '해당 날짜의 중기예보가 아직 없습니다.',
        });
      }

      return res.json({ status: 'available_mid', forecast: midForecast });
    }
    if (startDaysAway > 10) {
      console.log('[trips/weather] 예보 범위(10일) 완전히 밖');
      return res.json({
        status: 'out_of_range',
        message: '아직 예보를 확인할 수 없는 시기입니다.',
      });
    }

    const rawForecast = await getShortTermForecast(trip.latitude, trip.longitude);

    // 여행 시작~종료일에 해당하는 슬롯만 필터링 (범위를 벗어난 날짜의 예보는 의미 없음)
    const startKma = toKmaDate(trip.start_date);
    const endKma = toKmaDate(trip.end_date);
    const forecast = rawForecast.filter(
      slot => slot.date >= startKma && slot.date <= endKma,
    );

    console.log(
      `[trips/weather] 전체 ${rawForecast.length}개 중 여행 기간(${startKma}~${endKma}) 해당 ${forecast.length}개`,
    );
    for (const slot of forecast) {
      console.log(
        `  - ${slot.date} ${slot.time} | 기온 ${slot.temperature}℃ | 강수확률 ${slot.precipitationProbability}% | 하늘 ${slot.sky} | 강수형태 ${slot.precipitationType}`,
      );
    }

    if (forecast.length === 0) {
      // 여행이 오늘~글피 사이이긴 하지만, 아직 그 날짜의 회차가 발표 전이라 데이터가 없을 수 있음
      return res.json({
        status: 'not_yet_published',
        message: '해당 날짜의 예보가 아직 발표되지 않았습니다. 잠시 후 다시 확인해주세요.',
      });
    }

    res.json({ status: 'available', forecast });
  } catch (err) {
    next(err);
  }
});