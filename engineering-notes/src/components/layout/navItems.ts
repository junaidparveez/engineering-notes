import type { LucideIcon } from 'lucide-react';
import {
  Blocks,
  BrainCircuit,
  LayoutDashboard,
  Library,
  Map,
  NotebookPen,
  Radar,
  Settings2,
} from 'lucide-react';

/**
 * The seven views, in sidebar order. One list feeds the sidebar, the mobile
 * bar and the page heading, so a route can never appear in one and not another.
 *
 * `title` is the heading shown in the top bar — the same strings the old app
 * kept in its `titles` map.
 */
export interface NavItem {
  path: string;
  label: string;
  /** Short label for the collapsed/mobile bar tooltip. */
  short: string;
  title: string;
  Icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    short: 'Dashboard',
    title: 'Your career control center',
    Icon: LayoutDashboard,
  },
  { path: '/skills', label: 'Skill Gap', short: 'Skills', title: 'Current → target skill gap', Icon: Radar },
  { path: '/roadmap', label: '24-Week Roadmap', short: 'Roadmap', title: '24-week execution roadmap', Icon: Map },
  {
    path: '/interview',
    label: 'Interview Tracker',
    short: 'Interview',
    title: 'Interview conversion tracker',
    Icon: BrainCircuit,
  },
  {
    path: '/projects',
    label: 'Proof / Projects',
    short: 'Projects',
    title: 'Portfolio proof that compounds',
    Icon: Blocks,
  },
  {
    path: '/notes',
    label: 'Notes',
    short: 'Notes',
    title: 'Notes',
    Icon: NotebookPen,
  },
  { path: '/resources', label: 'Resources', short: 'Resources', title: 'Focused learning resources', Icon: Library },
  {
    path: '/settings',
    label: 'Settings & Backup',
    short: 'Settings',
    title: 'Settings & progress backup',
    Icon: Settings2,
  },
];

/** The views that fit in the mobile bottom bar — Resources is dropped, as before. */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((i) => i.path !== '/resources');
