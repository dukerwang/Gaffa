import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import ThemeToggle from '@/components/layout/ThemeToggle';
import bar from '@/components/layout/TopBar.module.css';
import styles from './PublicHome.module.css';

/**
 * The top bar for a visitor who isn't signed in. Same green bar and wordmark
 * as <TopBar>, without the league, balance and notification machinery, which
 * would cost every anonymous visit a round of authenticated fetches that all
 * come back 401.
 */
export default function PublicTopBar() {
  return (
    <nav className={bar.topBar}>
      <div className={bar.inner}>
        <Link href="/" className={bar.brand}>
          <span className={bar.brandIcon}><Icon name="gaffa" size={20} strokeWidth={2} /></span>
          <span className={`${bar.brandName} ${bar.brandNameKeep}`}>Gaffa</span>
        </Link>
        <div className={styles.topNav}>
          <Link href="/guide" className={`${styles.topLink} ${styles.topGuide}`}>Guide</Link>
          <span className={styles.topTheme}><ThemeToggle /></span>
          <Link href="/login" className={styles.topLink}>Sign In</Link>
          <Link href="/signup" className={styles.topCta}>Create Account</Link>
        </div>
      </div>
    </nav>
  );
}
