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

interface PosterPalette {
  bg: string;
  glow: string;
  accent: string;
  rule: string;
  sub: string;
}

const POSTER_PALETTES: PosterPalette[] = [
  {
    bg: 'from-[#291b14] via-[#171214] to-[#0c0b0f]',
    glow: 'radial-gradient(circle at 82% 20%, rgba(251,191,36,0.34), transparent 55%)',
    accent: 'text-amber-300',
    rule: 'border-amber-400/35',
    sub: 'text-amber-200/70',
  },
  {
    bg: 'from-[#122521] via-[#101819] to-[#0a0d10]',
    glow: 'radial-gradient(circle at 80% 22%, rgba(52,211,153,0.28), transparent 55%)',
    accent: 'text-emerald-300',
    rule: 'border-emerald-400/30',
    sub: 'text-emerald-200/70',
  },
  {
    bg: 'from-[#182135] via-[#111521] to-[#0a0c12]',
    glow: 'radial-gradient(circle at 84% 18%, rgba(96,165,250,0.30), transparent 55%)',
    accent: 'text-sky-300',
    rule: 'border-sky-400/30',
    sub: 'text-sky-200/70',
  },
  {
    bg: 'from-[#2b171f] via-[#191117] to-[#0c0a0f]',
    glow: 'radial-gradient(circle at 78% 20%, rgba(251,113,133,0.28), transparent 55%)',
    accent: 'text-rose-300',
    rule: 'border-rose-400/30',
    sub: 'text-rose-200/70',
  },
  {
    bg: 'from-[#281f12] via-[#181511] to-[#0c0b0e]',
    glow: 'radial-gradient(circle at 82% 18%, rgba(245,158,11,0.34), transparent 55%)',
    accent: 'text-yellow-300',
    rule: 'border-yellow-400/35',
    sub: 'text-yellow-200/70',
  },
  {
    bg: 'from-[#1f192f] via-[#141220] to-[#0b0a11]',
    glow: 'radial-gradient(circle at 80% 22%, rgba(167,139,250,0.28), transparent 55%)',
    accent: 'text-violet-300',
    rule: 'border-violet-400/30',
    sub: 'text-violet-200/70',
  },
];

function getPosterPalette(seed: string): PosterPalette {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return POSTER_PALETTES[hash % POSTER_PALETTES.length];
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
  const songs = parseSetlist(show.setlist);
  const songCount = songs.length;
  const palette = getPosterPalette(`${show.date}-${displayVenue}`);

  // Google Drive thumbnails frequently render pitch-black frames or SMPTE "PLEASE STAY TUNED" bars.
  // For Drive entries, prefer official Nugs concert artwork when available, otherwise render
  // our bespoke archival Concert Poster Card with unique atmospheric tour palettes.
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

  const openerPreview = songs.slice(0, 2).join(' · ');

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
          className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-300 ease-out"
        />
      ) : (
        /* Bespoke Archival Concert Poster Card (for vintage Drive tapes without Nugs artwork & archive records) */
        <div
          className={`w-full h-full bg-gradient-to-br ${palette.bg} relative flex flex-col justify-between ${
            compact ? 'p-2.5' : 'p-4'
          }`}
        >
          {/* Warm stage spotlight glow + fine concert poster texture */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `${palette.glow}, linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`,
              backgroundSize: '100% 100%, 28px 28px, 28px 28px',
            }}
          />

          {/* Subtle archival inner frame */}
          {!compact && (
            <div
              aria-hidden="true"
              className={`absolute inset-2.5 rounded-lg border ${palette.rule} opacity-45 pointer-events-none`}
            />
          )}

          <div
            className={`relative z-10 flex items-center justify-between gap-2 font-mono tabular-nums ${
              compact ? 'text-[10px]' : 'text-[11px] px-1 pt-0.5'
            }`}
          >
            <span className={`font-semibold tracking-wide ${palette.accent}`}>{show.date}</span>
            {!compact && songCount > 0 && (
              <span className="inline-flex items-center gap-1 text-zinc-300">
                <ListMusic className="w-3 h-3 opacity-80" aria-hidden="true" />
                <span>{songCount}</span>
              </span>
            )}
          </div>

          <div
            className={`relative z-10 my-auto ${
              compact ? 'py-0.5' : `border-t ${palette.rule} mx-1 pt-2.5`
            }`}
          >
            <p
              className={`font-serif font-semibold text-[#faf8f3] leading-tight tracking-tight ${
                compact ? 'text-xs line-clamp-2' : 'text-[19px] line-clamp-2'
              }`}
            >
              {displayVenue}
            </p>
            {!compact && location && (
              <p className={`text-xs truncate mt-1 font-medium ${palette.sub}`}>{location}</p>
            )}
          </div>

          <div
            className={`relative z-10 flex items-center justify-between gap-2 text-[11px] ${
              compact ? 'text-zinc-400' : 'px-1 pb-0.5 text-zinc-400'
            }`}
          >
            {compact || (partCount <= 1 && !hasChapters) ? (
              <span className="truncate pr-14">
                {!compact && openerPreview
                  ? openerPreview
                  : info
                  ? `${show.year} Concert Film`
                  : 'Archive Record'}
              </span>
            ) : (
              <span className="h-4" aria-hidden="true" />
            )}
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
