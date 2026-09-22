import categoryData from '../json/category_1.1.json';

/**
 * Helpers for `src/json/mvp_category.json` — category → subcategory → product type.
 */

export const GENDER_DRIVEN_CATEGORY_KEYS = new Set([
  'apparel & accessories',
  'jewelry & watches & eyewear',
  'shoes & accessories',
]);

export function isGenderDrivenCategory(categoryKey) {
  return GENDER_DRIVEN_CATEGORY_KEYS.has(String(categoryKey ?? '').trim().toLowerCase());
}

export function getGenderDrivenTypeOptions(categoryKey, gender) {
  const key = String(categoryKey ?? '').trim().toLowerCase();
  const normalizedGender = String(gender ?? '').trim().toLowerCase();
  const group = categoryData?.[key];
  if (!group || typeof group !== 'object') return [];
  const options = Array.isArray(group[normalizedGender]) ? group[normalizedGender] : [];
  return options
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

/**
 * Top-level keys in the MVP category file (e.g. `fashion`).
 * @param {Record<string, unknown>} data
 * @returns {string[]}
 */
export function mvpCategoryRootKeys(data) {
  if (!data || typeof data !== 'object') return [];
  return Object.keys(data).sort((a, b) => a.localeCompare(b));
}

/**
 * Builds sub-categories, types allowed per sub-category, and valid (sub, type) pairs
 * from merged segment blocks in `mvp_category.json`.
 *
 * @param {Record<string, unknown>} data
 * @param {string} categoryKey
 * @returns {{ subCategories: string[]; typesBySubCategory: Map<string, string[]>; subTypePairs: { sub: string; type: string }[] }}
 */
export function buildMvpCategoryFilters(data, categoryKey) {
  const key = String(categoryKey || '').trim() || 'fashion';
  const segments = data[key];
  const subCats = new Set();
  /** @type {Map<string, Set<string>>} */
  const typeSets = new Map();
  if (!Array.isArray(segments)) {
    return { subCategories: [], typesBySubCategory: new Map(), subTypePairs: [] };
  }

  for (const block of segments) {
    if (!block || typeof block !== 'object') continue;

    const blockKeys = Object.keys(block);
    for (const subKey of blockKeys) {
      const subVal = block[subKey];
      subCats.add(subKey);
      if (!typeSets.has(subKey)) typeSets.set(subKey, new Set());
      if (subVal && typeof subVal === 'object') {
        for (const typeKey of Object.keys(subVal)) {
          typeSets.get(subKey).add(typeKey);
        }
      }
    }
  }

  const typesBySubCategory = new Map();
  for (const [sub, set] of typeSets) {
    typesBySubCategory.set(sub, [...set].sort((a, b) => a.localeCompare(b)));
  }
  const subCategories = [...subCats].sort((a, b) => a.localeCompare(b));
  const subTypePairs = [];
  for (const sub of subCategories) {
    for (const type of typesBySubCategory.get(sub) || []) {
      subTypePairs.push({ sub, type });
    }
  }
  return { subCategories, typesBySubCategory, subTypePairs };
}

/**
 * Title-case words for picker labels (JSON keys stay lowercase).
 * @param {string} raw
 */
export function formatMvpCategoryLabel(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
