import type { Metric } from '../types';

/**
 * The 6 interview-conversion counters. `icon` is a lucide-react icon name; it
 * is resolved at render time so this file stays plain data with no imports
 * from the component layer.
 */
export const METRICS: Metric[] = [
  {
    id: 'dsa',
    label: 'DSA problems solved',
    target: 120,
    icon: 'code-2',
    note: 'Aim for pattern mastery + re-solving mistakes.',
  },
  {
    id: 'hld',
    label: 'HLD mocks',
    target: 12,
    icon: 'network',
    note: '45-minute timed designs with trade-offs.',
  },
  {
    id: 'lld',
    label: 'LLD mocks',
    target: 10,
    icon: 'boxes',
    note: 'Java OOD + concurrency + tests.',
  },
  {
    id: 'backend',
    label: 'Backend deep-dive mocks',
    target: 8,
    icon: 'server-cog',
    note: 'Java/Spring/SQL/Kafka/Redis/reliability.',
  },
  {
    id: 'apps',
    label: 'Targeted applications',
    target: 80,
    icon: 'send',
    note: 'Quality roles; track response/rejection signals.',
  },
  {
    id: 'referrals',
    label: 'Referrals requested',
    target: 25,
    icon: 'users',
    note: 'Warm referrals beat mass easy-apply volume.',
  },
];
