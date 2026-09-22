import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  disputeInfo: null,
};

export const disputeInfo_slice = createSlice({
  name: 'disputeInfo',
  initialState,
  reducers: {
    set_disputeInfo: (state, action) => {
      state.disputeInfo = action.payload;
    },
    clear_disputeInfo: (state) => {
      state.disputeInfo = null;
    },
  },
});

export const { set_disputeInfo, clear_disputeInfo } = disputeInfo_slice.actions;

export default disputeInfo_slice.reducer;
