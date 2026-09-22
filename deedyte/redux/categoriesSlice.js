import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getCategories } from '../src/api/categories';

function toCategoryLabel(raw) {
  return String(raw ?? '')
    .trim()
    .split(/\s+/)
    .map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : word))
    .join(' ');
}

function parseStringArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v ?? '').trim().toLowerCase()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseStringArray(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

function parseObject(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeRows(rows) {
  /** @type {{ id: number | null; category: string; variants: string[]; productType: Record<string, string[]>; existingProductCount: number }[]} */
  const normalized = [];

  for (const row of rows) {
    const category = String(row?.category ?? '').trim().toLowerCase();
    if (!category) continue;

    const rawProductType = parseObject(row?.['product-type'] ?? row?.product_type ?? row?.productType);
    /** @type {Record<string, string[]>} */
    const productType = {};
    for (const [subKey, subValues] of Object.entries(rawProductType)) {
      const key = String(subKey ?? '').trim().toLowerCase();
      if (!key) continue;
      productType[key] = parseStringArray(subValues);
    }

    normalized.push({
      id: Number.isFinite(Number(row?.id)) ? Number(row.id) : null,
      category,
      variants: (row?.variants),
      productType,
      existingProductCount: Number(row?.existing_product_count ?? 0) || 0,
    });
  }

  normalized.sort((a, b) => a.category.localeCompare(b.category));
  return normalized;
}

function toMvpCompatibleTree(rows) {
  /** @type {Record<string, Array<Record<string, Record<string, Record<string, never>>>>>} */
  const tree = {};

  for (const row of rows) {
    /** @type {Record<string, Record<string, Record<string, never>>>} */
    const block = {};
    const subEntries = Object.entries(row.productType);

    if (subEntries.length > 0) {
      for (const [subCategory, typeList] of subEntries) {
        block[subCategory] = {};
        for (const type of typeList) {
          block[subCategory][type] = {};
        }
      }
    } else if (row.variants.length > 0) {
      block.general = {};
      for (const variant of row.variants) {
        block.general[variant] = {};
      }
    }

    tree[row.category] = [block];
  }

  return tree;
}

export const fetchCategories = createAsyncThunk('categories/fetchAll', async () => {
  const rows = await getCategories();
  const normalizedRows = normalizeRows(Array.isArray(rows) ? rows : []);
  return {
    rows: normalizedRows,
    categoryTree: toMvpCompatibleTree(normalizedRows),
    options: normalizedRows.map((row) => ({
      value: row.category,
      label: toCategoryLabel(row.category),
    })),
  };
});

const categoriesSlice = createSlice({
  name: 'categories',
  initialState: {
    /** @type {{ id: number | null; category: string; variants: string[]; productType: Record<string, string[]>; existingProductCount: number }[]} */
    categories: [],
    /** @type {{ value: string; label: string }[]} */
    options: [],
    /** @type {Record<string, Array<Record<string, Record<string, Record<string, never>>>>>} */
    categoryTree: {},
    isLoading: false,
    error: null,
    lastFetchedAt: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.categories = action.payload.rows;
        state.options = action.payload.options;
        state.categoryTree = action.payload.categoryTree;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error?.message ?? 'Could not load categories';
      });
  },
});

export const selectCategoriesState = (state) => state.categories;
export const selectCategoryRows = (state) => state.categories.categories;
export const selectCategoryOptions = (state) => state.categories.options;
export const selectCategoryKeys = (state) => state.categories.options.map((opt) => opt.value);
export const selectCategoryTree = (state) => state.categories.categoryTree;
export const selectCategoriesLoading = (state) => state.categories.isLoading;
export const selectCategoriesError = (state) => state.categories.error;

export default categoriesSlice.reducer;