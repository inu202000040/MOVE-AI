import { PAGE_PATHS } from "./contracts";

const DASHBOARD_HREF = `${PAGE_PATHS.dashboard}?route=KNEI`;

export default function LandingPage() {
  return (
    <main
      aria-label="GLOVIS 해상운임 예측·운임 의사결정 플랫폼 소개"
      className="landing-page"
    >
      <header aria-label="상단 영역" className="landing-header">
        <a
          aria-label="GLOVIS 해상운임 예측·운임 의사결정 플랫폼 홈"
          className="landing-brand"
          href="#top"
        >
          GLOVIS
        </a>
        <a className="landing-cta" href={DASHBOARD_HREF}>데모 사용</a>
      </header>

      <section
        aria-label="한국 중심 지구에서 글로벌 노선으로 이어지는 현대글로비스 해상운임 예측·운임 의사결정 플랫폼 소개 영상"
        className="landing-hero"
        id="top"
      >
        <div
          aria-label="승인된 11초 인트로 영상과 poster 자산 대기 중"
          className="landing-media-pending"
          role="img"
        />
      </section>

      <section
        aria-labelledby="feature-title"
        className="landing-features"
        id="features"
      >
        <div className="landing-feature-heading" id="about">
          <p>핵심 기능</p>
          <h1 id="feature-title">예측에서 선복계약 의사결정까지</h1>
          <span>
            미래 스팟운임을 예측하고, 시나리오로 계약 비중을 추천하며, 글로벌 항로 상황을 모니터링합니다.
          </span>
        </div>

        <div className="landing-feature-grid">
          <article className="landing-feature-card">
            <div className="landing-feature-card-heading">
              <span className="landing-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M4 18V6" />
                  <path d="M4 18h16" />
                  <path d="m7 14 4-4 3 2 4-5" />
                </svg>
              </span>
              <div>
                <h2>스팟운임 예측</h2>
                <p>과거 운임 데이터를 분석해 향후 스팟운임의 흐름과 불확실성 구간을 예측합니다.</p>
              </div>
            </div>
            <div
              aria-label="미래 스팟운임 예측 추세 그래프"
              className="landing-forecast-visual landing-feature-visual"
              role="img"
            >
              <svg preserveAspectRatio="none" viewBox="0 0 340 152">
                <defs>
                  <linearGradient id="forecast-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#0968e8" stopOpacity=".28" />
                    <stop offset="1" stopColor="#0968e8" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="landing-chart-grid" d="M18 34h304M18 76h304M18 118h304" />
                <path className="landing-chart-area" d="M20 112 C62 102 77 89 112 91 S170 65 204 72 S257 43 320 32 V132 H20Z" />
                <path className="landing-chart-line" d="M20 112 C62 102 77 89 112 91 S170 65 204 72 S257 43 320 32" />
                <circle className="landing-chart-point" cx="204" cy="72" r="5" />
              </svg>
            </div>
          </article>

          <article className="landing-feature-card" id="flow">
            <div className="landing-feature-card-heading">
              <span className="landing-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 4v8l5 3" />
                </svg>
              </span>
              <div>
                <h2>선복계약 비중 추천</h2>
                <p>예측 시나리오별 예상 조달비용과 CVaR를 비교해 장기계약·스팟 조달 비중을 추천합니다.</p>
              </div>
            </div>
            <div
              aria-label="권장 선복계약 비중 장기계약 65퍼센트, 스팟 조달 35퍼센트"
              className="landing-allocation-visual landing-feature-visual"
              role="img"
            >
              <div className="landing-donut"><strong>65%</strong></div>
              <div className="landing-allocation-legend">
                <span><i className="landing-legend-fixed" />장기계약 65%</span>
                <span><i className="landing-legend-spot" />스팟 조달 35%</span>
                <em>CVaR 위험 반영</em>
              </div>
            </div>
          </article>

          <article className="landing-feature-card">
            <div className="landing-feature-card-heading">
              <span className="landing-feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
                </svg>
              </span>
              <div>
                <h2>글로벌 물류 모니터링</h2>
                <p>전 세계 13개 주요 항로와 운하·해협·항만의 기상 상태와 물동량을 한 화면에서 모니터링합니다.</p>
              </div>
            </div>
            <div
              aria-label="전 세계 13개 주요 항로와 운하, 해협, 항만의 기상 및 물동량 모니터링 화면"
              className="landing-network-visual landing-feature-visual"
              role="img"
            >
              <span className="landing-network-route-count">13 / 글로벌 항로</span>
              <span className="landing-network-weather">기상 정상</span>
              <svg preserveAspectRatio="none" viewBox="0 0 340 152">
                <path className="landing-map-land" d="M25 54 58 28l52 8 12 30-22 22-40-5-18 22-24-16Zm164-30 49 12 17 25-19 18-38-6-12-22Zm63 70 35-12 34 20-17 29-45-6Z" />
                <path className="landing-map-route" d="M49 96Q120 30 181 80T305 56" />
                <path className="landing-map-route" d="M36 67Q112 120 173 72T307 102" />
                <path className="landing-map-route" d="M62 119Q133 55 210 102T299 40" />
                <path className="landing-map-route" d="M79 42Q155 96 248 55" />
                <path className="landing-map-route" d="M107 128Q184 42 286 91" />
                <circle className="landing-map-hub" cx="173" cy="72" r="6" />
                <circle className="landing-map-port" cx="49" cy="96" r="4" />
                <circle className="landing-map-port" cx="79" cy="42" r="4" />
                <circle className="landing-map-port" cx="248" cy="55" r="4" />
                <circle className="landing-map-port" cx="299" cy="91" r="4" />
                <circle className="landing-map-port" cx="107" cy="128" r="4" />
                <circle className="landing-map-zone" cx="218" cy="93" r="11" />
              </svg>
              <span className="landing-network-watch">운하·해협 감시</span>
              <span className="landing-network-volume">항만 물동량 / 1.1M TEU</span>
            </div>
          </article>
        </div>
      </section>

      <section aria-label="서비스 강점" className="landing-trust" id="resources">
        {[
          ["◎", "글로벌 데이터 기반", "다양한 항로 데이터 수집"],
          ["✣", "AI·딥러닝 모델", "정확도 높은 예측"],
          ["◷", "실시간 모니터링", "빠른 대응과 판단"],
          ["♙", "전문가 인사이트", "의사결정 지원"],
        ].map(([symbol, title, description]) => (
          <div className="landing-trust-item" key={title}>
            <span aria-hidden="true">{symbol}</span>
            <div><strong>{title}</strong><small>{description}</small></div>
          </div>
        ))}
      </section>
    </main>
  );
}
