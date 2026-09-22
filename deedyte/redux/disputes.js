import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  disputeList: [],
};

export const disputeList_slice = createSlice({
  name: 'disputeList',
  initialState,
  reducers: {
    set_disputeList: (state, action) => {
      state.disputeList = action.payload;
    },
    clear_disputeList: (state) => {
      state.disputeList = [];
    },
  },
});

export const { set_disputeList, clear_disputeList } = disputeList_slice.actions;

export default disputeList_slice.reducer;
