const RE = 6371.00877;
const GRID = 5.0;
const SLAT1 = (30.0 * Math.PI) / 180.0;
const SLAT2 = (60.0 * Math.PI) / 180.0;
const OLON = (126.0 * Math.PI) / 180.0;
const OLAT = (38.0 * Math.PI) / 180.0;
const XO = 43;
const YO = 136;

export function toGrid(lat, lon) {
  const re = RE / GRID;
  const sn =
    Math.log(Math.cos(SLAT1) / Math.cos(SLAT2)) /
    Math.log(
      Math.tan(Math.PI * 0.25 + SLAT2 * 0.5) /
        Math.tan(Math.PI * 0.25 + SLAT1 * 0.5),
    );
  const sf =
    (Math.pow(Math.tan(Math.PI * 0.25 + SLAT1 * 0.5), sn) * Math.cos(SLAT1)) /
    sn;
  const ro = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * 0.5), sn);

  const raLat = (lat * Math.PI) / 180.0;
  const ra = (re * sf) / Math.pow(Math.tan(Math.PI * 0.25 + raLat * 0.5), sn);
  let theta = (lon * Math.PI) / 180.0 - OLON;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}
