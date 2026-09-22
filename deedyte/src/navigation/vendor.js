import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { ProfileProvider } from '../context/ProfileContext';

import { VendorHomeStackScreen } from '../stacks/vendor/Home';
import { VendorProductStackScreen } from '../stacks/vendor/Product';
import { VendorActivitiesStackScreen } from '../stacks/vendor/Activities';
import { VendorProfileStackScreen } from '../stacks/vendor/Profile';



const Tab = createBottomTabNavigator();

export default function VendorTabs() {
  const { nested_nav } = useSelector((s) => s?.nested_nav);
  const [tabBarStyle, setTabBarStyle] = React.useState('flex');

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
        <Tab.Screen name="Activities" component={VendorActivitiesStackScreen} />
        <Tab.Screen name="Products" component={VendorProductStackScreen} />
        <Tab.Screen name="Profile" component={VendorProfileStackScreen} />
      </Tab.Navigator>
    </ProfileProvider> 
  );
}
