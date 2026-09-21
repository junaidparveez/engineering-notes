import { NavLink } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { NAV_ITEMS } from './navItems';
import styles from './Sidebar.module.css';

interface SidebarProps {
  /** Overall roadmap completion, 0–100. */
  progressPct: number;
}

export default function Sidebar({ progressPct }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>
          <Rocket size={20} />
        </div>
        <div className={styles.brandText}>
          <h1>SDE Career OS</h1>
          <p>Junaid · 2026</p>
        </div>
      </div>

      <nav className={styles.nav}>
        {/*
          NavLink is react-router's <a> that knows whether it points at the
          current URL; the className callback receives that flag. Using it
          instead of tracking "which view is active" in state is the main reason
          the back button and bookmarking work now.
        */}
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink key={path} to={path} className={({ isActive }) => (isActive ? styles.active : undefined)}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className={styles.sideBottom}>
        <div className={styles.miniProgress}>
          <div className={styles.miniProgressTop}>
            <span>Roadmap</span>
            <b>{progressPct}%</b>
          </div>
          <div className="bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>
    </aside>
  );
}
