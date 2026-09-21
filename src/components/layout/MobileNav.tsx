import { NavLink } from 'react-router-dom';
import { MOBILE_NAV_ITEMS } from './navItems';
import styles from './MobileNav.module.css';

/** The fixed bottom bar that replaces the sidebar under 720px. */
export default function MobileNav() {
  return (
    <nav className={styles.mobileNav}>
      {MOBILE_NAV_ITEMS.map(({ path, short, Icon }) => (
        <NavLink
          key={path}
          to={path}
          title={short}
          aria-label={short}
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <Icon />
        </NavLink>
      ))}
    </nav>
  );
}
