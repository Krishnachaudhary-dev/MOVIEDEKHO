"use client";

import { Pause, Play, RefreshCw, WifiOff, ArrowLeft } from "lucide-react";
import Link from "next/link";
import React from "react";
import Hls from "hls.js";
import { Events, ErrorTypes, type ErrorData } from "hls.js";
import type { StreamSource } from "@/lib/types/sources";

export interface VideoPlayerProps {
  title: string;
  sources: StreamSource[];
  autoplay?: boolean;
  loadTimeoutMs?: number;
}

type PlayingState =
  | { kind: "idle"; elapsed: number }
  | { kind: "loading" }
  | { kind: "playing"; paused: boolean; elapsed: number }
  | { kind: "error"; reason: string };

function isHlsJsSupported(): boolean {
  return typeof Hls !== "undefined" && !!window.MediaSource;
}

export default function VideoPlayer({
  title,
  sources,
  autoplay = false,
  loadTimeoutMs = 12_000,
}: VideoPlayerProps) {
  const playerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const hlsRef = React.useRef<{ hls: Hls; destroy: () => void } | null>(null);

  const [activeIndex, setActiveIndex] = React.useState(0);
  // The player boots in a loading state; loading → playing/error transitions
  // are driven by media events, so no setState runs inside the mount effect.
  const [playState, setPlayState] = React.useState<PlayingState>({
    kind: "loading",
  });
  const [paused, setPaused] = React.useState(true);

  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  const active = sources[activeIndex];
  const isEmbed = active.type === "embed";
  const isHls = active.type === "m3u8";
  const isMp4 = active.type === "mp4";
  const activeSrc = active.url;

  const formatElapsed = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0)
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ---- hls.js ----

  const startHls = (
    src: string,
    onSuccess: () => void,
    onError: (message: string) => void,
    onStalled: () => void,
  ) => {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      startLevel: -1,
      capLevelToPlayerSize: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 90,
    });
    hlsRef.current = {
      hls,
      destroy: () => {
        hls.destroy();
        hlsRef.current = null;
      },
    };

    const onEvent = (event: Events, data: unknown) => {
      if (event === Events.MANIFEST_PARSED) {
        if (cleanupTimer) clearTimeout(cleanupTimer);
        cleanupTimer = null;
        const levels = hls.levels;
        if (!levels || levels.length === 0) {
          hls.destroy();
          onError("No playable levels in the playlist");
          return;
        }
        const videoEl = videoRef.current;
        if (!videoEl) {
          hls.destroy();
          onError("Video element unavailable");
          return;
        }
        const winHeight = window.innerHeight || 900;
        let bestIndex = 0;
        let bestLevel = -1;
        for (let i = 0; i < levels.length; i++) {
          const level = levels[i];
          const h = level.height ?? Infinity;
          if (h <= winHeight && h > bestLevel) {
            bestLevel = h;
            bestIndex = i;
          }
        }
        hls.currentLevel = bestIndex;
        hls.attachMedia(videoEl);
        onSuccess();
      } else if (event === Events.ERROR) {
        const errorData = data as ErrorData;
        if (errorData.type === ErrorTypes.NETWORK_ERROR) {
          hls.destroy();
          onError("Network error loading the stream");
        } else if (errorData.type === ErrorTypes.MEDIA_ERROR) {
          hls.destroy();
          onError(
            "Media error — stream may not be playable",
          );
        }
      }
    };

    hls.on(Events.ERROR, onEvent);
    hls.on(Events.MANIFEST_PARSED, onEvent);

    const stalledAt = () => {
      if (cleanupTimer) clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(() => {
        if (hlsRef.current?.hls === hls) {
          hls.destroy();
          onError("Stream stalled — try a different server");
        }
      }, 3_000);
    };
    hls.on(Events.MANIFEST_PARSED, () => {
      stalledAt();
    });

    try {
      hls.loadSource(src);
    } catch (err) {
      hls.destroy();
      onError(err instanceof Error ? err.message : String(err));
      return;
    }
  };

  // ---- mount ----

  const mountPlayer = async () => {
    if (isEmbed) {
      // nothing to mount — iframe ready state handled by onLoad
      return;
    }

    const el = videoRef.current;
    if (!el) {
      setPlayState({ kind: "error", reason: "Video element not found" });
      return;
    }

    if (isMp4) {
      el.src = activeSrc;
      el.load();
      return;
    }

    if (isHls) {
      if (!isHlsJsSupported()) {
        // Native HLS in Safari: point the <video> tag directly at the .m3u8.
        el.src = activeSrc;
        el.load();
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const signal = new AbortController();
        const timeout = setTimeout(() => signal.abort(), loadTimeoutMs);

        startHls(
          activeSrc,
          () => {
            clearTimeout(timeout);
            signal.abort();
            resolve();
          },
          (msg) => {
            clearTimeout(timeout);
            signal.abort();
            reject(new Error(msg));
          },
          () => {
            clearTimeout(timeout);
            signal.abort();
            reject(new Error("Stream stalled"));
          },
        );

        signal.signal.addEventListener(
          "abort",
          () => {
            /* cleanup handled inside startHls on abort */
          },
          { once: true },
        );
      });
    } else {
      el.src = activeSrc;
      el.load();
    }
  };

  // ---- mount effect ----

  React.useEffect(() => {
    mountPlayer();
    return () => {
      hlsRef.current?.destroy();
    };
  }, []);

  // ---- server switch ----

  const switchServer = (index: number) => {
    if (index === activeIndex) return;
    const next = sources[index];

    setPlayState({ kind: "loading" });
    setPaused(true);

    if (next.type === "embed") {
      const iframe = iframeRef.current;
      if (iframe) iframe.src = next.url;
    } else {
      const el = videoRef.current;
      if (el) {
        el.pause();
        try {
          el.removeAttribute("src");
          el.load();
          el.src = next.url;
        } catch {
          // some browsers throw on src removal while loading
        }
      }
    }
  };

  // ---- iframe handlers ----

  const onIframeLoad = () => {
    if (playState.kind === "loading") {
      setPlayState({ kind: "playing", paused: false, elapsed: 0 });
    }
  };
  const onIframeError = () => {
    setPlayState({
      kind: "error",
      reason:
        "This server's embed player could not be loaded. Try switching servers.",
    });
  };

  // ---- video handlers ----

  const onVideoTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    const t = Math.max(0, el.currentTime ?? 0);
    setPaused(el.paused);
  };
  const onVideoPlay = () => setPaused(false);
  const onVideoPause = () => setPaused(true);
  const onVideoWaiting = () => undefined;
  const onVideoCanPlay = () => {
    if (playState.kind === "loading") {
      setPlayState({
        kind: "playing",
        paused: !autoplay,
        elapsed: 0,
      });
    }
  };
  const onVideoProgress = () => undefined;
  const onVideoError = () => {
    setPlayState({
      kind: "error",
      reason: "This video could not be played. Try switching servers.",
    });
  };
  const onVideoStalled = () => {
    const el = videoRef.current;
    if (el && !el.paused) {
      setPlayState({
        kind: "error",
        reason: "Playback stalled — try switching servers",
      });
    }
  };
  const onVideoEnded = () => undefined;
  const onVideoSeeking = () => undefined;
  const onVideoSeeked = () => undefined;

  // ---- overlay ----

  const renderOverlay = () => {
    if (playState.kind === "error") {
      return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/80 backdrop-blur-sm px-6">
          <WifiOff className="size-10 text-rating-low" />
          <p className="text-sm font-medium leading-relaxed text-foreground/90 text-center max-w-md">
            {playState.reason}
            {sources.length > 1 ? (
              <span className="block mt-1 text-muted">
                Try switching servers using the buttons above.
              </span>
            ) : null}
          </p>
        </div>
      );
    }

    if (playState.kind === "loading") {
      return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-black/70 backdrop-blur-sm">
          <RefreshCw className="size-8 text-muted animate-spin" />
          <p className="text-sm text-muted">
            {LOADING_TITLE[active.type] ?? "Loading…"}
          </p>
        </div>
      );
    }

    if (playState.kind === "idle" || playState.kind === "playing") {
      return (
        <button
          type="button"
          onClick={() => {
            const el = videoRef.current;
            if (!el) return;
            if (el.paused) el.play();
            else el.pause();
          }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
          aria-label={paused ? `Play ${title}` : "Pause"}
          tabIndex={-1}
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-white/10 backdrop-blur transition group-hover:bg-white/20">
            {paused ? (
              <Play className="size-7 text-white ml-0.5" />
            ) : (
              <Pause className="size-7 text-white" />
            )}
          </div>
        </button>
      );
    }

    return null;
  };

  // ---- render ----

  return (
    <div className="w-full">
      {/* Cinematic 16:9 frame — full-width inside the max-w-6xl page column,
          unified rounded corners, deep shadow, hairline ring for depth. */}
      <div
        ref={playerRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10"
      >
      {isEmbed ? (
        <iframe
          ref={iframeRef}
          src={activeSrc}
          className="h-full w-full border-0"
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="eager"
          onLoad={onIframeLoad}
          onError={onIframeError}
        />
      ) : (
        <video
          ref={videoRef}
          src={activeSrc}
          className="h-full w-full bg-black object-cover"
          playsInline
          controls
          controlsList={isEmbed ? undefined : "nodownload"}
          preload="metadata"
          onTimeUpdate={onVideoTimeUpdate}
          onPlay={onVideoPlay}
          onPause={onVideoPause}
          onWaiting={onVideoWaiting}
          onCanPlay={onVideoCanPlay}
          onProgress={onVideoProgress}
          onError={onVideoError}
          onStalled={onVideoStalled}
          onEnded={onVideoEnded}
          onSeeking={onVideoSeeking}
          onSeeked={onVideoSeeked}
        />
      )}

      {!isEmbed && renderOverlay()}

      <Link
        href="/"
        className="absolute left-3 top-3 z-30 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-3 py-1.5 text-xs font-medium text-white drop-shadow backdrop-blur-sm transition hover:bg-black/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <ArrowLeft className="size-3.5" />
        Back to Browse
      </Link>
      </div>

      {/* Control bar — spacing, buttons and status sit below the player so
          overlays never cover the picture on small screens. */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {sources.map((source, index) => (
            <button
              key={source.id}
              type="button"
              onClick={() => switchServer(index)}
              className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:text-xs sm:px-2.5 sm:py-1.5 ${index === activeIndex ? "bg-brand text-white shadow-md" : "bg-surface-raised text-muted hover:bg-surface-hover hover:text-foreground"}`}
              title={source.name + (source.quality ? ` · ${source.quality}` : "")}
            >
              {source.name}
              {source.quality ? (
                <span className="ml-1 rounded bg-white/10 px-1 py-0.5 text-[10px] text-white/80">
                  {source.quality}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div
          className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg bg-surface px-3 py-1.5 text-[11px] font-medium backdrop-blur-sm sm:self-auto ${playState.kind === "playing" || playState.kind === "idle" ? "text-emerald-300 ring-1 ring-emerald-500/30" : playState.kind === "loading" ? "text-amber-300 ring-1 ring-amber-500/30" : "text-rating-low ring-1 ring-rating-low/30"}`}
        >
          {playState.kind === "playing" || playState.kind === "idle" ? (
            <span className="inline-flex items-center gap-1">
              {playState.elapsed > 0 ? (
                <span className="tabular-nums">{formatElapsed(playState.elapsed)}</span>
              ) : (
                <span className="tabular-nums">—</span>
              )}
              {playState.kind === "playing" ? (
                <span className="inline-flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  live
                </span>
              ) : null}
            </span>
          ) : playState.kind === "loading" ? (
            "Loading…"
          ) : (
            playState.reason
          )}
        </div>
      </div>
    </div>
  );
}

const LOADING_TITLE: Record<string, string> = {
  embed: "Loading player…",
  m3u8: "Preparing stream…",
  mp4: "Loading video…",
};
