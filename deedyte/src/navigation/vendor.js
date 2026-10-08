import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { ProfileProvider } from '../context/ProfileContext';
import { useAuth } from '../hooks/useAuth';
import { useUnreadChatTotal } from '../components/UnreadMessageBadge';
import { listNotifications } from '../api/user';
import { set_notifications } from '../../redux/notifications';

import { VendorHomeStackScreen } from '../stacks/vendor/Home';
import { VendorProductStackScreen } from '../stacks/vendor/Product';
import { VendorActivitiesStackScreen } from '../stacks/vendor/Activities';
import { VendorProfileStackScreen } from '../stacks/vendor/Profile';



const Tab = createBottomTabNavigator();

function useActivitiesBadge() {
  const dispatch = useDispatch();
  const { activeRole } = useAuth();
  const chatTotal = useUnreadChatTotal();
  const items = useSelector((state) => state.notifications?.items ?? []);

  React.useEffect(() => {
    listNotifications(activeRole)
      .then((rows) => dispatch(set_notifications(rows)))
      .catch(() => {});
  }, [activeRole, dispatch]);

  const role = activeRole === 'vendor' ? 'vendor' : 'buyer';
  const changes = items.filter((item) => {
    if (String(item?.status ?? '').toLowerCase() === 'read') return false;
    const source = String(item?.source_type ?? '').toLowerCase();
    if (!['order', 'return', 'dispute'].includes(source)) return false;
    const itemRole = String(item?.role ?? '').toLowerCase();
    if (role === 'vendor') return itemRole === 'vendor' || itemRole === 'seller';
    return itemRole === 'buyer' || itemRole === 'customer';
  }).length;

  const total = changes + chatTotal;
  return total > 0 ? total : undefined;
}

export default function VendorTabs() {
  const { nested_nav } = useSelector((s) => s?.nested_nav);
  const [tabBarStyle, setTabBarStyle] = React.useState('flex');
  const activitiesBadge = useActivitiesBadge();

  React.useEffect(() => {
    if (nested_nav?.boolean) {
      setTabBarStyle('flex');
    } else {
      setTabBarStyle('none');
    }
  }, [nested_nav]);

  return (
    <ProfileProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, size, color }) => {
            let iconName = 'ellipse-outline';
            if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
            else if (route.name === 'Activities') iconName = focused ? 'pulse' : 'pulse-outline';
            else if (route.name === 'Profile') iconName = focused ? 'person-circle' : 'person-circle-outline';
            else if (route.name === 'Products') iconName = focused ? 'pricetags' : 'pricetags-outline';
            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#00926E',
          tabBarInactiveTintColor: '#000000',
          headerShown: false,
          tabBarStyle: {
            display: tabBarStyle,
          },
        })}
      >
        <Tab.Screen name="Home" component={VendorHomeStackScreen} />
        <Tab.Screen
          name="Activities"
          component={VendorActivitiesStackScreen}
          options={{ tabBarBadge: activitiesBadge }}
        />
        <Tab.Screen name="Products" component={VendorProductStackScreen} />
        <Tab.Screen name="Profile" component={VendorProfileStackScreen} />
      </Tab.Navigator>
    </ProfileProvider> 
  );
}
