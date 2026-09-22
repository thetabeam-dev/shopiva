import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  orderInfo: null,
}

export const orderInfo_slice = createSlice({
  name: 'orderInfo',
  initialState,
  reducers: {
    set_orderInfo: (state, action) => {
      state.orderInfo = action.payload
    },
    clear_orderInfo: (state) => {
      state.orderInfo = null
    },
  },
})

// Action creators are generated for each case reducer function
export const { set_orderInfo, clear_orderInfo } = orderInfo_slice.actions

export default orderInfo_slice.reducer

  
  