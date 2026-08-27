import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Every navigation starts at the top of the page.
 *
 * A hash router cannot use react-router's own `<ScrollRestoration />` — that one
 * is for data routers with a browser history, and the browser's built-in
 * restoration does not fire for a change that never touches the path. So a
 * catalogue scrolled halfway down opened a cipher page halfway down, which reads
 * as a broken page rather than as a preserved position.
 *
 * The split is on navigation type, not on route:
 *
 * - **push** (a link was clicked) scrolls to the top. Following a link is asking
 *   for a new page, and a new page begins at its beginning.
 * - **pop** (Back or Forward) restores where that entry was left. Coming back to
 *   the catalogue and losing your place is the same bug in the other direction.
 *
 * Positions are keyed by `location.key`, which react-router makes unique per
 * history entry, and live in `sessionStorage` so a reload does not resurrect a
 * position for a page that is no longer there.
 */
const STORE_KEY = 'cl:scroll';

function readStore(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, number>) : {};
  } catch {
    // Private mode, blocked storage, corrupt JSON. Scrolling is not worth an
    // exception, so a failed read simply means "no remembered position".
    return {};
  }
}

function writeStore(store: Record<string, number>): void {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* nothing to do, and nothing worth telling the reader */
  }
}

export default function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    const key = location.key;

    if (navigationType === 'POP') {
      const remembered = readStore()[key];
      window.scrollTo(0, typeof remembered === 'number' ? remembered : 0);
    } else {
      window.scrollTo(0, 0);
    }

    // Record where this entry was left, on the way out rather than on scroll:
    // a scroll listener fires hundreds of times and this needs the last value
    // only.
    return () => {
      writeStore({ ...readStore(), [key]: window.scrollY });
    };
  }, [location.key, navigationType]);

  return null;
}
