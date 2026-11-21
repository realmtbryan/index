import { useState } from 'react';
import {
  ArrowUpDown,
  Bookmark,
  Compass,
  Monitor,
  SlidersHorizontal,
  Smartphone,
  Tv,
  X,
} from 'lucide-react';
import { LayoutMode } from '../types';
import {
  ArchiveStats,
  CollectionFilter,
  SongIndexEntry,
  SortOrder,
} from '../utils/shows';
import { MultiSongFilter } from './MultiSongFilter';

interface MobileNavBarProps {
  stats: ArchiveStats;
  collection: CollectionFilter;
  selectedYear: number | 'All';
  sortOrder: SortOrder;
  savedCount: number;
  recentCount: number;
  layoutMode: LayoutMode;
  songIndex: SongIndexEntry[];
  selectedSongs: string[];
  onSelectCollection: (collection: CollectionFilter) => void;
  onSelectYear: (year: number | 'All') => void;
  onToggleSort: () => void;
  onAddSong: (song: string) => void;
  onRemoveSong: (song: string) => void;
  onClearSongs: () => void;
  onSwitchLayoutMode: (mode: LayoutMode) => void;
}

const COLLECTION_OPTIONS: Array<{ id: CollectionFilter; label: string }> = [
  { id: 'video', label: 'Watchable Shows' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'drive', label: 'Google Drive' },
  { id: 'setlist', label: 'With Setlist' },
  { id: 'all', label: 'Full Archive' },
  { id: 'recent', label: 'Recently Watched' },
];

export function MobileNavBar({
  stats,
  collection,
  selectedYear,
  sortOrder,
  savedCount,
  layoutMode,
  songIndex,
  selectedSongs,
  onSelectCollection,
  onSelectYear,
  onToggleSort,
  onAddSong,
  onRemoveSong,
  onClearSongs,
  onSwitchLayoutMode,
}: MobileNavBarProps) {
  const [sheet, setSheet] = useState<'none' | 'filters' | 'mode'>('none');

  const activeFilterCount =
    (selectedYear !== 'All' ? 1 : 0) +
    selectedSongs.length +
    (collection !== 'video' && collection !== 'saved' ? 1 : 0);

  return (
    <>
      {/* Compact 56px Thumb-Friendly Bottom Tab Bar (keeps aggregate sticky <= 15% of viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 h-14 bg-[#0b0b0e]/95 backdrop-blur-md border-t border-white/[0.1] grid grid-cols-4 items-center px-1"
      >
        <button
          type="button"
          onClick={() => {
            onSelectCollection('video');
            setSheet('none');
          }}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            collection !== 'saved' && sheet === 'none'
              ? 'text-amber-400'
              : 'text-zinc-400'
          }`}
        >
          <Compass className="w-5 h-5" aria-hidden="true" />
          <span>Browse</span>
        </button>

        <button
          type="button"
          onClick={() => setSheet((prev) => (prev === 'filters' ? 'none' : 'filters'))}
          aria-expanded={sheet === 'filters'}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            sheet === 'filters' || activeFilterCount > 0
              ? 'text-amber-400'
              : 'text-zinc-400'
          }`}
        >
          <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
          <span>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            onSelectCollection('saved');
            setSheet('none');
          }}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            collection === 'saved' && sheet === 'none'
              ? 'text-amber-400'
              : 'text-zinc-400'
          }`}
        >
          <Bookmark className="w-5 h-5" aria-hidden="true" />
          <span>Saved{savedCount > 0 ? ` (${savedCount})` : ''}</span>
        </button>

        <button
          type="button"
          onClick={() => setSheet((prev) => (prev === 'mode' ? 'none' : 'mode'))}
          aria-expanded={sheet === 'mode'}
          className={`h-12 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium cursor-pointer ${
            sheet === 'mode' ? 'text-amber-400' : 'text-zinc-400'
          }`}
        >
          <Smartphone className="w-5 h-5" aria-hidden="true" />
          <span>Layout</span>
        </button>
      </nav>

      {/* Slide-Up Filter & Setlist Finder Bottom Sheet */}
      {sheet === 'filters' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter shows and setlists"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end"
          onClick={() => setSheet('none')}
        >
          <div
            className="w-full max-h-[82vh] bg-[#121216] border-t border-white/[0.12] rounded-t-3xl p-5 overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1 mb-1" />

            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-[#f4f4f0]">
                Filter &amp; Setlist Finder
              </h2>
              <button
                type="button"
                onClick={() => setSheet('none')}
                aria-label="Close filters"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/[0.08] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">Multi-Song Finder</p>
              <MultiSongFilter
                songIndex={songIndex}
                selectedSongs={selectedSongs}
                onAddSong={onAddSong}
                onRemoveSong={onRemoveSong}
                onClearSongs={onClearSongs}
                compact
              />
            </div>

            <div>
              <p className="text-xs font-medium text-zinc-400 mb-2">Collection</p>
              <div className="grid grid-cols-2 gap-2">
                {COLLECTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectCollection(opt.id)}
                    className={`h-11 px-3 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      collection === opt.id
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'bg-[#1a1a22] text-zinc-300 border border-white/[0.08]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-zinc-400">Tour Year</p>
                <button
                  type="button"
                  onClick={onToggleSort}
                  className="inline-flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectYear('All')}
                  className={`h-10 px-3.5 rounded-xl text-xs font-medium cursor-pointer ${
                    selectedYear === 'All'
                      ? 'bg-amber-400 text-zinc-950 font-semibold'
                      : 'bg-[#1a1a22] text-zinc-300 border border-white/[0.08]'
                  }`}
                >
                  All Years
                </button>
                {stats.years.map((y) => (
                  <button
                    key={y.year}
                    type="button"
                    onClick={() => onSelectYear(y.year)}
                    className={`h-10 px-3.5 rounded-xl text-xs font-mono tabular-nums cursor-pointer ${
                      selectedYear === y.year
                        ? 'bg-amber-400 text-zinc-950 font-semibold'
                        : 'bg-[#1a1a22] text-zinc-300 border border-white/[0.08]'
                    }`}
                  >
                    {y.year}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSheet('none')}
              className="w-full h-12 rounded-xl bg-amber-400 text-zinc-950 font-semibold text-sm cursor-pointer"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Slide-Up Layout Mode Switcher Sheet */}
      {sheet === 'mode' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Switch viewing layout"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end"
          onClick={() => setSheet('none')}
        >
          <div
            className="w-full bg-[#121216] border-t border-white/[0.12] rounded-t-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto -mt-1" />
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold text-[#f4f4f0]">
                Switch Layout Mode
              </h2>
              <button
                type="button"
                onClick={() => setSheet('none')}
                aria-label="Close layout sheet"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(
                [
                  { id: 'mobile' as const, label: 'Mobile Touch', desc: 'Thumb nav & stacked player', icon: Smartphone },
                  { id: 'desktop' as const, label: 'Desktop Theater', desc: 'Sidebar & side-by-side setlist', icon: Monitor },
                  { id: 'tv' as const, label: 'TV / Big Picture', desc: '10-ft D-pad & oversized cards', icon: Tv },
                ] as const
              ).map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSwitchLayoutMode(id);
                    setSheet('none');
                  }}
                  className={`w-full flex items-center gap-3.5 p-4 rounded-xl text-left transition-colors cursor-pointer ${
                    layoutMode === id
                      ? 'bg-amber-400/15 border border-amber-400/50 text-amber-200'
                      : 'bg-[#1a1a22] border border-white/[0.08] text-zinc-200'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0 text-amber-400" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs text-zinc-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
