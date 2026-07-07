const KAKAO_LOCAL_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';

export async function geocodeLocation(locationName) {
  if (!locationName) return null;

  const url = `${KAKAO_LOCAL_URL}?query=${encodeURIComponent(locationName)}`;
  const response = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  });

  if (!response.ok) {
    console.warn('지오코딩 실패:', locationName, response.status);
    return null;
  }

  const data = await response.json();
  const first = data.documents?.[0];
  if (!first) return null;

  return { latitude: Number(first.y), longitude: Number(first.x) };
}
