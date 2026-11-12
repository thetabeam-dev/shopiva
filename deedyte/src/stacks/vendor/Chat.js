import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../../pages/ChatList';
import ChatRoomScreen from '../../pages/ChatRoom';
import OrderDetailScreen from '../../pages/OrderDetail';
import OrderActionScreen from '../../pages/OrderAction';
import OpenDisputeScreen from '../../pages/OpenDispute';
import DisputeDetailScreen from '../../pages/DisputeDetail';
import DisputeActionScreen from '../../pages/DisputeAction';
import ReturnDetailScreen from '../../pages/ReturnDetail';
import ReturnActionScreen from '../../pages/ReturnAction';

const HEADER = '#075E54';
const VendorChatStack = createNativeStackNavigator();

const LIST_OPTIONS = {
  title: 'Chats',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerTitleStyle: { fontWeight: '700', color: '#111111' },
  contentStyle: { backgroundColor: '#FFFFFF' },
};

const ROOM_OPTIONS = {
  headerBackTitle: 'Chats',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: HEADER },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
  contentStyle: { backgroundColor: '#ECE5DD' },
};

export function VendorChatStackScreen() {
  return (
    <VendorChatStack.Navigator>
      <VendorChatStack.Screen name="chat-list" component={ChatListScreen} options={LIST_OPTIONS} />
      <VendorChatStack.Screen name="chat-room" component={ChatRoomScreen} options={ROOM_OPTIONS} />
      <VendorChatStack.Screen name="Inbox" component={ChatRoomScreen} options={ROOM_OPTIONS} />
      <VendorChatStack.Screen
        name="Order-detail"
        component={OrderDetailScreen}
        options={{ title: 'Order detail', headerBackVisible: false, headerShadowVisible: false }}
      />
      <VendorChatStack.Screen name="Order-action" component={OrderActionScreen} options={{ headerShown: true, title: 'Order-action', headerBackVisible: true, headerShadowVisible: false }} />
      <VendorChatStack.Screen name="Open-dispute" component={OpenDisputeScreen} options={{ headerShown: true, title: 'Open dispute', headerBackVisible: true, headerShadowVisible: false }} />
      <VendorChatStack.Screen name="Dispute-detail" component={DisputeDetailScreen} options={{ headerShown: true, title: 'Dispute detail', headerBackVisible: true, headerShadowVisible: false }} />
      <VendorChatStack.Screen name="Dispute-action" component={DisputeActionScreen} options={{ headerShown: true, title: 'Disputes', headerBackVisible: true, headerShadowVisible: false }} />
      <VendorChatStack.Screen name="Return-detail" component={ReturnDetailScreen} options={{ headerShown: true, title: 'Return detail', headerBackVisible: true, headerShadowVisible: false }} />
      <VendorChatStack.Screen name="Return-action" component={ReturnActionScreen} options={{ headerShown: true, title: 'Return action', headerBackVisible: true, headerShadowVisible: false }} />
    </VendorChatStack.Navigator>
  );
}
