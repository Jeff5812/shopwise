'use client';

import { useEffect, useRef, useState } from 'react';
import { dashboardLoginUrl, dashboardUrl } from '@/lib/urls';
import styles from './Nav.module.css';

const links = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
  { href: '#pricing', label: 'Pricing' },
];

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    const desktopViewport = window.matchMedia('(min-width: 768px)');

    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setMenuOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    desktopViewport.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      desktopViewport.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={`page-shell ${styles.inner}`}>
        <a
          className={styles.brand}
          href="/"
          aria-label="Shopwise home"
          onClick={() => setMenuOpen(false)}
        >
          Shopwise
        </a>

        <nav
          id="primary-navigation"
          aria-label="Main navigation"
          className={`${styles.navigation} ${menuOpen ? styles.open : ''}`}
        >
          {links.map((link) => (
            <a
              className={styles.link}
              href={link.href}
              key={link.href}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {dashboardLoginUrl && (
            <a
              className={styles.mobileSignIn}
              href={dashboardLoginUrl}
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </a>
          )}
          {dashboardUrl && (
            <a
              className={`${styles.cta} ${styles.mobileCta}`}
              href={dashboardUrl}
              onClick={() => setMenuOpen(false)}
            >
              Open dashboard
            </a>
          )}
        </nav>

        <div className={styles.actions}>
          {dashboardLoginUrl && (
            <a className={styles.signIn} href={dashboardLoginUrl}>
              Sign in
            </a>
          )}
          {dashboardUrl && (
            <a className={`${styles.cta} ${styles.desktopCta}`} href={dashboardUrl}>
              Open dashboard
            </a>
          )}
        </div>

        <button
          ref={menuButtonRef}
          aria-controls="primary-navigation"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className={styles.menuButton}
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span className={menuOpen ? styles.closeIcon : styles.menuIcon} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
