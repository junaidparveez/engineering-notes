import { canPublish, getRepoConfig, repoLabel } from '../../config/repoConfig';
import { PUBLISH } from '../../config/app.config';
import DeviceAuthCard from '../notes/DeviceAuthCard';
import styles from './SettingsPage.module.css';

/**
 * GitHub authorisation, so it can be done (and checked) outside a publish.
 *
 * The publish panel shows the same DeviceAuthCard when a publish is attempted
 * without a token.
 */
export default function GitHubCard() {
  const config = getRepoConfig();

  return (
    <div className={`panel ${styles.setting}`}>
      <label>GitHub publishing</label>

      {canPublish(config) ? (
        <DeviceAuthCard />
      ) : (
        <p className={styles.hint}>
          Fill in the publishing target above first. The GitHub App needs <b>Enable Device Flow</b>{' '}
          checked and <b>Contents: Read and write</b>, installed on the repository you name there.
        </p>
      )}

      <p className={styles.hint}>
        Publishes to {repoLabel(config)} on branch {config.branch}, into {config.notesDir}/. No GitHub
        token is stored on the server or in any environment variable — authorisation lasts{' '}
        {PUBLISH.tokenLifetimeMinutes} minutes in this tab and is dropped after each publish.
      </p>
    </div>
  );
}
