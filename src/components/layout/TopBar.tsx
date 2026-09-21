import { useNavigate } from 'react-router-dom';
import { Download, LocateFixed } from 'lucide-react';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Heading for the active view. */
  title: string;
  onExport: () => void;
}

export default function TopBar({ title, onExport }: TopBarProps) {
  const navigate = useNavigate();

  return (
    <div className={styles.topbar}>
      <div>
        <div className="eyebrow">Backend / SDE-II · high-compensation track</div>
        <h2>{title}</h2>
      </div>
      <div className={styles.actions}>
        <button type="button" className="btn" onClick={() => navigate('/roadmap')}>
          <LocateFixed />
          <span>Current week</span>
        </button>
        <button type="button" className="btn primary" onClick={onExport}>
          <Download />
          <span>Backup progress</span>
        </button>
      </div>
    </div>
  );
}
