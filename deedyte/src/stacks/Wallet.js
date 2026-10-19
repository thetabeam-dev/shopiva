import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletScreen from '../pages/Wallet';
import WalletTopUpScreen from '../pages/WalletTopUp';
import WalletSendScreen from '../pages/WalletSend';
import WalletHistoryScreen from '../pages/WalletHistory';
import WalletWithdrawScreen from '../pages/WalletWithdraw';
import WalletPinScreen from '../pages/WalletPin';
import WalletSettingsScreen from '../pages/WalletSettings';
import WalletPinChangeScreen from '../pages/WalletPinChange';

const WalletStack = createNativeStackNavigator();

const header = title => ({
  title,
  headerShown: true,
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#FFFFFF' },
});

export function WalletStackScreen() {
  return (
    <WalletStack.Navigator>
      <WalletStack.Screen name="Wallet" component={WalletScreen} options={header('Wallet')} />
      <WalletStack.Screen name="Wallet-topup" component={WalletTopUpScreen} options={header('Top up')} />
      <WalletStack.Screen name="Wallet-send" component={WalletSendScreen} options={header('Send')} />
      <WalletStack.Screen name="Wallet-history" component={WalletHistoryScreen} options={header('History')} />
      <WalletStack.Screen name="Wallet-withdraw" component={WalletWithdrawScreen} options={header('Withdraw')} />
      <WalletStack.Screen name="Wallet-pin" component={WalletPinScreen} options={header('Create PIN')} />
      <WalletStack.Screen name="Wallet-settings" component={WalletSettingsScreen} options={header('Wallet settings')} />
      <WalletStack.Screen name="Wallet-pin-change" component={WalletPinChangeScreen} options={header('Change PIN')} />
    </WalletStack.Navigator>
  );
}
