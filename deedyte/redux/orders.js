import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  orderList: [
    
  ],
}

export const orderList_slice = createSlice({
  name: 'orderList',
  initialState,
  reducers: {
    set_orderList: (state, action) => {
      state.orderList = action.payload
    },
    clear_orderList: (state) => {
      state.orderList = []
    },
  },
})

// Action creators are generated for each case reducer function
export const { set_orderList, clear_orderList } = orderList_slice.actions

export default orderList_slice.reducer

  
  