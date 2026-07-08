const BASE_URL = 'https://apis.data.go.kr/1360000/MidFcstInfoService';

// 발표시각(tmFc): 06시/18시, 최근 24시간만 제공
// - 06:10 이전 -> 전날 18시
// - 06:10 ~ 18:10 -> 당일 06시
// - 18:10 이후 -> 당일 18시
function getTmFc(now = new Date()) {
  const d = new Date(now);
  const hm = d.getHours() * 100 + d.getMinutes();
  let hour;
  if (hm < 610) {
    d.setDate(d.getDate() - 1);
    hour = '1800';
  } else if (hm < 1810) {
    hour = '0600';
  } else {
    hour = '1800';
  }
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `${date}${hour}`;
}

async function callMid(operation, regId, tmFc) {
  const url = new URL(`${BASE_URL}/${operation}`);
  url.searchParams.set('serviceKey', process.env.KMA_API_KEY);
  url.searchParams.set('numOfRows', '10');
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('regId', regId);
  url.searchParams.set('tmFc', tmFc);

  const response = await fetch(url);
  const rawText = await response.text();
  if (!response.ok) {
    console.log(`[kmaMid] ${operation} HTTP ${response.status}:`, rawText.slice(0, 300));
    throw new Error(`중기예보 ${operation} 조회 실패: ${response.status}`);
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.log(`[kmaMid] ${operation} JSON 파싱 실패:`, rawText.slice(0, 300));
    throw new Error(`중기예보 ${operation} 응답 파싱 실패`);
  }

  const code = data.response?.header?.resultCode;
  const msg = data.response?.header?.resultMsg;
  if (code !== '00' && code !== '0') {
    console.log(`[kmaMid] ${operation} API 에러 resultCode=${code} resultMsg=${msg}`);
    throw new Error(`중기예보 ${operation} API 에러: ${code} ${msg}`);
  }

  return data.response?.body?.items?.item?.[0] ?? null;
}

// tmFc 발표일과 대상 날짜(Date)의 일수 차 -> 필드 번호 N (3~10만 유효)
// 시각/타임존 영향을 없애기 위해 날짜 성분만으로 UTC 기준 일수 차 계산
function dayOffset(tmFc, targetDate) {
  const base = Date.UTC(
    Number(tmFc.slice(0, 4)),
    Number(tmFc.slice(4, 6)) - 1,
    Number(tmFc.slice(6, 8)),
  );
  const target = Date.UTC(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}

// 중기예보로 특정 날짜(Date)의 하늘/강수확률/최고·최저기온 조회
// 반환: { day, sky, rainAm, rainPm, taMax, taMin } 또는 null(범위 밖)
export async function getMidForecastForDate(landRegId, taRegId, targetDate) {
  const tmFc = getTmFc();
  const n = dayOffset(tmFc, targetDate);

  console.log(
    `[kmaMid] tmFc=${tmFc} landRegId=${landRegId} taRegId=${taRegId} dayOffset=${n}`,
  );

  if (n < 3 || n > 10) {
    return null; // 중기예보 제공 범위(3~10일) 밖
  }

  const [land, ta] = await Promise.all([
    landRegId ? callMid('getMidLandFcst', landRegId, tmFc) : null,
    callMid('getMidTa', taRegId, tmFc),
  ]);

  // 8~10일차는 오전/오후 구분 없이 단일 필드(wf8, rnSt8 ...)
  const result = {
    day: n,
    taMax: ta ? Number(ta[`taMax${n}`]) : null,
    taMin: ta ? Number(ta[`taMin${n}`]) : null,
    sky: null,
    rainAm: null,
    rainPm: null,
  };

  if (land) {
    if (n <= 7) {
      result.sky = land[`wf${n}Am`] ?? land[`wf${n}Pm`] ?? null;
      result.rainAm = land[`rnSt${n}Am`] != null ? Number(land[`rnSt${n}Am`]) : null;
      result.rainPm = land[`rnSt${n}Pm`] != null ? Number(land[`rnSt${n}Pm`]) : null;
    } else {
      result.sky = land[`wf${n}`] ?? null;
      result.rainAm = land[`rnSt${n}`] != null ? Number(land[`rnSt${n}`]) : null;
      result.rainPm = result.rainAm;
    }
  }

  return result;
}
