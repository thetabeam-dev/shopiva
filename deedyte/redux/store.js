import { configureStore } from '@reduxjs/toolkit';
import nested_nav from './nested_nav';
import authReducer from './authSlice';
import orderInfo from './order';
import orderList from './orders';
import disputeInfo from './dispute';
import disputeList from './disputes';
import returnInfo from './return';
import returnList from './returns';
import categories from './categoriesSlice';
import logisticsProviders from './logisticsProvidersSlice';

const store = configureStore({
  reducer: {
    nested_nav,
    auth: authReducer,
    orderInfo: orderInfo,
    orderList: orderList,
    disputeInfo: disputeInfo,
    disputeList: disputeList,
    returnInfo: returnInfo,
    returnList: returnList,
    categories,
    logisticsProviders,
  },
});

export default store;