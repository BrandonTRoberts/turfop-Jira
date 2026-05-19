const marketingRoutes = new Set(['/', '/pricing', '/security', '/book-demo', '/privacy', '/terms', '/signin', '/invite']);

if (marketingRoutes.has(window.location.pathname)) {
  import('./public-main.jsx');
} else {
  import('./main.jsx');
}
