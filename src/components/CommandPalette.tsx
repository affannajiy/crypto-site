import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SECURITY, ciphers, groupLabelOf, searchCiphers } from '../ciphers/registry';

/**
 * Ctrl+K, from anywhere.
 *
 * The catalogue's own search box is the front door and stays the front door.
 * This is for the reader who is already three tabs deep in ChaCha20 and wants
 * Vigenère — the alternative is Back, scroll, search, click, and by then
 * the comparison they had in mind has evaporated.
 *
 * It matches through `searchCiphers`, so it inherits the catalogue's behaviour
 * exactly: every term must match, substrings rather than fuzzy, and keywords
 * count — "rotor" finds Enigma. A palette with its own private matching rules
 * would be a second search engine to keep honest.
 *
 * The pages that are not ciphers are listed here rather than derived, because
 * there are five of them and no registry to read. If that list grows past a
 * handful it wants the same treatment the ciphers got.
 */
interface Destination {
  to: string;
  title: string;
  detail: string;
  hay: string;
}

const PAGES: readonly Destination[] = [
  {
    to: '/',
    title: 'Catalogue',
    detail: 'Every entry, grouped by family',
    hay: 'catalogue home ciphers browse family',
  },
  {
    to: '/timeline',
    title: 'Timeline',
    detail: 'The same entries, in the order they happened',
    hay: 'timeline history chronological year era',
  },
  {
    to: '/compare',
    title: 'Compare',
    detail: 'All the metadata on one sortable table',
    hay: 'compare table sort filter metadata side by side',
  },
  {
    to: '/playground',
    title: 'Playground',
    detail: 'One message through two ciphers at once',
    hay: 'playground side by side two ciphers diff compare',
  },
  {
    to: '/analyse',
    title: 'Analyse',
    detail: 'Measure a ciphertext before you know what it is',
    hay: 'analyse analyze cryptanalysis frequency index of coincidence ngram identify',
  },
];

export default function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Where focus was before the palette took it, so closing puts it back rather
  // than dumping the reader at the top of the document.
  const returnTo = useRef<Element | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
    if (returnTo.current instanceof HTMLElement) returnTo.current.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        returnTo.current = document.activeElement;
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    // The page behind a modal must not scroll under it. Restored rather than
    // cleared, so a stylesheet that sets its own overflow survives the palette.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    const pages = PAGES.filter((page) =>
      terms.every((term) => `${page.title} ${page.hay}`.toLowerCase().includes(term)),
    );
    const matched = trimmed === '' ? [...ciphers].slice(0, 8) : searchCiphers(trimmed);
    const cipherEntries: Destination[] = matched.map((cipher) => ({
      to: `/cipher/${cipher.slug}`,
      title: cipher.name,
      detail: `${groupLabelOf(cipher.slug) ?? 'Cipher'} · ${SECURITY[cipher.security].label}`,
      hay: '',
    }));
    return [...pages, ...cipherEntries];
  }, [query]);

  // A new query means a new list, and an active index left over from the old one
  // points at whatever happens to be in that slot now.
  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, results]);

  if (!open) return null;

  const go = (to: string) => {
    close();
    navigate(to);
  };

  const onFieldKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((n) => (results.length === 0 ? 0 : (n + 1) % results.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((n) => (results.length === 0 ? 0 : (n - 1 + results.length) % results.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[active];
      if (target !== undefined) go(target.to);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]">
      {/* The backdrop is a button so a click and the Escape key are the same
          affordance to a keyboard, and it is labelled rather than silent. */}
      <button
        type="button"
        aria-label="Close the command palette"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-ink-strong/30 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to"
        className="cl-card relative flex w-full max-w-xl flex-col overflow-hidden p-0 shadow-xl"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[active] === undefined ? undefined : `palette-${active}`}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onFieldKeyDown}
          placeholder="Go to a cipher or a page…"
          autoComplete="off"
          className="w-full border-0 border-b border-line bg-surface px-4 py-3 text-base text-ink outline-none"
        />

        <ul id="palette-results" ref={listRef} className="max-h-[50vh] overflow-y-auto">
          {results.length === 0 && (
            <li className="px-4 py-6 text-sm text-ink-muted">
              Nothing matches every word of that. The palette searches the same words the
              catalogue does, and does not guess at spellings.
            </li>
          )}
          {results.map((entry, index) => (
            <li key={entry.to}>
              <button
                type="button"
                id={`palette-${index}`}
                data-active={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => go(entry.to)}
                className={`flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left ${
                  index === active ? 'bg-marker-wash' : 'bg-transparent'
                }`}
              >
                <span className="font-medium text-ink-strong">{entry.title}</span>
                <span className="shrink-0 text-xs text-ink-subtle">{entry.detail}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="border-t border-line bg-sunken px-4 py-2 text-xs text-ink-subtle">
          <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> to move,{' '}
          <kbd className="font-mono">Enter</kbd> to go, <kbd className="font-mono">Esc</kbd> to
          close.
        </p>
      </div>
    </div>
  );
}
