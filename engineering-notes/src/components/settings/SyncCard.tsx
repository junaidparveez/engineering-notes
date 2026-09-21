import { useState } from 'react';
import { forgetPasscode, hasPasscode, setPasscode } from '../../notes/syncApi';
import { useAppState } from '../../state/useAppState';
import styles from './SettingsPage.module.css';

/**
 * The notes passcode, and what it unlocks.
 *
 * One passcode covers both notes and roadmap progress. It is not a GitHub
 * credential and grants no access to the repository - publishing uses a
 * separate, short-lived token authorised from the UI.
 */
export default function SyncCard() {
  const { syncStatus } = useAppState();
  const [entry, setEntry] = useState('');
  const [connected, setConnected] = useState(hasPasscode());

  return (
    <div className={`panel ${styles.setting}`}>
      <label htmlFor="passcode">Device sync</label>

      {connected ? (
        <>
          <div className={styles.buttonRow}>
            <button type="button" className="btn" onClick={() => void syncStatus.syncNow()}>
              Sync now
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                forgetPasscode();
                setConnected(false);
              }}
            >
              Forget passcode
            </button>
          </div>
          <p className={styles.hint}>
            Notes and roadmap progress sync across your devices.{' '}
            {syncStatus.lastSyncedAt
              ? `Last synced ${new Date(syncStatus.lastSyncedAt).toLocaleTimeString()}.`
              : 'Not synced yet this session.'}{' '}
            {syncStatus.status === 'error' && 'The last attempt failed — everything is still saved here.'}
            {syncStatus.status === 'offline' && 'Offline — changes will go up when you reconnect.'}
          </p>
        </>
      ) : (
        <>
          <form
            className={styles.buttonRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (!entry.trim()) return;
              setPasscode(entry.trim());
              setEntry('');
              setConnected(true);
              void syncStatus.syncNow();
            }}
          >
            <input
              id="passcode"
              className="field"
              type="password"
              placeholder="Notes passcode"
              autoComplete="current-password"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
            />
            <button type="submit" className="btn primary">
              Connect
            </button>
          </form>
          <p className={styles.hint}>
            Enter the passcode to sync notes and progress between devices. Everything works without it —
            it is stored in this browser only, and it is not a GitHub credential.
          </p>
        </>
      )}
    </div>
  );
}
