import { env } from './config/env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.port, () => {
  console.log(`TurfOp API running on http://localhost:${env.port}`);
});
