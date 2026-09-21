import { Outlet, useLocation } from 'react-router-dom';
import MobileNav from './MobileNav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { NAV_ITEMS } from './navItems';
import { FOOTER_NOTE } from '../../data/content';
import { overallPct } from '../../state/progress';
import { useAppState } from '../../state/useAppState';
import styles from './AppLayout.module.css';

/**
 * The frame every page renders inside: sidebar, top bar, the routed page, and
 * the mobile bar.
 *
 * <Outlet /> is react-router's slot for "whichever child route matched" — the
 * layout is rendered once and only the Outlet's contents swap when you
 * navigate, which is why the sidebar does not flicker between pages.
 */
export default function AppLayout() {
  const { pathname } = useLocation();
  // startsWith rather than === so a future sub-path (/notes/some-note) still
  // finds its heading, and a fallback so the bar is never blank on the one
  // render where pathname is still '/' and the index redirect has not run.
  const title = NAV_ITEMS.find((i) => pathname.startsWith(i.path))?.title ?? NAV_ITEMS[0]!.title;

  const { state, exportToFile } = useAppState();
  const progressPct = overallPct(state);

  return (
    <div className={styles.app}>
      <Sidebar progressPct={progressPct} />
      <main className={styles.main}>
        <div className={styles.shell}>
          <TopBar title={title} onExport={exportToFile} />
          <Outlet />
          <div className={styles.footerNote}>{FOOTER_NOTE}</div>
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
