import { isMarketingRoute } from './routes';

if (isMarketingRoute(window.location.pathname)) {
  import('./public-main.jsx');
} else {
  import('./main.jsx');
}
