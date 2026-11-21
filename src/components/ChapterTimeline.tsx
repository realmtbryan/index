import { useState } from 'react';
import {
  Check,
  Copy,
  Maximize,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
} from 'lucide-react';
import { Chapter } from '../types';
import { formatDurationCompact, formatTimestamp, getSetLabel } from '../utils/chapters';

interface ChapterTimelineProps {
  chapters: Chapter[];
  activeChapterIndex: number;
  currentTime: number;
  mediaDuration: number;
  isPlaying: boolean;
  supportsSeek: boolean;
  isDriveSource: boolean;
  syncOffset: number;
  timingSourceLabel?: string;
  theaterMode: boolean;
  showTheaterButton: boolean;
  onSelectChapter: (chapter: Chapter) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onTogglePlay: () => void;
  onSeekRelative: (deltaSeconds: number) => void;
  onChangeSyncOffset: (nextOffset: number | ((prev: number) => number)) => void;
  onToggleTheater: () => void;
  onRequestFullscreen: () => void;
}

export function ChapterTimeline({
  chapters,
  activeChapterIndex,
  currentTime,
  mediaDuration,
  isPlaying,
  supportsSeek,
  isDriveSource,
  syncOffset,
  timingSourceLabel,
  theaterMode,
  showTheaterButton,
  onSelectChapter,
  onPrevChapter,
  onNextChapter,
  onTogglePlay,
  onSeekRelative,
  onChangeSyncOffset,
  onToggleTheater,
  onRequestFullscreen,
}: ChapterTimelineProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showSyncDrawer, setShowSyncDrawer] = useState(false);
  const [copiedTime, setCopiedTime] = useState(false);

  const hasChapters = chapters.length > 0;
  const totalChapterSpan = hasChapters
    ? Math.max(
        1,
        chapters[chapters.length - 1].endTime - Math.min(0, chapters[0].startTime)
      )
    : Math.max(1, mediaDuration);

  const totalDuration = Math.max(totalChapterSpan, mediaDuration || 0);
  const activeChapter =
    activeChapterIndex >= 0 && activeChapterIndex < chapters.length
      ? chapters[activeChapterIndex]
      : chapters[0] ?? null;

  const previewChapter =
    hoveredIndex !== null && chapters[hoveredIndex] ? chapters[hoveredIndex] : null;

  const progressPct =
    supportsSeek && totalDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
      : activeChapter && totalDuration > 0
      ? Math.min(100, Math.max(0, (activeChapter.startTime / totalDuration) * 100))
      : 0;

  const handleCopyTimestamp = async (seconds: number) => {
    const label = formatTimestamp(seconds);
    try {
      await navigator.clipboard.writeText(label);
      setCopiedTime(true);
      window.setTimeout(() => setCopiedTime(false), 1800);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  return (
    <div className="bg-[#111115] md:rounded-b-xl border-b md:border-x border-white/[0.08] px-3.5 md:px-4 py-3 space-y-3">
      {/* Proportional Chapter Scrubber Bar */}
      {hasChapters && (
        <div className="relative pt-1">
          {/* Hover / Focus Tooltip */}
          {previewChapter && (
            <div
              role="tooltip"
              className="mb-2 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-[#1a1a22] border border-white/[0.12] text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono tabular-nums text-amber-400 shrink-0">
                  {String(previewChapter.index + 1).padStart(2, '0')}
                </span>
                <span className="font-medium text-[#f4f4f0] truncate">
                  {previewChapter.title}
                </span>
                {getSetLabel(previewChapter.setNumber) && (
                  <span className="text-zinc-500 shrink-0">
                    · {getSetLabel(previewChapter.setNumber)}
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums text-zinc-300 shrink-0">
                {formatTimestamp(previewChapter.startTime)} ({formatDurationCompact(previewChapter.duration)})
              </span>
            </div>
          )}

          {/* Segmented Chapter Track */}
          <div
            role="group"
            aria-label="Concert setlist chapters"
            className="relative flex items-center gap-[2px] h-7 rounded-md overflow-hidden bg-white/[0.04] p-0.5"
          >
            {chapters.map((chapter) => {
              const widthPct = Math.max(
                0.8,
                (chapter.duration / totalChapterSpan) * 100
              );
              const isActive = chapter.index === activeChapterIndex;
              const isPast =
                activeChapterIndex >= 0 && chapter.index < activeChapterIndex;

              return (
                <button
                  key={`${chapter.index}-${chapter.title}`}
                  type="button"
                  style={{ width: `${widthPct}%` }}
                  onClick={() => onSelectChapter(chapter)}
                  onMouseEnter={() => setHoveredIndex(chapter.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(chapter.index)}
                  onBlur={() => setHoveredIndex(null)}
                  aria-label={`Chapter ${chapter.index + 1}: ${chapter.title} at ${formatTimestamp(
                    chapter.startTime
                  )}`}
                  title={`${String(chapter.index + 1).padStart(2, '0')} ${chapter.title} (${formatTimestamp(
                    chapter.startTime
                  )})`}
                  className={`h-full rounded-[3px] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                    isActive
                      ? 'bg-amber-400'
                      : isPast
                      ? 'bg-amber-400/45 hover:bg-amber-400/75'
                      : 'bg-white/[0.14] hover:bg-white/[0.32]'
                  }`}
                />
              );
            })}

            {/* Live Playhead Indicator */}
            {supportsSeek && currentTime > 0 && (
              <div
                aria-hidden="true"
                style={{ left: `${progressPct}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] pointer-events-none"
              />
            )}
          </div>
        </div>
      )}

      {/* Unified Transport & Chapter Readout Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Transport Controls */}
        <div className="flex items-center gap-1">
          {supportsSeek && (
            <>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause playback' : 'Play'}
                title="Play / Pause (Space)"
                className="w-9 h-9 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-zinc-950" aria-hidden="true" />
                ) : (
                  <Play className="w-4 h-4 fill-zinc-950 translate-x-0.5" aria-hidden="true" />
                )}
              </button>

              <button
                type="button"
                onClick={() => onSeekRelative(-10)}
                aria-label="Rewind 10 seconds"
                title="Rewind 10s (J)"
                className="w-9 h-9 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => onSeekRelative(10)}
                aria-label="Forward 10 seconds"
                title="Forward 10s (L)"
                className="w-9 h-9 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
              >
                <RotateCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}

          {hasChapters && (
            <>
              <button
                type="button"
                onClick={onPrevChapter}
                disabled={activeChapterIndex <= 0}
                aria-label="Previous song"
                title="Previous song (P)"
                className="w-9 h-9 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
              >
                <SkipBack className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onNextChapter}
                disabled={activeChapterIndex >= chapters.length - 1}
                aria-label="Next song"
                title="Next song (N)"
                className="w-9 h-9 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center transition-colors cursor-pointer"
              >
                <SkipForward className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          )}

          {/* Active Track & Timestamp Readout */}
          <div className="ml-1.5 min-w-0">
            {activeChapter ? (
              <div className="flex items-center gap-2 text-xs min-w-0">
                <span className="font-mono tabular-nums text-amber-400 shrink-0">
                  {supportsSeek && currentTime > 0
                    ? `${formatTimestamp(currentTime)} / ${formatTimestamp(totalDuration)}`
                    : formatTimestamp(activeChapter.startTime)}
                </span>
                <span aria-hidden="true" className="text-zinc-600">·</span>
                <span className="text-zinc-200 font-medium truncate max-w-[180px] sm:max-w-[280px]">
                  {String(activeChapter.index + 1).padStart(2, '0')} {activeChapter.title}
                </span>
              </div>
            ) : supportsSeek && totalDuration > 0 ? (
              <span className="font-mono text-xs tabular-nums text-zinc-300">
                {formatTimestamp(currentTime)} / {formatTimestamp(totalDuration)}
              </span>
            ) : (
              <span className="text-xs text-zinc-500">
                {isDriveSource ? 'Google Drive Preview' : 'Concert Player'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Sync Offset Toggle, Copy Timestamp (Drive), Theater & Fullscreen */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isDriveSource && activeChapter && (
            <button
              type="button"
              onClick={() => handleCopyTimestamp(activeChapter.startTime)}
              aria-label={`Copy timestamp ${formatTimestamp(activeChapter.startTime)}`}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-xs font-mono tabular-nums text-amber-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              {copiedTime ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Copied {formatTimestamp(activeChapter.startTime)}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Copy {formatTimestamp(activeChapter.startTime)}</span>
                </>
              )}
            </button>
          )}

          {hasChapters && (
            <button
              type="button"
              onClick={() => setShowSyncDrawer((prev) => !prev)}
              aria-expanded={showSyncDrawer}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                showSyncDrawer || syncOffset !== 0
                  ? 'bg-white/[0.12] text-amber-300'
                  : 'bg-white/[0.05] text-zinc-300 hover:bg-white/[0.1]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                Sync {syncOffset === 0 ? '0s' : `${syncOffset > 0 ? '+' : ''}${syncOffset}s`}
              </span>
            </button>
          )}

          {showTheaterButton && (
            <button
              type="button"
              onClick={onToggleTheater}
              aria-label={theaterMode ? 'Exit theater mode' : 'Theater mode'}
              title="Toggle Theater Mode (T)"
              className="w-8 h-8 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
            >
              {theaterMode ? (
                <Minimize2 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onRequestFullscreen}
            aria-label="Toggle fullscreen"
            title="Fullscreen (F)"
            className="w-8 h-8 rounded-lg text-zinc-300 hover:text-white hover:bg-white/[0.08] flex items-center justify-center transition-colors cursor-pointer"
          >
            <Maximize className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Google Drive Cross-Origin Seeking Note */}
      {isDriveSource && hasChapters && activeChapter && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06] text-xs text-zinc-400">
          <span>
            Drive embeds restrict JS seeking — scrub to{' '}
            <strong className="font-mono tabular-nums text-amber-300">
              {formatTimestamp(activeChapter.startTime)}
            </strong>{' '}
            for <strong className="text-zinc-200">{activeChapter.title}</strong>
            {timingSourceLabel ? ` (${timingSourceLabel})` : ''}, or attach a direct stream for
            instant jumps.
          </span>
        </div>
      )}

      {/* Compact Sync Offset Controls (saved per show in localStorage) */}
      {hasChapters && showSyncDrawer && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-white/[0.08]">
          <div className="text-xs text-zinc-400">
            <span className="text-zinc-200 font-medium">Chapter Sync Offset</span>
            <span className="ml-2 text-zinc-500">
              Nudge timestamps for intro or setbreak padding (saved per show).
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {[-30, -5, -1, 1, 5, 30].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => onChangeSyncOffset((prev) => prev + delta)}
                aria-label={`Adjust chapter sync by ${delta > 0 ? `+${delta}` : delta} seconds`}
                className="h-8 px-2.5 rounded-md bg-white/[0.06] hover:bg-white/[0.14] text-xs font-mono tabular-nums text-zinc-200 transition-colors cursor-pointer"
              >
                {delta > 0 ? `+${delta}s` : `${delta}s`}
              </button>
            ))}
            {syncOffset !== 0 && (
              <button
                type="button"
                onClick={() => onChangeSyncOffset(0)}
                className="h-8 px-2.5 rounded-md border border-white/[0.12] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
