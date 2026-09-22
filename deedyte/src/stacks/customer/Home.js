import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
// import { useSelector } from 'react-redux';
import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import HomeScreen from "../../pages/customer/Home";
import VendorsScreen from "../../pages/customer/Vendors";
import VendorScreen from '../../pages/customer/Vendor';
import ProductScreen from '../../pages/customer/Product';
import CartScreen from '../../pages/customer/Cart';
import CartCheckoutScreen from '../../pages/customer/CartCheckoutScreen';
import PaymentSuccessScreen from '../../pages/customer/PaymentSuccessScreen';
import PaymentFailedScreen from '../../pages/customer/PaymentFailedScreen';
import { HomeStackCartIconButton } from '../../components/HomeStackCartButton';

/** Bundled logo for native stack header (do not use `{ uri: '../assets/...' }` for local files). */
const DEEDYTE_LOGO = require('../../assets/Deedyte.png');
// import { setUserAuthTo } from '../../redux/...';
const HomeStack = createNativeStackNavigator();


const homeOpt = (styles) => ({
  title: 'Home',
  headerBackVisible: false,
  headerShadowVisible: false,
  headerStyle: styles.homeHeaderBar,
  // headerRight: () => (
  //   <View>
  //     <HomeStackCartIconButton
  //       size={24}
  //       color="#000000"
  //       style={styles.vendorsHomeHeaderCart}
  //     />
  //   </View>
  // ),
  
});
const vendorsOpt = (navigation) => ({
  title: 'Home',
  headerRight: () => (
    <View style={styles.vendorsHeaderRight}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Select location"
        onPress={() =>
          navigation.setParams({ openVendorFilter: Date.now() })
        }
        style={styles.vendorsHeaderFilter}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="location-outline" size={22} color="#000000" />
      </TouchableOpacity>

      <TouchableOpacity
        accessibilityRole="button"
        onPress={() =>
          navigation.navigate('')
        }
        style={styles.vendorsHeaderFilter}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Icon name="notifications-outline" size={22} color="#000000" />
      </TouchableOpacity>
    </View>
  ),
})
const vendorOpt={
  header: () => (
    <View style={styles.hiddenHeader} />
  ),
}
const cartOpt = {
  title: 'Cart',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
}
const cartCheckoutOpt = {
  title: 'Checkout',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
}
const paySuccessOpt = {
  title: 'Payment Status',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
  headerBackVisible: false,
}
const payFailedOpt = {
  title: 'Payment Status',
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
}
export function HomeStackScreen() {
  // const { user } = useSelector(s => s?.user ?? {});
  // const dispatch = useDispatch();
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        name="Home"
        component={VendorsScreen}
        options={({ navigation }) => vendorsOpt(navigation)}
      />
      <HomeStack.Screen name="Vendor" component={VendorScreen} options={vendorOpt} />
      <HomeStack.Screen name="Product" component={ProductScreen} options={{   headerShown: false, }} />
      <HomeStack.Screen name="Cart" component={CartScreen} options={cartOpt}/>
      <HomeStack.Screen name="Cart-checkout" component={CartCheckoutScreen} options={cartCheckoutOpt}/>
      <HomeStack.Screen name="Payment-success" component={PaymentSuccessScreen} options={paySuccessOpt}/>
      <HomeStack.Screen name="Payment-failed" component={PaymentFailedScreen} options={payFailedOpt}/>
    </HomeStack.Navigator>
  );
}

const styles = StyleSheet.create({
  placeholderRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  placeholderText: {
    fontSize: 18,
    color: '#333',
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  searchBarText: {
    color: '#999',
    fontSize: 14,
  },
  offersStrip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff6f2',
  },
  offersText: {
    color: '#00926e',
    fontWeight: '600',
  },
  headerContainer: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
    ...Platform.select({
      ios: { paddingTop: 10 },
    }),
  },
  logoContainer: { flex: 1 },
  logo: { width: 50, height: 40 },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00926e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#00926e',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  loginText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  hiddenHeader: {
    height: 0,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  backHeader: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingLeft: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  backButton: {
    height: 44,
    width: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  /** Flat header bar: no shadow / elevation (matches full-bleed home hero). */
  homeHeaderBar: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
    borderBottomWidth: 0,
  },

  homeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  vendorsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  vendorsHeaderCart: {
    marginRight: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vendorsHomeHeaderCart: {
    marginRight: 0,
    paddingVertical: 4,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vendorsHeaderFilter: {
    marginRight: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },

  homeHeaderLogoCnt: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    display: "flex"
    // marginLeft: 4,
  },
  homeHeaderLogo: {
    width: "100%",
    height: "100%",
    // marginLeft: 4,
  },
});

