import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, View } from 'react-native';
import VendorActivitiesScreen from '../../pages/Activities';
import VendorOrderScreen from '../../pages/OrdersList';
import VendorOrderDetailScreen from '../../pages/OrderDetail';
import VendorDisputeScreen from '../../pages/DisputesList';
import DisputeDetailScreen from '../../pages/DisputeDetail';
import OrderActionScreen from '../../pages/OrderAction';
import OpenDispute from '../../pages/OpenDispute';
import DisputeActionScreen from '../../pages/DisputeAction'
import ReturnListScreen from '../../pages/ReturnList';
import ReturnDetailScreen from '../../pages/ReturnDetail';
import ReturnActionScreen from '../../pages/ReturnAction';
import ChatRoomScreen from '../../pages/ChatRoom';
const VendorActivitiesStack = createNativeStackNavigator();

const shellStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  stackWrap: {
    flex: 1,
  },
});

const activitiesOptions = {
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
const orderDetailOpt = {
  headerShown: true,
  title: 'Order detail',
  headerBackVisible: false,
  headerShadowVisible: false,
}
const orderStatusUpdateOpt = {
  headerShown: true,
  title: 'Order-action',
  headerBackVisible: true,
  headerShadowVisible: false,
};
const disputeOpt = {
  headerShown: true,
  title: 'Open dispute',
  headerBackVisible: true,
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
const inboxOpt = {
  title: 'Inbox',
  headerBackTitle: 'Order',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#075E54' },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
  contentStyle: { backgroundColor: '#ECE5DD' },
};
/**
 * Activities tab: hub + nested orders and disputes stacks (vendor).
 * Outer flow screens keep headers off so we do not nest two native-stack headers.
 */
export function VendorActivitiesStackScreen() {
  return (
    <VendorActivitiesStack.Navigator>
      <VendorActivitiesStack.Screen name="Activities" component={VendorActivitiesScreen} options={activitiesOptions} />
      <VendorActivitiesStack.Screen name="Orders" options={orderOpt} component={VendorOrderScreen} />
      <VendorActivitiesStack.Screen name="Order-detail"  options={orderDetailOpt} component={VendorOrderDetailScreen} />
      <VendorActivitiesStack.Screen name="Order-action" component={OrderActionScreen} options={orderStatusUpdateOpt} />
      <VendorActivitiesStack.Screen name="Returns" options={returnOpt} component={ReturnListScreen} />
      <VendorActivitiesStack.Screen name="Return-detail" options={returnDetailOpt} component={ReturnDetailScreen} />
      <VendorActivitiesStack.Screen name="Return-action" component={ReturnActionScreen} options={returnStatusUpdateOpt} />
      <VendorActivitiesStack.Screen
        name="Open-dispute"
        component={OpenDispute}
        options={disputeOpt}
      />
      <VendorActivitiesStack.Screen name="Inbox" component={ChatRoomScreen} options={inboxOpt} />
      <VendorActivitiesStack.Screen name="Disputes" options={{ headerShown: true, title: 'Disputes', headerBackVisible: true, headerShadowVisible: false,}}  component={VendorDisputeScreen} /> 
      <VendorActivitiesStack.Screen name="Dispute-action" options={{ headerShown: true, title: 'Disputes', headerBackVisible: true, headerShadowVisible: false,}}  component={DisputeActionScreen} /> 
      <VendorActivitiesStack.Screen name="Dispute-detail" options={{ headerShown: true, title: 'Dispute detail', headerBackVisible: true, headerShadowVisible: false,}}  component={DisputeDetailScreen} />
       
    </VendorActivitiesStack.Navigator>
  );
}
