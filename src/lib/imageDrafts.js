const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.82;
const PASSTHROUGH_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function parseMimeFromDataUrl(dataUrl) {
  const match = /^data:(.*?);base64,/.exec(dataUrl || '');
  return match?.[1] || 'image/jpeg';
}

function buildExtension(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function estimateDataUrlBytes(dataUrl = '') {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to decode image.'));
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function compressDataUrl(dataUrl, {
  maxDimension = DEFAULT_MAX_DIMENSION,
  quality = DEFAULT_QUALITY,
  preferredMimeType
} = {}) {
  if (typeof document === 'undefined') {
    return dataUrl;
  }

  const image = await loadImage(dataUrl);
  const longestSide = Math.max(image.width, image.height);
  const targetScale = longestSide > maxDimension ? maxDimension / longestSide : 1;
  const targetWidth = Math.max(1, Math.round(image.width * targetScale));
  const targetHeight = Math.max(1, Math.round(image.height * targetScale));
  const sourceMimeType = parseMimeFromDataUrl(dataUrl);
  const outputMimeType = preferredMimeType || (
    sourceMimeType === 'image/png'
      ? 'image/png'
      : sourceMimeType === 'image/webp'
        ? 'image/webp'
        : sourceMimeType === 'image/jpeg'
          ? 'image/jpeg'
          : 'image/jpeg'
  );

  if (
    targetScale === 1
    && estimateDataUrlBytes(dataUrl) < 900000
    && outputMimeType === sourceMimeType
    && PASSTHROUGH_MIME_TYPES.has(sourceMimeType)
  ) {
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL(outputMimeType, quality);
}

export async function optimizeImageDraftFromFile(file, options = {}) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  let dataUrl;
  try {
    dataUrl = await compressDataUrl(sourceDataUrl, options);
  } catch (error) {
    throw new Error('This image format could not be processed here. Try JPG, PNG, WEBP, GIF, or another browser-supported photo format.');
  }
  const mimeType = parseMimeFromDataUrl(dataUrl);
  const extension = buildExtension(mimeType);
  const baseName = (file.name || 'upload').replace(/\.[^.]+$/, '');

  return {
    name: `${baseName}.${extension}`,
    dataUrl,
    url: dataUrl,
    mimeType,
    sizeBytes: estimateDataUrlBytes(dataUrl)
  };
}

export async function optimizeImageDraft(draft, options = {}) {
  if (!draft?.dataUrl && !draft?.url) {
    throw new Error('No image data found to optimize.');
  }

  const sourceDataUrl = draft.dataUrl || draft.url;
  const dataUrl = await compressDataUrl(sourceDataUrl, options);
  const mimeType = parseMimeFromDataUrl(dataUrl);
  const extension = buildExtension(mimeType);
  const baseName = (draft.name || 'capture').replace(/\.[^.]+$/, '');

  return {
    ...draft,
    name: `${baseName}.${extension}`,
    dataUrl,
    url: dataUrl,
    mimeType,
    sizeBytes: estimateDataUrlBytes(dataUrl)
  };
}
