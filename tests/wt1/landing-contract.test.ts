import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("keeps every MD-required landing section, copy group, and static illustration", async () => {
  const source = await readFile(path.resolve("app/page.tsx"), "utf8");

  for (const requiredSource of [
    'aria-label="상단 영역"',
    "GLOVIS",
    "데모 사용",
    'className="landing-hero"',
    'id="features"',
    'id="about"',
    'id="flow"',
    'id="resources"',
    "예측에서 선복계약 의사결정까지",
    "스팟운임 예측",
    "선복계약 비중 추천",
    "글로벌 물류 모니터링",
    "장기계약 65%",
    "스팟 조달 35%",
    "CVaR 위험 반영",
    "13 / 글로벌 항로",
    "기상 정상",
    "운하·해협 감시",
    "항만 물동량 / 1.1M TEU",
    "글로벌 데이터 기반",
    "AI·딥러닝 모델",
    "실시간 모니터링",
    "전문가 인사이트",
  ]) {
    assert.equal(source.includes(requiredSource), true, requiredSource);
  }
});

test("keeps landing and workspace visual languages separate and responsive", async () => {
  const styles = await readFile(path.resolve("app/globals.css"), "utf8");

  for (const requiredSource of [
    ".landing-page",
    "font-family: Arial",
    "background: #010f2c",
    ".landing-feature-grid",
    ".landing-trust",
    ".workspace-shell",
    "--shell-raised:",
    "--shell-inset:",
    "width: 68px",
    "width: 244px",
    "width: 218px",
    "@media (max-width: 900px)",
    "@media (max-width: 760px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.equal(styles.includes(requiredSource), true, requiredSource);
  }
});
