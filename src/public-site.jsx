import { useEffect, useState } from 'react';
import turfopLogo from './assets/turfop-logo-web.png';
import { APP_ROUTES } from './routes';
import { api } from './services/api';
import './public-site.css';

const heroStats = [
  ['Live activity feed', 'Always on'],
  ['Inventory accuracy', 'Auto-updates'],
  ['Offline on range', 'Syncs later']
];

const painCards = [
  {
    title: 'Inventory disappears when it lives on paper',
    body: 'Parts used in work orders automatically deduct from stock. Managers see accurate levels without manual counts.'
  },
  {
    title: 'No one knows what the crew is actually doing',
    body: 'Live technician activity feed shows who is working on what and their online status. Full audit trail of completed work.'
  },
  {
    title: 'Weak signal on the range breaks updates',
    body: 'Offline-first mobile app lets technicians complete work orders with notes and photos. Everything syncs when back in coverage.'
  }
];

const featureCards = [
  {
    title: 'Visual Work Order Board',
    body: 'Drag-and-drop work orders with assignment, comments, photos, parts usage, and a full history of each job.',
    lines: ['Hole 7 aeration · In Progress · Mike', 'Sprinkler head repair · High priority · Sarah', 'Mower inspection · Completed · Photo attached']
  },
  {
    title: 'Course Configuration',
    body: 'Define your exact layout — holes, sections, greens, flags, bunkers. Work orders and reporting adapt automatically.',
    lines: ['18 holes · 4 fairway sections', 'Greens · 18 flags', 'Bunkers · 42 hazards']
  },
  {
    title: 'Live Technician Feed + Offline Sync',
    body: 'See what everyone is working on in real time. Technicians work offline on the range and sync when back at the clubhouse.',
    lines: ['Mike · Aerating greens · Online', 'Sarah · Sprinkler repair · 3 updates queued', 'Last sync · 2 minutes ago']
  }
];

const trustItems = [
  'Role-based permissions for managers, technicians, and admins',
  'Audit log for every work order update, part used, and completion note',
  'Offline sync visibility for queued updates from low-signal areas',
  'Course-scoped access so teams only see authorized operations data',
  'Traceable inventory changes tied directly to completed work orders',
  'Built by an IT and GRC professional with security in the workflow from day one'
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$49',
    cadence: '/ course / month',
    annualPrice: '$470/year when billed annually',
    fit: 'Single-course operations teams',
    description: 'Perfect for one golf course that needs accurate inventory, live visibility, and reliable offline updates.',
    features: ['1 course with full customization', 'Visual work order board', 'Live technician activity feed', 'Inventory auto-deduct', 'Offline-first mobile sync', 'Basic reporting and audit trail'],
    cta: 'Start Free Trial',
    href: '/signin'
  },
  {
    name: 'Growth',
    price: '$99',
    cadence: '/month',
    annualPrice: '$950/year when billed annually',
    fit: 'Multi-course or growing operations',
    description: 'For teams managing 2–5 courses that need centralized visibility, advanced reporting, and stronger controls.',
    features: ['Up to 5 courses', 'Everything in Starter', 'Advanced course configuration', 'Real-time technician status', 'Full audit and compliance reports', 'Priority support'],
    cta: 'Start Free Trial',
    href: '/signin',
    featured: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    cadence: '',
    annualPrice: 'For groups and management companies',
    fit: 'Portfolio operators and large organizations',
    description: 'Custom rollout, integrations, company-level controls, dedicated support, and advanced security workflows.',
    features: ['Unlimited courses', 'Everything in Growth', 'API and custom modules', 'Advanced security controls', 'Dedicated onboarding and training', 'Enterprise SLA'],
    cta: 'Book a Demo',
    href: '/book-demo'
  }
];

const securityStandards = [
  {
    title: 'Authentication and scoped access',
    body: 'JWT-based auth with course memberships. Technicians only see their assigned work and the courses they are authorized for.'
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
          <small>Golf course operations, not golfer software</small>
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
          <p className="mk-eyebrow">Built for golf course operations</p>
          <h1>Manage work orders, inventory, and crews — even offline.</h1>
          <p className="mk-lead">
            TurfOp gives superintendents and operations managers a visual work order board, live activity feed, automatic inventory updates, full course customization, and reliable offline sync for the range.
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
            <span>Full course customization</span>
          </div>
        </div>
        <HeroScreens />
      </section>

      <section className="mk-section">
        <div className="mk-section-heading">
          <p className="mk-eyebrow">Why teams switch</p>
          <h2>Clear answers to the problems superintendents and crews deal with every day.</h2>
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
            <h2>See the workflow your course needs — in seconds.</h2>
          </div>
          <p className="mk-muted">Visual work orders, live technician status, auto-updating inventory, offline sync, and full course customization.</p>
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
            <h2>Secure, traceable, and ready for operational review.</h2>
            <p className="mk-muted">
              Built by an IT and GRC professional, TurfOp includes audit trails, permission-based access, offline sync visibility, and operational controls from day one.
            </p>
          </div>
          <ul className="mk-checklist">
            {trustItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mk-section mk-cta-band">
        <div>
          <p className="mk-eyebrow">Ready for your course</p>
          <h2>Give your operations team one clear place to track work, people, and parts.</h2>
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
  ["Visual work order board", "✓", "✓", "✓"],
  ["Live technician feed", "✓", "✓", "✓"],
  ["Auto-updating inventory", "✓", "✓", "✓"],
  ["Offline-first mobile", "✓", "✓", "✓"],
  ["Course customization", "✓", "✓", "✓"],
  ["Full audit trail", "✓", "✓", "✓"],
  ["API and custom modules", "—", "—", "✓"],
];

function PricingPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Pricing</p>
        <h1>Simple pricing for golf course operations teams.</h1>
        <p className="mk-lead">Starter for one course. Growth for 2–5 courses. Enterprise for management companies and portfolios.</p>
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
};

function SecurityPage() {
  return (
    <>
      <section className="mk-page-hero">
        <p className="mk-eyebrow">Security & GRC</p>
        <h1>Security, permissions, and auditability built in from day one.</h1>
        <p className="mk-lead">TurfOp uses role-based course scope, bcrypt password hashing, JWT auth, audit logging, offline sync visibility, and backend controls that help courses evaluate and trust operational software.</p>
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
        <h1>See how TurfOp fits your course operations.</h1>
        <p className="mk-lead">We will tailor the walkthrough to your course layout, team workflow, inventory needs, and offline use cases.</p>
      </div>
      <div className="mk-card">
        <h3>What we will cover</h3>
        <ul className="mk-checklist">
          <li>Configure your course layout, staff roles, and inventory rules</li>
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

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await api.login({ email, password });
      // Move off the public /signin route so entry.jsx loads the authenticated app bundle.
      window.location.assign(APP_ROUTES.dashboard);
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mk-signin-page">
      <div className="mk-signin-card">
        <h2>Sign in to TurfOp</h2>
        <p>Use your employee account to access your courses and operations data.</p>
        <form className="mk-signin-form" onSubmit={handleSubmit}>
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
          {error && (
            <div className="mk-inline-banner mk-inline-banner-error">
              {error}
            </div>
          )}
          <button
            type="submit"
            className="mk-btn mk-btn-primary"
            disabled={loading}
            style={{ minHeight: "48px", width: "100%", fontWeight: "600" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="mk-signin-help">
          Need access?{" "}
          <a href="/invite">
            Request an invite
          </a>
        </p>
      </div>
      <aside className="mk-signin-proof" aria-label="TurfOp operations preview">
        <p className="mk-eyebrow">Operations hub</p>
        <h3>Track work, parts, and crew activity from one secure dashboard.</h3>
        <ul className="mk-checklist">
          <li>Course-scoped access for every employee</li>
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
  else if (activePage === 'signin') content = <SignInPage />;
  else content = <LandingPage />;

  return (
    <div className="mk-shell">
      <div className="mk-container">
        <MarketingNav activePage={activePage} />
        {content}
      </div>
    </div>
  );
}

export default PublicSite;
