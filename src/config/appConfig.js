const defaultApiBaseUrl = import.meta.env.PROD ? 'https://api.turfop.com' : 'http://localhost:4000';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl;
const allowDemoMode = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false';

export const appConfig = {
  backend: {
    provider: 'custom-node-api',
    apiBaseUrl,
    allowDemoMode,
    rationale:
      'Self-hosted Node API with PostgreSQL keeps web, iOS, and Android on one backend without a subscription dependency.'
  },
  tenancy: {
    model: 'multi-course',
    strategy:
      'Every record belongs to a courseId. Users can belong to one or more courses with role-based access.'
  }
};
