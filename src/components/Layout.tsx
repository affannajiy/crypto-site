import { Link, Outlet } from 'react-router-dom';
import SafetyNotice from './SafetyNotice';

/**
 * The frame every page sits in: a skip link, a header, the page, and the footer
 * that carries the safety notice.
 */
export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
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
          <span className="text-sm text-ink-subtle">see how ciphers actually work</span>
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
