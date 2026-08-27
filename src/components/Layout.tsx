import { Link, NavLink, Outlet } from 'react-router-dom';
import SafetyNotice from './SafetyNotice';
import ScrollToTop from './ScrollToTop';
import CommandPalette from './CommandPalette';

const NAV = [
  { to: '/', label: 'Ciphers' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/compare', label: 'Compare' },
  { to: '/playground', label: 'Playground' },
  { to: '/analyse', label: 'Analyse' },
];

/**
 * The frame every page sits in: a skip link, a header, the page, and the footer
 * that carries the safety notice.
 */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ScrollToTop />
      <CommandPalette />

      <a
        href="#main"
        className="sr-only rounded-lg bg-ink-strong px-3 py-2 text-sm font-semibold text-ink-inverse focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-baseline gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="text-base font-semibold tracking-tight text-ink-strong">
            CryptoLab
          </Link>
          <span className="hidden text-sm text-ink-subtle sm:inline">
            see how ciphers actually work
          </span>
          {/* The nav wraps rather than collapsing into a menu button: five short
              links fit on two lines at 320px, and a disclosure widget would hide
              four pages behind a tap to save one. */}
          <nav aria-label="Sections" className="ml-auto flex flex-wrap justify-end gap-x-4">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `py-1 text-sm underline underline-offset-4 hover:text-ink ${
                    isActive ? 'font-semibold text-ink-strong' : 'text-ink-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <SafetyNotice />
        </div>
      </footer>
    </div>
  );
}
