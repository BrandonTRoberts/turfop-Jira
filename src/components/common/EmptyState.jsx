function AppIcon({ children, className = '', size = 18 }) {
  return (
    <svg
      className={`app-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function BoxIcon(props) {
  return <AppIcon {...props}><path d="M12 3 4.5 7 12 11l7.5-4L12 3Z" /><path d="M4.5 7v10L12 21l7.5-4V7" /><path d="M12 11v10" /></AppIcon>;
}

function WrenchIcon(props) {
  return <AppIcon {...props}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.3-.8-.8-2.3 2.5-2.3Z" /></AppIcon>;
}

function ClipboardIcon(props) {
  return <AppIcon {...props}><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M8 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><path d="M9 12h6" /><path d="M9 16h6" /></AppIcon>;
}

function SparkIcon(props) {
  return <AppIcon {...props}><path d="M12 3v4" /><path d="M12 17v4" /><path d="m5.6 5.6 2.8 2.8" /><path d="m15.6 15.6 2.8 2.8" /><path d="M3 12h4" /><path d="M17 12h4" /><path d="m5.6 18.4 2.8-2.8" /><path d="m15.6 8.4 2.8-2.8" /></AppIcon>;
}

export function EmptyState({ icon = 'spark', title, message, hint = '', action = null }) {
  const Icon = icon === 'inventory'
    ? BoxIcon
    : icon === 'equipment'
      ? WrenchIcon
      : icon === 'work'
        ? ClipboardIcon
        : SparkIcon;

  return (
    <div className="empty-state" role="status" aria-live="polite">
      <div className="empty-state-icon"><Icon size={20} /></div>
      <div className="empty-state-copy">
        <h4>{title}</h4>
        <p>{message}</p>
        {hint ? <small>{hint}</small> : null}
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
