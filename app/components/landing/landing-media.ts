export const LANDING_MEDIA_RIGHTS = {
  rightsBasis: "project owner confirmed team usage rights in coordinator task",
  approvalRecordId: "coordinator-task/019fcf7c-829e-7fe3-902c-09185b7301c7/2026-08-13",
  permittedScope: "MOVE-AI project",
  approvalDate: "2026-08-13",
  expiry: "not specified",
  resolutionDisposition: "project owner approved supplied 1708x721 master",
} as const;

export const LANDING_VIDEO_ASSET = {
  src: "/media/glovis-landing-intro.mp4",
  sha256: "aaa91e9ab74192fa461eae298554080173846641ab5cf96ca14a1ecd589f1904",
  byteSize: 2_429_702,
  width: 1_708,
  height: 721,
  durationSeconds: 11.041667,
  frameRate: 24,
  codec: "H.264/AVC",
} as const;

export const LANDING_POSTER_ASSET = {
  src: "/media/glovis-landing-poster.jpg",
  sha256: "9a010ef9975b0eed94656cac9ebfe28278943e5343f09f032f9a8fc812541d8d",
  byteSize: 280_972,
  width: 1_708,
  height: 721,
  mimeType: "image/jpeg",
  derivedFromSha256: LANDING_VIDEO_ASSET.sha256,
  extractionFrameSeconds: 0.25,
  extractionFrameIndex: 6,
  extractionMethod: "Chromium canvas image/jpeg quality 0.92",
  extractedAt: "2026-08-13T15:17:53+09:00",
  deterministicExtractionRuns: 2,
} as const;
