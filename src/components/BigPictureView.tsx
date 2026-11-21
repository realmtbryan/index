import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bookmark,
  Disc3,
  Layers,
  ListMusic,
  Monitor,
  Play,
  Shuffle,
  Smartphone,
  Tv,
} from 'lucide-react';
import { GroupedShow, LayoutMode, Show } from '../types';
import {
  CollectionFilter,
  formatLocation,
  formatReadableDate,
  parseSetlist,
} from '../utils/shows';
import { ShowThumbnail } from './ShowThumbnail';

interface BigPictureViewProps {
  groups: GroupedShow[];
  collection: CollectionFilter;
  selectedYear: number | 'All';
  years: number[];
  savedIds: Set<string>;
  selectedSongs: string[];
  playerOpen: boolean;
  onSelectCollection: (collection: CollectionFilter) => void;
  onSelectYear: (year: number | 'All') => void;
  onSelectShow: (show: Show) => void;
  onToggleSave: (showId: string) => void;
  onRandomShow: () => void;
  onSwitchLayoutMode: (mode: LayoutMode) => void;
  onClearSongs: () => void;
}

const TV_NAV_ITEMS: Array<{ id: string; label: string; collection?: CollectionFilter }> = [
  { id: 'video', label: 'Watchable', collection: 'video' },
  { id: 'youtube', label: 'YouTube', collection: 'youtube' },
  { id: 'drive', label: 'Drive Tapes', collection: 'drive' },
  { id: 'setlist', label: 'Setlists', collection: 'setlist' },
  { id: 'saved', label: 'Saved', collection: 'saved' },
  { id: 'random', label: 'Random Show' },
  { id: 'mode-desktop', label: 'Desktop Mode' },
  { id: 'mode-mobile', label: 'Mobile Mode' },
];

const GRID_COLS = 3;

export function BigPictureView({
  groups,
  collection,
  selectedYear,
  years,
  savedIds,
  selectedSongs,
  playerOpen,
  onSelectCollection,
  onSelectYear,
  onSelectShow,
  onToggleSave,
  onRandomShow,
  onSwitchLayoutMode,
  onClearSongs,
}: BigPictureViewProps) {
  const [zone, setZone] = useState<'nav' | 'hero' | 'grid'>('grid');
  const [navIndex, setNavIndex] = useState(0);
  const [heroActionIndex, setHeroActionIndex] = useState(0); // 0 = Play, 1 = Save
  const [gridIndex, setGridIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(36);

  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const navRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const visibleGroups = useMemo(
    () => groups.slice(0, visibleCount),
    [groups, visibleCount]
  );

  // Clamp grid index when filter changes
  useEffect(() => {
    setGridIndex(0);
    setVisibleCount(36);
  }, [collection, selectedYear, selectedSongs.join('|')]);

  const focusedGroup = visibleGroups[gridIndex] ?? visibleGroups[0] ?? null;

  // Auto-expand list when approaching bottom via D-pad
  useEffect(() => {
    if (gridIndex >= visibleGroups.length - 6 && visibleCount < groups.length) {
      setVisibleCount((prev) => Math.min(groups.length, prev + 24));
    }
  }, [gridIndex, visibleGroups.length, visibleCount, groups.length]);

  // Smoothly scroll and move real DOM focus onto the spatially focused control in Big Picture mode
  useEffect(() => {
    if (playerOpen) return;
    if (zone === 'grid' && cardRefs.current[gridIndex]) {
      const el = cardRefs.current[gridIndex];
      el?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
      el?.focus({ preventScroll: true });
    } else if (zone === 'nav' && navRefs.current[navIndex]) {
      navRefs.current[navIndex]?.focus({ preventScroll: true });
    }
  }, [zone, gridIndex, navIndex, playerOpen]);

  const activateNavItem = (index: number) => {
    const item = TV_NAV_ITEMS[index];
    if (!item) return;
    if (item.collection) {
      onSelectCollection(item.collection);
      setZone('grid');
    } else if (item.id === 'random') {
      onRandomShow();
    } else if (item.id === 'mode-desktop') {
      onSwitchLayoutMode('desktop');
    } else if (item.id === 'mode-mobile') {
      onSwitchLayoutMode('mobile');
    }
  };

  // Full 10-ft D-pad / Arrow-key spatial navigation
  useEffect(() => {
    if (playerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (zone === 'nav') {
          setNavIndex((prev) => (prev + 1) % TV_NAV_ITEMS.length);
        } else if (zone === 'hero') {
          setHeroActionIndex((prev) => (prev === 0 ? 1 : 0));
        } else if (visibleGroups.length > 0) {
          setGridIndex((prev) => Math.min(visibleGroups.length - 1, prev + 1));
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (zone === 'nav') {
          setNavIndex((prev) => (prev - 1 + TV_NAV_ITEMS.length) % TV_NAV_ITEMS.length);
        } else if (zone === 'hero') {
          setHeroActionIndex((prev) => (prev === 0 ? 1 : 0));
        } else if (visibleGroups.length > 0) {
          setGridIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (zone === 'nav') {
          setZone(focusedGroup ? 'hero' : 'grid');
        } else if (zone === 'hero') {
          if (visibleGroups.length > 0) setZone('grid');
        } else if (visibleGroups.length > 0) {
          setGridIndex((prev) => Math.min(visibleGroups.length - 1, prev + GRID_COLS));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (zone === 'grid') {
          if (gridIndex >= GRID_COLS) {
            setGridIndex((prev) => prev - GRID_COLS);
          } else {
            setZone('hero');
          }
        } else if (zone === 'hero') {
          setZone('nav');
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (zone === 'nav') {
          activateNavItem(navIndex);
        } else if (zone === 'hero' && focusedGroup) {
          if (heroActionIndex === 0) {
            onSelectShow(focusedGroup.primaryShow);
          } else {
            onToggleSave(focusedGroup.primaryShow.id);
          }
        } else if (zone === 'grid' && focusedGroup) {
          onSelectShow(focusedGroup.primaryShow);
        }
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (zone !== 'nav') {
          setZone('nav');
        } else if (selectedYear !== 'All') {
          onSelectYear('All');
        } else if (selectedSongs.length > 0) {
          onClearSongs();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    playerOpen,
    zone,
    navIndex,
    heroActionIndex,
    gridIndex,
    visibleGroups.length,
    focusedGroup,
    selectedYear,
    selectedSongs.length,
    onSelectShow,
    onToggleSave,
    onSelectYear,
    onClearSongs,
  ]);

  const heroShow = focusedGroup?.primaryShow ?? null;
  const heroSongs = heroShow ? parseSetlist(heroShow.setlist) : [];
  const heroSaved = heroShow ? savedIds.has(heroShow.id) : false;

  return (
    <div
      data-testid="big-picture-view"
      className="min-h-screen bg-[#070709] text-[#f4f4f0] flex flex-col px-6 md:px-12 py-6"
    >
      {/* Top Big Picture Bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/[0.1]">
        <div className="flex items-center gap-3 shrink-0">
          <Disc3 className="w-8 h-8 text-amber-400" aria-hidden="true" />
          <span className="font-serif text-2xl font-semibold tracking-tight text-[#f4f4f0]">
            StringsArchive
          </span>
          <span aria-hidden="true" className="text-zinc-600">·</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300">
            <Tv className="w-4 h-4" aria-hidden="true" />
            <span>Big Picture</span>
          </span>
        </div>

        <nav
          aria-label="Big Picture navigation"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
        >
          {TV_NAV_ITEMS.map((item, idx) => {
            const isNavFocused = zone === 'nav' && navIndex === idx;
            const isActiveCollection = item.collection && collection === item.collection;

            return (
              <button
                key={item.id}
                ref={(el) => {
                  navRefs.current[idx] = el;
                }}
                type="button"
                onClick={() => {
                  setNavIndex(idx);
                  activateNavItem(idx);
                }}
                className={`h-11 px-4 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer inline-flex items-center gap-2 ${
                  isNavFocused
                    ? 'bg-amber-400 text-zinc-950 ring-4 ring-amber-300/60 scale-[1.03]'
                    : isActiveCollection
                    ? 'bg-white/[0.16] text-white border border-white/25'
                    : 'bg-[#131318] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.12]'
                }`}
              >
                {item.id === 'random' && <Shuffle className="w-4 h-4" aria-hidden="true" />}
                {item.id === 'mode-desktop' && <Monitor className="w-4 h-4" aria-hidden="true" />}
                {item.id === 'mode-mobile' && <Smartphone className="w-4 h-4" aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      {/* Tour Year Quick Row */}
      <div className="flex items-center gap-4 py-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelectYear('All')}
            className={`h-10 px-4 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              selectedYear === 'All'
                ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50'
                : 'bg-[#121217] text-zinc-400 border border-white/[0.08] hover:text-white'
            }`}
          >
            All Years
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              onClick={() => onSelectYear(year)}
              className={`h-10 px-4 rounded-lg text-sm font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedYear === year
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/50 font-semibold'
                  : 'bg-[#121217] text-zinc-400 border border-white/[0.08] hover:text-white'
              }`}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="hidden xl:flex items-center gap-2.5 text-xs text-zinc-400 pl-4 border-l border-white/[0.08] shrink-0 font-mono">
          <span>Arrows Navigate</span>
          <span aria-hidden="true">·</span>
          <span>Enter Play</span>
          <span aria-hidden="true">·</span>
          <span>Esc Top Bar</span>
        </div>
      </div>

      {/* Oversized Hero Spotlight for Focused Show */}
      {focusedGroup && heroShow && (
        <section
          aria-label="Featured show"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch p-5 md:p-6 rounded-2xl bg-[#111116] border border-white/[0.1] mb-8"
        >
          <div className="lg:col-span-5 aspect-video rounded-xl overflow-hidden border border-white/[0.1] bg-black">
            <ShowThumbnail
              show={heroShow}
              partCount={
                focusedGroup.playablePartCount > 1
                  ? focusedGroup.playablePartCount
                  : focusedGroup.parts.length
              }
              hasChapters={focusedGroup.hasChapters}
            />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between gap-4 min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-2.5 text-sm font-mono tabular-nums text-amber-400 mb-2">
                <span>{formatReadableDate(heroShow.date)}</span>
                {formatLocation(heroShow) && (
                  <>
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className="font-sans text-zinc-300">{formatLocation(heroShow)}</span>
                  </>
                )}
                {focusedGroup.parts.length > 1 && (
                  <>
                    <span aria-hidden="true" className="text-zinc-600">·</span>
                    <span className="inline-flex items-center gap-1 text-amber-300 font-sans">
                      <Layers className="w-4 h-4" aria-hidden="true" />
                      {focusedGroup.parts.length} parts
                    </span>
                  </>
                )}
              </div>

              <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-[#f4f4f0] text-balance">
                {focusedGroup.displayVenue}
              </h1>

              {heroSongs.length > 0 && (
                <p className="text-sm text-zinc-400 mt-3 line-clamp-2 leading-relaxed">
                  <ListMusic
                    className="w-4 h-4 inline-block text-amber-400 mr-1.5 -mt-0.5"
                    aria-hidden="true"
                  />
                  {heroSongs.slice(0, 10).join(' · ')}
                  {heroSongs.length > 10 ? ` · +${heroSongs.length - 10} more` : ''}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onSelectShow(heroShow)}
                className={`inline-flex items-center gap-2.5 h-12 px-7 rounded-xl font-semibold text-base transition-all cursor-pointer ${
                  zone === 'hero' && heroActionIndex === 0
                    ? 'bg-amber-400 text-zinc-950 ring-4 ring-amber-300/70 scale-[1.03]'
                    : 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                }`}
              >
                <Play className="w-5 h-5 fill-zinc-950" aria-hidden="true" />
                <span>Play Concert</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleSave(heroShow.id)}
                className={`inline-flex items-center gap-2 h-12 px-6 rounded-xl font-semibold text-base transition-all cursor-pointer ${
                  zone === 'hero' && heroActionIndex === 1
                    ? 'bg-white text-zinc-950 ring-4 ring-amber-400 scale-[1.03]'
                    : heroSaved
                    ? 'bg-white/[0.16] text-amber-300 border border-amber-400/50'
                    : 'bg-white/[0.08] hover:bg-white/[0.16] text-white'
                }`}
              >
                <Bookmark
                  className={`w-5 h-5 ${heroSaved ? 'fill-amber-300' : ''}`}
                  aria-hidden="true"
                />
                <span>{heroSaved ? 'Saved' : 'Save Show'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Oversized Lean-Back Grid */}
      {visibleGroups.length > 0 ? (
        <div
          data-testid="tv-shows-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-16"
        >
          {visibleGroups.map((group, idx) => {
            const show = group.primaryShow;
            const isFocused = zone === 'grid' && gridIndex === idx;
            const loc = formatLocation(show);

            return (
              <button
                key={group.groupKey}
                ref={(el) => {
                  cardRefs.current[idx] = el;
                }}
                type="button"
                onFocus={() => {
                  setZone('grid');
                  setGridIndex(idx);
                }}
                onMouseEnter={() => {
                  setZone('grid');
                  setGridIndex(idx);
                }}
                onClick={() => onSelectShow(show)}
                aria-label={`Play ${group.displayVenue} on ${show.date}`}
                className={`text-left rounded-2xl p-3 transition-all cursor-pointer focus:outline-none ${
                  isFocused
                    ? 'bg-[#181820] ring-4 ring-amber-400 scale-[1.02] shadow-2xl'
                    : 'bg-[#111116] border border-white/[0.08] hover:border-white/25'
                }`}
              >
                <div className="aspect-video w-full rounded-xl overflow-hidden mb-3 bg-black">
                  <ShowThumbnail
                    show={show}
                    partCount={
                      group.playablePartCount > 1
                        ? group.playablePartCount
                        : group.parts.length
                    }
                    hasChapters={group.hasChapters}
                  />
                </div>

                <div className="px-1">
                  <p className="text-sm font-mono tabular-nums text-amber-400">
                    {show.date}
                    {loc ? ` · ${loc}` : ''}
                  </p>
                  <h2 className="font-serif text-xl font-semibold text-[#f4f4f0] line-clamp-1 mt-1">
                    {group.displayVenue}
                  </h2>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="font-serif text-2xl text-zinc-200">No shows in this shelf</p>
          <p className="text-sm text-zinc-400 mt-2">
            Switch categories above or press Escape to browse Watchable Shows.
          </p>
        </div>
      )}
    </div>
  );
}
