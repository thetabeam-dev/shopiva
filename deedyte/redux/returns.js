import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  returnList: [
    
  ],
}

export const returnList_slice = createSlice({
  name: 'returnList',
  initialState,
  reducers: {
    set_returnList: (state, action) => {
      state.returnList = action.payload
    },
    clear_returnList: (state) => {
      state.returnList = []
    },
  },
})

export const { set_returnList, clear_returnList } = returnList_slice.actions

export default returnList_slice.reducer
