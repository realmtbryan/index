import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  HardDrive,
  Layers,
  ListMusic,
  Play,
  Radio,
  Search,
  Share2,
  Shield,
  Sparkles,
  X,
  Youtube,
} from 'lucide-react';
import { Chapter, CustomShowTiming, GroupedShow, LayoutMode, Show } from '../types';
import {
  findSimilarShows,
  formatLocation,
  formatReadableDate,
  formatShowFullTitle,
  getBaseVenueName,
  getPartLabel,
  getPerformanceGroupKey,
  getUpNextGroups,
  parseSetlist,
} from '../utils/shows';
import {
  formatDurationCompact,
  formatTimestamp,
  getActiveChapterIndex,
  getChaptersForShow,
  getSetLabel,
  parseCustomTimingsInput,
} from '../utils/chapters';
import { getNugsMetadataForDate, getNugsReleaseUrl } from '../data/nugsCatalog';
import { getVideoInfo, isDirectStreamUrl } from '../utils/video';
import { ShowThumbnail } from './ShowThumbnail';
import { PlayerViewport, PlayerViewportHandle } from './PlayerViewport';
import { ChapterTimeline } from './ChapterTimeline';

type RailTab = 'setlist' | 'similar' | 'upnext';

interface PlayerModalProps {
  show: Show;
  layoutMode: LayoutMode;
  filteredGroups: GroupedShow[];
  allGroups: GroupedShow[];
  isSaved: boolean;
  syncOffset: number;
  customStreamUrl?: string;
  customTiming?: CustomShowTiming;
  autoAdvanceParts: boolean;
  onClose: () => void;
  onSelectShow: (show: Show) => void;
  onToggleSave: (showId: string) => void;
  onFindSongPerformances: (song: string) => void;
  onChangeSyncOffset: (
    showId: string,
    offsetOrUpdater: number | ((prev: number) => number)
  ) => void;
  onSaveCustomStream: (showId: string, url: string | null) => void;
  onSaveCustomTiming: (showId: string, timing: CustomShowTiming | null) => void;
  onToggleAutoAdvance: (enabled: boolean) => void;
}

interface NugsLookupResult {
  loading: boolean;
  found: boolean;
  nugsShowId: string | null;
  nugsUrl: string;
  artworkUrl: string | null;
  hasVideoOnDemand?: boolean;
}

export function PlayerModal({
  show,
  layoutMode,
  filteredGroups,
  allGroups,
  isSaved,
  syncOffset,
  customStreamUrl,
  customTiming,
  autoAdvanceParts,
  onClose,
  onSelectShow,
  onToggleSave,
  onFindSongPerformances,
  onChangeSyncOffset,
  onSaveCustomStream,
  onSaveCustomTiming,
  onToggleAutoAdvance,
}: PlayerModalProps) {
  const [useNoCookie, setUseNoCookie] = useState(false);
  const [theaterMode, setTheaterMode] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');
  const [activeTab, setActiveTab] = useState<RailTab>('setlist');
  const [showStreamDrawer, setShowStreamDrawer] = useState(false);

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualChapterIndex, setManualChapterIndex] = useState<number>(0);

  // Nugs / Custom Stream form state
  const [streamInput, setStreamInput] = useState(customStreamUrl ?? '');
  const [timingInput, setTimingInput] = useState('');
  const [timingMessage, setTimingMessage] = useState<string | null>(null);
  const [streamMessage, setStreamMessage] = useState<string | null>(null);

  const staticNugs = getNugsMetadataForDate(show.date);
  const [nugsLookup, setNugsLookup] = useState<NugsLookupResult>(() => ({
    loading: false,
    found: Boolean(staticNugs),
    nugsShowId: staticNugs?.nugsShowId ?? show.nugsShowId ?? null,
    nugsUrl: getNugsReleaseUrl(staticNugs?.nugsShowId ?? show.nugsShowId, show.date),
    artworkUrl: staticNugs?.artworkUrl ?? show.nugsArtworkUrl ?? null,
    hasVideoOnDemand: staticNugs?.hasVideoOnDemand,
  }));

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<PlayerViewportHandle | null>(null);

  const effectiveUrl = customStreamUrl || show.directStreamUrl || show.videoUrl;
  const videoInfo = getVideoInfo(effectiveUrl, useNoCookie);
  const displayVenue = getBaseVenueName(show.venue);
  const location = formatLocation(show);

  // Resolve current show's group & parts
  const currentGroupKey = getPerformanceGroupKey(show);
  const currentGroup = useMemo(
    () => allGroups.find((g) => g.groupKey === currentGroupKey) ?? null,
    [allGroups, currentGroupKey]
  );
  const sameShowParts = useMemo(
    () => currentGroup?.parts ?? [],
    [currentGroup]
  );
  const currentPartIndex = useMemo(
    () => sameShowParts.findIndex((p) => p.id === show.id),
    [sameShowParts, show.id]
  );

  // Merge setlist from group primaryShow if current part is Part 2+ without setlist
  const effectiveShow: Show = useMemo(
    () => ({
      ...show,
      setlist: show.setlist || currentGroup?.primaryShow.setlist,
      notes: show.notes || currentGroup?.primaryShow.notes,
      bandMembers: show.bandMembers || currentGroup?.primaryShow.bandMembers,
      reviews: show.reviews || currentGroup?.primaryShow.reviews,
      trackDurations: show.trackDurations || currentGroup?.primaryShow.trackDurations,
      trackSets: show.trackSets || currentGroup?.primaryShow.trackSets,
      nugsArtworkUrl:
        nugsLookup.artworkUrl || show.nugsArtworkUrl || currentGroup?.primaryShow.nugsArtworkUrl,
      nugsShowId: nugsLookup.nugsShowId || show.nugsShowId || currentGroup?.primaryShow.nugsShowId,
    }),
    [show, currentGroup, nugsLookup.artworkUrl, nugsLookup.nugsShowId]
  );

  const songs = useMemo(() => parseSetlist(effectiveShow.setlist), [effectiveShow.setlist]);

  // Build chapters (exact Nugs/custom timings or proportional fallback when media duration is known)
  const { chapters, sourceLabel: timingSourceLabel, isExact: chaptersExact } = useMemo(
    () =>
      getChaptersForShow(
        effectiveShow,
        syncOffset,
        customTiming,
        mediaDuration > 60 ? mediaDuration : undefined
      ),
    [effectiveShow, syncOffset, customTiming, mediaDuration]
  );

  const liveChapterIndex = useMemo(() => {
    if (chapters.length === 0) return -1;
    if (videoInfo?.supportsSeek && currentTime > 0) {
      return getActiveChapterIndex(chapters, currentTime);
    }
    return Math.min(manualChapterIndex, chapters.length - 1);
  }, [chapters, videoInfo?.supportsSeek, currentTime, manualChapterIndex]);

  const similarShows = useMemo(
    () => findSimilarShows(allGroups, effectiveShow, 18),
    [allGroups, effectiveShow]
  );

  const upNextGroups = useMemo(
    () => getUpNextGroups(filteredGroups, allGroups, effectiveShow, 20),
    [filteredGroups, allGroups, effectiveShow]
  );

  // Previous / Next distinct show navigation
  const activeGroupIndex = useMemo(
    () => filteredGroups.findIndex((g) => g.groupKey === currentGroupKey),
    [filteredGroups, currentGroupKey]
  );
  const prevShow =
    activeGroupIndex > 0 ? filteredGroups[activeGroupIndex - 1].primaryShow : null;
  const nextShow =
    activeGroupIndex >= 0 && activeGroupIndex < filteredGroups.length - 1
      ? filteredGroups[activeGroupIndex + 1].primaryShow
      : upNextGroups[0]?.primaryShow ?? null;

  // Reset per-show local UI state on show change
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    setShareState('idle');
    setCurrentTime(0);
    setMediaDuration(0);
    setIsPlaying(false);
    setManualChapterIndex(0);
    setStreamInput(customStreamUrl ?? '');
    setStreamMessage(null);
    setTimingMessage(null);
    setActiveTab(songs.length > 0 ? 'setlist' : 'upnext');
  }, [show.id]);

  // Fetch public unauthenticated Nugs release metadata for the show date via backend proxy
  useEffect(() => {
    const initial = getNugsMetadataForDate(show.date);
    setNugsLookup({
      loading: !initial,
      found: Boolean(initial),
      nugsShowId: initial?.nugsShowId ?? show.nugsShowId ?? null,
      nugsUrl: getNugsReleaseUrl(initial?.nugsShowId ?? show.nugsShowId, show.date),
      artworkUrl: initial?.artworkUrl ?? show.nugsArtworkUrl ?? null,
      hasVideoOnDemand: initial?.hasVideoOnDemand,
    });

    if (initial) return;

    let cancelled = false;
    fetch(`/api/nugs/date/${encodeURIComponent(show.date)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setNugsLookup({
          loading: false,
          found: Boolean(data.found),
          nugsShowId: data.nugsShowId ?? null,
          nugsUrl: data.nugsUrl ?? getNugsReleaseUrl(undefined, show.date),
          artworkUrl: data.artworkUrl ?? null,
          hasVideoOnDemand: Boolean(data.hasVideoOnDemand),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setNugsLookup((prev) => ({ ...prev, loading: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [show.date, show.nugsShowId, show.nugsArtworkUrl]);

  // Lock body scroll while player is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleSelectChapter = useCallback(
    (chapter: Chapter) => {
      setManualChapterIndex(chapter.index);
      if (videoInfo?.supportsSeek) {
        viewportRef.current?.seekTo(chapter.startTime);
      }
    },
    [videoInfo?.supportsSeek]
  );

  const handlePrevChapter = useCallback(() => {
    if (chapters.length === 0) return;
    const targetIdx = Math.max(0, liveChapterIndex - 1);
    handleSelectChapter(chapters[targetIdx]);
  }, [chapters, liveChapterIndex, handleSelectChapter]);

  const handleNextChapter = useCallback(() => {
    if (chapters.length === 0) return;
    const targetIdx = Math.min(chapters.length - 1, liveChapterIndex + 1);
    handleSelectChapter(chapters[targetIdx]);
  }, [chapters, liveChapterIndex, handleSelectChapter]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (!autoAdvanceParts) return;
    if (currentPartIndex >= 0 && currentPartIndex < sameShowParts.length - 1) {
      onSelectShow(sameShowParts[currentPartIndex + 1]);
    }
  }, [autoAdvanceParts, currentPartIndex, sameShowParts, onSelectShow]);

  // Player keyboard shortcuts: Space, J/L, N/P, F, T, Escape/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape' || (layoutMode === 'tv' && e.key === 'Backspace')) {
        e.preventDefault();
        onClose();
        return;
      }

      const lower = e.key.toLowerCase();
      if (e.key === ' ' && videoInfo?.supportsSeek) {
        e.preventDefault();
        viewportRef.current?.togglePlay();
      } else if (lower === 'j' && videoInfo?.supportsSeek) {
        e.preventDefault();
        viewportRef.current?.seekRelative(-10);
      } else if (lower === 'l' && videoInfo?.supportsSeek) {
        e.preventDefault();
        viewportRef.current?.seekRelative(10);
      } else if (lower === 'n' && chapters.length > 0) {
        e.preventDefault();
        handleNextChapter();
      } else if (lower === 'p' && chapters.length > 0) {
        e.preventDefault();
        handlePrevChapter();
      } else if (lower === 'f') {
        e.preventDefault();
        viewportRef.current?.requestFullscreen();
      } else if (lower === 't' && layoutMode === 'desktop') {
        e.preventDefault();
        setTheaterMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    layoutMode,
    videoInfo?.supportsSeek,
    chapters.length,
    onClose,
    handleNextChapter,
    handlePrevChapter,
  ]);

  const handleShare = async () => {
    const deepLink = window.location.href;
    const title = formatShowFullTitle(effectiveShow);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text: title, url: deepLink });
        return;
      }
    } catch {
      // Fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${title}\n${deepLink}`);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Ignore
    }
  };

  const handleApplyStream = () => {
    const cleaned = streamInput.trim();
    if (!cleaned) {
      onSaveCustomStream(show.id, null);
      setStreamMessage('Cleared custom stream. Using archive source.');
      return;
    }
    if (!isDirectStreamUrl(cleaned) && !getVideoInfo(cleaned)) {
      setStreamMessage('Enter a valid .m3u8 HLS, .mp4, .m4a, YouTube, or Google Drive URL.');
      return;
    }
    onSaveCustomStream(show.id, cleaned);
    setStreamMessage('Stream attached and saved locally for this show.');
  };

  const handleApplyTimings = () => {
    const parsed = parseCustomTimingsInput(timingInput);
    if (!parsed) {
      setTimingMessage(
        'Could not parse timings. Paste a Nugs shows/{id} JSON response or mm:ss durations (one per line).'
      );
      return;
    }
    onSaveCustomTiming(show.id, parsed);
    setTimingInput('');
    setTimingMessage(`Loaded ${parsed.durations.length} track durations (${parsed.sourceLabel}).`);
  };

  const isMobileLayout = layoutMode === 'mobile';
  const isTvLayout = layoutMode === 'tv';

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Watching ${displayVenue} on ${show.date}`}
      className="fixed inset-0 z-50 bg-[#09090b] overflow-y-auto overflow-x-hidden"
    >
      {/* Compact Sticky Top Bar */}
      <div className="sticky top-0 z-20 bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.08] px-3.5 md:px-6 h-14 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className={`inline-flex items-center gap-2 font-medium text-zinc-200 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg px-2.5 py-1.5 -ml-2 ${
            isTvLayout ? 'text-base bg-white/[0.08] px-4' : 'text-sm'
          }`}
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Archive</span>
        </button>

        <div className="hidden md:flex items-center gap-2 text-xs text-zinc-400 truncate min-w-0">
          <span className="font-mono tabular-nums text-amber-400 shrink-0">{show.date}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate font-medium text-zinc-200">{displayVenue}</span>
          {location && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{location}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!prevShow}
            onClick={() => prevShow && onSelectShow(prevShow)}
            aria-label="Previous show"
            title="Previous show"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={!nextShow}
            onClick={() => nextShow && onSelectShow(nextShow)}
            aria-label="Next show"
            title="Next show"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Main Responsive Player Grid */}
      <div
        className={`mx-auto flex flex-col gap-6 ${
          isMobileLayout
            ? 'px-0 py-0 pb-20'
            : theaterMode
            ? 'max-w-[1440px] px-4 md:px-6 py-5'
            : 'max-w-[1680px] px-0 md:px-6 py-0 md:py-6 xl:flex-row'
        }`}
      >
        {/* Left / Primary Video + Chapters + Metadata Column */}
        <div className="flex-1 min-w-0">
          <div className="md:rounded-xl overflow-hidden md:border md:border-white/[0.08]">
            <PlayerViewport
              ref={viewportRef}
              show={effectiveShow}
              videoInfo={videoInfo}
              useNoCookie={useNoCookie}
              onTimeUpdate={(cur, dur) => {
                setCurrentTime(cur);
                if (dur > 0) setMediaDuration(dur);
              }}
              onPlayStateChange={setIsPlaying}
              onEnded={handleVideoEnded}
            />

            <ChapterTimeline
              chapters={chapters}
              activeChapterIndex={liveChapterIndex}
              currentTime={currentTime}
              mediaDuration={mediaDuration}
              isPlaying={isPlaying}
              supportsSeek={Boolean(videoInfo?.supportsSeek)}
              isDriveSource={videoInfo?.source === 'drive'}
              syncOffset={syncOffset}
              timingSourceLabel={timingSourceLabel}
              theaterMode={theaterMode}
              showTheaterButton={!isMobileLayout && !isTvLayout}
              onSelectChapter={handleSelectChapter}
              onPrevChapter={handlePrevChapter}
              onNextChapter={handleNextChapter}
              onTogglePlay={() => viewportRef.current?.togglePlay()}
              onSeekRelative={(delta) => viewportRef.current?.seekRelative(delta)}
              onChangeSyncOffset={(next) => onChangeSyncOffset(show.id, next)}
              onToggleTheater={() => setTheaterMode((prev) => !prev)}
              onRequestFullscreen={() => viewportRef.current?.requestFullscreen()}
            />
          </div>

          {/* Multi-Part Switcher + Auto-Advance (inside player view) */}
          {sameShowParts.length > 1 && (
            <div className="px-4 md:px-0 mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-[#111115] border border-white/[0.08]">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 whitespace-nowrap shrink-0 mr-1">
                    <Layers className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    <span>{sameShowParts.length} parts:</span>
                  </span>
                  {sameShowParts.map((part) => {
                    const isCurrent = part.id === show.id;
                    const label = getPartLabel(part, sameShowParts.length) ?? part.venue;
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => onSelectShow(part)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          isCurrent
                            ? 'bg-amber-400 text-zinc-950 font-semibold'
                            : 'bg-white/[0.07] text-zinc-300 hover:bg-white/[0.15] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-zinc-400 cursor-pointer shrink-0 select-none">
                  <input
                    type="checkbox"
                    checked={autoAdvanceParts}
                    onChange={(e) => onToggleAutoAdvance(e.target.checked)}
                    className="accent-amber-400 w-3.5 h-3.5 rounded cursor-pointer"
                  />
                  <span>Auto-advance parts</span>
                </label>
              </div>
            </div>
          )}

          {/* Show Header & Actions */}
          <div className="px-4 md:px-0 mt-5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mb-1.5">
              <span className="font-mono tabular-nums text-amber-400">
                {formatReadableDate(show.date)}
              </span>
              {location && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{location}</span>
                </>
              )}
              {videoInfo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-zinc-300">
                    {videoInfo.source === 'youtube' ? (
                      <Youtube className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
                    ) : videoInfo.source === 'drive' ? (
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                    ) : (
                      <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    )}
                    {videoInfo.source === 'youtube'
                      ? 'YouTube'
                      : videoInfo.source === 'drive'
                      ? 'Google Drive'
                      : 'Direct Stream'}
                  </span>
                </>
              )}
              {timingSourceLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-zinc-300">{timingSourceLabel}</span>
                </>
              )}
            </div>

            <h1
              className={`font-serif font-semibold text-[#f4f4f0] tracking-tight text-balance ${
                isTvLayout ? 'text-3xl md:text-4xl' : 'text-2xl md:text-3xl'
              }`}
            >
              {displayVenue}
            </h1>
            <p className="text-sm text-zinc-400 mt-1">{show.artist}</p>

            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pb-5 border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => onToggleSave(show.id)}
                aria-pressed={isSaved}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isSaved
                    ? 'bg-amber-400 text-zinc-950 font-semibold hover:bg-amber-300'
                    : 'bg-white/[0.08] text-zinc-100 hover:bg-white/[0.15]'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${isSaved ? 'fill-zinc-950' : ''}`}
                  aria-hidden="true"
                />
                <span>{isSaved ? 'Saved' : 'Save Show'}</span>
              </button>

              <a
                href={nugsLookup.nugsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-zinc-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
              >
                <ExternalLink className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>
                  {nugsLookup.nugsShowId
                    ? `Open on Nugs (#${nugsLookup.nugsShowId})`
                    : 'Find Date on Nugs'}
                </span>
              </a>

              <button
                type="button"
                onClick={() => setShowStreamDrawer((prev) => !prev)}
                aria-expanded={showStreamDrawer}
                className={`inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showStreamDrawer || customStreamUrl || customTiming
                    ? 'bg-amber-400/15 text-amber-300 border border-amber-400/35'
                    : 'bg-white/[0.08] hover:bg-white/[0.15] text-zinc-100'
                }`}
              >
                <Radio className="w-4 h-4" aria-hidden="true" />
                <span>Nugs &amp; Stream</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] text-zinc-100 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {shareState === 'copied' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    <span>Share</span>
                  </>
                )}
              </button>

              {videoInfo && (videoInfo.source === 'youtube' || videoInfo.source === 'drive') && (
                <a
                  href={videoInfo.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border border-white/[0.1] hover:bg-white/[0.08] text-zinc-300 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{videoInfo.source === 'youtube' ? 'YouTube' : 'Google Drive'}</span>
                </a>
              )}

              {videoInfo?.source === 'youtube' && (
                <button
                  type="button"
                  onClick={() => setUseNoCookie((prev) => !prev)}
                  aria-pressed={useNoCookie}
                  className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    useNoCookie
                      ? 'bg-white/[0.14] text-amber-300'
                      : 'border border-white/[0.1] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{useNoCookie ? 'No-Cookie On' : 'Privacy Embed'}</span>
                </button>
              )}
            </div>

            {/* Collapsible Nugs & Direct Stream Helper Drawer */}
            {showStreamDrawer && (
              <section
                aria-label="Nugs and direct stream settings"
                className="mt-4 p-4 rounded-xl bg-[#121217] border border-white/[0.1] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-base font-semibold text-[#f4f4f0]">
                      Subscriber Stream &amp; Nugs Timing Sync
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Launch this date in your Nugs account, attach your own direct HLS (.m3u8) /
                      M4A / MP4 stream for instant chapter seeking, or paste track durations.
                    </p>
                  </div>
                  {nugsLookup.nugsShowId && (
                    <span className="font-mono text-xs tabular-nums text-amber-300">
                      Nugs Release #{nugsLookup.nugsShowId}
                    </span>
                  )}
                </div>

                {/* Direct Stream URL Attach */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-stream-input"
                    className="block text-xs font-medium text-zinc-300"
                  >
                    Direct Stream URL (.m3u8 HLS, .mp4, or .m4a — saved locally for this show)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      id="custom-stream-input"
                      type="url"
                      value={streamInput}
                      onChange={(e) => setStreamInput(e.target.value)}
                      placeholder="https://.../show_hls_4200.m3u8 or .mp4/.m4a"
                      className="flex-1 h-10 bg-[#0b0b0e] border border-white/[0.1] rounded-lg px-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleApplyStream}
                        className="h-10 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Load Stream
                      </button>
                      {customStreamUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setStreamInput('');
                            onSaveCustomStream(show.id, null);
                            setStreamMessage('Reverted to archive video source.');
                          }}
                          className="h-10 px-3 rounded-lg border border-white/[0.12] hover:bg-white/[0.08] text-xs text-zinc-300 transition-colors cursor-pointer"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                  {streamMessage && <p className="text-xs text-amber-300">{streamMessage}</p>}
                </div>

                {/* Track Durations / Nugs JSON Importer */}
                <div className="space-y-1.5 pt-3 border-t border-white/[0.07]">
                  <label
                    htmlFor="custom-timings-input"
                    className="block text-xs font-medium text-zinc-300"
                  >
                    Import Track Durations (paste Nugs shows/&#123;id&#125; JSON or mm:ss lines)
                  </label>
                  <textarea
                    id="custom-timings-input"
                    rows={3}
                    value={timingInput}
                    onChange={(e) => setTimingInput(e.target.value)}
                    placeholder="Paste Nugs Response JSON or track durations like:&#10;01:06&#10;03:14&#10;06:44"
                    className="w-full bg-[#0b0b0e] border border-white/[0.1] rounded-lg p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400/70"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleApplyTimings}
                      className="h-9 px-3.5 rounded-lg bg-white/[0.1] hover:bg-white/[0.18] text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      Apply Chapter Timings
                    </button>
                    {customTiming && (
                      <button
                        type="button"
                        onClick={() => {
                          onSaveCustomTiming(show.id, null);
                          setTimingMessage('Cleared custom timings.');
                        }}
                        className="h-9 px-3 rounded-lg border border-white/[0.1] hover:bg-white/[0.06] text-xs text-zinc-400 cursor-pointer"
                      >
                        Reset Custom Timings
                      </button>
                    )}
                    {timingMessage && (
                      <span className="text-xs text-amber-300">{timingMessage}</span>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Show Details & Notes (below player on Desktop & Mobile) */}
            <section className="mt-5 pb-6 text-sm text-zinc-400 space-y-2.5">
              {effectiveShow.bandMembers && (
                <p>
                  <span className="text-zinc-200 font-medium">Lineup: </span>
                  {effectiveShow.bandMembers}
                </p>
              )}
              {effectiveShow.notes && (
                <p className="text-zinc-300 leading-relaxed">{effectiveShow.notes}</p>
              )}
              <p className="leading-relaxed">
                Archived performance by {show.artist} at {displayVenue}
                {location ? ` in ${location}` : ''} on {formatReadableDate(show.date)} ({show.year}{' '}
                tour).
              </p>

              {effectiveShow.reviews && (
                <div className="pt-3 space-y-2.5">
                  <h2 className="font-serif text-base font-semibold text-zinc-200">Fan Notes</h2>
                  {effectiveShow.reviews.split(' // ').map((review, i) => (
                    <blockquote
                      key={i}
                      className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-300 italic text-xs md:text-sm"
                    >
                      "{review}"
                    </blockquote>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Right / Stacked Tabbed Panel: Setlist | Similar Setlists | Up Next */}
        <aside
          aria-label="Setlist, similar shows, and up next"
          className={`px-4 md:px-0 pb-12 ${
            isMobileLayout || theaterMode
              ? 'w-full'
              : 'w-full xl:w-[440px] shrink-0'
          }`}
        >
          {/* Segmented Tab Controls */}
          <div
            role="tablist"
            aria-label="Player sidebar tabs"
            className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#121216] border border-white/[0.08] mb-4"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'setlist'}
              onClick={() => setActiveTab('setlist')}
              className={`h-10 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'setlist'
                  ? 'bg-[#f4f4f0] text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Setlist {songs.length > 0 ? `(${songs.length})` : ''}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'similar'}
              onClick={() => setActiveTab('similar')}
              className={`h-10 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'similar'
                  ? 'bg-[#f4f4f0] text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Similar ({similarShows.length})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'upnext'}
              onClick={() => setActiveTab('upnext')}
              className={`h-10 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'upnext'
                  ? 'bg-[#f4f4f0] text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Up Next ({upNextGroups.length})</span>
            </button>
          </div>

          {/* TAB 1: Dual-Action Setlist */}
          {activeTab === 'setlist' && (
            <div
              role="tabpanel"
              aria-label="Setlist"
              className="rounded-xl bg-[#111115] border border-white/[0.08] overflow-hidden"
            >
              {songs.length > 0 ? (
                <>
                  <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between gap-2 text-xs text-zinc-400">
                    <span>
                      {chapters.length > 0
                        ? videoInfo?.supportsSeek
                          ? 'Click a song to jump · Search icon for other shows'
                          : 'Click a song for timestamp · Search icon for other shows'
                        : 'Click search icon on any song to find other performances'}
                    </span>
                    {chaptersExact && (
                      <span className="font-mono text-[11px] text-amber-400 shrink-0">
                        Nugs Synced
                      </span>
                    )}
                  </div>

                  <ol className="divide-y divide-white/[0.05] max-h-[62vh] xl:max-h-[70vh] overflow-y-auto">
                    {songs.map((song, index) => {
                      const chapter = chapters[index];
                      const isCurrent = chapter && index === liveChapterIndex;
                      const prevSet = index > 0 ? chapters[index - 1]?.setNumber : undefined;
                      const showSetHeader =
                        chapter?.setNumber && chapter.setNumber !== prevSet;

                      return (
                        <li key={`${index}-${song}`}>
                          {showSetHeader && (
                            <div className="px-4 py-1.5 bg-white/[0.03] text-[11px] font-medium text-amber-400/90 border-b border-white/[0.05]">
                              {getSetLabel(chapter.setNumber)}
                            </div>
                          )}

                          <div
                            className={`flex items-center justify-between gap-2 px-3 py-1.5 transition-colors ${
                              isCurrent
                                ? 'bg-amber-400/12'
                                : 'hover:bg-white/[0.04]'
                            }`}
                          >
                            {/* Primary Row Action: Jump to song timestamp (does NOT navigate away) */}
                            <button
                              type="button"
                              onClick={() => {
                                if (chapter) {
                                  handleSelectChapter(chapter);
                                } else {
                                  setShowStreamDrawer(true);
                                }
                              }}
                              aria-label={
                                chapter
                                  ? `Jump to ${song} at ${formatTimestamp(chapter.startTime)}`
                                  : `${song} (open timing sync)`
                              }
                              className="flex-1 min-w-0 flex items-center gap-3 py-1.5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
                            >
                              <span
                                className={`font-mono text-xs tabular-nums w-6 shrink-0 flex items-center justify-center ${
                                  isCurrent ? 'text-amber-400 font-semibold' : 'text-zinc-500'
                                }`}
                              >
                                {isCurrent ? (
                                  <Play className="w-3 h-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                                ) : (
                                  String(index + 1).padStart(2, '0')
                                )}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-sm truncate ${
                                    isCurrent
                                      ? 'text-amber-300 font-semibold'
                                      : 'text-zinc-100'
                                  }`}
                                >
                                  {song}
                                </p>
                                {chapter && (
                                  <p className="text-[11px] font-mono tabular-nums text-zinc-500 mt-0.5">
                                    {formatTimestamp(chapter.startTime)}
                                    <span aria-hidden="true" className="mx-1.5">·</span>
                                    {formatDurationCompact(chapter.duration)}
                                  </p>
                                )}
                              </div>
                            </button>

                            {/* Secondary Action: Find other performances of this song */}
                            <button
                              type="button"
                              onClick={() => onFindSongPerformances(song)}
                              aria-label={`Find other performances of ${song}`}
                              title={`Find other playable shows featuring "${song}"`}
                              className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-400 hover:text-amber-300 hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              <Search className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </>
              ) : (
                <div className="p-8 text-center">
                  <ListMusic className="w-8 h-8 text-zinc-600 mx-auto mb-2.5" aria-hidden="true" />
                  <p className="text-sm font-medium text-zinc-300">No setlist archived yet</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Check Similar or Up Next to continue exploring full concerts.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Similar Setlists */}
          {activeTab === 'similar' && (
            <div
              role="tabpanel"
              aria-label="Similar setlists"
              className="space-y-3 max-h-[70vh] overflow-y-auto pr-0.5"
            >
              {similarShows.length > 0 ? (
                similarShows.map(({ group, overlapCount, matchingSongs }) => {
                  const candidate = group.primaryShow;
                  const loc = formatLocation(candidate);
                  return (
                    <button
                      key={group.groupKey}
                      type="button"
                      onClick={() => onSelectShow(candidate)}
                      className="w-full p-3 rounded-xl bg-[#111115] hover:bg-[#17171d] border border-white/[0.08] hover:border-white/[0.18] text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <div className="flex gap-3">
                        <div className="w-28 aspect-video rounded-lg overflow-hidden shrink-0 bg-[#141418] border border-white/[0.07]">
                          <ShowThumbnail show={candidate} compact />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-mono tabular-nums text-zinc-400">
                              {candidate.date}
                            </span>
                            <span className="font-mono tabular-nums text-amber-400 font-medium shrink-0">
                              {overlapCount} shared
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-zinc-100 line-clamp-1 mt-0.5">
                            {group.displayVenue}
                          </h3>
                          {loc && <p className="text-xs text-zinc-500 truncate">{loc}</p>}
                        </div>
                      </div>

                      <p className="mt-2.5 pt-2 border-t border-white/[0.06] text-xs text-zinc-400 line-clamp-2">
                        <span className="text-zinc-500">Matches: </span>
                        {matchingSongs.slice(0, 6).join(' · ')}
                        {matchingSongs.length > 6 ? ` +${matchingSongs.length - 6} more` : ''}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 rounded-xl bg-[#111115] border border-white/[0.08] text-center">
                  <Sparkles className="w-8 h-8 text-zinc-600 mx-auto mb-2.5" aria-hidden="true" />
                  <p className="text-sm font-medium text-zinc-300">
                    No setlist overlap available
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Open a show with a documented setlist to discover concerts sharing the most
                    songs.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Clean Playable-Only Up Next Queue */}
          {activeTab === 'upnext' && (
            <div
              role="tabpanel"
              aria-label="Up next playable shows"
              className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-0.5"
            >
              <p className="text-xs text-zinc-500 px-1 pb-1">
                Playable full concerts ordered by tour proximity and setlist match — archive-only
                records and recaps excluded.
              </p>
              {upNextGroups.map((nextGroup) => {
                const nextItem = nextGroup.primaryShow;
                const nextLoc = formatLocation(nextItem);
                return (
                  <button
                    key={nextGroup.groupKey}
                    type="button"
                    onClick={() => onSelectShow(nextItem)}
                    className="w-full flex gap-3 text-left group rounded-xl p-2 bg-[#111115] hover:bg-[#17171d] border border-white/[0.07] hover:border-white/[0.16] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <div className="w-32 sm:w-36 aspect-video rounded-lg overflow-hidden shrink-0 bg-[#131316] border border-white/[0.07]">
                      <ShowThumbnail show={nextItem} compact />
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-zinc-400 mb-0.5">
                        <span>{nextItem.date}</span>
                        {nextGroup.parts.length > 1 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-amber-300 font-sans">
                              {nextGroup.parts.length} parts
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-100 line-clamp-2 leading-snug group-hover:text-amber-300 transition-colors">
                        {nextGroup.displayVenue}
                      </h3>
                      {nextLoc && (
                        <p className="text-xs text-zinc-500 truncate mt-0.5">{nextLoc}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
