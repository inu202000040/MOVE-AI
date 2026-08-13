export interface NetworkDisplayLabel {
  readonly ko: string;
  readonly en?: string;
  readonly subtitleKo?: string;
}

const routes: Readonly<Record<string, NetworkDisplayLabel>> = {
  KAUI: { ko: "호주", en: "Australia" },
  KCI: { ko: "중국", en: "China" },
  KJI: { ko: "일본", en: "Japan" },
  KLEI: { ko: "남미동안", en: "South America East Coast" },
  KLWI: { ko: "남미서안", en: "South America West Coast" },
  KMDI: { ko: "지중해", en: "Mediterranean" },
  KMEI: { ko: "중동", en: "Middle East" },
  KNEI: { ko: "유럽", en: "Europe" },
  KSAI: { ko: "남아프리카", en: "Southern Africa" },
  KSEI: { ko: "동남아", en: "Southeast Asia" },
  KUEI: { ko: "북미동안", en: "North America East Coast" },
  KUWI: { ko: "북미서안", en: "North America West Coast" },
  KWAI: { ko: "서아프리카", en: "West Africa" },
};

const ports: Readonly<Record<string, NetworkDisplayLabel>> = {
  "KAUI-ADL": { ko: "애들레이드항", en: "Port Adelaide" },
  "KAUI-BNE": { ko: "브리즈번항", en: "Port of Brisbane" },
  "KAUI-FRE": { ko: "프리맨틀항", en: "Fremantle Ports" },
  "KAUI-MEL": { ko: "멜버른항", en: "Port of Melbourne" },
  "KAUI-SYD": { ko: "포트보타니", en: "Port Botany" },
  "KCI-NGB": { ko: "닝보-저우산항", en: "Port of Ningbo-Zhoushan" },
  "KCI-SHA": { ko: "상하이항", en: "Port of Shanghai" },
  "KCI-TAO": { ko: "칭다오항", en: "Port of Qingdao" },
  "KJI-OSA": { ko: "오사카항", en: "Port of Osaka" },
  "KJI-TYO": { ko: "도쿄항", en: "Port of Tokyo" },
  "KJI-YOK": { ko: "요코하마항", en: "Port of Yokohama" },
  "KLEI-BUE": { ko: "부에노스아이레스항", en: "Port of Buenos Aires" },
  "KLEI-IOA": { ko: "이타포아항", en: "Port of Itapoa" },
  "KLEI-MVD": { ko: "몬테비데오항", en: "Port of Montevideo" },
  "KLEI-PNG": { ko: "파라나과항", en: "Port of Paranagua" },
  "KLEI-SSZ": { ko: "산투스항", en: "Port of Santos" },
  "KLWI-BUN": { ko: "부에나벤투라항", en: "Port of Buenaventura" },
  "KLWI-CLL": { ko: "카야오항", en: "Port of Callao" },
  "KLWI-GYE": { ko: "과야킬항", en: "Port of Guayaquil" },
  "KLWI-SAI": { ko: "산안토니오항", en: "Port of San Antonio" },
  "KLWI-ZLO": { ko: "만사니요항", en: "Port of Manzanillo" },
  "KMDI-BCN": { ko: "바르셀로나항", en: "Port of Barcelona" },
  "KMDI-GOA": { ko: "제노바항", en: "Port of Genoa" },
  "KMDI-NAP": { ko: "나폴리항", en: "Port of Naples" },
  "KMDI-PIR": { ko: "피레우스항", en: "Port of Piraeus" },
  "KMDI-VLC": { ko: "발렌시아항", en: "Port of Valencia" },
  "KMEI-DMM": { ko: "담맘항", en: "King Abdulaziz Port (Dammam)" },
  "KMEI-JEA": { ko: "제벨알리항", en: "Jebel Ali Port" },
  "KMEI-JED": { ko: "제다항", en: "Jeddah Islamic Port" },
  "KMEI-KHL": { ko: "칼리파항", en: "Khalifa Port" },
  "KMEI-SOH": { ko: "소하르항", en: "Port of Sohar" },
  "KNEI-ANR": { ko: "앤트워프-브뤼헤항", en: "Port of Antwerp-Bruges" },
  "KNEI-BRV": { ko: "브레머하펜항", en: "Port of Bremerhaven" },
  "KNEI-FXT": { ko: "펠릭스토우항", en: "Port of Felixstowe" },
  "KNEI-HAM": { ko: "함부르크항", en: "Port of Hamburg" },
  "KNEI-RTM": { ko: "로테르담항", en: "Port of Rotterdam" },
  "KSAI-CPT": { ko: "케이프타운항", en: "Port of Cape Town" },
  "KSAI-DUR": { ko: "더반항", en: "Port of Durban" },
  "KSAI-NGQ": { ko: "응쿠라항", en: "Port of Ngqura" },
  "KSEI-CMT": { ko: "까이멥항", en: "Cai Mep Port" },
  "KSEI-LCH": { ko: "램차방항", en: "Laem Chabang Port" },
  "KSEI-PKG": { ko: "포트클랑", en: "Port Klang" },
  "KSEI-SIN": { ko: "싱가포르항", en: "Port of Singapore" },
  "KSEI-TPP": { ko: "탄중프리옥항", en: "Port of Tanjung Priok" },
  "KUEI-CHS": { ko: "찰스턴항", en: "Port of Charleston" },
  "KUEI-JAX": { ko: "잭슨빌항", en: "Port of Jacksonville" },
  "KUEI-NYNJ": { ko: "뉴욕·뉴저지항", en: "Port of New York and New Jersey" },
  "KUEI-SAV": { ko: "서배너항", en: "Port of Savannah" },
  "KUEI-VAP": { ko: "버지니아항", en: "Port of Virginia" },
  "KUWI-LAX": { ko: "로스앤젤레스항", en: "Port of Los Angeles" },
  "KUWI-LGB": { ko: "롱비치항", en: "Port of Long Beach" },
  "KUWI-OAK": { ko: "오클랜드항", en: "Port of Oakland" },
  "KUWI-SEA": { ko: "시애틀항", en: "Port of Seattle" },
  "KUWI-TAC": { ko: "타코마항", en: "Port of Tacoma" },
  "KWAI-ABJ": { ko: "아비장항", en: "Port of Abidjan" },
  "KWAI-LOS": { ko: "라고스·아파파항", en: "Lagos (Apapa) Port" },
  "KWAI-TEM": { ko: "테마항", en: "Port of Tema" },
};

const chokepoints: Readonly<Record<string, NetworkDisplayLabel>> = {
  "bab-el-mandeb": { ko: "바브엘만데브해협", en: "Bab el-Mandeb Strait" },
  "cape-good-hope": { ko: "희망봉", en: "Cape of Good Hope" },
  "dover-strait": { ko: "도버해협", en: "Dover Strait" },
  "gibraltar-strait": { ko: "지브롤터해협", en: "Gibraltar Strait" },
  "hormuz-strait": { ko: "호르무즈해협", en: "Strait of Hormuz" },
  "korea-strait": { ko: "대한해협", en: "Korea Strait" },
  "luzon-strait": { ko: "루손해협", en: "Luzon Strait" },
  "malacca-strait": { ko: "말라카해협", en: "Malacca Strait" },
  "panama-canal": { ko: "파나마운하", en: "Panama Canal" },
  "suez-canal": { ko: "수에즈운하", en: "Suez Canal" },
  "taiwan-strait": { ko: "대만해협", en: "Taiwan Strait" },
};

export const APPROVED_ROUTE_CORRIDORS: Readonly<Record<string, string>> = {
  KAUI: "대한해협 · 루손해협 · 필리핀해 · 산호해",
  KCI: "대한해협 · 제주 남방 · 동중국해",
  KJI: "대한해협 · 규슈 남방 · 일본 남해안",
  KLEI: "말라카해협 · 인도양 · 희망봉 · 남대서양",
  KLWI: "대한해협 · 북태평양 · 남동태평양",
  KMDI: "대만해협 · 말라카해협 · 수에즈운하 · 에게해",
  KMEI: "대만해협 · 말라카해협 · 호르무즈해협",
  KNEI: "대만해협 · 말라카해협 · 수에즈운하 · 도버해협",
  KSAI: "말라카해협 · 인도양 · 마다가스카르 남방",
  KSEI: "대만해협 · 남중국해 · 싱가포르해협",
  KUEI: "대한해협 · 북태평양 · 파나마운하 · 카리브해",
  KUWI: "대한해협 · 일본 남방 · 북태평양",
  KWAI: "말라카해협 · 인도양 · 희망봉 · 기니만",
};

const weather = Object.freeze({
  "port:BUSAN": { ko: "부산항" },
  ...Object.fromEntries(
    Object.entries(ports).map(([id, label]) => [`port:${id}`, label]),
  ),
  ...Object.fromEntries(
    Object.entries(chokepoints).map(([id, label]) => [
      `chokepoint:${id}`,
      label,
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(routes).map(([id, label]) => [
      `route:${id}`,
      { ko: `${label.ko} 해상 구간`, subtitleKo: APPROVED_ROUTE_CORRIDORS[id] },
    ]),
  ),
}) as Readonly<Record<string, NetworkDisplayLabel>>;

export const APPROVED_NETWORK_LABELS = Object.freeze({
  routes,
  ports,
  chokepoints,
  weather,
});
