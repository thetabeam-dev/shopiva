import { createSlice } from '@reduxjs/toolkit';

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    items: [],
  },
  reducers: {
    set_notifications(state, action) {
      const incoming = Array.isArray(action.payload) ? action.payload : [];
      const incomingIds = new Set(incoming.map((item) => item.id));
      const newerLocal = state.items.filter((item) => !incomingIds.has(item.id));
      const merged = [...newerLocal, ...incoming];
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      state.items = merged;
    },
    push_notification(state, action) {
      const row = action.payload;
      if (!row || row.id == null) return;
      state.items = [row, ...state.items.filter((item) => item.id !== row.id)];
    },
    mark_notification_read(state, action) {
      const id = action.payload;
      state.items = state.items.map((item) =>
        item.id === id ? { ...item, status: 'read' } : item,
      );
    },
    clear_notifications(state) {
      state.items = [];
    },
  },
});

export const {
  set_notifications,
  push_notification,
  mark_notification_read,
  clear_notifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
