import { LayoutMode } from '../types';

export interface DeviceSignals {
  width: number;
  height: number;
  coarsePointer: boolean;
  canHover: boolean;
  userAgent: string;
}

const TV_UA_PATTERN =
  /SmartTV|SMART-TV|Tizen|Web0S|webOS|AppleTV|Roku|FireTV|AFT[A-Z0-9]+|BRAVIA|CrKey|PlayStation|Xbox|Nintendo|GoogleTV|Android TV|Shield Android TV|KDL-|Viera|NetCast|HbbTV/i;

const MOBILE_UA_PATTERN =
  /Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i;

/**
 * Pure heuristic detector for TV (10-ft Big Picture), Mobile, or Desktop layout modes.
 */
export function detectDeviceProfile(signals: DeviceSignals): LayoutMode {
  const { width, coarsePointer, canHover, userAgent } = signals;

  if (TV_UA_PATTERN.test(userAgent)) {
    return 'tv';
  }

  if (
    MOBILE_UA_PATTERN.test(userAgent) ||
    width < 768 ||
    (coarsePointer && !canHover && width < 1024)
  ) {
    return 'mobile';
  }

  return 'desktop';
}

export function detectCurrentBrowserProfile(): LayoutMode {
  if (typeof window === 'undefined') return 'desktop';

  const coarsePointer =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;
  const canHover =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(hover: hover)').matches
      : true;

  return detectDeviceProfile({
    width: window.innerWidth,
    height: window.innerHeight,
    coarsePointer,
    canHover,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  });
}

export function parseModeFromQuery(search: string): LayoutMode | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('mode')?.toLowerCase();
    if (raw === 'tv' || raw === 'desktop' || raw === 'mobile') {
      return raw;
    }
  } catch {
    // Ignore malformed query
  }
  return null;
}

export function hasAutostartFlag(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return params.get('autostart') === '1' || params.has('show');
  } catch {
    return false;
  }
}

export const LAYOUT_MODE_LABELS: Record<LayoutMode, string> = {
  tv: 'TV / Big Picture',
  desktop: 'Desktop',
  mobile: 'Mobile',
};
