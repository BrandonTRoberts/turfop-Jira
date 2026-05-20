import cors from 'cors';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: [
      'https://turfop.com',
      'https://www.turfop.com',
      'https://turfopfrontend.brandonroberts.workers.dev',
      'http://localhost:5173',
      'https://turfopfrontend.pages.dev'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // ... rest of your app setup
}
