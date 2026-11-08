import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

/** Compact sticky bar on every page. */
export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          <span aria-hidden="true">🧭</span> Family Adventures
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
