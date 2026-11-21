import { useEffect, useState } from 'react';
import { HardDrive, Layers, ListMusic, Play, Radio, Youtube } from 'lucide-react';
import { Show } from '../types';
import { formatLocation, getBaseVenueName, parseSetlist } from '../utils/shows';
import { getVideoInfo } from '../utils/video';

interface ShowThumbnailProps {
  show: Show;
  compact?: boolean;
  partCount?: number;
  hasChapters?: boolean;
}

interface EraPalette {
  bg: string;
  accent: string;
  line: string;
}

function getEraPalette(year: number): EraPalette {
  if (year >= 2024) {
    return {
      bg: 'from-[#18161c] via-[#121318] to-[#0c0d11]',
      accent: 'text-amber-300',
      line: 'border-amber-400/20',
    };
  }
  if (year >= 2022) {
    return {
      bg: 'from-[#191512] via-[#131216] to-[#0c0c10]',
      accent: 'text-amber-400',
      line: 'border-amber-500/20',
    };
  }
  if (year >= 2019) {
    return {
      bg: 'from-[#12181c] via-[#111318] to-[#0b0d11]',
      accent: 'text-sky-300',
      line: 'border-sky-400/20',
    };
  }
  return {
    bg: 'from-[#181515] via-[#121215] to-[#0c0c0f]',
    accent: 'text-orange-300',
    line: 'border-orange-400/20',
  };
}

export function ShowThumbnail({
  show,
  compact = false,
  partCount = 1,
  hasChapters = false,
}: ShowThumbnailProps) {
  const info = getVideoInfo(show.directStreamUrl || show.videoUrl);
  const displayVenue = getBaseVenueName(show.venue);
  const location = formatLocation(show);
  const songCount = parseSetlist(show.setlist).length;
  const palette = getEraPalette(show.year);

  // Google Drive thumbnails frequently render pitch-black frames or SMPTE "PLEASE STAY TUNED" bars.
  // For Drive entries, prefer official Nugs concert artwork when available, otherwise render
  // our bespoke archival Concert Poster Card instead of broken/ugly Drive video frames.
  const preferredImageSrc = show.nugsArtworkUrl
    ? show.nugsArtworkUrl
    : info?.source === 'youtube'
    ? compact
      ? info.compactThumbnailUrl
      : info.thumbnailUrl
    : null;

  const fallbackImageSrc =
    info?.source === 'youtube' ? info.fallbackThumbnailUrl : null;

  const [imgSrc, setImgSrc] = useState<string | null>(preferredImageSrc);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgSrc(preferredImageSrc);
    setImgFailed(false);
  }, [show.id, preferredImageSrc]);

  const handleImgError = () => {
    if (fallbackImageSrc && imgSrc !== fallbackImageSrc) {
      setImgSrc(fallbackImageSrc);
    } else {
      setImgFailed(true);
    }
  };

  const handleImgLoad = (img: HTMLImageElement) => {
    if (
      info?.source === 'youtube' &&
      fallbackImageSrc &&
      imgSrc !== fallbackImageSrc &&
      img.naturalWidth <= 120
    ) {
      setImgSrc(fallbackImageSrc);
    }
  };

  const showPoster = !imgSrc || imgFailed;

  const sourceLabel =
    info?.source === 'youtube'
      ? 'YouTube'
      : info?.source === 'drive'
      ? 'Drive'
      : info?.source === 'hls' || info?.source === 'direct-video' || info?.source === 'direct-audio'
      ? 'Stream'
      : null;

  return (
    <div className="w-full h-full bg-[#121216] relative overflow-hidden select-none">
      {!showPoster && imgSrc ? (
        <img
          src={imgSrc}
          alt={`${show.artist} live at ${displayVenue} on ${show.date}`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleImgError}
          onLoad={(e) => handleImgLoad(e.currentTarget)}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
        />
      ) : (
        /* Styled Concert Poster Card (used for Google Drive tapes, archive records, and fallback) */
        <div
          className={`w-full h-full bg-gradient-to-br ${palette.bg} relative flex flex-col justify-between ${
            compact ? 'p-2.5' : 'p-4'
          }`}
        >
          {/* Subtle architectural stage-grid motif */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.14] pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 85% 18%, rgba(251,191,36,0.28), transparent 45%), linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 24px 24px, 24px 24px',
            }}
          />

          <div className="relative z-10 flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
            <span className={palette.accent}>{show.date}</span>
            {!compact && songCount > 0 && (
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <ListMusic className="w-3 h-3" aria-hidden="true" />
                <span>{songCount}</span>
              </span>
            )}
          </div>

          <div className={`relative z-10 my-auto py-1 border-t ${palette.line} pt-2`}>
            <p
              className={`font-serif font-semibold text-[#f4f4f0] leading-tight ${
                compact ? 'text-xs line-clamp-2' : 'text-[17px] line-clamp-2'
              }`}
            >
              {displayVenue}
            </p>
            {!compact && location && (
              <p className="text-xs text-zinc-400 truncate mt-1">{location}</p>
            )}
          </div>

          <div className="relative z-10 flex items-center justify-between text-[11px] text-zinc-500">
            <span className="truncate">{info ? `${show.year} Concert Tape` : 'Archive Record'}</span>
          </div>
        </div>
      )}

      {/* Measured contrast scrim at bottom for readable overlays */}
      {!showPoster && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
      )}

      {/* Bottom-left metadata cue: multi-part count or chapters */}
      {!compact && (partCount > 1 || hasChapters) && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-2 rounded bg-black/80 backdrop-blur-sm px-2 py-0.5 text-[11px] font-medium text-zinc-100">
          {partCount > 1 && (
            <span className="inline-flex items-center gap-1 tabular-nums text-amber-300">
              <Layers className="w-3 h-3" aria-hidden="true" />
              {partCount} parts
            </span>
          )}
          {partCount > 1 && hasChapters && <span aria-hidden="true" className="text-zinc-500">·</span>}
          {hasChapters && <span className="text-zinc-200">Chapters</span>}
        </div>
      )}

      {/* Bottom-right source indicator */}
      {sourceLabel && (
        <div
          className={`absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded bg-black/80 backdrop-blur-sm text-zinc-100 font-medium ${
            compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
          }`}
        >
          {info?.source === 'youtube' ? (
            <Youtube
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-red-500`}
              aria-hidden="true"
            />
          ) : info?.source === 'drive' ? (
            <HardDrive
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-amber-400`}
              aria-hidden="true"
            />
          ) : (
            <Radio
              className={`${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} text-emerald-400`}
              aria-hidden="true"
            />
          )}
          <span>{sourceLabel}</span>
        </div>
      )}

      {/* Subtle play button affordance on hover/focus */}
      {!compact && info && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/75 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-lg">
            <Play className="w-5 h-5 fill-white text-white translate-x-0.5" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
}
