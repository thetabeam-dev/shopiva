import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getLogisticsProviders } from '../src/api/logisticsProviders';

function normalizeProviders(rows) {
  return rows
    .map((row) => ({
      id: String(row?.id ?? '').trim(),
      name: String(row?.name ?? '').trim(),
      logo_url: String(row?.logo_url ?? '').trim()
    }))
    .filter((provider) => provider.id && provider.name && provider.logo_url)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const fetchLogisticsProviders = createAsyncThunk(
  'logisticsProviders/fetchAll',
  async () => normalizeProviders(await getLogisticsProviders()),
);

const logisticsProvidersSlice = createSlice({
  name: 'logisticsProviders',
  initialState: {
    providers: [],
    isLoading: false,
    error: null,
    lastFetchedAt: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLogisticsProviders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchLogisticsProviders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;
        state.providers = action.payload;
        state.lastFetchedAt = Date.now();
      })
      .addCase(fetchLogisticsProviders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error?.message ?? 'Could not load logistics providers';
      });
  },
});

export const selectLogisticsProvidersState = (state) => state.logisticsProviders;

export default logisticsProvidersSlice.reducer;