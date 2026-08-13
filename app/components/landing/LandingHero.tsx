"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  LANDING_POSTER_ASSET,
  LANDING_VIDEO_ASSET,
} from "./landing-media";

type MediaState = "loading" | "ready" | "autoplay-blocked" | "ended" | "error";

export function LandingHero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryConsumedRef = useRef(false);
  const [mediaState, setMediaState] = useState<MediaState>("loading");

  const requestPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;

    try {
      await video.play();
      setMediaState("ready");
    } catch {
      setMediaState("autoplay-blocked");
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;

    if (document.readyState === "complete") {
      void requestPlayback();
      return;
    }

    const handleLoad = () => void requestPlayback();
    window.addEventListener("load", handleLoad, { once: true });
    return () => window.removeEventListener("load", handleLoad);
  }, [requestPlayback]);

  useEffect(() => {
    if (mediaState !== "autoplay-blocked" || retryConsumedRef.current) return;
    const retryOnce = () => {
      retryConsumedRef.current = true;
      void requestPlayback();
    };
    document.addEventListener("pointerdown", retryOnce, { once: true });
    return () => document.removeEventListener("pointerdown", retryOnce);
  }, [mediaState, requestPlayback]);

  return (
    <div className="landing-media" data-media-state={mediaState}>
      <img
        alt=""
        aria-hidden="true"
        className="landing-poster"
        height={LANDING_POSTER_ASSET.height}
        src={LANDING_POSTER_ASSET.src}
        width={LANDING_POSTER_ASSET.width}
      />
      <video
        aria-label="한국이 보이는 지구에서 여러 글로벌 노선이 펼쳐진 뒤 지구가 현대글로비스 로고의 O로 흔들림 없이 안착하는 인트로 영상"
        autoPlay
        className="landing-video"
        controls={false}
        data-media-state={mediaState}
        muted
        onEnded={() => setMediaState("ended")}
        onError={() => setMediaState("error")}
        onPlaying={() => setMediaState("ready")}
        playsInline
        poster={LANDING_POSTER_ASSET.src}
        preload="auto"
        ref={videoRef}
      >
        <source src={LANDING_VIDEO_ASSET.src} type="video/mp4" />
        한국 중심 지구에서 글로벌 노선으로 이어지는 해상운임 의사결정 플랫폼 소개 영상입니다.
      </video>
      {mediaState === "error" ? (
        <p className="landing-media-error" role="status">
          소개 영상을 불러올 수 없어 대표 이미지를 표시합니다.
        </p>
      ) : null}
    </div>
  );
}
