import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import VendorsScreen from '../../pages/customer/Vendors';
import ExploreBrowse from '../../pages/customer/ExploreBrowse';
import VendorScreen from '../../pages/customer/Vendor';
import ProductScreen from '../../pages/customer/Product';
import CartScreen from '../../pages/customer/Cart';
import CartCheckoutScreen from '../../pages/customer/CartCheckoutScreen';
import PaymentSuccessScreen from '../../pages/customer/PaymentSuccessScreen';
import PaymentFailedScreen from '../../pages/customer/PaymentFailedScreen';
import NotificationsScreen from '../../pages/NotificationsScreen';
import OrderDetailScreen from '../../pages/OrderDetail';
import DisputeDetailScreen from '../../pages/DisputeDetail';
import ReturnDetailScreen from '../../pages/ReturnDetail';
import ChatRoomScreen from '../../pages/ChatRoom';

const ExploreStack = createNativeStackNavigator();

const exploreOpt = (navigation) => ({
  title: 'Explore',
  headerShadowVisible: false,
  headerRight: () => (
    <View style={styles.headerRight}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Select location"
        onPress={() => navigation.setParams({ openVendorFilter: Date.now() })}
        style={styles.headerAction}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="location-outline" size={22} color="#000000" />
      </TouchableOpacity>
    </View>
  ),
});

const vendorOpt = {
  header: () => <View style={styles.hiddenHeader} />,
};

const cartOpt = {
  title: 'Cart',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
};

const cartCheckoutOpt = {
  title: 'Checkout',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
};

const paySuccessOpt = {
  title: 'Payment Status',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerBackVisible: false,
};

const payFailedOpt = {
  title: 'Payment Status',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
};

export function ExploreStackScreen() {
  return (
    <ExploreStack.Navigator>
      <ExploreStack.Screen
        name="Explore"
        component={ExploreBrowse}
        options={{ title: 'Explore', headerShadowVisible: false }}
      />
      <ExploreStack.Screen
        name="State-shops"
        component={VendorsScreen}
        options={({ navigation, route }) => ({
          ...exploreOpt(navigation),
          title: route.params?.state ? `Shops in ${route.params.state}` : 'Shops',
        })}
      />
      <ExploreStack.Screen name="Vendor" component={VendorScreen} options={vendorOpt} />
      <ExploreStack.Screen name="Product" component={ProductScreen} options={{ headerShown: false }} />
      <ExploreStack.Screen name="Cart" component={CartScreen} options={cartOpt} />
      <ExploreStack.Screen name="Cart-checkout" component={CartCheckoutScreen} options={cartCheckoutOpt} />
      <ExploreStack.Screen name="Payment-success" component={PaymentSuccessScreen} options={paySuccessOpt} />
      <ExploreStack.Screen name="Payment-failed" component={PaymentFailedScreen} options={payFailedOpt} />
      {/* <ExploreStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerShadowVisible: false }}
      /> */}
      <ExploreStack.Screen name="Order-detail" component={OrderDetailScreen} options={{ title: 'Order detail', headerBackVisible: false, headerShadowVisible: false }} />
      <ExploreStack.Screen name="Dispute-detail" component={DisputeDetailScreen} options={{ title: 'Dispute detail', headerBackVisible: false, headerShadowVisible: false }} />
      <ExploreStack.Screen name="Return-detail" component={ReturnDetailScreen} options={{ title: 'Return detail', headerBackVisible: false, headerShadowVisible: false }} />
      <ExploreStack.Screen
        name="Inbox"
        component={ChatRoomScreen}
        options={{
          title: 'Inbox',
          headerBackVisible: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: '#075E54' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
        }}
      />
    </ExploreStack.Navigator>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  headerAction: {
    // marginRight: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenHeader: {
    height: 0,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
});
