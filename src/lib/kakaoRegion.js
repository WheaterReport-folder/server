const COORD2REGION_URL =
  'https://dapi.kakao.com/v2/local/geo/coord2regioncode.json';

// 위경도 -> 행정구역명 { province: "경기", city: "광명시" }
export async function coordToRegion(latitude, longitude) {
  // 카카오는 x=경도, y=위도 순서
  const url = `${COORD2REGION_URL}?x=${longitude}&y=${latitude}`;
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });

  if (!response.ok) {
    console.warn('coord2regioncode 실패:', response.status);
    return null;
  }

  const data = await response.json();
  // 행정동(H)·법정동(B) 중 법정동(B) 우선, 없으면 첫 결과
  const doc =
    data.documents?.find(d => d.region_type === 'B') ?? data.documents?.[0];
  if (!doc) return null;

  return {
    province: doc.region_1depth_name, // 예: "경기", "강원특별자치도"
    city: doc.region_2depth_name, // 예: "광명시", "원주시"
  };
}
