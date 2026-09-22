import * as React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import { HomeStackScreen } from '../stacks/customer/Home';
import { ProfileStackScreen } from '../stacks/customer/Profile';
import { CartStackScreen } from '../stacks/customer/Cart';
import { ActivitiesStackScreen } from '../stacks/customer/Activities';
import { ProfileProvider } from '../context/ProfileContext';

const Tab = createBottomTabNavigator();

export default function CustomerTab() {
  const { nested_nav } = useSelector(s => s?.nested_nav);
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

            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Cart') {
              iconName = focused ? 'cart' : 'cart-outline';
            } else if (route.name === 'Activities') {
              iconName = focused ? 'pulse' : 'pulse-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person-circle' : 'person-circle-outline';
            }
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
        <Tab.Screen name="Home" component={HomeStackScreen} />
        <Tab.Screen name="Activities" component={ActivitiesStackScreen} />
        <Tab.Screen name="Cart" component={CartStackScreen} />
        <Tab.Screen name="Profile" component={ProfileStackScreen} />
      </Tab.Navigator>
    </ProfileProvider>
  );
}
