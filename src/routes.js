export const MARKETING_ROUTES = Object.freeze([
  '/',
  '/pricing',
  '/security',
  '/book-demo',
  '/privacy',
  '/terms',
  '/signin',
  '/invite',
]);

export const APP_ROUTES = Object.freeze({
  dashboard: '/app/dashboard',
  issues: '/app/work-orders',
  users: '/app/team',
  time: '/app/time',
  equipment: '/app/equipment',
  inventory: '/app/inventory',
  admin: '/app/admin',
});

const marketingRouteSet = new Set(MARKETING_ROUTES);

export function normalizePathname(pathname = '/') {
  if (!pathname || pathname === '') return '/';
  return pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
}

export function isMarketingRoute(pathname) {
  return marketingRouteSet.has(normalizePathname(pathname));
}
