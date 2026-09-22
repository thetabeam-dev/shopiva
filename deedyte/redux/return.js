import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  returnInfo: null,
}

export const returnInfo_slice = createSlice({
  name: 'returnInfo',
  initialState,
  reducers: {
    set_returnInfo: (state, action) => {
      state.returnInfo = action.payload
    },
    clear_returnInfo: (state) => {
      state.returnInfo = null
    },
  },
})

export const { set_returnInfo, clear_returnInfo } = returnInfo_slice.actions

export default returnInfo_slice.reducer
