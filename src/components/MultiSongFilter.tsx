import { useMemo, useRef, useState } from 'react';
import { ListMusic, Plus, X } from 'lucide-react';
import { SongIndexEntry } from '../utils/shows';

interface MultiSongFilterProps {
  songIndex: SongIndexEntry[];
  selectedSongs: string[];
  onAddSong: (songTitle: string) => void;
  onRemoveSong: (songTitle: string) => void;
  onClearSongs: () => void;
  compact?: boolean;
}

export function MultiSongFilter({
  songIndex,
  selectedSongs,
  onAddSong,
  onRemoveSong,
  onClearSongs,
  compact = false,
}: MultiSongFilterProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedLower = useMemo(
    () => new Set(selectedSongs.map((s) => s.toLowerCase())),
    [selectedSongs]
  );

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? songIndex.filter(
          (entry) =>
            !selectedLower.has(entry.title.toLowerCase()) &&
            entry.title.toLowerCase().includes(q)
        )
      : songIndex.filter((entry) => !selectedLower.has(entry.title.toLowerCase()));
    return list.slice(0, 8);
  }, [songIndex, query, selectedLower]);

  const handleSelect = (title: string) => {
    onAddSong(title);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`${compact ? 'space-y-2' : 'mb-6'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <ListMusic
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/80 pointer-events-none"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 160)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && suggestions.length > 0) {
                e.preventDefault();
                handleSelect(suggestions[0].title);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            aria-label="Filter shows containing specific songs"
            placeholder={
              selectedSongs.length === 0
                ? 'Setlist Finder: add a song (e.g. Heartbeat Of America)...'
                : 'Add another song (must contain all)...'
            }
            className="w-full h-10 bg-[#121216] border border-white/[0.1] rounded-lg pl-9 pr-3 text-xs md:text-sm text-[#f4f4f0] placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/70 transition-colors"
          />

          {open && suggestions.length > 0 && (
            <ul
              role="listbox"
              aria-label="Song suggestions"
              className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-[#141419] border border-white/[0.12] rounded-xl shadow-2xl py-1 max-h-64 overflow-y-auto"
            >
              {suggestions.map((entry) => (
                <li key={entry.normalized}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(entry.title);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 hover:bg-white/[0.08] text-sm text-zinc-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Plus className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{entry.title}</span>
                    </span>
                    <span className="text-xs font-mono tabular-nums text-zinc-500 shrink-0">
                      {entry.playableShows} videos
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active Multi-Song Filter Controls */}
        {selectedSongs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedSongs.map((song) => (
              <button
                key={song}
                type="button"
                onClick={() => onRemoveSong(song)}
                aria-label={`Remove song filter ${song}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-400/15 border border-amber-400/40 text-xs font-medium text-amber-200 hover:bg-amber-400/25 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{song}</span>
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            ))}

            {selectedSongs.length > 1 && (
              <button
                type="button"
                onClick={onClearSongs}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-4 px-2 py-1 cursor-pointer whitespace-nowrap"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
