import { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import './LandingPage.css';

const isDev = import.meta.env.DEV;

const DEV_TEST_ACCOUNTS = [
  { label: 'Test Host', email: 'testhost@scrumsuite.dev', password: 'testpass123' },
  { label: 'Test User 1', email: 'testuser1@scrumsuite.dev', password: 'testpass123' },
  { label: 'Test User 2', email: 'testuser2@scrumsuite.dev', password: 'testpass123' },
];

function GoogleSignInButton({ onClick, signingIn, label = 'Sign in with Google', className = '' }) {
  return (
    <button className={`google-sign-in-btn ${className}`} onClick={onClick} disabled={signingIn}>
      <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      {signingIn ? 'Signing in…' : label}
    </button>
  );
}

export default function LandingPage() {
  const { login, loginWithEmail } = useUser();
  const [error, setError] = useState(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      await login();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Sign-in failed. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDevSignIn = async (account) => {
    setError(null);
    setSigningIn(true);
    try {
      await loginWithEmail(account.email, account.password);
    } catch (err) {
      setError(`Dev sign-in failed: ${err.message}`);
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="landing">
      <header className="landing-nav">
        <a href="/" className="landing-logo">
          <span className="landing-logo-glyph">&#9830;</span> Scrum Suite
        </a>
        <GoogleSignInButton onClick={handleGoogleSignIn} signingIn={signingIn} className="nav-sign-in" />
      </header>

      <main>
        <section className="landing-hero">
          <span className="landing-eyebrow">Free real-time agile tooling</span>
          <h1>Plan smarter,<br />ship faster.</h1>
          <p className="landing-hero-sub">
            Scrum Suite brings <strong>Sprint Poker</strong> and <strong>Retro Boards</strong> together in one
            place, so your team can estimate story points and run retrospectives in real time. Sign in with
            Google and share a link — no passwords, no setup.
          </p>
          <div className="landing-cta-group">
            <GoogleSignInButton onClick={handleGoogleSignIn} signingIn={signingIn} label="Get started — Sign in with Google" className="hero-sign-in" />
            <span className="landing-cta-note">It&apos;s free. Just bring your Google account.</span>
          </div>
          {error && <p className="landing-error">{error}</p>}
        </section>

        <section className="landing-features" aria-label="Features">
          <article className="feature-card feature-poker">
            <div className="feature-icon">&#9827;</div>
            <h2>Sprint Poker</h2>
            <p>
              Estimate story points together in real time. Everyone votes privately, cards reveal at once, and
              the team sees the vote distribution instantly — no more anchoring or guesswork.
            </p>
            <ul className="feature-list">
              <li>Private voting with simultaneous reveal</li>
              <li>Live vote distribution &amp; averages</li>
              <li>Multiple rounds for re-estimation</li>
            </ul>
          </article>

          <article className="feature-card feature-retro">
            <div className="feature-icon">&#8635;</div>
            <h2>Retro Board</h2>
            <p>
              Reflect on your sprint with a structured retrospective. Capture what went well, what to improve,
              and turn discussion into action items your team can actually follow up on.
            </p>
            <ul className="feature-list">
              <li>Organized columns for honest reflection</li>
              <li>Action items carried across sprints</li>
              <li>Built-in timer to keep retros focused</li>
            </ul>
          </article>
        </section>

        <section className="landing-steps" aria-label="How it works">
          <h2 className="landing-section-title">Up and running in seconds</h2>
          <div className="steps-grid">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Sign in with Google</h3>
              <p>No new password to remember. One click with your existing Google account and you&apos;re in.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Create or join</h3>
              <p>Start a Sprint Poker room or Retro Board, then share the link with your team.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Collaborate live</h3>
              <p>Everyone&apos;s votes, cards, and notes sync in real time — wherever your team is.</p>
            </div>
          </div>
        </section>

        <section className="landing-benefits" aria-label="Why Scrum Suite">
          <h2 className="landing-section-title">Why teams choose Scrum Suite</h2>
          <div className="benefits-grid">
            <div className="benefit">
              <span className="benefit-glyph">&#9889;</span>
              <h3>Real-time by default</h3>
              <p>Every vote and note updates instantly for the whole team, with no refresh needed.</p>
            </div>
            <div className="benefit">
              <span className="benefit-glyph">&#128274;</span>
              <h3>No passwords</h3>
              <p>Secure Google sign-in means there&apos;s nothing extra to manage or forget.</p>
            </div>
            <div className="benefit">
              <span className="benefit-glyph">&#128241;</span>
              <h3>Works anywhere</h3>
              <p>Runs in any modern browser on desktop, tablet, or phone — no install required.</p>
            </div>
            <div className="benefit">
              <span className="benefit-glyph">&#127991;</span>
              <h3>Free to use</h3>
              <p>All the essentials for agile ceremonies, completely free for your team.</p>
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <h2>Ready to run your next sprint?</h2>
          <p>Sign in with Google and start your first Sprint Poker or Retro in seconds.</p>
          <GoogleSignInButton onClick={handleGoogleSignIn} signingIn={signingIn} label="Sign in with Google" className="hero-sign-in" />
          {error && <p className="landing-error">{error}</p>}

          {isDev && (
            <div className="dev-sign-in">
              <div className="dev-divider">
                <span>Dev Sign In</span>
              </div>
              <div className="dev-accounts">
                {DEV_TEST_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    className="dev-account-btn"
                    onClick={() => handleDevSignIn(account)}
                    disabled={signingIn}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="landing-footer">
        <span className="landing-footer-brand">
          <span className="landing-logo-glyph">&#9830;</span> Scrum Suite
        </span>
        <span className="landing-footer-tagline">Sprint Poker &amp; Retro Boards for agile teams.</span>
      </footer>
    </div>
  );
}
