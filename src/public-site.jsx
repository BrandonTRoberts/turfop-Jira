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
    title: 'Jira-like Issues Board',
    body: 'Drag-and-drop work orders with assignment, comments, photos, and parts usage. Full history and audit trail.',
    lines: ['Aerate greens on hole 7 · In Progress', 'Replace sprinkler head · Assigned to Sarah', 'Inspect mowers · Completed with notes']
  },
  {
    title: 'Course Configuration',
    body: 'Define your exact layout — holes, sections, greens, flags, bunkers. Work orders and reporting adapt automatically.',
    lines: ['18 holes · 4 fairway sections', 'Greens · 18 flags', 'Bunkers · 42 hazards']
  },
  {
    title: 'Live Technician Feed + Offline Sync',
    body: 'See what everyone is working on in real time. Technicians work offline on the range and sync when back at the clubhouse.',
    lines: ['Mike · Aerating greens (Online)', 'Sarah · Sprinkler repair (Offline - syncing)']
  }
];

const trustItems = [
  'Jira-style work orders with assignment and live activity feed',
  'Inventory that auto-updates when parts are used in work orders',
  'Offline-first mobile app designed for no-signal golf ranges',
  'Full course customization (holes, sections, greens, flags)',
  'Complete audit trail — see exactly what was done and when',
  'Built with GRC principles — secure, traceable, permission-based'
];

const pricingTiers = [
  {
    name: 'Starter',
    price: '$49',
    cadence: '/month per course',
    annualPrice: '$470 annually',
    fit: 'Single-course operations teams',
    description: 'Perfect for one golf course that needs accurate inventory, live visibility, and reliable offline updates.',
    features: ['1 course with full customization', 'Jira-like Issues Board', 'Live technician activity feed', 'Inventory auto-deduct', 'Offline-first mobile sync', 'Basic reporting and audit trail'],
    cta: 'Start Free Trial',
    href: '/signin'
  },
  {
    name: 'Growth',
    price: '$99',
    cadence: '/month',
    annualPrice: '$950 annually',
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
    description: 'Custom rollout, integrations, company-level controls, dedicated support, and advanced GRC features.',
    features: ['Unlimited courses', 'Everything in Growth', 'API and custom modules', 'Advanced compliance tools', 'Dedicated onboarding and training', 'Enterprise SLA'],
    cta: 'Book a Review',
    href: '/book-demo'
  }
];

const securityStandards = [
  {
    title: 'Authentication and course-scoped access',
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
    body: 'Built with your background in mind — permission-based, traceable, and compliant with operational risk standards.'
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
          <span>Work Order #TOP-A1B2C3</span>
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
          <h1>Track work orders, inventory, and technician activity — even offline on the range.</h1>
          <p className="mk-lead">
            TurfOp gives superintendents and operations managers a Jira-like Issues Board, live activity feed, automatic inventory updates, full course customization, and reliable offline sync for the golf range.
          </p>
          <div className="mk-actions">
            <a className="mk-btn mk-btn-primary" href="/signin">Start Free Trial</a>
            <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/book-demo')}>Book a Demo for Your Buyer</button>
          </div>
          <div className="mk-proof-strip">
            <span>Jira-like work orders</span>
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
            <h2>The workflow your buyer asked for — in seconds.</h2>
          </div>
          <p className="mk-muted">Jira-like board, live technician status, auto-updating inventory, offline sync, and full course customization.</p>
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
            <p className="mk-eyebrow">Built with GRC principles</p>
            <h2>Secure, traceable, and ready for your buyer.</h2>
            <p className="mk-muted">
              As a GRC Analyst with 12+ years in IT and cybersecurity, Brandon designed TurfOp with audit trails, permission-based access, offline sync visibility, and operational controls that match how buyers evaluate software.
            </p>
          </div>
          <ul className="mk-checklist">
            {trustItems.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mk-section mk-cta-band">
        <div>
          <p className="mk-eyebrow">Ready for your buyer</p>
          <h2>Deliver a professional, reliable product that solves their exact needs.</h2>
        </div>
        <div className="mk-actions mk-actions-right">
          <button type="button" className="mk-btn mk-btn-secondary" onClick={() => navigate('/pricing')}>See Plans</button>
          <a className="mk-btn mk-btn-primary" href="/signin">Start Free Trial for Your Buyer</a>
        </div>
      </section>
    </>
  );
};

const comparisonRows = [
  ["Jira-like board", "Yes", "Yes", "Yes"],
  ["Live technician feed", "Yes", "Yes", "Yes"],
  ["Auto-updating inventory", "Yes", "Yes", "Yes"],
  ["Offline-first mobile", "Yes", "Yes", "Yes"],
  ["Course customization", "Yes", "Yes", "Yes"],
  ["Full audit trail", "Yes", "Yes", "Yes"],
  ["API and custom modules", "No", "No", "Yes"],
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
              <p className="mk-eyebrow">{tier.name}{tier.featured ? ' · Recommended' : ''}</p>
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
        <h1>Built by a GRC Analyst for real operations data.</h1>
        <p className="mk-lead">TurfOp uses role-based course scope, bcrypt password hashing, JWT auth, audit logging, offline sync visibility, and backend controls that match how buyers evaluate software.</p>
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
        <p className="mk-eyebrow">Ready for your buyer</p>
        <h1>Deliver a professional product that solves their exact needs.</h1>
        <p className="mk-lead">We can tailor the demo to their specific golf course layout, technician workflow, inventory requirements, and offline use cases.</p>
      </div>
      <div className="mk-card">
        <h3>Fastest next steps</h3>
        <ul className="mk-checklist">
          <li>Deploy the polished MVP with live activity feed, auto-updating inventory, and offline sync</li>
          <li>Include course configuration and full audit trail for their operations team</li>
          <li>Provide training materials and ongoing support for successful rollout</li>
        </ul>
        <div className="mk-actions mk-actions-stack">
          <button type="button" className="mk-btn mk-btn-primary" onClick={() => navigate('/signin')}>Start Free Trial</button>
          <a className="mk-btn mk-btn-secondary" href="mailto:sales@turfop.com?subject=TurfOp%20Buyer%20Rollout">Email for Buyer Handover</a>
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
        <p style={{ marginTop: "24px", textAlign: "center", fontSize: "0.9rem", color: "#64748b" }}>
          Need access?{" "}
          <a href="/invite" style={{ color: "#15803d", textDecoration: "none" }}>
            Request an invite
          </a>
        </p>
      </div>
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
    <>
      <MarketingNav activePage={activePage} />
      {content}
    </>
  );
}

export default PublicSite;
