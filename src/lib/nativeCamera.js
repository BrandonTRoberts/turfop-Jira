import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { isNativeMobilePlatform } from './capacitorPlatform';

function buildDraftName(format = 'jpeg') {
  return `capture-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
}

export async function captureSingleImageDraft() {
  if (!isNativeMobilePlatform()) {
    throw new Error('Native camera capture is only available inside the iOS or Android app.');
  }

  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera
  });

  if (!photo?.dataUrl) {
    throw new Error('No image was captured.');
  }

  return {
    name: buildDraftName(photo.format || 'jpeg'),
    dataUrl: photo.dataUrl,
    url: photo.dataUrl
  };
}
