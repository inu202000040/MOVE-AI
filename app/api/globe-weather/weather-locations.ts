import type { RouteId } from "../../contracts/routes";
import networkCatalogArtifact from "../../data/generated/network-catalog-seam-v1.json";

export interface WeatherLocationV1 {
  readonly key: string;
  readonly kind: "port" | "chokepoint" | "route";
  readonly entityId: string;
  readonly nameKo: string;
  readonly subtitleKo: string;
  readonly routeCode: RouteId | null;
  readonly longitude: number;
  readonly latitude: number;
}

type WeatherLocationRowV1 = readonly [
  kind: WeatherLocationV1["kind"],
  entityId: string,
  nameKo: string,
  subtitleKo: string,
  routeCode: RouteId | null,
  longitude: number,
  latitude: number,
];

// Byte-for-byte labels and coordinates from approved data pack 09 LOCATION_CATALOG.
const LOCATION_ROWS_V1: Readonly<Record<string, WeatherLocationRowV1>> = {
  "port:BUSAN": ["port", "BUSAN", "부산항", "KCCI 출발항", null, 129.0756, 35.1047],
  "port:KUWI-LAX": ["port", "KUWI-LAX", "로스앤젤레스항", "미국 · KUWI", "KUWI", -118.2641, 33.7326],
  "port:KUWI-LGB": ["port", "KUWI-LGB", "롱비치항", "미국 · KUWI", "KUWI", -118.2165, 33.7542],
  "port:KUWI-OAK": ["port", "KUWI-OAK", "오클랜드항", "미국 · KUWI", "KUWI", -122.308894, 37.808164],
  "port:KUWI-SEA": ["port", "KUWI-SEA", "시애틀항", "미국 · KUWI", "KUWI", -122.345762, 47.57185],
  "port:KUWI-TAC": ["port", "KUWI-TAC", "타코마항", "미국 · KUWI", "KUWI", -122.391212, 47.253566],
  "port:KUEI-NYNJ": ["port", "KUEI-NYNJ", "뉴욕·뉴저지항", "미국 · KUEI", "KUEI", -74.179421, 40.632984],
  "port:KUEI-SAV": ["port", "KUEI-SAV", "서배너항", "미국 · KUEI", "KUEI", -81.10052, 32.104025],
  "port:KUEI-VAP": ["port", "KUEI-VAP", "버지니아항", "미국 · KUEI", "KUEI", -76.320023, 36.936454],
  "port:KUEI-CHS": ["port", "KUEI-CHS", "찰스턴항", "미국 · KUEI", "KUEI", -79.921158, 32.899296],
  "port:KUEI-JAX": ["port", "KUEI-JAX", "잭슨빌항", "미국 · KUEI", "KUEI", -81.583034, 30.383326],
  "port:KNEI-RTM": ["port", "KNEI-RTM", "로테르담항", "네덜란드 · KNEI", "KNEI", 4.215145, 51.922281],
  "port:KNEI-ANR": ["port", "KNEI-ANR", "앤트워프-브뤼헤항", "벨기에 · KNEI", "KNEI", 4.317802, 51.279355],
  "port:KNEI-HAM": ["port", "KNEI-HAM", "함부르크항", "독일 · KNEI", "KNEI", 9.964294, 53.516401],
  "port:KNEI-BRV": ["port", "KNEI-BRV", "브레머하펜항", "독일 · KNEI", "KNEI", 8.555057, 53.549441],
  "port:KNEI-FXT": ["port", "KNEI-FXT", "펠릭스토우항", "영국 · KNEI", "KNEI", 1.293148, 51.954111],
  "port:KMDI-PIR": ["port", "KMDI-PIR", "피레우스항", "그리스 · KMDI", "KMDI", 23.603747, 37.952446],
  "port:KMDI-VLC": ["port", "KMDI-VLC", "발렌시아항", "스페인 · KMDI", "KMDI", -0.322345, 39.44221],
  "port:KMDI-BCN": ["port", "KMDI-BCN", "바르셀로나항", "스페인 · KMDI", "KMDI", 2.14649, 41.337978],
  "port:KMDI-GOA": ["port", "KMDI-GOA", "제노바항", "이탈리아 · KMDI", "KMDI", 8.85868, 44.4131],
  "port:KMDI-NAP": ["port", "KMDI-NAP", "나폴리항", "이탈리아 · KMDI", "KMDI", 14.278909, 40.839247],
  "port:KMEI-JEA": ["port", "KMEI-JEA", "제벨알리항", "아랍에미리트 · KMEI", "KMEI", 55.077817, 24.999419],
  "port:KMEI-DMM": ["port", "KMEI-DMM", "담맘항", "사우디아라비아 · KMEI", "KMEI", 50.194397, 26.476267],
  "port:KMEI-JED": ["port", "KMEI-JED", "제다항", "사우디아라비아 · KMEI", "KMEI", 39.166406, 21.460797],
  "port:KMEI-KHL": ["port", "KMEI-KHL", "칼리파항", "아랍에미리트 · KMEI", "KMEI", 54.693145, 24.806301],
  "port:KMEI-SOH": ["port", "KMEI-SOH", "소하르항", "오만 · KMEI", "KMEI", 56.612718, 24.511687],
  "port:KAUI-SYD": ["port", "KAUI-SYD", "포트보타니", "호주 · KAUI", "KAUI", 151.215895, -33.981535],
  "port:KAUI-MEL": ["port", "KAUI-MEL", "멜버른항", "호주 · KAUI", "KAUI", 144.91756, -37.828178],
  "port:KAUI-BNE": ["port", "KAUI-BNE", "브리즈번항", "호주 · KAUI", "KAUI", 153.145583, -27.408501],
  "port:KAUI-FRE": ["port", "KAUI-FRE", "프리맨틀항", "호주 · KAUI", "KAUI", 115.770524, -32.152033],
  "port:KAUI-ADL": ["port", "KAUI-ADL", "애들레이드항", "호주 · KAUI", "KAUI", 138.505719, -34.810396],
  "port:KLEI-SSZ": ["port", "KLEI-SSZ", "산투스항", "브라질 · KLEI", "KLEI", -46.336564, -23.917068],
  "port:KLEI-PNG": ["port", "KLEI-PNG", "파라나과항", "브라질 · KLEI", "KLEI", -48.517135, -25.505239],
  "port:KLEI-IOA": ["port", "KLEI-IOA", "이타포아항", "브라질 · KLEI", "KLEI", -48.604327, -26.182895],
  "port:KLEI-BUE": ["port", "KLEI-BUE", "부에노스아이레스항", "아르헨티나 · KLEI", "KLEI", -58.352372, -34.61975],
  "port:KLEI-MVD": ["port", "KLEI-MVD", "몬테비데오항", "우루과이 · KLEI", "KLEI", -56.213813, -34.888091],
  "port:KLWI-CLL": ["port", "KLWI-CLL", "카야오항", "페루 · KLWI", "KLWI", -77.140231, -12.047309],
  "port:KLWI-ZLO": ["port", "KLWI-ZLO", "만사니요항", "멕시코 · KLWI", "KLWI", -104.287661, 19.056267],
  "port:KLWI-SAI": ["port", "KLWI-SAI", "산안토니오항", "칠레 · KLWI", "KLWI", -71.618855, -33.593245],
  "port:KLWI-GYE": ["port", "KLWI-GYE", "과야킬항", "에콰도르 · KLWI", "KLWI", -79.918915, -2.261146],
  "port:KLWI-BUN": ["port", "KLWI-BUN", "부에나벤투라항", "콜롬비아 · KLWI", "KLWI", -77.066496, 3.894389],
  "port:KSAI-DUR": ["port", "KSAI-DUR", "더반항", "남아프리카공화국 · KSAI", "KSAI", 31.023022, -29.88213],
  "port:KSAI-CPT": ["port", "KSAI-CPT", "케이프타운항", "남아프리카공화국 · KSAI", "KSAI", 18.448229, -33.915432],
  "port:KSAI-NGQ": ["port", "KSAI-NGQ", "응쿠라항", "남아프리카공화국 · KSAI", "KSAI", 25.694415, -33.806951],
  "port:KWAI-LOS": ["port", "KWAI-LOS", "라고스·아파파항", "나이지리아 · KWAI", "KWAI", 3.334134, 6.447337],
  "port:KWAI-TEM": ["port", "KWAI-TEM", "테마항", "가나 · KWAI", "KWAI", 0.00079, 5.626168],
  "port:KWAI-ABJ": ["port", "KWAI-ABJ", "아비장항", "코트디부아르 · KWAI", "KWAI", -4.010908, 5.283956],
  "port:KCI-SHA": ["port", "KCI-SHA", "상하이항", "중국 · KCI", "KCI", 121.644197, 31.191795],
  "port:KCI-NGB": ["port", "KCI-NGB", "닝보-저우산항", "중국 · KCI", "KCI", 121.881841, 29.920769],
  "port:KCI-TAO": ["port", "KCI-TAO", "칭다오항", "중국 · KCI", "KCI", 120.222618, 36.026779],
  "port:KJI-YOK": ["port", "KJI-YOK", "요코하마항", "일본 · KJI", "KJI", 139.668812, 35.427556],
  "port:KJI-TYO": ["port", "KJI-TYO", "도쿄항", "일본 · KJI", "KJI", 139.792578, 35.606071],
  "port:KJI-OSA": ["port", "KJI-OSA", "오사카항", "일본 · KJI", "KJI", 135.430026, 34.644931],
  "port:KSEI-SIN": ["port", "KSEI-SIN", "싱가포르항", "싱가포르 · KSEI", "KSEI", 103.707482, 1.271989],
  "port:KSEI-CMT": ["port", "KSEI-CMT", "까이멥항", "베트남 · KSEI", "KSEI", 107.02606, 10.571698],
  "port:KSEI-TPP": ["port", "KSEI-TPP", "탄중프리옥항", "인도네시아 · KSEI", "KSEI", 106.905488, -6.100545],
  "port:KSEI-PKG": ["port", "KSEI-PKG", "포트클랑", "말레이시아 · KSEI", "KSEI", 101.340306, 2.972595],
  "port:KSEI-LCH": ["port", "KSEI-LCH", "램차방항", "태국 · KSEI", "KSEI", 100.899992, 13.088734],
  "chokepoint:korea-strait": ["chokepoint", "korea-strait", "대한해협", "해협 · 13/13 노선", null, 129.209206, 34.13076811],
  "chokepoint:taiwan-strait": ["chokepoint", "taiwan-strait", "대만해협", "해협 · 기본 7개 노선", null, 119.8313644, 24.72350972],
  "chokepoint:malacca-strait": ["chokepoint", "malacca-strait", "말라카해협", "해협 · 기본 6개 노선", null, 102.6651061, 1.516954817],
  "chokepoint:bab-el-mandeb": ["chokepoint", "bab-el-mandeb", "바브엘만데브해협", "해협 · 기본 2개 노선", null, 43.34954476, 12.78859715],
  "chokepoint:suez-canal": ["chokepoint", "suez-canal", "수에즈운하", "운하 · 기본 2개 노선", null, 32.43688221, 30.59334599],
  "chokepoint:cape-good-hope": ["chokepoint", "cape-good-hope", "희망봉", "곶 · 기본 2개 노선", null, 20.88273666, -34.92728556],
  "chokepoint:panama-canal": ["chokepoint", "panama-canal", "파나마운하", "운하 · 기본 1개 노선", null, -79.76723825, 9.120512367],
  "chokepoint:hormuz-strait": ["chokepoint", "hormuz-strait", "호르무즈해협", "해협 · 기본 1개 노선", null, 56.85984844, 26.29685349],
  "chokepoint:gibraltar-strait": ["chokepoint", "gibraltar-strait", "지브롤터해협", "해협 · 기본 1개 노선", null, -5.754895722, 35.94227416],
  "chokepoint:dover-strait": ["chokepoint", "dover-strait", "도버해협", "해협 · 기본 1개 노선", null, 1.505839716, 51.03022414],
  "chokepoint:luzon-strait": ["chokepoint", "luzon-strait", "루손해협", "해협 · 기본 1개 노선", null, 121.35229505, 20.48889071],
  "route:KUWI": ["route", "KUWI", "북미서안 해상 구간", "대한해협 · 일본 남방 · 북태평양", "KUWI", 150, 32],
  "route:KUEI": ["route", "KUEI", "북미동안 해상 구간", "대한해협 · 북태평양 · 파나마운하 · 카리브해", "KUEI", -79.4941, 8.7966],
  "route:KNEI": ["route", "KNEI", "유럽 해상 구간", "대만해협 · 말라카해협 · 수에즈운하 · 도버해협", "KNEI", 32.6, 29.7],
  "route:KMDI": ["route", "KMDI", "지중해 해상 구간", "대만해협 · 말라카해협 · 수에즈운하 · 에게해", "KMDI", 44, 12],
  "route:KMEI": ["route", "KMEI", "중동 해상 구간", "대만해협 · 말라카해협 · 호르무즈해협", "KMEI", 90, 6.47],
  "route:KAUI": ["route", "KAUI", "호주 해상 구간", "대한해협 · 루손해협 · 필리핀해 · 산호해", "KAUI", 152, 0],
  "route:KLEI": ["route", "KLEI", "남미동안 해상 구간", "말라카해협 · 인도양 · 희망봉 · 남대서양", "KLEI", 98.1281, 5.8117],
  "route:KLWI": ["route", "KLWI", "남미서안 해상 구간", "대한해협 · 북태평양 · 남동태평양", "KLWI", 175, 15],
  "route:KSAI": ["route", "KSAI", "남아프리카 해상 구간", "말라카해협 · 인도양 · 마다가스카르 남방", "KSAI", 102, 2],
  "route:KWAI": ["route", "KWAI", "서아프리카 해상 구간", "말라카해협 · 인도양 · 희망봉 · 기니만", "KWAI", 90, 7],
  "route:KCI": ["route", "KCI", "중국 해상 구간", "대한해협 · 제주 남방 · 동중국해", "KCI", 125, 31.5],
  "route:KJI": ["route", "KJI", "일본 해상 구간", "대한해협 · 규슈 남방 · 일본 남해안", "KJI", 134, 29.5],
  "route:KSEI": ["route", "KSEI", "동남아 해상 구간", "대만해협 · 남중국해 · 싱가포르해협", "KSEI", 117, 21],
};

export const WEATHER_LOCATIONS_V1: readonly WeatherLocationV1[] = Object.freeze(
  Object.entries(LOCATION_ROWS_V1)
    .map(([key, [kind, entityId, nameKo, subtitleKo, routeCode, longitude, latitude]]) => Object.freeze({
      key,
      kind,
      entityId,
      nameKo,
      subtitleKo,
      routeCode,
      longitude,
      latitude,
    }))
    .sort((left, right) => left.key.localeCompare(right.key)),
);

if (WEATHER_LOCATIONS_V1.length !== 82) {
  throw new Error(`Approved weather catalog must contain 82 locations; got ${WEATHER_LOCATIONS_V1.length}`);
}

const canonicalWeatherById = new Map(networkCatalogArtifact.weather.map((location) => [location.id, location]));
for (const location of WEATHER_LOCATIONS_V1) {
  const canonical = canonicalWeatherById.get(location.key);
  if (
    canonical === undefined
    || canonical.kind !== location.kind
    || canonical.entityId !== location.entityId
    || canonical.longitude !== location.longitude
    || canonical.latitude !== location.latitude
  ) {
    throw new Error(`Approved weather location drifted from the canonical network seam: ${location.key}`);
  }
}
