import { describe, expect, it } from 'vitest';
import { APP_ROUTES, MARKETING_ROUTES, isMarketingRoute } from './routes';

describe('route registry', () => {
  it('keeps public marketing routes explicit', () => {
    expect(MARKETING_ROUTES).toContain('/pricing');
    expect(MARKETING_ROUTES).toContain('/signin');
    expect(isMarketingRoute('/security')).toBe(true);
  });

  it('treats app routes as authenticated application routes', () => {
    expect(APP_ROUTES.dashboard).toBe('/app/dashboard');
    expect(isMarketingRoute('/app/dashboard')).toBe(false);
    expect(isMarketingRoute('/work-orders')).toBe(false);
  });
});
