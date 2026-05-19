import { useEffect, useMemo, useState } from 'react';
import { acceptInvite, requestPasswordReset, signInWithPassword } from './services/backend';
import turfopLogo from './assets/turfop-logo-web.png';
import './public-site.css';

const pricingTiers = [
  {
    name: 'Starter',
    price: '$29',
    cadence: '/month',
    annualPrice: '$278 annually',
    fit: 'Single-course teams, small municipal properties, and practice facilities',
    description: 'For one property that needs clean maintenance records, parts visibility, and a reliable mobile workflow.',
    features: ['1 course', 'Work orders and equipment records', 'Inventory tracking', 'Offline-friendly mobile updates', 'Basic reporting'],
    cta: 'Start Starter',
    href: '/signin'
  },
  {
    name: 'Growth',
    price: '$59',
    cadence: '/month',
    annualPrice: '$566 annually',
    fit: '18-hole clubs and growing multi-course operators',
    description: 'Best fit for operations teams that need stronger accountability, mobile capture, and portfolio readiness.',
    features: ['Up to 5 courses', 'Everything in Starter', 'Barcode / RFID workflows', 'Audit logs and team roles', 'Supplier links and export support'],
    cta: 'Start Growth',
    href: '/signin',
    featured: true
  },
  {
    name: 'Enterprise',
    price: '$99+',
    cadence: '/month',
    annualPrice: 'Custom rollout available',
    fit: 'Resort groups, management companies, and portfolio operators',
    description: 'For operators who need broader rollout support, integrations, and company-level controls across properties.',
    features: ['Unlimited courses', 'Everything in Growth', 'API access', 'Custom modules', 'Priority onboarding'],
    cta: 'Book rollout review',
    href: '/book-demo'
  }
];

const comparisonRows = [
  ['Courses', '1', 'Up to 5', 'Unlimited'],
  ['Work orders + maintenance', 'Included', 'Included', 'Included'],
  ['Inventory tracking', 'Included', 'Included', 'Included'],
  ['Offline-friendly mobile updates', 'Included', 'Included', 'Included'],
  ['Photos on records', 'Included', 'Included', 'Included'],
  ['Barcode / RFID workflows', '—', 'Included', 'Included'],
  ['Audit logs + team roles', '—', 'Included', 'Included'],
  ['API access', '—', '—', 'Included']
];

const heroStats = [
  ['Open work orders', '14'],
  ['Low-stock items', '8'],
  ['Units needing service', '4']
];

const painCards = [
  {
    title: 'Downtime hits the crew first',
    body: 'See overdue maintenance, blocked jobs, and parts shortages before the morning setup gets derailed.'
  },
  {
    title: 'Inventory slips when counts live on paper',
    body: 'Track filters, bearings, irrigation parts, tires, fluids, and shop supplies in one system tied to the right course.'
  },
  {
    title: 'Weak Wi‑Fi should not break field updates',
    body: 'Log notes, parts used, photos, and completion details from the barn, the shop, or the course and sync when service returns.'
  }
];

const featureCards = [
  {
    title: 'Equipment and maintenance',
    body: 'Track service status, labor, parts cost, and completion notes by course and by machine.',
    lines: ['Fairway mower · Needs service', 'Sprayer calibration · Due today', 'Utility cart battery swap · Completed']
  },
  {
    title: 'Inventory and low-stock alerts',
    body: 'Know what is on hand before work stalls or someone places the same order twice.',
    lines: ['Hydraulic filters · 3 left', 'Reel bearings · 12 left', 'Irrigation heads · reorder now']
  },
  {
    title: 'Multi-course oversight',
    body: 'Give each property its own controls while keeping company rollups, staffing, and audit visibility clean.',
    lines: ['North Course · 5 open jobs', 'South Course · 2 overdue units', 'Practice Facility · low stock warning']
  }
];

const trustItems = [
  'Role-based course access with company-level supervision where needed',
  'Password hashing, JWT-based auth, audit logs, and production CORS controls in the backend',
  'Offline queue and local sync support for field updates in low-service areas',
  'Native-ready iOS and Android shell with camera, haptics, and push registration support'
];

const securityStandards = [
  {
    title: 'Authentication and access control',
    body: 'Passwords are hashed with bcrypt, authentication uses signed JWTs, and course memberships control what each employee can view or change.'
  },
  {
    title: 'Transport and application hardening',
    body: 'Production traffic is expected to run over HTTPS, the API is protected with Helmet and CORS allowlists, and password-related routes are rate limited.'
  },
  {
    title: 'Operational visibility',
    body: 'Audit log events cover employee creation, invites, membership changes, profile updates, password reset requests, and time-entry approvals.'
  },
  {
    title: 'Mobile and device behavior',
    body: 'Offline updates stay queued on-device until the API is reachable again, with sync state visible to the user before anything is discarded.'
  }
];

const privacySections = [
  {
    title: 'What TurfOp stores',
    body: 'TurfOp stores account details, course memberships, work orders, equipment records, inventory records, time entries, audit events, and photos that users attach to operational records.'
  },
  {
    title: 'Why the data is used',
    body: 'The data is used to run maintenance workflows, inventory control, staff access, reporting, security checks, and account recovery for golf-course operations teams.'
  },
  {
    title: 'Who can access it',
    body: 'Access is limited by company role and course membership. Employees only see the courses and records they are authorized to work on. Company super users can review broader portfolio data where configured.'
  },
  {
    title: 'Operational safeguards',
    body: 'Password reset requests are rate limited, account actions are audited, and production deployments are expected to run with HTTPS, a configured JWT secret, and explicit CORS origins.'
  }
];

const termsSections = [
  {
    title: 'Service scope',
    body: 'TurfOp is provided as operations software for golf-course maintenance, equipment, inventory, and workforce workflows. It is not a golfer booking, tee-sheet, or point-of-sale system.'
  },
  {
    title: 'Customer responsibility',
    body: 'Customers are responsible for the accuracy of the data they enter, the devices their staff use, and the permissions they assign to employees and managers.'
  },
  {
    title: 'Availability and rollout',
    body: 'The product is offered on a best-effort basis while infrastructure, backup, and rollout practices continue to mature. Course operators should keep their own critical business continuity procedures in place.'
  },
  {
    title: 'Acceptable use',
    body: 'Customers may not use TurfOp to interfere with the service, bypass access controls, or upload unlawful or malicious content. Access may be suspended for abuse or security risk.'
  }
];

function getPageFromPath(pathname) {
  if (pathname === '/pricing') return 'pricing';
  if (pathname === '/security') return 'security';
  if (pathname === '/book-demo') return 'contact';
  if (pathname === '/privacy') return 'privacy';
  if (pathname === '/terms') return 'terms';
  if (pathname === '/signin' || pathname === '/invite') return 'signin';
  return 'landing';
}

function navigate(path) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function MarketingNav({ activePage }) {
  return (
    <header className="mk-nav">
      <button type="button" className="mk-brand" onClick={() => navigate('/')}>
        <span className="mk-brand-mark">
          <img src={turfopLogo} alt="TurfOp logo" />
        </span>
        <span>
          <strong>TurfOp</strong>
          <small>Golf-course ops, not golfer software</small>
        </span>
      </button>
      <nav className="mk-nav-links" aria-label="Primary">
        <button type="button" className={activePage === 'landing' ? 'active' : ''} onClick={() => navigate('/')}>Product</button>
        <button type="button" className={activePage === 'pricing' ? 'active' : ''} onClick={() => navigate('/pricing')}>Pricing</button>
        <button type="button" className={activePage === 'security' ? 'active' : ''} onClick={() => navigate('/security')}>Security</button>
        <button type="button" className={activePage === 'contact' ? 'active' : ''} onClick={() => navigate('/book-demo')}>Demo</button>
        <a className="mk-signin" href="/signin">Sign in</a>
      </nav>
    </header>
  );
}

function HeroScreens() {
  return (
    <div className="mk-screens" aria-hidden="true">
      <article className="mk-screen mk-screen-desktop">
        <div className="mk-screen-topbar">
          <span />
          <span />
          <span />
        </div>
        <div className="mk-screen-header">
          <div>
            <p>Portfolio dashboard</p>
            <h3>What needs attention right now</h3>
          </div>
          <span className="mk-screen-chip">Live</span>
        </div>
        <div className="mk-stat-grid">
          {heroStats.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className="mk-table-card">
          <div className="mk-table-row mk-table-head"><span>Course</span><span>Status</span><span>Next issue</span></div>
          <div className="mk-table-row"><span>North Course</span><strong>5 open</strong><span>Hydraulic filters low</span></div>
          <div className="mk-table-row"><span>South Course</span><strong>2 overdue</strong><span>Sprayer calibration</span></div>
          <div className="mk-table-row"><span>Practice Facility</span><strong>1 alert</strong><span>Picker tire reorder</span></div>
        </div>
      </article>
      <article className="mk-screen mk-screen-mobile">
        <div className="mk-phone-notch" />
        <div className="mk-mobile-header">
          <span>Work order</span>
          <strong>Cart barn inspection</strong>
        </div>
        <div className="mk-mobile-pill-row">
          <span>In progress</span>
          <span>2 parts used</span>
        </div>
        <ul className="mk-mobile-list">
          <li>Attach field photos</li>
          <li>Track labor and parts cost</li>
          <li>Save offline if service drops</li>
        </ul>
        <div className="mk-mobile-footer">
          <button type="button">Add note</button>
          <button type="button" className="filled">Complete</button>
        </div>
      </article>
    </div>
  );
}

function LandingPage() {
  return (
    <>
      <section className="mk-hero">
        <div className="mk-hero-copy">
          <p className="mk-eyebrow">Built for golf-course operations</p>
          <h1>Track carts, parts, and maintenance without slowing the crew down.</h1>
          <p className="mk-lead">
            TurfOp gives superintendents and operations managers one system for work orders, equipment history, inventory counts, and mobile field updates — even on weak course Wi‑Fi.
          </p>
          <div className="mk-actions">
            <a className="mk-btn mk-btn-primary" href="/signin">Start Starter or Growth</a>
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/book-demo')}>Book 15-minute review</button>
          </div>
          <div className="mk-proof-strip">
            <span>Offline-friendly updates</span>
            <span>Course-level controls</span>
            <span>iPhone + Android ready</span>
          </div>
        </div>
        <HeroScreens />
      </section>

      <section className="mk-section">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">Why teams switch</p>
          <h2>Clear answers to the problems crews and superintendents deal with every day.</h2>
        </div>
        <div className="mk-card-grid mk-card-grid-three">
          {painCards.map((card) => (
            <article className="mk-card" key={card.title}>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-section-heading split">
          <div>
            <p className="mk-eyebrow">Product views</p>
            <h2>Visitors should understand the workflow in seconds.</h2>
          </div>
          <p className="mk-muted">What is broken, what is low, what is overdue, and what each course needs next.</p>
        </div>
        <div className="mk-card-grid mk-card-grid-three">
          {featureCards.map((card) => (
            <article className="mk-card mk-feature-card" key={card.title}>
              <div className="mk-mini-screen">
                <div className="mk-mini-screen-bar" />
                <div className="mk-mini-screen-body">
                  {card.lines.map((line) => <span key={line}>{line}</span>)}
                </div>
              </div>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-trust-section">
        <div className="mk-trust-card">
          <div>
            <p className="mk-eyebrow">Security and rollout</p>
            <h2>Concrete controls, not vague reassurance.</h2>
            <p className="mk-muted">
              TurfOp is designed for real operations data: user access by course, audit visibility, mobile sync status, and backend controls that match how buyers actually evaluate early-stage software.
            </p>
          </div>
          <ul className="mk-checklist">
            {trustItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mk-section mk-cta-band">
        <div>
          <p className="mk-eyebrow">Buying path</p>
          <h2>Small courses should be able to start without getting trapped in a sales process.</h2>
        </div>
        <div className="mk-actions mk-actions-right">
          <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/pricing')}>See plans</button>
          <a className="mk-btn mk-btn-primary" href="/signin">Start Starter or Growth</a>
        </div>
      </section>
    </>
  );
}

function PricingPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Pricing</p>
        <h1>Simple pricing for course operations teams.</h1>
        <p className="mk-lead">Starter and Growth are positioned for self-serve rollout. Use Enterprise when you need more than one team, one process, and one property to line up cleanly.</p>
      </section>
      <section className="mk-section">
        <div className="mk-pricing-grid">
          {pricingTiers.map((tier) => (
            <article className={`mk-price-card ${tier.featured ? 'featured' : ''}`} key={tier.name}>
              <p className="mk-eyebrow">{tier.name}{tier.featured ? ' · Most popular' : ''}</p>
              <h2>{tier.price}<span>{tier.cadence}</span></h2>
              <strong>{tier.annualPrice}</strong>
              <p>{tier.fit}</p>
              <p>{tier.description}</p>
              <ul className="mk-checklist">
                {tier.features.map((feature) => <li key={feature}>{feature}</li>)}
              </ul>
              <a className={`mk-btn ${tier.featured ? 'mk-btn-primary' : 'mk-btn-secondary'}`} href={tier.href}>{tier.cta}</a>
            </article>
          ))}
        </div>
      </section>
      <section className="mk-section">
        <div className="mk-compare-card">
          <h2>Compare plans</h2>
          <div className="mk-compare-table">
            <div className="mk-compare-row mk-compare-head">
              <strong>Feature</strong>
              <strong>Starter</strong>
              <strong>Growth</strong>
              <strong>Enterprise</strong>
            </div>
            {comparisonRows.map(([feature, starter, growth, enterprise]) => (
              <div className="mk-compare-row" key={feature}>
                <span>{feature}</span>
                <span>{starter}</span>
                <span>{growth}</span>
                <span>{enterprise}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SecurityPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Security</p>
        <h1>Operational records need to be accurate, restricted, and recoverable.</h1>
        <p className="mk-lead">The current TurfOp stack uses role-based course scope, bcrypt password hashing, JWT auth, Helmet, CORS allowlists, password rate limits, and audit logging in the backend.</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-four">
          {securityStandards.map((section) => (
            <article className="mk-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function ContactPage() {
  return (
    <section className="mk-page-hero mk-contact-hero">
      <div>
        <p className="mk-eyebrow">Book a demo</p>
        <h1>Show us the bottlenecks and we’ll tailor the walkthrough.</h1>
        <p className="mk-lead">We focus the review on downtime, missing parts, crew workflow, equipment history, and multi-course visibility instead of giving you a generic product tour.</p>
      </div>
      <div className="mk-card">
        <h3>Fastest next steps</h3>
        <ul className="mk-checklist">
          <li>Start Starter for one course that needs cleaner daily operations</li>
          <li>Start Growth if you need broader controls, better accountability, or multiple properties</li>
          <li>Book rollout review for Enterprise if you need group oversight or integration planning</li>
        </ul>
        <div className="mk-actions mk-actions-stack">
          <button type="button" className="mk-btn mk-btn-primary" onClick={() => navigate('/signin')}>Start Starter or Growth</button>
          <a className="mk-btn mk-btn-secondary" href="mailto:sales@turfop.com?subject=TurfOp%20rollout%20review">Email sales</a>
        </div>
      </div>
    </section>
  );
}

function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [courseId, setCourseId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const hasInviteToken = Boolean(inviteToken);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await signInWithPassword(email, password);
      window.location.href = '/my-work';
    } catch (submitError) {
      setError(submitError.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await requestPasswordReset({ email, courseId });
      setMessage('If that account exists, reset instructions have been prepared.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to send reset instructions.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteAccept(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    try {
      await acceptInvite({ token: inviteToken, password });
      setInviteToken('');
      setPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, '', '/signin');
      setMessage('Password set. You can sign in now.');
    } catch (submitError) {
      setError(submitError.message || 'Unable to finish account setup.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mk-page-hero mk-contact-hero">
      <div>
        <p className="mk-eyebrow">Employee access</p>
        <h1>Sign in to TurfOp</h1>
        <p className="mk-lead">Use your employee account to access assigned courses, work orders, equipment, inventory, and mobile sync status.</p>
      </div>
      <div className="mk-card mk-signin-card">
        <h3>{hasInviteToken ? 'Create your password' : showReset ? 'Request password reset' : 'Enter your account'}</h3>
        {error ? <div className="mk-inline-banner mk-inline-banner-error">{error}</div> : null}
        {message ? <div className="mk-inline-banner">{message}</div> : null}
        <form className="mk-signin-form" onSubmit={hasInviteToken ? handleInviteAccept : showReset ? handleReset : handleSubmit}>
          {hasInviteToken ? (
            <>
              <label>
                Invite token
                <input type="text" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} autoCapitalize="none" autoCorrect="off" required />
              </label>
              <label>
                New password
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
              <label>
                Confirm password
                <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </label>
            </>
          ) : (
            <label>
              Email
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
          )}
          {!hasInviteToken && !showReset ? (
            <label>
              Password
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
          ) : null}
          {!hasInviteToken && showReset ? (
            <label>
              Course ID (optional)
              <input type="text" value={courseId} onChange={(event) => setCourseId(event.target.value)} placeholder="Leave blank to use your first membership" />
            </label>
          ) : null}
          <button className="mk-btn mk-btn-primary" type="submit" disabled={loading}>
            {loading ? (hasInviteToken ? 'Saving…' : showReset ? 'Sending…' : 'Signing in…') : (hasInviteToken ? 'Set password' : showReset ? 'Send reset instructions' : 'Enter app')}
          </button>
          {hasInviteToken ? null : (
            <button className="mk-btn mk-btn-secondary" type="button" onClick={() => { setShowReset((current) => !current); setError(''); setMessage(''); }} disabled={loading}>
              {showReset ? 'Back to sign in' : 'Forgot password?'}
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function LegalPage({ eyebrow, title, intro, sections }) {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="mk-lead">{intro}</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-four">
          {sections.map((section) => (
            <article className="mk-card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.body}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function Footer() {
  return (
    <footer className="mk-footer">
      <div>
        <strong>TurfOp</strong>
        <p>Equipment, inventory, maintenance, and field workflow control for golf-course operations.</p>
      </div>
      <div className="mk-footer-links">
        <button type="button" onClick={() => navigate('/pricing')}>Pricing</button>
        <button type="button" onClick={() => navigate('/security')}>Security</button>
        <button type="button" onClick={() => navigate('/privacy')}>Privacy</button>
        <button type="button" onClick={() => navigate('/terms')}>Terms</button>
      </div>
    </footer>
  );
}

export default function PublicSite() {
  const [page, setPage] = useState(() => getPageFromPath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPage(getPageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const titleMap = {
      landing: 'TurfOp | Golf-course operations software',
      pricing: 'TurfOp Pricing',
      security: 'TurfOp Security',
      contact: 'TurfOp Rollout Review',
      privacy: 'TurfOp Privacy',
      terms: 'TurfOp Terms',
      signin: 'TurfOp Sign In'
    };
    document.title = titleMap[page] || titleMap.landing;
  }, [page]);

  const content = useMemo(() => {
    if (page === 'pricing') return <PricingPage />;
    if (page === 'security') return <SecurityPage />;
    if (page === 'contact') return <ContactPage />;
    if (page === 'signin') return <SignInPage />;
    if (page === 'privacy') {
      return <LegalPage eyebrow="Privacy" title="Privacy for operational course data" intro="TurfOp is meant to collect the minimum information needed to run course operations, secure account access, and maintain an auditable maintenance history." sections={privacySections} />;
    }
    if (page === 'terms') {
      return <LegalPage eyebrow="Terms" title="Terms for using TurfOp" intro="These terms reflect the current operating model of the product: early commercial software for golf-course operations teams with real production data and practical customer responsibilities." sections={termsSections} />;
    }
    return <LandingPage />;
  }, [page]);

  return (
    <div className="mk-shell">
      <div className="mk-container">
        <MarketingNav activePage={page} />
        <main>{content}</main>
        <Footer />
      </div>
    </div>
  );
}
