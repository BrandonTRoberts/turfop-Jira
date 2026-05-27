import { useEffect, useState } from 'react';
import turfopLogo from './assets/turfop-logo-web.png';
import { APP_ROUTES } from './routes';
import { api } from './services/api';
import './public-site.css';

const heroStats = [
  ['Operational visibility', 'Real-time'],
  ['Inventory integrity', 'Continuously updated'],
  ['Field continuity', 'Offline-first sync']
];

const painCards = [
  {
    title: 'Inventory disappears when it lives on paper',
    body: 'Inventory updates in real time as parts are consumed in work orders, reducing reconciliation effort and stock uncertainty.'
  },
  {
    title: 'No one knows what the crew is actually doing',
    body: 'Give leadership a live view of assignments, progress, and bottlenecks, with complete historical context on every job.'
  },
  {
    title: 'Weak signal on the range breaks updates',
    body: 'Teams continue documenting work in low-coverage areas; updates are securely synchronized when connectivity returns.'
  }
];

const featureCards = [
  {
    title: 'Visual Work Order Board',
    body: 'Coordinate planning, assignment, and execution in a single operational workspace with comments, photos, parts, and full traceability.',
    lines: ['Hole 7 aeration · In Progress · Mike', 'Sprinkler head repair · High priority · Sarah', 'Mower inspection · Completed · Photo attached']
  },
  {
    title: 'Facility Configuration',
    body: 'Model each facility’s structure — holes, sections, greens, flags, and bunkers — so workflows and reporting reflect real operations.',
    lines: ['18 holes · 4 fairway sections', 'Greens · 18 flags', 'Bunkers · 42 hazards']
  },
  {
    title: 'Live Technician Feed + Offline Sync',
    body: 'Monitor technician progress in real time while preserving continuity with offline capture and automatic synchronization.',
    lines: ['Mike · Aerating greens · Online', 'Sarah · Sprinkler repair · 3 updates queued', 'Last sync · 2 minutes ago']
  }
];

const trustItems = [
  'Role-based permissions for managers, technicians, and admins',
  'Audit log for every work order update, part used, and completion note',
  'Offline sync visibility for queued updates from low-signal areas',
  'Facility-scoped access so teams only see authorized operations data',
  'Traceable inventory changes tied directly to completed work orders',
  'Built by an IT and GRC professional with security in the workflow from day one'
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$99',
    cadence: '/ facility / month',
    annualPrice: '$1,188/year',
    fit: 'Small teams getting organized',
    description: 'Best for smaller operations that need clear equipment records and dependable inventory tracking.',
    features: ['Unlimited users', 'Unlimited work orders', 'Equipment records and maintenance history', 'Parts and inventory tracking', 'Photo-based issue reporting', 'Offline-friendly mobile workflows'],
    cta: 'Start 14-Day Pro Trial',
    href: '/signin'
  },
  {
    name: 'Pro',
    price: '$249',
    cadence: '/ facility / month',
    annualPrice: '$2,988/year (save $612/year)',
    fit: 'Private clubs and daily-fee 18-hole operations',
    description: 'Our most popular plan for teams that need tighter control, preventive scheduling, and stronger reporting.',
    features: ['Everything in Starter', 'Equipment health dashboard', 'Preventive maintenance scheduler', 'Inventory usage logs and low-stock alerts', 'Recurring work automation', 'Advanced operational reporting'],
    cta: 'Book a Demo',
    href: '/book-demo',
    featured: true
  },
  {
    name: 'Enterprise',
    price: '$399',
    cadence: '/ facility / month + $99/extra site',
    annualPrice: 'Custom annual terms available',
    fit: 'Management companies and multi-site portfolios',
    description: 'Built for organizations that require portfolio visibility, enterprise access controls, and integration support.',
    features: ['Everything in Pro', 'Multi-site roll-up reporting', 'API access', 'SSO support', 'Dedicated success manager', 'Custom integrations'],
    cta: 'Talk to Sales',
    href: '/book-demo'
  }
];

const securityStandards = [
  {
    title: 'Authentication and scoped access',
    body: 'JWT-based auth with facility memberships. Technicians only see their assigned work and the facilities they are authorized for.'
  },
  {
    title: 'Offline-first with secure sync',
    body: 'Work orders created offline stay on-device until coverage returns. Sync is audited and only completes with valid credentials.'
  },
  {
    title: 'Full audit trail and activity logging',
    body: 'Every work order update, part usage, status change, and technician action is logged with who did it and when.'
  },
  {
    title: 'GRC-aligned design',
    body: 'Built by an IT and GRC professional — permission-based, traceable, and aligned to operational risk review.'
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
          <small>Operational command center for golf facilities</small>
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
            <p>Live Operations Dashboard</p>
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
          <div className="mk-table-row mk-table-head"><span>Technician</span><span>Current Work</span><span>Status</span></div>
          <div className="mk-table-row"><span>Mike Thompson</span><span>Aerating greens on hole 7</span><span className="text-emerald-500">Online</span></div>
          <div className="mk-table-row"><span>Sarah Chen</span><span>Sprinkler repair - hole 12</span><span className="text-amber-500">Offline (syncing)</span></div>
        </div>
      </article>
      <article className="mk-screen mk-screen-mobile">
        <div className="mk-phone-notch" />
        <div className="mk-mobile-header">
          <span>Work Order #A1B2C3</span>
          <strong>Cart barn inspection</strong>
        </div>
        <div className="mk-mobile-pill-row">
          <span>In Progress</span>
          <span>2 parts used</span>
        </div>
        <ul className="mk-mobile-list">
          <li>Attach field photos</li>
          <li>Update inventory (auto-deduct)</li>
          <li>Save offline if signal drops</li>
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
          <p className="mk-eyebrow">Built for golf facility operations</p>
          <h1>Unify work orders, inventory, and field execution in one operations platform.</h1>
          <p className="mk-lead">
            TurfOp gives superintendents and operations leaders structured oversight, faster coordination, and dependable offline continuity across the entire operation.
          </p>
          <div className="mk-actions">
            <a className="mk-btn mk-btn-primary" href="/signin">Start Free Trial</a>
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/book-demo')}>Book a Demo</button>
          </div>
          <div className="mk-proof-strip">
            <span>Visual work order board</span>
            <span>Live technician feed</span>
            <span>Auto-updating inventory</span>
            <span>Offline-first mobile</span>
            <span>Full facility customization</span>
          </div>
        </div>
        <HeroScreens />
      </section>

      <section className="mk-section">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">Why teams switch</p>
          <h2>Built to solve the operational gaps that slow high-performing facilities.</h2>
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
            <h2>See the workflow your facility needs — in seconds.</h2>
          </div>
          <p className="mk-muted">Visual work orders, live technician status, auto-updating inventory, offline sync, and full facility customization.</p>
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
            <p className="mk-eyebrow">Security built in</p>
            <h2>Security, traceability, and governance by design.</h2>
            <p className="mk-muted">
              TurfOp includes role-based access, comprehensive audit trails, offline sync visibility, and controls aligned to operational governance.
            </p>
          </div>
          <ul className="mk-checklist">
            {trustItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mk-section mk-cta-band">
        <div>
          <p className="mk-eyebrow">Ready for your facility</p>
          <h2>Standardize execution with one system for work, teams, and inventory.</h2>
        </div>
        <div className="mk-actions mk-actions-right">
          <a className="mk-btn mk-btn-primary" href="/signin">Start Free Trial</a>
          <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/pricing')}>See Plans</button>
        </div>
      </section>
    </>
  );
};

const comparisonRows = [
  ["Unlimited users", "✓", "✓", "✓"],
  ["Unlimited work orders", "✓", "✓", "✓"],
  ["Equipment records + maintenance history", "✓", "✓", "✓"],
  ["Parts + inventory tracking", "✓", "✓", "✓"],
  ["Preventive maintenance scheduler", "—", "✓", "✓"],
  ["Advanced operational reporting", "—", "✓", "✓"],
  ["API + SSO", "—", "—", "✓"],
];

function PricingPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Pricing</p>
        <h1>Simple pricing for equipment and inventory operations.</h1>
        <p className="mk-lead">Per-facility pricing with unlimited users so your whole team can run in one system without per-seat surprises.</p>
      </section>
      <section className="mk-section">
        <div className="mk-pricing-grid">
          {pricingTiers.map((tier) => (
            <article className={`mk-price-card ${tier.featured ? 'featured' : ''}`} key={tier.name}>
              <div className="mk-price-card-top">
                <p className="mk-eyebrow">{tier.name}</p>
                {tier.featured ? <span className="mk-recommended-badge">Recommended</span> : null}
              </div>
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
              <strong>Pro</strong>
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
};

function SecurityPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Security & GRC</p>
        <h1>Security, permissions, and auditability built in from day one.</h1>
        <p className="mk-lead">TurfOp uses role-based facility scope, bcrypt password hashing, JWT auth, audit logging, offline sync visibility, and backend controls that help facilities evaluate and trust operational software.</p>
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
};

function ContactPage() {
  return (
    <section className="mk-page-hero mk-contact-hero">
      <div>
        <p className="mk-eyebrow">Tailored demo</p>
        <h1>See how TurfOp fits your facility operations.</h1>
        <p className="mk-lead">We will tailor the walkthrough to your facility layout, team workflow, inventory needs, and offline use cases.</p>
      </div>
      <div className="mk-card">
        <h3>What we will cover</h3>
        <ul className="mk-checklist">
          <li>Configure your facility layout, staff roles, and inventory rules</li>
          <li>Walk through live work orders, technician activity, and offline sync</li>
          <li>Build a rollout plan your operations team can actually use</li>
        </ul>
        <div className="mk-actions mk-actions-stack">
          <button type="button" className="mk-btn mk-btn-primary" onClick={() => navigate('/signin')}>Start Free Trial</button>
          <a className="mk-btn mk-btn-secondary" href="mailto:sales@turfop.com?subject=TurfOp%20Demo%20Request">Email Sales</a>
        </div>
      </div>
    </section>
  );
};

function PrivacyPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Privacy</p>
        <h1>Privacy policy for TurfOp</h1>
        <p className="mk-lead">We collect only the data required to run facility operations, secure user access, and support service delivery.</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-two">
          <article className="mk-card">
            <h3>Data we collect</h3>
            <p>Account profile fields, facility memberships, work order records, inventory activity, and audit log events used for traceability.</p>
          </article>
          <article className="mk-card">
            <h3>How data is used</h3>
            <p>To authenticate users, apply role-based access, process operational workflows, maintain auditability, and provide customer support.</p>
          </article>
          <article className="mk-card">
            <h3>Data protection controls</h3>
            <p>TurfOp uses encrypted transport, session controls, permissions by role and facility, and logging controls aligned with GRC workflows.</p>
          </article>
          <article className="mk-card">
            <h3>Your options</h3>
            <p>For account updates or privacy requests, contact your organization admin or email <a href="mailto:sales@turfop.com">sales@turfop.com</a>.</p>
          </article>
        </div>
      </section>
    </>
  );
};

function TermsPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Terms</p>
        <h1>Terms of use for TurfOp</h1>
        <p className="mk-lead">Use of TurfOp requires authorized business access, responsible account security, and lawful use of the platform.</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-two">
          <article className="mk-card">
            <h3>Authorized access</h3>
            <p>Only approved team members may use TurfOp. Organizations are responsible for managing role assignments and account lifecycle actions.</p>
          </article>
          <article className="mk-card">
            <h3>Account security</h3>
            <p>Users must maintain credential confidentiality and report suspected compromise promptly to their organization administrator.</p>
          </article>
          <article className="mk-card">
            <h3>Operational integrity</h3>
            <p>Submitted operational data should be accurate and lawful. Misuse, abuse, or unauthorized access attempts are prohibited.</p>
          </article>
          <article className="mk-card">
            <h3>Support</h3>
            <p>For legal, privacy, or security questions, contact <a href="mailto:sales@turfop.com">sales@turfop.com</a>.</p>
          </article>
        </div>
      </section>
    </>
  );
};

function SignInPage() {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('token') || '';
  const facilityId = params.get('facilityId') || params.get('courseId') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mode, setMode] = useState(inviteToken ? 'invite' : 'login');

  async function handleLoginSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await api.login({ email, password });
      // Move off the public /signin route so entry.jsx loads the authenticated app bundle.
      window.location.assign(APP_ROUTES.dashboard);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteSubmit(e) {
    e.preventDefault();
    if (!inviteToken) {
      setError('Invite token is missing. Open the full link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.acceptInvite({ token: inviteToken, password });
      setSuccess('Your password is set. You can now sign in to TurfOp.');
      setPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, '', '/signin');
    } catch (err) {
      setError(err.message || 'Could not finish account setup. Please request a new invite.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetSubmit(e) {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.requestPasswordReset({ email, facilityId });
      setSuccess('Check your email for a password reset link. If the account exists, the reset instructions are on the way.');
    } catch (err) {
      setError(err.message || 'Could not request a password reset right now.');
    } finally {
      setLoading(false);
    }
  }

  function showResetMode() {
    setMode('reset');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  function showLoginMode() {
    setMode('login');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  }

  let formContent;
  if (mode === 'invite') {
    formContent = (
      <>
        <h2>Set your TurfOp password</h2>
        <p>Create a password to finish your account setup. This same flow also works for reset links.</p>
        <form className="mk-signin-form" onSubmit={handleInviteSubmit}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <div className="mk-inline-banner mk-inline-banner-error">{error}</div>}
          {success && <div className="mk-inline-banner mk-inline-banner-success">{success}</div>}
          <button type="submit" className="mk-btn mk-btn-primary" disabled={loading} style={{ minHeight: '48px', width: '100%', fontWeight: '600' }}>
            {loading ? 'Saving password...' : 'Save password'}
          </button>
        </form>
      </>
    );
  } else if (mode === 'reset') {
    formContent = (
      <>
        <h2>Reset your password</h2>
        <p>Enter your account email and we’ll send a secure link to set a new password.</p>
        <form className="mk-signin-form" onSubmit={handleResetSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          {error && <div className="mk-inline-banner mk-inline-banner-error">{error}</div>}
          {success && <div className="mk-inline-banner mk-inline-banner-success">{success}</div>}
          <button type="submit" className="mk-btn mk-btn-primary" disabled={loading} style={{ minHeight: '48px', width: '100%', fontWeight: '600' }}>
            {loading ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>
        <p className="mk-signin-help">
          Remembered it? <button type="button" className="mk-link-button" onClick={showLoginMode}>Back to sign in</button>
        </p>
      </>
    );
  } else {
    formContent = (
      <>
        <h2>Sign in to TurfOp</h2>
        <p>Use your employee account to access your facilities and operations data.</p>
        <form className="mk-signin-form" onSubmit={handleLoginSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <div className="mk-inline-banner mk-inline-banner-error">{error}</div>}
          {success && <div className="mk-inline-banner mk-inline-banner-success">{success}</div>}
          <button type="submit" className="mk-btn mk-btn-primary" disabled={loading} style={{ minHeight: '48px', width: '100%', fontWeight: '600' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mk-signin-help">
          <button type="button" className="mk-link-button" onClick={showResetMode}>Forgot password?</button>
        </p>
        <p className="mk-signin-help">
          Need access? <span>Ask your TurfOp admin to send an invite.</span>
        </p>
      </>
    );
  }

  return (
    <div className="mk-signin-page">
      <div className="mk-signin-card">
        {formContent}
      </div>
      <aside className="mk-signin-proof" aria-label="TurfOp operations preview">
        <p className="mk-eyebrow">Operations hub</p>
        <h3>Track work, parts, and crew activity from one secure dashboard.</h3>
        <ul className="mk-checklist">
          <li>Facility-scoped access for every employee</li>
          <li>Audit trail for work order and inventory changes</li>
          <li>Offline updates sync when coverage returns</li>
        </ul>
      </aside>
    </div>
  );
};

function PublicSite() {
  const [pathname, setPathname] = useState(window.location.pathname);
  const activePage = getPageFromPath(pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  let content;
  if (activePage === 'pricing') content = <PricingPage />;
  else if (activePage === 'security') content = <SecurityPage />;
  else if (activePage === 'contact') content = <ContactPage />;
  else if (activePage === 'privacy') content = <PrivacyPage />;
  else if (activePage === 'terms') content = <TermsPage />;
  else if (activePage === 'signin') content = <SignInPage />;
  else content = <LandingPage />;

  return (
    <div className="mk-shell">
      <div className="mk-container">
        <MarketingNav activePage={activePage} />
        {content}
        <footer className="mk-signin-help" style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button type="button" className="mk-link-button" onClick={() => navigate('/privacy')}>Privacy</button>
          <span> · </span>
          <button type="button" className="mk-link-button" onClick={() => navigate('/terms')}>Terms</button>
        </footer>
      </div>
    </div>
  );
}

export default PublicSite;
