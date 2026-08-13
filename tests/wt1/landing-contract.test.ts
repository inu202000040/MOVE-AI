import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("keeps every MD-required landing section, copy group, and static illustration", async () => {
  const source = await readFile(path.resolve("app/page.tsx"), "utf8");
  const heroSource = await readFile(
    path.resolve("app/components/landing/LandingHero.tsx"),
    "utf8",
  );
  const landingSource = `${source}\n${heroSource}`;

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
    assert.equal(landingSource.includes(requiredSource), true, requiredSource);
  }

  for (const requiredMediaSource of [
    "LANDING_VIDEO_ASSET.src",
    "autoPlay",
    "muted",
    "playsInline",
    "poster={LANDING_POSTER_ASSET.src}",
    'preload="auto"',
    'type="video/mp4"',
    'document.addEventListener("pointerdown"',
    "{ once: true }",
    'onEnded={() => setMediaState("ended")}',
    'mediaState === "error"',
    "소개 영상을 불러올 수 없어 대표 이미지를 표시합니다.",
  ]) {
    assert.equal(heroSource.includes(requiredMediaSource), true, requiredMediaSource);
  }
});

test("pins the user-supplied landing video binary to its exact implementation identity", async () => {
  const video = await readFile(
    path.resolve("public/media/glovis-landing-intro.mp4"),
  );
  const poster = await readFile(
    path.resolve("public/media/glovis-landing-poster.jpg"),
  );
  const manifestSource = await readFile(
    path.resolve("app/components/landing/landing-media.ts"),
    "utf8",
  );
  const allowedInputs = await readFile(
    path.resolve("docs/00_ALLOWED_INPUTS.md"),
    "utf8",
  );

  assert.equal(video.byteLength, 2_429_702);
  assert.equal(
    createHash("sha256").update(video).digest("hex"),
    "aaa91e9ab74192fa461eae298554080173846641ab5cf96ca14a1ecd589f1904",
  );
  assert.equal(poster.byteLength, 280_972);
  assert.equal(
    createHash("sha256").update(poster).digest("hex"),
    "9a010ef9975b0eed94656cac9ebfe28278943e5343f09f032f9a8fc812541d8d",
  );
  for (const requiredMetadata of [
    'rightsBasis: "project owner confirmed team usage rights in coordinator task"',
    'approvalRecordId: "coordinator-task/019fcf7c-829e-7fe3-902c-09185b7301c7/2026-08-13"',
    'permittedScope: "MOVE-AI project"',
    'approvalDate: "2026-08-13"',
    'expiry: "not specified"',
    'resolutionDisposition: "project owner approved supplied 1708x721 master"',
    'src: "/media/glovis-landing-intro.mp4"',
    "width: 1_708",
    "height: 721",
    "durationSeconds: 11.041667",
    "frameRate: 24",
    'codec: "H.264/AVC"',
    'src: "/media/glovis-landing-poster.jpg"',
    "byteSize: 280_972",
    'mimeType: "image/jpeg"',
    "derivedFromSha256: LANDING_VIDEO_ASSET.sha256",
    "extractionFrameSeconds: 0.25",
    "extractionFrameIndex: 6",
    'extractionMethod: "Chromium canvas image/jpeg quality 0.92"',
    'extractedAt: "2026-08-13T15:17:53+09:00"',
    "deterministicExtractionRuns: 2",
  ]) {
    assert.equal(manifestSource.includes(requiredMetadata), true, requiredMetadata);
  }

  assert.equal(
    allowedInputs.includes("| Landing 영상·poster | `APPROVED_FOR_MOVE_AI`"),
    true,
  );
  assert.equal(
    allowedInputs.includes("aaa91e9ab74192fa461eae298554080173846641ab5cf96ca14a1ecd589f1904"),
    true,
  );
  assert.equal(
    allowedInputs.includes("9a010ef9975b0eed94656cac9ebfe28278943e5343f09f032f9a8fc812541d8d"),
    true,
  );
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
    ".landing-video",
    "object-fit: cover",
    "object-position: center 50%",
  ]) {
    assert.equal(styles.includes(requiredSource), true, requiredSource);
  }
});
