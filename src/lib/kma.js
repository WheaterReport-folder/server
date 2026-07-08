import { toGrid } from './kmaGrid.js';

const BASE_URL =
  'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';

const BASE_TIMES = ['0200', '0500', '0800', '1100', '1400', '1700', '2000', '2300'];

// 발표 시각 + 10분 뒤부터 데이터가 확정되므로, 그 이전이면 직전 회차를 사용
function getBaseDateTime(now = new Date()) {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;

  let candidate = [...BASE_TIMES]
    .reverse()
    .find(
      t =>
        hhmm >=
        `${t.slice(0, 2)}${String(Number(t.slice(2)) + 10).padStart(2, '0')}`,
    );

  const date = new Date(now);
  if (!candidate) {
    // 새벽 02:10 이전이면 전날 23:00 회차 사용
    date.setDate(date.getDate() - 1);
    candidate = '2300';
  }

  const baseDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return { baseDate, baseTime: candidate };
}

const CATEGORY_LABEL = {
  TMP: 'temperature',
  POP: 'precipitationProbability',
  SKY: 'sky',
  PTY: 'precipitationType',
};

export async function getShortTermForecast(latitude, longitude) {
  const { nx, ny } = toGrid(latitude, longitude);
  const { baseDate, baseTime } = getBaseDateTime();

  const url = new URL(BASE_URL);
  url.searchParams.set('serviceKey', process.env.KMA_API_KEY);
  url.searchParams.set('numOfRows', '1000');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(nx));
  url.searchParams.set('ny', String(ny));

  console.log(
    `[kma] 요청: base_date=${baseDate} base_time=${baseTime} nx=${nx} ny=${ny}`,
  );

  const response = await fetch(url);
  const rawText = await response.text();

  if (!response.ok) {
    console.log(`[kma] HTTP 에러 ${response.status}:`, rawText.slice(0, 500));
    throw new Error(`기상청 단기예보 조회 실패: ${response.status}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    // dataType=JSON을 요청해도 인증키/파라미터 오류 시 XML로 응답하는 경우가 있음
    console.log('[kma] JSON 파싱 실패, 응답 원문(XML일 가능성):', rawText.slice(0, 500));
    throw new Error('기상청 응답을 파싱할 수 없습니다 (원문 로그 참조)');
  }

  const resultCode = data.response?.header?.resultCode;
  const resultMsg = data.response?.header?.resultMsg;
  if (resultCode && resultCode !== '00') {
    console.log(`[kma] API 에러 resultCode=${resultCode} resultMsg=${resultMsg}`);
    throw new Error(`기상청 API 에러: ${resultCode} ${resultMsg}`);
  }

  const items = data.response?.body?.items?.item ?? [];
  console.log(`[kma] resultCode=${resultCode} 수신 항목 ${items.length}개`);

  // fcstDate+fcstTime 단위로 묶어서 { date, time, temperature, ... } 형태로 정리
  const grouped = new Map();
  for (const item of items) {
    const label = CATEGORY_LABEL[item.category];
    if (!label) continue; // 필요한 항목(TMP/POP/SKY/PTY)만 사용

    const key = `${item.fcstDate}-${item.fcstTime}`;
    if (!grouped.has(key)) {
      grouped.set(key, { date: item.fcstDate, time: item.fcstTime });
    }
    grouped.get(key)[label] = item.fcstValue;
  }

  return Array.from(grouped.values()).sort((a, b) =>
    `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
  );
}
