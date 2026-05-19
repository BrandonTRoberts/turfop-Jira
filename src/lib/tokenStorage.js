import { Preferences } from '@capacitor/preferences';
import { isNativePlatform } from './capacitorPlatform';

async function nativeGet(key) {
  const { value } = await Preferences.get({ key });
  return value;
}

async function nativeSet(key, value) {
  await Preferences.set({ key, value });
}

async function nativeRemove(key) {
  await Preferences.remove({ key });
}

function webGet(_key) {
  return null;
}

function webSet(_key, _value) {
  // Web auth now relies on httpOnly cookies instead of browser-accessible token storage.
}

function webRemove(key) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(key);
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(key);
  }
}

export async function getStoredString(key) {
  return isNativePlatform() ? nativeGet(key) : webGet(key);
}

export async function setStoredString(key, value) {
  return isNativePlatform() ? nativeSet(key, value) : webSet(key, value);
}

export async function removeStoredString(key) {
  return isNativePlatform() ? nativeRemove(key) : webRemove(key);
}
