import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from '@/services/api';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

function loadOneSignalSdk() {
  return new Promise((resolve, reject) => {
    if (window.OneSignal || window.OneSignalDeferred) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load OneSignal Web SDK'));
    document.head.appendChild(script);
  });
}

async function setupWebPush(employeeId) {
  if (!ONESIGNAL_APP_ID || !employeeId) {
    return { enabled: false, reason: 'missing_web_push_config' };
  }

  await loadOneSignalSdk();

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const initPromise = new Promise((resolve) => {
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: 'OneSignalSDKUpdaterWorker.js',
          notifyButton: { enable: false }
        });

        await OneSignal.login(String(employeeId));

        const permission = OneSignal.Notifications.permission;
        if (permission !== 'granted') {
          await OneSignal.Notifications.requestPermission();
        }

        const subscriptionId = OneSignal.User?.PushSubscription?.id || null;
        if (subscriptionId) {
          await api.registerNotificationDevice({
            provider: 'onesignal',
            deviceType: 'web',
            deviceToken: subscriptionId,
            metadata: { channel: 'onesignal-web' }
          });
        }

        resolve({ enabled: true, channel: 'web' });
      } catch (error) {
        resolve({ enabled: false, reason: error?.message || 'web_push_init_failed' });
      }
    });
  });

  return initPromise;
}

async function setupMobilePush() {
  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') {
    return { enabled: false, reason: 'unsupported_mobile_platform' };
  }

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    return { enabled: false, reason: 'permission_denied' };
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async (token) => {
    await api.registerNotificationDevice({
      provider: 'onesignal',
      deviceType: platform,
      deviceToken: token.value,
      metadata: { platform },
    });
  });

  return { enabled: true, channel: platform };
}

export async function setupPushNotifications({ employeeId }) {
  const platform = Capacitor.getPlatform();
  if (platform === 'web') {
    return setupWebPush(employeeId);
  }
  return setupMobilePush();
}
