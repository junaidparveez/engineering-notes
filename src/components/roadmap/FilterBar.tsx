import styles from './FilterBar.module.css';

interface FilterBarProps {
  filters: string[];
  active: string;
  onChange: (filter: string) => void;
}

/** 'All' plus one button per phase. The choice is persisted, as before. */
export default function FilterBar({ filters, active, onChange }: FilterBarProps) {
  return (
    <div className={styles.roadToolbar}>
      {filters.map((filter) => (
        <button
          type="button"
          key={filter}
          className={`${styles.filter} ${filter === active ? styles.active : ''}`}
          onClick={() => onChange(filter)}
          aria-pressed={filter === active}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
