const PRODUCT_IMAGE_CANDIDATE_KEYS = [
  'thumbnail_url',
  'thumbnail',
  'thumbnailUrl',
  'image_url',
  'imageUrl',
  'image',
  'uri',
  'url',
];

const IMAGE_OBJECT_KEYS = ['url', 'uri', 'src', 'source'];

/** @param {unknown} value */
function normalizePotentialImageValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (value && typeof value === 'object') {
    for (const key of IMAGE_OBJECT_KEYS) {
      const child = /** @type {Record<string, unknown>} */ (value)[key];
      if (typeof child === 'string' && child.trim()) {
        return child.trim();
      }
    }
  }
  return null;
}

export function getProductImageUris(source) {
  if (!source) return [];
  if (typeof source === 'string') {
    const trimmed = source.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof source !== 'object') return [];

  const seen = new Set();
  const images = [];

  for (const key of PRODUCT_IMAGE_CANDIDATE_KEYS) {
    const value = /** @type {Record<string, unknown>} */ (source)[key];
    const uri = normalizePotentialImageValue(value);
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      images.push(uri);
    }
  }

  const pushArray = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      const uri = normalizePotentialImageValue(item);
      if (uri && !seen.has(uri)) {
        seen.add(uri);
        images.push(uri);
      }
    }
  };

  pushArray((/** @type {Record<string, unknown>} */ (source)).images);
  pushArray((/** @type {Record<string, unknown>} */ (source)).product_images);
  pushArray((/** @type {Record<string, unknown>} */ (source)).productImages);
  pushArray((/** @type {Record<string, unknown>} */ (source)).thumbnails);

  return images;
}

export function getProductImageUri(source) {
  const uris = getProductImageUris(source);
  return uris.length > 0 ? uris[0] : null;
}
