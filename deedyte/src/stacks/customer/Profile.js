import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import React, { Suspense, lazy } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileScreen from '../../pages/Profile';
import ProfileSettings from '../../pages/ProfileSettings';
import TransactionsScreen from '../../pages/TransactionsScreen';
import SettingsChangeEmailScreen from '../../pages/SettingsChangeEmail';
import SettingsChangePasswordScreen from '../../pages/SettingsChangePassword';
import SettingsWhatsappScreen from '../../pages/SettingsWhatsapp';
import PersonalInformationScreen from '../../pages/PersonalInformation';
import DeleteAccountScreen from '../../pages/DeleteAccountScreen';
/** Lazily loaded so `react-native-maps` native module is not required until this screen mounts. */
// const SettingsLocationLazy = lazy(() => import('../pages/SettingsLocation'));

function SettingsLocationSuspense(props) {
  return (
    <Suspense
      fallback={
        <View style={styles.lazyFallback}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      }
    >
      {/* <SettingsLocationLazy {...props} /> */}
    </Suspense>
  );
}

const ProfileStack = createNativeStackNavigator();

const SETTINGS_ROUTE_TITLES = {
  'profile-settings-email': 'Change email',
  'profile-settings-password': 'Password',
  'profile-settings-whatsapp': 'WhatsApp number',
  'profile-settings-location': 'Location',
  'profile-settings-payout': 'Payout Details',
  'profile-shop-info': 'Shop info',
  'profile-settings-delete-account': 'Delete Account',
};

function ProfileMainHeader({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.headerContainer, { paddingTop: Platform === 'ios' ? 0 : Math.max(0, 30) }]}>
      <Text style={styles.headerTitle}>Profile</Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Profile-settings')}
        style={styles.iconBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Icon name="settings-outline" size={22} color="#000000" />
      </TouchableOpacity>
    </View>
  );
}

function ProfileSettingsHeader({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.backHeaderOuter, { paddingTop: Platform === 'ios' ? 0 : Math.max(0, 30) }]}>
      <View style={styles.backHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={25} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>Settings</Text>
      </View>
    </View>
  );
}

function SettingsDetailHeader({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const title = SETTINGS_ROUTE_TITLES[route.name] ?? '';

  return (
    <View style={[styles.backHeaderOuter, { paddingTop: 0 }]}>
      <View style={styles.backHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={25} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
    </View>
  );
}

function PersonalInformationHeader({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.editProfileHeaderOuter, { paddingTop: Platform === 'ios' ? 0 : Math.max(0, 30) }]}>
      <View style={styles.editProfileHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backPill}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.editProfileTitle} numberOfLines={1} pointerEvents="none">
          Edit profile
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>
    </View>
  );
}

function TransactionsHeader({ navigation }) {
  return (
    <View style={[styles.editProfileHeaderOuter, { paddingTop: 0 }]}>
      <View style={styles.editProfileHeaderRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backPill}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevron-back" size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.editProfileTitle} numberOfLines={1} pointerEvents="none">
          Transactions
        </Text>
        <View style={styles.headerRightSpacer} />
      </View>
    </View>
  );
}


export function ProfileStackScreen() {
  const detailScreenOptions = {
    headerShown: true,
    headerShadowVisible: false,
    header: SettingsDetailHeader,
    contentStyle: { backgroundColor: '#F7F7F8' },
  };

  const profileHomeOpt = {
    headerShown: true,
    headerShadowVisible: false,
    header: ProfileMainHeader,
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profileSettingsOpt={
    headerShown: true,
    headerShadowVisible: false,
    header: ProfileSettingsHeader,
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profilePersonalInfoOpt = {
    headerShown: true,
    headerShadowVisible: false,
    header: PersonalInformationHeader,
    contentStyle: { backgroundColor: '#FFFFFF' },
  }
  const profileTxnOpt={
    headerShown: true,
    headerShadowVisible: false,
    title: "Transaction",
    headerBackVisible: true,
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profileEmailOpt = {
    headerShown: true,
    headerShadowVisible: false,
    title: "Edit email",
    headerBackVisible: true,
    headerBackTitle: "Settings",
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profilePasswordOpt = {
    headerShown: true,
    headerShadowVisible: false,
    title: "Edit Password",
    headerBackVisible: true,
    headerBackTitle: "Settings",
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profileWhatsappOpt = {
    headerShown: true,
    headerShadowVisible: false,
    title: "Edit WhatsApp number",
    headerBackVisible: true,
    headerBackTitle: "Settings",
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profileLocationOpt = {
    headerShown: true,
    headerShadowVisible: false,
    title: "Edit Location",
    headerBackVisible: true,
    headerBackTitle: "Settings",
    contentStyle: { backgroundColor: '#F7F7F8' },
  }
  const profileDeleteAccountOpt = {
    headerShown: true,
    headerShadowVisible: false,
    header: SettingsDetailHeader,
    contentStyle: { backgroundColor: '#F7F7F8' },
  }

  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} options={profileHomeOpt} />
      <ProfileStack.Screen name="Profile-settings" component={ProfileSettings} options={profileSettingsOpt} />
      <ProfileStack.Screen name="profile-personal-information" component={PersonalInformationScreen} options={profilePersonalInfoOpt} />
      <ProfileStack.Screen name="profile-transactions" component={TransactionsScreen} options={profileTxnOpt} />
      <ProfileStack.Screen name="profile-settings-email" component={SettingsChangeEmailScreen} options={profileEmailOpt} />
      <ProfileStack.Screen name="profile-settings-password" component={SettingsChangePasswordScreen} options={profilePasswordOpt} />
      <ProfileStack.Screen name="profile-settings-whatsapp" component={SettingsWhatsappScreen} options={profileWhatsappOpt} />
      <ProfileStack.Screen name="profile-settings-location" component={SettingsLocationSuspense} options={profileLocationOpt} />
      <ProfileStack.Screen name="profile-settings-delete-account" component={DeleteAccountScreen} options={profileDeleteAccountOpt} />
    </ProfileStack.Navigator>
  );
}

const styles = StyleSheet.create({
  lazyFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F7F8',
  },
  headerContainer: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEC',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  iconBtn: { padding: 8 },
  backHeaderOuter: {
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEC',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  editProfileHeaderOuter: {
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  backHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingLeft: 8,
    paddingBottom: 6,
  },
  backButton: {
    height: 44,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
    paddingRight: 44,
  },
  editProfileHeaderRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 48,
  },
  backPill: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8F8FA',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  editProfileTitle: {
    position: 'absolute',
    left: 56,
    right: 56,
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    zIndex: 1,
  },
  headerRightSpacer: {
    width: 40,
    height: 40,
    zIndex: 2,
  },
});
