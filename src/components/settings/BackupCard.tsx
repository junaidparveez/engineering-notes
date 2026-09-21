import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { parseImported } from '../../state/storage';
import { useAppState } from '../../state/useAppState';
import styles from './SettingsPage.module.css';

/**
 * Export and import. The only part of Settings with logic of its own, so it
 * lives apart from the cards that are just markup.
 *
 * Import replaces all progress, which makes it the one destructive control in
 * the app - hence the explicit success/failure line rather than the old
 * alert(), and the refusal in parseImported for files it does not recognise.
 */
export default function BackupCard() {
  const { exportToFile, replaceState } = useAppState();

  // A ref is a handle to the real DOM node - the only way to open a file
  // picker, since the <input> itself stays hidden.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleFile(file: File) {
    try {
      const imported = parseImported(await file.text());
      replaceState(imported);
      const done = Object.keys(imported.completed).length;
      setResult({ ok: true, message: `Imported ${done} completed tasks from ${file.name}.` });
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : 'That file could not be read.',
      });
    }
  }

  return (
    <div className={`panel ${styles.setting}`}>
      <label>Manual backup · optional</label>
      <div className={styles.buttonRow}>
        {/*
          Secondary, not primary: once progress syncs through Redis this is a
          fallback, not the way progress moves between devices. Import still
          earns its place - it is how the old app's backup gets in.
        */}
        <button type="button" className="btn" onClick={exportToFile}>
          <Download />
          Export JSON
        </button>
        <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
          <Upload />
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            // Clear the input so picking the same file twice still fires.
            e.target.value = '';
          }}
        />
      </div>
      <p className={styles.hint}>
        Optional. Progress is saved in this browser and will sync across your devices once that is switched
        on; this is a snapshot you can keep, and the way a backup exported by the old version of this app
        gets in.
      </p>
      {result && (
        <p className={`${styles.result} ${result.ok ? styles.ok : styles.error}`} role="status">
          {result.message}
        </p>
      )}
    </div>
  );
}
