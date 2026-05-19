import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativeMobilePlatform } from './capacitorPlatform';

const PUSH_TOKEN_STORAGE_KEY = 'turfop_push_token';
let pushListenersRegistered = false;

function canUseNativeEnhancements() {
  return typeof window !== 'undefined' && isNativeMobilePlatform();
}

export async function triggerLightImpact() {
  if (!canUseNativeEnhancements()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

export async function triggerMediumImpact() {
  if (!canUseNativeEnhancements()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

export async function triggerSuccessHaptic() {
  if (!canUseNativeEnhancements()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

export async function triggerWarningHaptic() {
  if (!canUseNativeEnhancements()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {}
}

export async function triggerErrorHaptic() {
  if (!canUseNativeEnhancements()) return;
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

export function getStoredPushToken() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY) || '';
}

export async function registerForPushNotifications(callbacks = {}) {
  if (!canUseNativeEnhancements()) {
    return { supported: false, status: 'web' };
  }

  const {
    onToken = () => {},
    onError = () => {},
    onPermissionDenied = () => {},
    onReceived = () => {},
    onAction = () => {}
  } = callbacks;

  if (!pushListenersRegistered) {
    PushNotifications.addListener('registration', (token) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token.value);
      }
      onToken(token.value);
    });

    PushNotifications.addListener('registrationError', (error) => {
      onError(error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      onReceived(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      onAction(notification);
    });

    pushListenersRegistered = true;
  }

  let permissionStatus = await PushNotifications.checkPermissions();
  if (permissionStatus.receive === 'prompt') {
    permissionStatus = await PushNotifications.requestPermissions();
  }

  if (permissionStatus.receive !== 'granted') {
    onPermissionDenied(permissionStatus.receive);
    return { supported: true, status: permissionStatus.receive };
  }

  await PushNotifications.register();
  return { supported: true, status: 'registered' };
}
