import {
  Archive,
  Bookmark,
  Clock,
  Film,
  HardDrive,
  ListMusic,
  PlayCircle,
  Youtube,
} from 'lucide-react';
import { ArchiveStats, CollectionFilter } from '../utils/shows';

interface SidebarProps {
  stats: ArchiveStats;
  collection: CollectionFilter;
  selectedYear: number | 'All';
  savedCount: number;
  recentCount: number;
  onSelectCollection: (collection: CollectionFilter) => void;
  onSelectYear: (year: number | 'All') => void;
}

export function Sidebar({
  stats,
  collection,
  selectedYear,
  savedCount,
  recentCount,
  onSelectCollection,
  onSelectYear,
}: SidebarProps) {
  const collectionItems: Array<{
    id: CollectionFilter;
    label: string;
    count: number;
    icon: typeof Film;
  }> = [
    { id: 'video', label: 'Watchable Shows', count: stats.videoCount, icon: PlayCircle },
    { id: 'youtube', label: 'YouTube', count: stats.youtubeCount, icon: Youtube },
    { id: 'drive', label: 'Google Drive', count: stats.driveCount, icon: HardDrive },
    { id: 'setlist', label: 'With Setlist', count: stats.setlistCount, icon: ListMusic },
    { id: 'all', label: 'Full Archive', count: stats.total, icon: Archive },
    { id: 'none', label: 'Archive Only', count: stats.noVideoCount, icon: Film },
  ];

  const personalItems: Array<{
    id: CollectionFilter;
    label: string;
    count: number;
    icon: typeof Bookmark;
  }> = [
    { id: 'saved', label: 'Saved Shows', count: savedCount, icon: Bookmark },
    { id: 'recent', label: 'Recently Watched', count: recentCount, icon: Clock },
  ];

  const showVideoCounts =
    collection === 'video' || collection === 'youtube' || collection === 'drive';

  return (
    <aside
      aria-label="Archive navigation"
      className="w-60 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto px-3 py-5 border-r border-white/[0.07] shrink-0"
    >
      <nav className="space-y-6">
        <div>
          <h2 className="px-3 mb-2 text-xs font-medium text-zinc-500">Browse</h2>
          <div className="space-y-0.5">
            {collectionItems.map(({ id, label, count, icon: Icon }) => {
              const active = collection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectCollection(id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? 'bg-white/[0.1] text-[#f4f4f0] font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-amber-400' : 'text-zinc-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="text-xs font-mono tabular-nums text-zinc-500 shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="px-3 mb-2 text-xs font-medium text-zinc-500">Library</h2>
          <div className="space-y-0.5">
            {personalItems.map(({ id, label, count, icon: Icon }) => {
              const active = collection === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectCollection(id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? 'bg-white/[0.1] text-[#f4f4f0] font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active ? 'text-amber-400' : 'text-zinc-500'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="text-xs font-mono tabular-nums text-zinc-500 shrink-0">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/[0.07] pt-5">
          <div className="px-3 mb-2 flex items-center justify-between">
            <h2 className="text-xs font-medium text-zinc-500">Tour Years</h2>
            <span className="text-[11px] text-zinc-600">
              {showVideoCounts ? 'shows' : 'all'}
            </span>
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onSelectYear('All')}
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                selectedYear === 'All'
                  ? 'bg-white/[0.1] text-[#f4f4f0] font-semibold'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
              }`}
            >
              <span>All Years</span>
              <span className="text-xs font-mono tabular-nums text-zinc-500">
                {showVideoCounts ? stats.videoCount : stats.total}
              </span>
            </button>

            {stats.years.map((y) => {
              const active = selectedYear === y.year;
              const yearCount =
                collection === 'youtube'
                  ? y.youtubeCount
                  : collection === 'drive'
                  ? y.driveCount
                  : collection === 'video'
                  ? y.videoCount
                  : collection === 'setlist'
                  ? y.setlistCount
                  : y.total;

              return (
                <button
                  key={y.year}
                  type="button"
                  onClick={() => onSelectYear(y.year)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active
                      ? 'bg-white/[0.1] text-[#f4f4f0] font-semibold'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="font-mono tabular-nums">{y.year}</span>
                  <span className="text-xs font-mono tabular-nums text-zinc-500">
                    {yearCount}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </aside>
  );
}
