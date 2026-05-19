import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const appPath = resolve('src/components/App.jsx');
const source = readFileSync(appPath, 'utf8');
const mainPath = resolve('src/main.jsx');
const mainSource = readFileSync(mainPath, 'utf8');

const requiredMarkers = [
  "from '../services/backend'",
  'listWorkOrders',
  'selectedRole?.canWrite'
];

const forbiddenMarkers = [
  'const STORAGE_KEY = "turfop-issues"',
  'localStorage.getItem(STORAGE_KEY)'
];

const missingMarkers = requiredMarkers.filter((marker) => !source.includes(marker));
const presentForbiddenMarkers = forbiddenMarkers.filter((marker) => source.includes(marker));
const mainUsesOperationalShell = mainSource.includes("from './components/App'") || mainSource.includes('from "./components/App"');

if (missingMarkers.length > 0 || presentForbiddenMarkers.length > 0 || !mainUsesOperationalShell) {
  console.error('src/components/App.jsx must remain the API-backed operational app shell.');
  if (missingMarkers.length > 0) {
    console.error(`Missing expected marker(s): ${missingMarkers.join(', ')}`);
  }
  if (presentForbiddenMarkers.length > 0) {
    console.error(`Found standalone issue-board marker(s): ${presentForbiddenMarkers.join(', ')}`);
  }
  if (!mainUsesOperationalShell) {
    console.error('src/main.jsx must import ./components/App as the active authenticated app shell.');
  }
  process.exit(1);
}
