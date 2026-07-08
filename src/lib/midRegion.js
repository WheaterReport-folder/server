import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { coordToRegion } from './kakaoRegion.js';

const here = dirname(fileURLToPath(import.meta.url));
const REGION_CODES = JSON.parse(
  readFileSync(join(here, 'midRegionCodes.json'), 'utf8'),
);

// 시/군 코드(특성 C) 중 국내 육상만. 이름 -> 코드 후보 목록
// (동명 지역이 있으므로 배열로 보관하고 도(province) prefix로 구분)
const cityByName = new Map();
for (const row of REGION_CODES) {
  if (row.char !== 'C') continue; // 시/군/도시 단위만
  if (!/^(11[A-H]|21F)/.test(row.code)) continue; // 국내 육상만 (해양·북한 제외)
  if (!cityByName.has(row.name)) cityByName.set(row.name, []);
  cityByName.get(row.name).push(row.code);
}

// 시/군 코드 prefix -> 중기육상예보(getMidLandFcst) 광역 regId
function toLandRegId(taRegId) {
  const p2 = taRegId.slice(0, 3); // 11B, 11C ...
  const p4 = taRegId.slice(0, 4); // 11C1, 11D2 ...
  if (p2 === '11A') return '11B00000'; // 백령도 -> 인천
  if (p2 === '11B') return '11B00000'; // 서울·인천·경기
  if (p4 === '11C1') return '11C10000'; // 충북
  if (p4 === '11C2') return '11C20000'; // 대전·세종·충남
  if (p4 === '11D1') return '11D10000'; // 강원영서
  if (p4 === '11D2') return '11D20000'; // 강원영동
  if (p2 === '11E') return '11H10000'; // 울릉·독도 -> 경북
  if (p4 === '11F1' || p4 === '21F1') return '11F10000'; // 전북
  if (p4 === '11F2' || p4 === '21F2') return '11F20000'; // 광주·전남
  if (p2 === '11G') return '11G00000'; // 제주
  if (p4 === '11H1') return '11H10000'; // 대구·경북
  if (p4 === '11H2') return '11H20000'; // 부산·울산·경남
  return null;
}

// 도(province) 이름 -> 시/군 코드 prefix (동명 지역 구분용)
function provincePrefixes(province) {
  if (!province) return null;
  if (province.includes('서울')) return ['11B1'];
  if (province.includes('인천')) return ['11B2', '11A'];
  if (province.includes('경기')) return ['11B'];
  if (province.includes('강원')) return ['11D']; // 영서/영동 모두
  if (province.includes('충청북') || province === '충북') return ['11C1'];
  if (
    province.includes('충청남') ||
    province.includes('대전') ||
    province.includes('세종')
  )
    return ['11C2'];
  if (province.includes('전북') || province.includes('전라북'))
    return ['11F1', '21F1'];
  if (
    province.includes('전라남') ||
    province.includes('전남') ||
    province.includes('광주')
  )
    return ['11F2', '21F2'];
  if (province.includes('경상북') || province.includes('대구'))
    return ['11H1', '11E'];
  if (
    province.includes('경상남') ||
    province.includes('부산') ||
    province.includes('울산')
  )
    return ['11H2'];
  if (province.includes('제주')) return ['11G'];
  return null;
}

// "광명시" -> "광명" 처럼 뒤의 행정단위 접미사를 떼어 표와 매칭
function normalizeCity(city) {
  if (!city) return '';
  return city
    .replace(/특별자치시$|광역시$|특별시$/g, '')
    .replace(/시$|군$|구$/g, '')
    .trim();
}

// 위경도 -> { taRegId, landRegId, matchedName } 또는 null
export async function resolveMidRegion(latitude, longitude) {
  const region = await coordToRegion(latitude, longitude);
  if (!region) return null;

  const cityKey = normalizeCity(region.city);
  const candidates = cityByName.get(cityKey);
  if (!candidates || candidates.length === 0) {
    console.warn(
      `[midRegion] 시/군 코드 매칭 실패: province=${region.province} city=${region.city} (정규화="${cityKey}")`,
    );
    return null;
  }

  let taRegId;
  if (candidates.length === 1) {
    taRegId = candidates[0];
  } else {
    // 동명 지역: 도(province) prefix로 좁힘
    const prefixes = provincePrefixes(region.province) ?? [];
    taRegId =
      candidates.find(code => prefixes.some(p => code.startsWith(p))) ??
      candidates[0];
  }

  const landRegId = toLandRegId(taRegId);
  return { taRegId, landRegId, matchedName: cityKey, region };
}
