import { useEffect, useState } from 'react';
import turfopLogo from './assets/turfop-logo-web.png';
import { APP_ROUTES } from './routes';
import { api } from './services/api';
import './public-site.css';

const productPills = [
  'Visual work order board',
  'Templates for recurring work',
  'Multi-facility operations',
  'Inventory + equipment tracking',
  'Clock-in approvals',
  'Push notifications'
];

const highlights = [
  {
    title: 'Work Orders + Crew Execution',
    body: 'Create, assign, and complete work with a drag-and-drop board, in-ticket comments, photos, and status visibility from dispatch to closeout.'
  },
  {
    title: 'Inventory + Equipment in One Flow',
    body: 'Track parts, tools, and equipment records with usage tied directly to work orders so your data stays accurate without duplicate entry.'
  },
  {
    title: 'Multi-Facility Command',
    body: 'Manage teams across facilities with scoped access, roll-up visibility, and facility-specific workflows that stay clean and auditable.'
  },
  {
    title: 'Templates + Preventive Work',
    body: 'Standardize repeatable tasks with templates to reduce missed steps, increase consistency, and onboard new crew members faster.'
  }
];

const testimonials = [
  {
    quote: 'We replaced whiteboards and scattered spreadsheets with one clear operating system for our grounds team.',
    name: 'Operations Director',
    org: 'Regional Sports Complex'
  },
  {
    quote: 'The templates and notifications alone cut coordination time every morning. Everyone knows what to do and where to go.',
    name: 'Head Grounds Manager',
    org: 'Private Golf Facility'
  },
  {
    quote: 'Inventory and work orders are finally connected. We can trust what parts were used and when.',
    name: 'Facilities Superintendent',
    org: 'Multi-Site Campus'
  }
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$99',
    cadence: '/facility/month',
    annualPrice: '$1,188/year',
    fit: 'Best for single-facility teams',
    description: 'Get operational control with core workflows.',
    features: ['Unlimited users', 'Unlimited work orders', 'Inventory + equipment tracking', 'Mobile workflows + offline support', 'Basic reporting'],
    cta: 'Start Free Trial',
    href: '/signin'
  },
  {
    name: 'Pro',
    price: '$249',
    cadence: '/facility/month',
    annualPrice: '$2,988/year',
    fit: 'Best for growing operations',
    description: 'Add deeper planning, automation, and visibility.',
    features: ['Everything in Starter', 'Service templates', 'Advanced reporting', 'Notification controls', 'Time tracking + approvals'],
    cta: 'Request a Demo',
    href: '/book-demo',
    featured: true
  },
  {
    name: 'Enterprise',
    price: '$399',
    cadence: '/facility/month + site add-ons',
    annualPrice: 'Custom annual terms available',
    fit: 'Best for multi-facility organizations',
    description: 'Centralized governance and integrations.',
    features: ['Everything in Pro', 'Multi-facility roll-up views', 'API access', 'SSO support', 'Priority onboarding'],
    cta: 'Talk to Sales',
    href: '/book-demo'
  }
];

const comparisonRows = [
  ['Unlimited users', '✓', '✓', '✓'],
  ['Unlimited work orders', '✓', '✓', '✓'],
  ['Inventory + equipment tracking', '✓', '✓', '✓'],
  ['Templates', '—', '✓', '✓'],
  ['Time tracking + approvals', '—', '✓', '✓'],
  ['Multi-facility roll-up', '—', '—', '✓'],
  ['API + SSO', '—', '—', '✓']
];

const complianceRoadmap = [
  {
    title: 'SOC 2 Type I/II readiness',
    status: 'In preparation',
    body: 'Control mapping and evidence collection are being structured around access control, change management, logging, and incident response.'
  },
  {
    title: 'ISO/IEC 27001 readiness',
    status: 'In preparation',
    body: 'Information security management processes are being formalized across risk treatment, policy management, vendor review, and operational controls.'
  },
  {
    title: 'GDPR data rights support',
    status: 'Active',
    body: 'Privacy requests, lawful processing language, and consent management are included in public policy and product-adjacent workflows.'
  }
];

const missionStatement = `TurfOp exists to give turf managers, grounds crews, and facility operators one trusted system to run daily execution with confidence. We believe operational excellence comes from clarity: clear priorities, clear accountability, and clear data from the field to leadership.`;

const missionStatement2 = `Our mission is to modernize grounds operations with software that is practical, secure, and built for real crews — unifying work orders, inventory, templates, time tracking, and multi-facility coordination so every team can protect assets, reduce downtime, and deliver consistently great playing and facility conditions.`;

function getPageFromPath(pathname) {
  if (pathname === '/pricing') return 'pricing';
  if (pathname === '/security') return 'security';
  if (pathname === '/mission' || pathname === '/about') return 'mission';
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
        <span className="mk-brand-mark"><img src={turfopLogo} alt="TurfOp logo" /></span>
        <span>
          <strong>TurfOp</strong>
          <small>All-in-one operations platform for turf teams</small>
        </span>
      </button>
      <nav className="mk-nav-links" aria-label="Primary">
        <button type="button" className={activePage === 'landing' ? 'active' : ''} onClick={() => navigate('/')}>Product</button>
        <button type="button" className={activePage === 'pricing' ? 'active' : ''} onClick={() => navigate('/pricing')}>Pricing</button>
        <button type="button" className={activePage === 'mission' ? 'active' : ''} onClick={() => navigate('/mission')}>Mission</button>
        <button type="button" className={activePage === 'security' ? 'active' : ''} onClick={() => navigate('/security')}>Security & Compliance</button>
        <button type="button" className={activePage === 'contact' ? 'active' : ''} onClick={() => navigate('/book-demo')}>Demo</button>
        <a className="mk-signin" href="/signin">Sign in</a>
      </nav>
    </header>
  );
}

function ProductMockup() {
  return (
    <div className="mk-product-shot" aria-hidden="true">
      <div className="mk-shot-top">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <strong>TurfOp - Operations Dashboard</strong>
        <span className="mk-bell">🔔 3</span>
      </div>
      <div className="mk-shot-body">
        <aside className="mk-shot-sidebar">
          <p>Facilities</p>
          <strong>North Course</strong>
          <strong>South Campus</strong>
          <span className="active">Templates</span>
          <span>Work Board</span>
          <span>Inventory</span>
          <span>Time Approval</span>
        </aside>
        <section className="mk-shot-main">
          <div className="mk-shot-kpis">
            <article><small>Open tickets</small><strong>18</strong></article>
            <article><small>Due today</small><strong>9</strong></article>
            <article><small>Pending approvals</small><strong>4</strong></article>
            <article><small>Low stock parts</small><strong>7</strong></article>
          </div>
          <div className="mk-shot-grid">
            <article>
              <h4>Templates</h4>
              <p>Morning Greens Setup • 12 tasks</p>
              <p>Irrigation Zone Inspection • Weekly</p>
            </article>
            <article>
              <h4>Notification Center</h4>
              <p>Valve replacement approved</p>
              <p>2 time clock submissions need review</p>
            </article>
            <article>
              <h4>Multi-Facility View</h4>
              <p>North: 6 in progress</p>
              <p>South: 3 blocked / 1 urgent</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <>
      <section className="mk-hero">
        <div>
          <p className="mk-eyebrow">Modern operations for turf and grounds teams</p>
          <h1>Run work orders, inventory, time, and multi-facility operations in one platform.</h1>
          <p className="mk-lead">TurfOp helps managers and crews move faster with less confusion using live coordination, templates, approvals, and field-ready workflows.</p>
          <div className="mk-actions">
            <a className="mk-btn mk-btn-primary" href="/signin">Get Started</a>
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/book-demo')}>Request a Demo</button>
          </div>
          <div className="mk-proof-strip">
            {productPills.map((pill) => <span key={pill}>{pill}</span>)}
          </div>
        </div>
        <ProductMockup />
      </section>

      <section className="mk-section">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">Why TurfOp</p>
          <h2>Built around the real work your teams do every day.</h2>
        </div>
        <div className="mk-card-grid mk-card-grid-four">
          {highlights.map((item) => (
            <article className="mk-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">Customer outcomes</p>
          <h2>Trusted by teams modernizing daily execution.</h2>
        </div>
        <div className="mk-card-grid mk-card-grid-three">
          {testimonials.map((item) => (
            <article className="mk-card" key={item.quote}>
              <p>“{item.quote}”</p>
              <h3>{item.name}</h3>
              <p>{item.org}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section mk-cta-band">
        <div>
          <p className="mk-eyebrow">Ready to upgrade operations?</p>
          <h2>Give your crews a system that is fast, clear, and built for the field.</h2>
        </div>
        <div className="mk-actions mk-actions-right">
          <a className="mk-btn mk-btn-primary" href="/signin">Get Started</a>
          <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/mission')}>Read Our Mission</button>
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
        <h1>Straightforward pricing for turf and grounds operations.</h1>
        <p className="mk-lead">Per-facility pricing with unlimited users so managers, technicians, and admins can work from one shared source of truth.</p>
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
            {comparisonRows.map(([feature, starter, pro, enterprise]) => (
              <div className="mk-compare-row" key={feature}>
                <span>{feature}</span>
                <span>{starter}</span>
                <span>{pro}</span>
                <span>{enterprise}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function MissionPage() {
  return (
    <>
      <section className="mk-page-hero mk-mission-hero">
        <p className="mk-eyebrow">Our mission</p>
        <h1>We are building the operating system for high-performing turf and grounds teams.</h1>
        <p className="mk-lead">{missionStatement}</p>
        <p className="mk-lead">{missionStatement2}</p>
        <div className="mk-actions">
          <a className="mk-btn mk-btn-primary" href="/signin">Get Started</a>
          <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/book-demo')}>Request a Demo</button>
        </div>
      </section>
    </>
  );
}

function SecurityPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Security & Compliance</p>
        <h1>Built for operational trust, governance, and enterprise readiness.</h1>
        <p className="mk-lead">TurfOp is designed with role-based access, auditability, encryption in transit, and privacy-forward workflows to support modern compliance programs.</p>
      </section>

      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-three">
          {complianceRoadmap.map((item) => (
            <article className="mk-card" key={item.title}>
              <p className="mk-eyebrow">{item.status}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-card mk-legal-note">
          <h3>Current controls highlighted</h3>
          <ul className="mk-checklist">
            <li>Role-based permissions and facility-scoped access</li>
            <li>Authenticated sessions and controlled account lifecycle workflows</li>
            <li>Operational audit logs for critical user actions</li>
            <li>Documented privacy/contact channels for data rights requests</li>
          </ul>
          <p className="mk-muted">Legal review still required for final policy language, data-processing agreements, and region-specific obligations before formal certification claims.</p>
        </div>
      </section>
    </>
  );
}

function ContactPage() {
  return (
    <section className="mk-page-hero mk-contact-hero">
      <div>
        <p className="mk-eyebrow">Tailored demo</p>
        <h1>See TurfOp with your workflow, facilities, and crew structure.</h1>
        <p className="mk-lead">We will walk through work orders, templates, inventory, time tracking approvals, and multi-facility operations based on your actual environment.</p>
      </div>
      <div className="mk-card">
        <h3>What we will cover</h3>
        <ul className="mk-checklist">
          <li>How your team plans and executes daily work</li>
          <li>How inventory and equipment updates stay accurate</li>
          <li>How permissions and compliance controls are managed</li>
        </ul>
        <div className="mk-actions mk-actions-stack">
          <button type="button" className="mk-btn mk-btn-primary" onClick={() => navigate('/signin')}>Get Started</button>
          <a className="mk-btn mk-btn-secondary" href="mailto:sales@turfop.com?subject=TurfOp%20Demo%20Request">Email Sales</a>
        </div>
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Privacy Policy</p>
        <h1>How TurfOp processes and protects personal data.</h1>
        <p className="mk-lead">This summary describes key processing activities. Final legal text should be reviewed and approved by counsel before production publication.</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-two">
          <article className="mk-card"><h3>Data categories</h3><p>Account identity data, facility membership, work records, inventory/equipment events, and audit activity metadata.</p></article>
          <article className="mk-card"><h3>Purpose of processing</h3><p>Authentication, role enforcement, operational workflow execution, analytics for service quality, and customer support.</p></article>
          <article className="mk-card"><h3>GDPR rights</h3><p>Users may request access, correction, deletion, restriction, portability, and objection where applicable.</p></article>
          <article className="mk-card"><h3>Data handling</h3><p>Data is processed under documented controls, least-privilege access principles, and retention expectations aligned to business needs.</p></article>
        </div>
      </section>
    </>
  );
}

function TermsPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Terms of Service</p>
        <h1>Usage terms for the TurfOp platform.</h1>
        <p className="mk-lead">This summary should be replaced by attorney-reviewed terms prior to formal commercial rollout.</p>
      </section>
      <section className="mk-section">
        <div className="mk-card-grid mk-card-grid-two">
          <article className="mk-card"><h3>Authorized use</h3><p>Use is limited to approved organizational users and lawful business operations.</p></article>
          <article className="mk-card"><h3>Security responsibilities</h3><p>Customers are responsible for account governance, credential confidentiality, and timely incident reporting.</p></article>
          <article className="mk-card"><h3>Service boundaries</h3><p>Platform functionality, support windows, and availability commitments should be documented in commercial terms.</p></article>
          <article className="mk-card"><h3>Contact</h3><p>Legal and compliance inquiries: <a href="mailto:sales@turfop.com">sales@turfop.com</a>.</p></article>
        </div>
      </section>
    </>
  );
}

function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('turfop_cookie_consent_v1');
    if (!saved) setVisible(true);
  }, []);

  function saveConsent(preferences) {
    window.localStorage.setItem('turfop_cookie_consent_v1', JSON.stringify({ ...preferences, updatedAt: new Date().toISOString() }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside className="mk-cookie-banner" role="dialog" aria-label="Cookie consent">
      <div>
        <strong>Cookie preferences</strong>
        <p>We use essential cookies to run TurfOp. You can accept or reject optional analytics and personalization cookies.</p>
        <ul>
          <li>Essential (always on)</li>
          <li>Analytics</li>
          <li>Personalization</li>
        </ul>
      </div>
      <div className="mk-cookie-actions">
        <button type="button" className="mk-btn mk-btn-secondary" onClick={() => saveConsent({ essential: true, analytics: false, personalization: false })}>Reject all optional</button>
        <button type="button" className="mk-btn mk-btn-secondary" onClick={() => saveConsent({ essential: true, analytics: true, personalization: false })}>Allow analytics only</button>
        <button type="button" className="mk-btn mk-btn-primary" onClick={() => saveConsent({ essential: true, analytics: true, personalization: true })}>Accept all</button>
      </div>
    </aside>
  );
}

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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </label>
          <label>
            Confirm password
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={8} required />
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </label>
          {error && <div className="mk-inline-banner mk-inline-banner-error">{error}</div>}
          {success && <div className="mk-inline-banner mk-inline-banner-success">{success}</div>}
          <button type="submit" className="mk-btn mk-btn-primary" disabled={loading} style={{ minHeight: '48px', width: '100%', fontWeight: '600' }}>
            {loading ? 'Sending reset link...' : 'Send reset link'}
          </button>
        </form>
        <p className="mk-signin-help">Remembered it? <button type="button" className="mk-link-button" onClick={showLoginMode}>Back to sign in</button></p>
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
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="mk-inline-banner mk-inline-banner-error">{error}</div>}
          {success && <div className="mk-inline-banner mk-inline-banner-success">{success}</div>}
          <button type="submit" className="mk-btn mk-btn-primary" disabled={loading} style={{ minHeight: '48px', width: '100%', fontWeight: '600' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <p className="mk-signin-help"><button type="button" className="mk-link-button" onClick={showResetMode}>Forgot password?</button></p>
        <p className="mk-signin-help">Need access? <span>Ask your TurfOp admin to send an invite.</span></p>
      </>
    );
  }

  return (
    <div className="mk-signin-page">
      <div className="mk-signin-card">{formContent}</div>
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
}

function PublicSiteFooter() {
  return (
    <footer className="mk-footer">
      <p>© {new Date().getFullYear()} TurfOp. Built for modern turf and grounds operations.</p>
      <nav className="mk-footer-links" aria-label="Footer">
        <button type="button" onClick={() => navigate('/mission')}>Mission</button>
        <button type="button" onClick={() => navigate('/security')}>Security & Compliance</button>
        <button type="button" onClick={() => navigate('/privacy')}>Privacy Policy</button>
        <button type="button" onClick={() => navigate('/terms')}>Terms of Service</button>
      </nav>
    </footer>
  );
}

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
  else if (activePage === 'mission') content = <MissionPage />;
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
        <PublicSiteFooter />
      </div>
      <CookieConsentBanner />
    </div>
  );
}

export default PublicSite;
