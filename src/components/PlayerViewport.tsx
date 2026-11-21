import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Disc3, VideoOff } from 'lucide-react';
import { Show } from '../types';
import { formatLocation, formatReadableDate, formatShowFullTitle, getBaseVenueName } from '../utils/shows';
import { VideoInfo } from '../utils/video';

export interface PlayerViewportHandle {
  seekTo: (seconds: number) => void;
  seekRelative: (deltaSeconds: number) => void;
  togglePlay: () => void;
  requestFullscreen: () => void;
}

interface PlayerViewportProps {
  show: Show;
  videoInfo: VideoInfo | null;
  useNoCookie: boolean;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onEnded: () => void;
}

interface YTPlayerInstance {
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: HTMLElement | string,
        options: {
          videoId: string;
          host?: string;
          playerVars?: Record<string, string | number>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
      PlayerState?: {
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<void> | null = null;

function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && typeof window.YT.Player === 'function') {
    return Promise.resolve();
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<void>((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      resolve();
    };

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => resolve();
      document.head.appendChild(script);
    }

    // Safety fallback if network blocks iframe_api in offline/hermetic environments
    window.setTimeout(() => resolve(), 3500);
  });

  return ytApiPromise;
}

export const PlayerViewport = forwardRef<PlayerViewportHandle, PlayerViewportProps>(
  function PlayerViewport(
    { show, videoInfo, useNoCookie, onTimeUpdate, onPlayStateChange, onEnded },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const ytHostRef = useRef<HTMLDivElement | null>(null);
    const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
    const mediaRef = useRef<HTMLVideoElement | null>(null);
    const [ytFallbackIframe, setYtFallbackIframe] = useState(false);
    const [streamError, setStreamError] = useState<string | null>(null);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onPlayStateRef = useRef(onPlayStateChange);
    const onEndedRef = useRef(onEnded);
    onTimeUpdateRef.current = onTimeUpdate;
    onPlayStateRef.current = onPlayStateChange;
    onEndedRef.current = onEnded;

    const location = formatLocation(show);
    const displayVenue = getBaseVenueName(show.venue);

    // Mount YouTube IFrame Player API when source === 'youtube'
    useEffect(() => {
      setStreamError(null);
      setYtFallbackIframe(false);

      if (!videoInfo || videoInfo.source !== 'youtube') {
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.destroy();
          } catch {
            // Ignore cleanup errors
          }
          ytPlayerRef.current = null;
        }
        return;
      }

      let cancelled = false;
      let pollId: number | null = null;

      loadYouTubeIframeAPI().then(() => {
        if (cancelled || !ytHostRef.current) return;

        if (!window.YT || typeof window.YT.Player !== 'function') {
          setYtFallbackIframe(true);
          return;
        }

        // Clear any previous node inside mount host
        ytHostRef.current.innerHTML = '';
        const mountEl = document.createElement('div');
        mountEl.className = 'w-full h-full';
        ytHostRef.current.appendChild(mountEl);

        try {
          const player = new window.YT.Player(mountEl, {
            videoId: videoInfo.id,
            host: useNoCookie ? 'https://www.youtube-nocookie.com' : 'https://www.youtube.com',
            playerVars: {
              rel: 0,
              playsinline: 1,
              modestbranding: 1,
              enablejsapi: 1,
              origin: window.location.origin,
            },
            events: {
              onReady: (event) => {
                if (cancelled) return;
                const dur = event.target.getDuration?.() ?? 0;
                const cur = event.target.getCurrentTime?.() ?? 0;
                onTimeUpdateRef.current(cur, dur);
              },
              onStateChange: (event) => {
                if (cancelled) return;
                const playing = event.data === 1;
                onPlayStateRef.current(playing);
                if (event.data === 0) {
                  onEndedRef.current();
                }
              },
            },
          });

          ytPlayerRef.current = player;

          pollId = window.setInterval(() => {
            if (!ytPlayerRef.current) return;
            try {
              const cur = ytPlayerRef.current.getCurrentTime?.();
              const dur = ytPlayerRef.current.getDuration?.();
              if (typeof cur === 'number' && Number.isFinite(cur)) {
                onTimeUpdateRef.current(cur, typeof dur === 'number' && Number.isFinite(dur) ? dur : 0);
              }
            } catch {
              // Ignore polling errors while iframe initializes
            }
          }, 500);
        } catch {
          setYtFallbackIframe(true);
        }
      });

      return () => {
        cancelled = true;
        if (pollId !== null) window.clearInterval(pollId);
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.destroy();
          } catch {
            // Ignore destroy errors
          }
          ytPlayerRef.current = null;
        }
      };
    }, [videoInfo?.source, videoInfo?.id, useNoCookie]);

    // Mount HLS (.m3u8) or direct HTML5 video/audio stream
    useEffect(() => {
      setStreamError(null);
      if (
        !videoInfo ||
        (videoInfo.source !== 'hls' &&
          videoInfo.source !== 'direct-video' &&
          videoInfo.source !== 'direct-audio')
      ) {
        return;
      }

      const mediaEl = mediaRef.current;
      if (!mediaEl) return;

      let hls: Hls | null = null;

      if (videoInfo.source === 'hls') {
        if (Hls.isSupported()) {
          hls = new Hls({ enableWorker: true });
          hls.loadSource(videoInfo.embedUrl);
          hls.attachMedia(mediaEl);
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) {
              setStreamError(
                'Direct HLS stream could not be loaded (the stream token may have expired or requires origin headers). Paste a fresh stream URL in Nugs & Stream.'
              );
            }
          });
        } else if (mediaEl.canPlayType('application/vnd.apple.mpegurl')) {
          mediaEl.src = videoInfo.embedUrl;
        } else {
          setStreamError('HLS playback is not supported in this browser.');
        }
      } else {
        mediaEl.src = videoInfo.embedUrl;
      }

      return () => {
        if (hls) {
          hls.destroy();
        }
        mediaEl.pause();
        mediaEl.removeAttribute('src');
        mediaEl.load();
      };
    }, [videoInfo?.source, videoInfo?.embedUrl]);

    useImperativeHandle(
      ref,
      () => ({
        seekTo: (seconds: number) => {
          const safe = Math.max(0, seconds);
          if (videoInfo?.source === 'youtube' && ytPlayerRef.current) {
            try {
              ytPlayerRef.current.seekTo(safe, true);
              ytPlayerRef.current.playVideo();
              onTimeUpdateRef.current(safe, ytPlayerRef.current.getDuration?.() ?? 0);
            } catch {
              // Ignore seek errors
            }
          } else if (
            (videoInfo?.source === 'hls' ||
              videoInfo?.source === 'direct-video' ||
              videoInfo?.source === 'direct-audio') &&
            mediaRef.current
          ) {
            mediaRef.current.currentTime = safe;
            mediaRef.current.play().catch(() => {});
            onTimeUpdateRef.current(safe, mediaRef.current.duration || 0);
          }
        },
        seekRelative: (deltaSeconds: number) => {
          if (videoInfo?.source === 'youtube' && ytPlayerRef.current) {
            try {
              const cur = ytPlayerRef.current.getCurrentTime?.() ?? 0;
              const target = Math.max(0, cur + deltaSeconds);
              ytPlayerRef.current.seekTo(target, true);
              onTimeUpdateRef.current(target, ytPlayerRef.current.getDuration?.() ?? 0);
            } catch {
              // Ignore
            }
          } else if (mediaRef.current) {
            const target = Math.max(0, (mediaRef.current.currentTime || 0) + deltaSeconds);
            mediaRef.current.currentTime = target;
            onTimeUpdateRef.current(target, mediaRef.current.duration || 0);
          }
        },
        togglePlay: () => {
          if (videoInfo?.source === 'youtube' && ytPlayerRef.current) {
            try {
              const state = ytPlayerRef.current.getPlayerState?.();
              if (state === 1) {
                ytPlayerRef.current.pauseVideo();
              } else {
                ytPlayerRef.current.playVideo();
              }
            } catch {
              // Ignore
            }
          } else if (mediaRef.current) {
            if (mediaRef.current.paused) {
              mediaRef.current.play().catch(() => {});
            } else {
              mediaRef.current.pause();
            }
          }
        },
        requestFullscreen: () => {
          const target = mediaRef.current ?? containerRef.current;
          if (!target) return;
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else if (typeof target.requestFullscreen === 'function') {
            target.requestFullscreen().catch(() => {});
          }
        },
      }),
      [videoInfo?.source]
    );

    const isDirectMedia =
      videoInfo?.source === 'hls' ||
      videoInfo?.source === 'direct-video' ||
      videoInfo?.source === 'direct-audio';

    return (
      <div
        ref={containerRef}
        className="aspect-video w-full bg-black md:rounded-t-xl overflow-hidden border-b border-white/[0.08] shadow-2xl relative"
      >
        {!videoInfo ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#111115] px-6 text-center">
            <VideoOff className="w-10 h-10 text-zinc-600 mb-3" aria-hidden="true" />
            <p className="font-serif text-xl font-semibold text-zinc-200 mb-1">
              {displayVenue}
            </p>
            <p className="text-sm text-zinc-400">
              {formatReadableDate(show.date)}
              {location ? ` · ${location}` : ''}
            </p>
            <p className="text-xs text-zinc-500 mt-3 max-w-md">
              No video recording is linked for this archive date yet. Open Nugs &amp; Stream below
              to launch this date on Nugs or attach a direct stream URL.
            </p>
          </div>
        ) : videoInfo.source === 'youtube' ? (
          ytFallbackIframe ? (
            <iframe
              key={`${show.id}-${videoInfo.embedUrl}`}
              src={videoInfo.embedUrl}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              title={formatShowFullTitle(show)}
            />
          ) : (
            <div
              ref={ytHostRef}
              className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
              aria-label={formatShowFullTitle(show)}
            />
          )
        ) : videoInfo.source === 'drive' ? (
          <iframe
            key={`${show.id}-${videoInfo.embedUrl}`}
            src={videoInfo.embedUrl}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            title={formatShowFullTitle(show)}
          />
        ) : isDirectMedia ? (
          <div className="w-full h-full relative bg-[#0b0b0e] flex items-center justify-center">
            {videoInfo.source === 'direct-audio' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
                {show.nugsArtworkUrl ? (
                  <img
                    src={show.nugsArtworkUrl}
                    alt={`${displayVenue} artwork`}
                    referrerPolicy="no-referrer"
                    className="w-40 h-40 rounded-xl object-cover shadow-2xl border border-white/15 mb-4"
                  />
                ) : (
                  <Disc3 className="w-16 h-16 text-amber-400/80 mb-4" aria-hidden="true" />
                )}
                <p className="font-serif text-xl font-semibold text-[#f4f4f0]">{displayVenue}</p>
                <p className="text-xs font-mono tabular-nums text-zinc-400 mt-1">
                  {formatReadableDate(show.date)}
                  {location ? ` · ${location}` : ''}
                </p>
              </div>
            )}

            <video
              ref={mediaRef}
              controls
              playsInline
              onTimeUpdate={(e) =>
                onTimeUpdateRef.current(
                  e.currentTarget.currentTime || 0,
                  Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0
                )
              }
              onPlay={() => onPlayStateRef.current(true)}
              onPause={() => onPlayStateRef.current(false)}
              onEnded={() => onEndedRef.current()}
              className={`w-full h-full ${
                videoInfo.source === 'direct-audio' ? 'opacity-90' : 'object-contain bg-black'
              }`}
            />

            {streamError && (
              <div className="absolute inset-x-4 bottom-16 rounded-lg bg-zinc-950/95 border border-amber-400/40 px-4 py-3 text-xs text-amber-200">
                {streamError}
              </div>
            )}
          </div>
        ) : null}
      </div>
    );
  }
);
