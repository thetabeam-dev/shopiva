import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Alert, StyleSheet, View } from 'react-native';
import Activities from '../../pages/Activities';
import OrderListScreen from '../../pages/OrdersList';
import OpenDispute from '../../pages/OpenDispute';
import DisputesListScreen from '../../pages/DisputesList';
import OrderDetailScreen from '../../pages/OrderDetail';
import OrderActionScreen from '../../pages/OrderAction';
import DisputeDetailScreen from '../../pages/DisputeDetail';
import ReturnListScreen from '../../pages/ReturnList';
import ReturnDetailScreen from '../../pages/ReturnDetail';
import ReturnActionScreen from '../../pages/ReturnAction';
import ProductReviewScreen from '../../pages/Review';
import ShopReviewScreen from '../../pages/ShopReview';
import PendingReviewsScreen from '../../pages/PendingReviews';
import ChatRoomScreen from '../../pages/ChatRoom';
const ActivitiesStack = createNativeStackNavigator();
const activityOptions = {
  headerShown: true,
  title: 'Activities',
  headerBackVisible: false,
  headerShadowVisible: false,
};
const orderOpt = {
  headerShown: true,
  title: 'Orders',
  headerBackVisible: true,
  headerShadowVisible: false,
}
const disputeOpt = {
  headerShown: true,
  title: 'Disputes',
  headerBackVisible: true,
  headerShadowVisible: false,
};
const orderStatusUpdateOpt = {
  headerShown: true,
  title: 'Order-action',
  headerBackVisible: true,
  headerShadowVisible: false,
};
const orderDetailOpt = {
  headerShown: true,
  title: 'Order detail',
  headerBackVisible: false,
  headerShadowVisible: false,
}
const returnOpt = {
  headerShown: true,
  title: 'Returns',
  headerBackVisible: true,
  headerShadowVisible: false,
}
const returnDetailOpt = {
  headerShown: true,
  title: 'Return detail',
  headerBackVisible: true,
  headerShadowVisible: false,
}
const returnStatusUpdateOpt = {
  headerShown: true,
  title: 'Return-action',
  headerBackVisible: true,
  headerShadowVisible: false,
};
const productReviewOpt = {
  headerShown: true,
  title: 'Product Review',
  headerBackVisible: false,
  headerShadowVisible: false,
}
const shopReviewOpt = {
  ...productReviewOpt,
  title: 'Shop Review',
};
const inboxOpt = {
  title: 'Inbox',
  headerBackTitle: 'Order',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#075E54' },
  headerTintColor: '#FFFFFF',
  headerShown: true,
  headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
  contentStyle: { backgroundColor: '#ECE5DD' },
};
/**
 * Orders tab: hub + nested orders and disputes stacks (customer).
 * Outer flow screens keep headers off so we do not nest two native-stack headers
 * (avoids duplicate bars and confusing back behavior with Order/Dispute stacks).
 */
export function ActivitiesStackScreen() {
 
  return (
    <ActivitiesStack.Navigator screenOptions={{ headerShown: false }}>
      <ActivitiesStack.Screen name="Activities" component={Activities} options={activityOptions} />
      <ActivitiesStack.Screen name="Orders" component={OrderListScreen} options={orderOpt} />
      <ActivitiesStack.Screen name="Order-detail" component={OrderDetailScreen} options={orderDetailOpt}  />
      <ActivitiesStack.Screen name="Order-list" component={OrderDetailScreen} options={orderOpt} />
      <ActivitiesStack.Screen name="Order-action" component={OrderActionScreen} options={orderStatusUpdateOpt} />
      
      <ActivitiesStack.Screen name="Inbox" component={ChatRoomScreen} options={inboxOpt} />
      
      <ActivitiesStack.Screen
        name="Open-dispute"
        component={OpenDispute}
        options={{ ...disputeOpt, title: 'Open dispute' }}
      />
      <ActivitiesStack.Screen name="ProductReview" options={productReviewOpt} component={ProductReviewScreen} />
      <ActivitiesStack.Screen name="ShopReview" options={shopReviewOpt} component={ShopReviewScreen} />
      
      <ActivitiesStack.Screen name="Disputes" component={DisputesListScreen} options={disputeOpt} />
      <ActivitiesStack.Screen name="Dispute-detail" component={DisputeDetailScreen} options={{ headerShown: true, title: 'Dispute detail', headerBackVisible: true, headerShadowVisible: false}}  />
      <ActivitiesStack.Screen name="Pending-Reviews" component={PendingReviewsScreen} options={{ headerShown: true, title: 'Pending Reviews', headerBackVisible: true, headerShadowVisible: false }} />
      
      <ActivitiesStack.Screen name="Returns" component={ReturnListScreen} options={returnOpt} />
      <ActivitiesStack.Screen name="Return-detail" component={ReturnDetailScreen} options={returnDetailOpt} />
      <ActivitiesStack.Screen name="Return-action" component={ReturnActionScreen} options={returnStatusUpdateOpt} />

    </ActivitiesStack.Navigator>
  );
}
