import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Github, Link2, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { forgetToken, getStoredToken, startDeviceFlow, tokenExpiresAt, waitForAuthorisation } from '../../notes/deviceAuth';
import { formatCountdown, secondsRemaining } from '../../notes/deviceAuthRules';
import { GITHUB_REVOKE_URL, PUBLISH } from '../../config/app.config';
import { canPublish } from '../../config/repoConfig';
import type { DeviceCode } from '../../notes/deviceAuth';
import styles from './DeviceAuthCard.module.css';

interface DeviceAuthCardProps {
  /** Called once a token is in sessionStorage. */
  onAuthorised?: () => void;
}

/**
 * The GitHub authorisation card: shows the code, opens github.com, waits.
 *
 * Lives on its own so phase 9's publish panel can show the same card when a
 * publish is attempted without a token.
 */
export default function DeviceAuthCard({ onAuthorised }: DeviceAuthCardProps) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // Aborts the poll loop if this card unmounts mid-flow; otherwise it would
  // keep polling against a panel that is no longer on screen.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  // Ticks the countdown once a second while a code is live. The cleanup stops
  // the interval - without it every restarted flow would add another ticker.
  useEffect(() => {
    if (!code) return;
    const tick = () => setRemaining(secondsRemaining(code.expiresAt));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [code]);

  async function begin() {
    setError(null);
    setCopied(false);
    setLinkCopied(false);
    try {
      const started = await startDeviceFlow();
      setCode(started);
      setWaiting(true);

      const controller = new AbortController();
      abortRef.current = controller;
      await waitForAuthorisation(started, { signal: controller.signal });

      setToken(getStoredToken());
      setCode(null);
      setWaiting(false);
      onAuthorised?.();
    } catch (err) {
      setWaiting(false);
      setCode(null);
      setError(err instanceof Error ? err.message : 'Authorisation failed.');
    }
  }

  if (token) {
    const expiresAt = tokenExpiresAt();
    return (
      <div className={styles.card}>
        <div className={styles.authorised}>
          <Check />
          <span>
            GitHub authorised
            {expiresAt ? ` · expires ${new Date(expiresAt).toLocaleTimeString()}` : ''}
          </span>
        </div>
        <p className={styles.hint}>
          Held in this tab only, for {PUBLISH.tokenLifetimeMinutes} minutes, and discarded as soon as a
          publish finishes. Forgetting it here deletes this copy — it does not end the token at GitHub,
          which would need the app&apos;s client secret. To kill it there, revoke the authorisation.
        </p>
        <div className={styles.codeRow}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              forgetToken();
              setToken(null);
            }}
          >
            Forget token here
          </button>
          <a className="btn" href={GITHUB_REVOKE_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Revoke on GitHub
          </a>
        </div>
      </div>
    );
  }

  // Authorising cannot work without a client ID, so say that up front and
  // offer the way there rather than failing on the button press.
  if (!canPublish()) {
    return (
      <div className={styles.card}>
        <div className={styles.heading}>
          <Github />
          <b>Publishing target not set</b>
        </div>
        <p className={styles.hint}>
          Publishing needs the owner, repository, branch and GitHub App client ID. They are entered
          once, in Settings.
        </p>
        <Link className="btn primary" to="/settings">
          <Settings2 />
          Open Settings → Publishing target
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      {!code ? (
        <>
          <div className={styles.heading}>
            <Github />
            <b>Authorise GitHub to publish</b>
          </div>
          <p className={styles.hint}>
            Publishing needs your permission each session. No token is stored on the server, and this one
            can only touch the repositories this app is installed on.
          </p>
          <button type="button" className="btn primary" onClick={() => void begin()}>
            Start authorisation
          </button>
        </>
      ) : (
        <>
          <p className={styles.hint}>Enter this code on GitHub, then come back here.</p>
          <div className={styles.codeRow}>
            <code className={styles.userCode}>{code.userCode}</code>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(code.userCode);
                setCopied(true);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                void navigator.clipboard?.writeText(code.verificationUri);
                setLinkCopied(true);
              }}
            >
              {linkCopied ? <Check /> : <Link2 />}
              {linkCopied ? 'Link copied' : 'Copy link'}
            </button>
          </div>

          {/*
            Opening the link here would use the default browser, which may be
            signed in as a different GitHub account. Authorising with the wrong
            account is confusing at best, so the link is copied rather than
            opened and the destination is spelled out.
          */}
          <p className={styles.warning}>
            Open <code>{code.verificationUri}</code> in the browser profile where your{' '}
            <b>personal</b> GitHub is signed in — not whichever account your default browser happens
            to be using.
          </p>
          <details className={styles.details}>
            <summary>Open it here anyway</summary>
            <a
              className="btn"
              href={code.verificationUri}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink />
              Open in default browser
            </a>
          </details>
          <p className={styles.hint}>
            {waiting ? 'Waiting for you to approve it on GitHub…' : 'Ready.'} Code expires in{' '}
            {formatCountdown(remaining)}.
          </p>
        </>
      )}

      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
