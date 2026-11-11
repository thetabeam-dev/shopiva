import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatListScreen from '../../pages/ChatList';
import ChatRoomScreen from '../../pages/ChatRoom';
import VendorScreen from '../../pages/customer/Vendor';
import CartCheckoutScreen from '../../pages/customer/CartCheckoutScreen';
import CheckoutWalletTopUpScreen from '../../pages/customer/CheckoutWalletTopUp';
import PaymentSuccessScreen from '../../pages/customer/PaymentSuccessScreen';
import PaymentFailedScreen from '../../pages/customer/PaymentFailedScreen';
import OrderDetailScreen from '../../pages/OrderDetail';
import OrderActionScreen from '../../pages/OrderAction';
import OpenDisputeScreen from '../../pages/OpenDispute';
import DisputeDetailScreen from '../../pages/DisputeDetail';

const HEADER = '#075E54';
const ChatStack = createNativeStackNavigator();

const CHAT_LIST_OPTIONS = {
  title: 'Chats',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerTitleStyle: { fontWeight: '700', color: '#111111' },
  contentStyle: { backgroundColor: '#FFFFFF' },
};

const CHAT_ROOM_OPTIONS = {
  headerBackTitle: 'Chats',
  headerShadowVisible: false,
  headerStyle: { backgroundColor: HEADER },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
  contentStyle: { backgroundColor: '#ECE5DD' },
};

export function ChatStackScreen() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen name="chat-list" component={ChatListScreen} options={CHAT_LIST_OPTIONS} />
      <ChatStack.Screen name="chat-room" component={ChatRoomScreen} options={CHAT_ROOM_OPTIONS} />
      <ChatStack.Screen name="Inbox" component={ChatRoomScreen} options={CHAT_ROOM_OPTIONS} />
      <ChatStack.Screen
        name="Vendor"
        component={VendorScreen}
        options={{ headerShown: false }}
      />
      <ChatStack.Screen
        name="Cart-checkout"
        component={CartCheckoutScreen}
        options={{
          title: 'Checkout',
          headerShown: true,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <ChatStack.Screen
        name="Checkout-wallet-topup"
        component={CheckoutWalletTopUpScreen}
        options={{
          title: 'Top up to pay',
          headerShown: true,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <ChatStack.Screen
        name="Payment-success"
        component={PaymentSuccessScreen}
        options={{
          title: 'Payment Status',
          headerShown: true,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerBackVisible: false,
        }}
      />
      <ChatStack.Screen
        name="Payment-failed"
        component={PaymentFailedScreen}
        options={{
          title: 'Payment Status',
          headerShown: true,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <ChatStack.Screen
        name="Order-detail"
        component={OrderDetailScreen}
        options={{ title: 'Order detail', headerBackVisible: false, headerShadowVisible: false }}
      />
      <ChatStack.Screen name="Order-action" component={OrderActionScreen} options={{ headerShown: true, title: 'Order-action', headerBackVisible: true, headerShadowVisible: false }} />
      <ChatStack.Screen name="Open-dispute" component={OpenDisputeScreen} options={{ headerShown: true, title: 'Open dispute', headerBackVisible: true, headerShadowVisible: false }} />
      <ChatStack.Screen name="Dispute-detail" component={DisputeDetailScreen} options={{ headerShown: true, title: 'Dispute detail', headerBackVisible: true, headerShadowVisible: false }} />
    </ChatStack.Navigator>
  );
}
