/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  Disc3,
  Monitor,
  Search,
  Shuffle,
  Smartphone,
  Tv,
  X,
} from 'lucide-react';
import { SHOWS } from './data/shows';
import { CustomShowTiming, LayoutMode, Show } from './types';
import {
  CollectionFilter,
  SortOrder,
  buildSongIndex,
  computeGroupedArchiveStats,
  countHiddenArchiveMatches,
  filterAndSortGroupedShows,
  getPerformanceGroupKey,
  groupShowsByPerformance,
  isRecapOrPromo,
  pickRandomPlayableGroup,
} from './utils/shows';
import {
  detectCurrentBrowserProfile,
  hasAutostartFlag,
  LAYOUT_MODE_LABELS,
  parseModeFromQuery,
} from './utils/device';
import {
  loadAutoAdvanceParts,
  loadCustomStreams,
  loadCustomTimings,
  loadLayoutMode,
  loadRecentIds,
  loadSavedIds,
  loadSyncOffsets,
  persistAutoAdvanceParts,
  persistCustomStream,
  persistCustomTiming,
  persistLayoutMode,
  persistRecentIds,
  persistSavedIds,
  persistSyncOffset,
  recordRecentId,
  toggleSavedId,
} from './utils/storage';
import { ShowCard } from './components/ShowCard';
import { Sidebar } from './components/Sidebar';
import { PlayerModal } from './components/PlayerModal';
import { DeviceLander } from './components/DeviceLander';
import { MultiSongFilter } from './components/MultiSongFilter';
import { BigPictureView } from './components/BigPictureView';
import { MobileNavBar } from './components/MobileNavBar';

const PAGE_SIZE = 48;

const COLLECTION_META: Record<
  CollectionFilter,
  { title: string; subtitle: string }
> = {
  video: {
    title: 'Watchable Concert Archive',
    subtitle:
      'Full-length concert recordings playable directly from YouTube and Google Drive — recaps and promos hidden.',
  },
  youtube: {
    title: 'YouTube Recordings',
    subtitle:
      'Full live sets, festival streams, and multi-part audience tapers hosted on YouTube.',
  },
  drive: {
    title: 'Google Drive Tapes',
    subtitle: 'Archived full-concert video captures stored on Google Drive.',
  },
  setlist: {
    title: 'Shows with Setlists',
    subtitle:
      'Concerts with track-by-track setlists. Jump directly to songs inside the player or filter by multiple songs below.',
  },
  all: {
    title: 'Complete Chronological Archive',
    subtitle:
      'Every documented full Billy Strings performance from 2012 through 2026 (recaps hidden).',
  },
  none: {
    title: 'Archive Records (No Video)',
    subtitle: 'Historical tour dates and setlist entries without linked video footage.',
  },
  saved: {
    title: 'Saved Shows',
    subtitle: 'Your bookmarked concerts stored locally in this browser.',
  },
  recent: {
    title: 'Recently Watched',
    subtitle: 'Shows you opened recently, ordered from most recent.',
  },
};

export default function App() {
  // Globally collapse multi-part performances and filter out all recaps/promos
  const allGroups = useMemo(() => groupShowsByPerformance(SHOWS, false), []);
  const hiddenRecapCount = useMemo(
    () => SHOWS.filter((s) => isRecapOrPromo(s)).length,
    []
  );
  const stats = useMemo(
    () => computeGroupedArchiveStats(allGroups, hiddenRecapCount),
    [allGroups, hiddenRecapCount]
  );
  const songIndex = useMemo(() => buildSongIndex(allGroups), [allGroups]);

  // Adaptive Device Profile Detection + First-Visit Confirmation Lander
  const detectedMode = useMemo<LayoutMode>(() => detectCurrentBrowserProfile(), []);
  const initialQueryMode = useMemo(
    () => parseModeFromQuery(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );
  const initialAutostart = useMemo(
    () => hasAutostartFlag(typeof window !== 'undefined' ? window.location.search : ''),
    []
  );

  const [savedMode, setSavedMode] = useState<LayoutMode | null>(() => loadLayoutMode());
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(
    () => initialQueryMode ?? loadLayoutMode() ?? detectedMode
  );
  const [showLander, setShowLander] = useState<boolean>(
    () => !initialQueryMode && !initialAutostart && loadLayoutMode() === null
  );
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  const [selectedShow, setSelectedShow] = useState<Show | null>(() => {
    try {
      const showParam = new URLSearchParams(window.location.search).get('show');
      if (showParam) {
        const direct = SHOWS.find((s) => s.id === showParam);
        if (direct && !isRecapOrPromo(direct)) return direct;
      }
    } catch {
      // Ignore URL parsing errors
    }
    return null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'All'>('All');
  const [collection, setCollection] = useState<CollectionFilter>('video');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Persistent local state
  const [savedIdList, setSavedIdList] = useState<string[]>(() => loadSavedIds());
  const [recentIdList, setRecentIdList] = useState<string[]>(() => loadRecentIds());
  const [syncOffsets, setSyncOffsets] = useState<Record<string, number>>(() =>
    loadSyncOffsets()
  );
  const [customStreams, setCustomStreams] = useState<Record<string, string>>(() =>
    loadCustomStreams()
  );
  const [customTimings, setCustomTimings] = useState<Record<string, CustomShowTiming>>(
    () => loadCustomTimings()
  );
  const [autoAdvanceParts, setAutoAdvanceParts] = useState<boolean>(() =>
    loadAutoAdvanceParts()
  );

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const savedIds = useMemo(() => new Set(savedIdList), [savedIdList]);

  // Sync ?show= query param & record recently watched
  useEffect(() => {
    if (selectedShow) {
      setRecentIdList((prev) => {
        const next = recordRecentId(prev, selectedShow.id);
        persistRecentIds(next);
        return next;
      });
    }

    try {
      const url = new URL(window.location.href);
      if (selectedShow) {
        url.searchParams.set('show', selectedShow.id);
      } else {
        url.searchParams.delete('show');
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore history errors
    }
  }, [selectedShow?.id]);

  // Press "/" outside inputs to focus search in desktop/mobile browse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedShow || showLander || layoutMode === 'tv') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShow, showLander, layoutMode]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedSongs, selectedYear, collection, sortOrder]);

  const filteredGroups = useMemo(
    () =>
      filterAndSortGroupedShows(allGroups, {
        searchQuery,
        selectedYear,
        collection,
        sortOrder,
        savedIds,
        recentIds: recentIdList,
        selectedSongs,
      }),
    [allGroups, searchQuery, selectedYear, collection, sortOrder, savedIds, recentIdList, selectedSongs]
  );

  const hiddenArchiveMatches = useMemo(
    () =>
      countHiddenArchiveMatches(
        allGroups,
        searchQuery,
        selectedYear,
        collection,
        selectedSongs
      ),
    [allGroups, searchQuery, selectedYear, collection, selectedSongs]
  );

  const visibleGroups = useMemo(
    () => filteredGroups.slice(0, visibleCount),
    [filteredGroups, visibleCount]
  );

  const handleConfirmMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    setSavedMode(mode);
    persistLayoutMode(mode);
    setShowLander(false);
  };

  const handleSwitchMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    setSavedMode(mode);
    persistLayoutMode(mode);
    setModeMenuOpen(false);
  };

  const handleToggleSave = (showId: string) => {
    setSavedIdList((prev) => {
      const next = toggleSavedId(prev, showId);
      persistSavedIds(next);
      return next;
    });
  };

  const handleRandomShow = () => {
    const excludeKey = selectedShow ? getPerformanceGroupKey(selectedShow) : undefined;
    const picked = pickRandomPlayableGroup(filteredGroups, allGroups, excludeKey);
    if (picked) {
      setSelectedShow(picked.primaryShow);
    }
  };

  const handleAddSongFilter = (song: string) => {
    setSelectedSongs((prev) => {
      if (prev.some((s) => s.toLowerCase() === song.toLowerCase())) return prev;
      return [...prev, song];
    });
  };

  const handleRemoveSongFilter = (song: string) => {
    setSelectedSongs((prev) =>
      prev.filter((s) => s.toLowerCase() !== song.toLowerCase())
    );
  };

  /**
   * Secondary action from a song row inside PlayerModal:
   * Filter the archive to all playable shows featuring that song.
   */
  const handleFindSongPerformances = (song: string) => {
    setSelectedShow(null);
    setCollection('video');
    setSelectedYear('All');
    setSearchQuery('');
    setSelectedSongs([song]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleChangeSyncOffset = (
    showId: string,
    offsetOrUpdater: number | ((prev: number) => number)
  ) => {
    setSyncOffsets((prev) => {
      const current = prev[showId] ?? 0;
      const nextVal =
        typeof offsetOrUpdater === 'function' ? offsetOrUpdater(current) : offsetOrUpdater;
      return persistSyncOffset(showId, nextVal);
    });
  };

  const handleSaveCustomStream = (showId: string, url: string | null) => {
    setCustomStreams(persistCustomStream(showId, url));
  };

  const handleSaveCustomTiming = (showId: string, timing: CustomShowTiming | null) => {
    setCustomTimings(persistCustomTiming(showId, timing));
  };

  const handleToggleAutoAdvance = (enabled: boolean) => {
    setAutoAdvanceParts(enabled);
    persistAutoAdvanceParts(enabled);
  };

  const resetFilters = () => {
    setSelectedShow(null);
    setSelectedYear('All');
    setCollection('video');
    setSearchQuery('');
    setSelectedSongs([]);
  };

  const currentMeta = COLLECTION_META[collection];
  const isMobileMode = layoutMode === 'mobile';
  const ModeIcon =
    layoutMode === 'tv' ? Tv : layoutMode === 'mobile' ? Smartphone : Monitor;

  const yearNumbers = useMemo(() => stats.years.map((y) => y.year), [stats.years]);

  // First-visit Adaptive Device Lander
  if (showLander) {
    return (
      <DeviceLander
        detectedMode={detectedMode}
        playableCount={stats.videoCount}
        onConfirm={handleConfirmMode}
      />
    );
  }

  return (
    <div
      data-layout-mode={layoutMode}
      data-saved-mode={savedMode ?? 'auto'}
      className="min-h-screen bg-[#09090b] text-[#f4f4f0] flex flex-col overflow-x-hidden"
    >
      {layoutMode === 'tv' ? (
        <BigPictureView
          groups={filteredGroups}
          collection={collection}
          selectedYear={selectedYear}
          years={yearNumbers}
          savedIds={savedIds}
          selectedSongs={selectedSongs}
          playerOpen={Boolean(selectedShow)}
          onSelectCollection={setCollection}
          onSelectYear={setSelectedYear}
          onSelectShow={setSelectedShow}
          onToggleSave={handleToggleSave}
          onRandomShow={handleRandomShow}
          onSwitchLayoutMode={handleSwitchMode}
          onClearSongs={() => setSelectedSongs([])}
        />
      ) : (
        <>
          {/* Sticky Single-Row Top Bar */}
          <header
            className={`sticky top-0 z-40 ${
              isMobileMode ? 'h-14 px-3' : 'h-16 px-4 lg:px-6'
            } bg-[#09090b]/95 backdrop-blur-md border-b border-white/[0.08] flex items-center justify-between gap-3 md:gap-6`}
          >
            {/* Zone 1: Brand Wordmark */}
            <button
              type="button"
              onClick={resetFilters}
              className="flex items-center gap-2 text-left whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-md"
            >
              <Disc3 className="w-5 h-5 md:w-6 md:h-6 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="font-serif text-base md:text-xl font-semibold tracking-tight text-[#f4f4f0]">
                StringsArchive
              </span>
            </button>

            {/* Zone 2: Integrated Search */}
            <div className="flex-1 max-w-xl min-w-0">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search shows, venues, cities, dates, or songs"
                  placeholder={
                    isMobileMode
                      ? 'Search venue, city, song...'
                      : 'Search venue, city, song, or date...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 md:h-10 bg-[#141418] border border-white/[0.1] rounded-lg pl-9 pr-8 text-sm text-[#f4f4f0] placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                ) : (
                  <kbd className="hidden md:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-zinc-500 border border-white/[0.1] rounded px-1.5 py-0.5 pointer-events-none">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Zone 3: Mode Switcher + Random Show Action */}
            <div className="flex items-center gap-2 shrink-0 relative">
              {!isMobileMode && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={modeMenuOpen}
                    aria-label={`Layout mode: ${LAYOUT_MODE_LABELS[layoutMode]}`}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg bg-[#141418] hover:bg-white/[0.08] border border-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <ModeIcon className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    <span className="hidden md:inline">{LAYOUT_MODE_LABELS[layoutMode]}</span>
                  </button>

                  {modeMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Select layout mode"
                      className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#14141a] border border-white/[0.12] shadow-2xl py-1.5 z-50"
                    >
                      {(
                        [
                          { id: 'desktop' as const, label: 'Desktop Theater', icon: Monitor },
                          { id: 'tv' as const, label: 'TV / Big Picture', icon: Tv },
                          { id: 'mobile' as const, label: 'Mobile Touch', icon: Smartphone },
                        ] as const
                      ).map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={layoutMode === id}
                          onClick={() => handleSwitchMode(id)}
                          className={`w-full px-3.5 py-2.5 text-left text-xs flex items-center justify-between gap-2 hover:bg-white/[0.08] cursor-pointer ${
                            layoutMode === id
                              ? 'text-amber-300 font-semibold'
                              : 'text-zinc-200'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2.5">
                            <Icon className="w-4 h-4" aria-hidden="true" />
                            <span>{label}</span>
                          </span>
                          {layoutMode === id && <span>Active</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleRandomShow}
                aria-label="Random Show"
                title="Play a random full concert"
                className="inline-flex items-center gap-2 h-9 md:h-10 px-3 md:px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs md:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
              >
                <Shuffle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Random Show</span>
              </button>
            </div>
          </header>

          <div className="flex flex-1 min-w-0">
            {/* Desktop Sidebar (hidden in explicit Mobile Mode) */}
            {!isMobileMode && (
              <Sidebar
                stats={stats}
                collection={collection}
                selectedYear={selectedYear}
                savedCount={savedIdList.length}
                recentCount={recentIdList.length}
                onSelectCollection={setCollection}
                onSelectYear={setSelectedYear}
              />
            )}

            {/* Main Browse Workspace */}
            <main
              className={`flex-1 min-w-0 px-4 md:px-8 py-5 md:py-7 ${
                isMobileMode ? 'pb-20' : ''
              }`}
            >
              {/* Responsive Collection & Year Strip on smaller Desktop screens */}
              {!isMobileMode && (
                <div className="lg:hidden space-y-2.5 mb-5">
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {(
                      [
                        { id: 'video', label: 'Watchable' },
                        { id: 'youtube', label: 'YouTube' },
                        { id: 'drive', label: 'Drive' },
                        { id: 'setlist', label: 'Setlists' },
                        { id: 'all', label: 'All Archive' },
                        { id: 'saved', label: `Saved (${savedIdList.length})` },
                      ] as Array<{ id: CollectionFilter; label: string }>
                    ).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCollection(item.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                          collection === item.id
                            ? 'bg-[#f4f4f0] text-zinc-950 font-semibold'
                            : 'bg-[#141418] text-zinc-300 border border-white/[0.08]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Heading & Sort Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-white/[0.08] mb-5">
                <div className="min-w-0">
                  <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-[#f4f4f0] text-balance">
                    {selectedSongs.length > 0
                      ? `Shows featuring ${selectedSongs.join(' + ')}`
                      : searchQuery.trim()
                      ? `Results for “${searchQuery.trim()}”`
                      : selectedYear === 'All'
                      ? currentMeta.title
                      : `${selectedYear} · ${currentMeta.title}`}
                  </h1>
                  <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
                    {selectedSongs.length > 0
                      ? `Showing ${
                          collection === 'all' ? 'all archive' : 'playable'
                        } performances containing every selected song.`
                      : searchQuery.trim()
                      ? `Matching venues, cities, dates, and setlists across ${
                          selectedYear === 'All' ? 'all tour years' : selectedYear
                        }.`
                      : currentMeta.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono tabular-nums text-zinc-400">
                    {filteredGroups.length.toLocaleString()}{' '}
                    {filteredGroups.length === 1 ? 'show' : 'shows'}
                  </span>

                  {collection !== 'recent' && (
                    <button
                      type="button"
                      onClick={() =>
                        setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
                      }
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#141418] hover:bg-white/[0.08] border border-white/[0.09] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                      <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Song Setlist Finder (inline on Desktop, also in Filter Sheet on Mobile) */}
              {!isMobileMode && (
                <MultiSongFilter
                  songIndex={songIndex}
                  selectedSongs={selectedSongs}
                  onAddSong={handleAddSongFilter}
                  onRemoveSong={handleRemoveSongFilter}
                  onClearSongs={() => setSelectedSongs([])}
                />
              )}

              {/* Active mobile song filter strip if songs selected */}
              {isMobileMode && selectedSongs.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  {selectedSongs.map((song) => (
                    <button
                      key={song}
                      type="button"
                      onClick={() => handleRemoveSongFilter(song)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-400/15 border border-amber-400/40 text-xs font-medium text-amber-200 cursor-pointer"
                    >
                      <span>{song}</span>
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}

              {/* Escape Hatch for Hidden Archive-Only Matches */}
              {hiddenArchiveMatches > 0 && (
                <div className="mb-6 px-4 py-3 rounded-xl bg-[#141418] border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className="text-zinc-300">
                    <span className="font-mono tabular-nums text-amber-300">
                      +{hiddenArchiveMatches}
                    </span>{' '}
                    archive-only {hiddenArchiveMatches === 1 ? 'record' : 'records'} without video
                    also match.
                  </span>
                  <button
                    type="button"
                    onClick={() => setCollection('all')}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4 cursor-pointer whitespace-nowrap"
                  >
                    Include archive-only shows
                  </button>
                </div>
              )}

              {/* Unified Show Grid */}
              {visibleGroups.length > 0 ? (
                <>
                  <div
                    data-testid="shows-grid"
                    className={
                      isMobileMode
                        ? 'grid grid-cols-1 gap-y-6'
                        : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-x-5 gap-y-8'
                    }
                  >
                    {visibleGroups.map((group) => (
                      <ShowCard
                        key={group.groupKey}
                        group={group}
                        isSaved={group.parts.some((p) => savedIds.has(p.id))}
                        onSelect={setSelectedShow}
                        onToggleSave={handleToggleSave}
                      />
                    ))}
                  </div>

                  {visibleCount < filteredGroups.length && (
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-10 pb-6">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="h-11 px-5 rounded-lg bg-white/[0.1] hover:bg-white/[0.16] text-sm font-medium text-[#f4f4f0] transition-colors cursor-pointer"
                      >
                        Load More ({(filteredGroups.length - visibleCount).toLocaleString()} remaining)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVisibleCount(filteredGroups.length)}
                        className="h-11 px-5 rounded-lg border border-white/[0.1] hover:bg-white/[0.06] text-sm text-zinc-300 transition-colors cursor-pointer"
                      >
                        Show All ({filteredGroups.length.toLocaleString()})
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  {collection === 'saved' ? (
                    <>
                      <Bookmark className="w-10 h-10 text-zinc-600 mb-3" aria-hidden="true" />
                      <p className="font-serif text-lg text-zinc-200 mb-1">No saved shows yet</p>
                      <p className="text-sm text-zinc-500 max-w-sm">
                        Bookmark any concert from the grid or inside the player to build your
                        personal library.
                      </p>
                    </>
                  ) : (
                    <>
                      <Search className="w-10 h-10 text-zinc-600 mb-3" aria-hidden="true" />
                      <p className="font-serif text-lg text-zinc-200 mb-1">
                        No matching shows found
                      </p>
                      <p className="text-sm text-zinc-500 max-w-sm">
                        Try clearing a song filter, broadening your search, or checking the full
                        2012–2026 archive.
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="mt-5 h-10 px-4 rounded-lg bg-white/[0.1] hover:bg-white/[0.16] text-sm font-medium text-white transition-colors cursor-pointer"
                  >
                    Browse Watchable Shows
                  </button>
                </div>
              )}
            </main>
          </div>

          {/* Mobile Mode Thumb-Friendly Bottom Nav & Sheets */}
          {isMobileMode && !selectedShow && (
            <MobileNavBar
              stats={stats}
              collection={collection}
              selectedYear={selectedYear}
              sortOrder={sortOrder}
              savedCount={savedIdList.length}
              recentCount={recentIdList.length}
              layoutMode={layoutMode}
              songIndex={songIndex}
              selectedSongs={selectedSongs}
              onSelectCollection={setCollection}
              onSelectYear={setSelectedYear}
              onToggleSort={() =>
                setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
              }
              onAddSong={handleAddSongFilter}
              onRemoveSong={handleRemoveSongFilter}
              onClearSongs={() => setSelectedSongs([])}
              onSwitchLayoutMode={handleSwitchMode}
            />
          )}
        </>
      )}

      {/* Seamless Chapterized Concert Player */}
      {selectedShow && (
        <PlayerModal
          show={selectedShow}
          layoutMode={layoutMode}
          filteredGroups={filteredGroups}
          allGroups={allGroups}
          isSaved={savedIds.has(selectedShow.id)}
          syncOffset={syncOffsets[selectedShow.id] ?? 0}
          customStreamUrl={customStreams[selectedShow.id]}
          customTiming={customTimings[selectedShow.id]}
          autoAdvanceParts={autoAdvanceParts}
          onClose={() => setSelectedShow(null)}
          onSelectShow={setSelectedShow}
          onToggleSave={handleToggleSave}
          onFindSongPerformances={handleFindSongPerformances}
          onChangeSyncOffset={handleChangeSyncOffset}
          onSaveCustomStream={handleSaveCustomStream}
          onSaveCustomTiming={handleSaveCustomTiming}
          onToggleAutoAdvance={handleToggleAutoAdvance}
        />
      )}
    </div>
  );
}
