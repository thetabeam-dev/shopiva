import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../context/ProfileContext';

const BLACK = '#000000';
const PAGE_BG = '#F7F7F8';
const CARD_BG = '#FFFFFF';
const TEXT_MUTED = '#8E8E93';
const PRO_YELLOW = '#FFE566';
const SOFT_YELLOW = '#FFF9E6';
const SOFT_YELLOW_DEEP = '#FFF3CC';
const BADGE_TEXT = '#000000';

const AVATAR_SIZE = 104;
const AVATAR_RING_PAD = 4;

const AI_STYLING_TOAST_MS = 2400;

export default function ProfileScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { signOut, isAuthenticated, activeRole } = useAuth();
  const { user, loading, refresh } = useProfile();

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => { });
    }, [refresh]),
  );

  const displayName = user?.displayName?.trim() || (loading ? 'Loading…' : 'Shopper');
  const emailDisplay = user?.email?.trim() || (loading ? '…' : '—');
  const avatarUri = user?.avatarUrl?.trim() || '';
  const avatarLetter = displayName.charAt(0).toUpperCase() || '?';
  const showProBadge = user?.roleRaw === 'entrepreneur';
  /** Show only while currently in vendor mode, even if account can switch roles. */
  const showShopInfo = activeRole === 'vendor';
  const [msgNotifications, setMsgNotifications] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastHideTimerRef = useRef(null);

  const showAiStylingComingSoonToast = useCallback(() => {
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current);
      toastHideTimerRef.current = null;
    }
    toastOpacity.setValue(0);
    setToastVisible(true);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    toastHideTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setToastVisible(false);
      });
      toastHideTimerRef.current = null;
    }, AI_STYLING_TOAST_MS);
  }, [toastOpacity]);

  useEffect(() => {
    return () => {
      if (toastHideTimerRef.current) clearTimeout(toastHideTimerRef.current);
    };
  }, []);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 20) + 8 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile block */}
        <View style={styles.profileBlock}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarRing}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={[styles.avatarImg, styles.avatarPh]}>
                  <Text style={styles.avatarPhText}>{avatarLetter}</Text>
                </View>
              )}
            </View>
            {/* {showProBadge ? (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>Pro</Text>
            </View>
          ) : null} */}
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email} numberOfLines={1}>
            {emailDisplay}
          </Text>
        </View>

        {/* Quick actions */}
        {/* <View style={styles.quickRow}>
        <QuickAction icon="bag-outline" label="My closet" onPress={() => {}} />
        <QuickAction icon="bar-chart-outline" label="Style stats" onPress={() => {}} />
        <QuickAction icon="clipboard-outline" label="Monthly report" onPress={() => {}} />
      </View> */}

        {/* Menu */}
        <View style={styles.menuCard}>
          {/* <MenuRow
          icon="bookmark-outline"
          title="Bookmark"
          right={
            <>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>2</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={BLACK} />
            </>
          }
          onPress={() => {}}
        /> */}



          {/* <MenuRow
          icon="time-outline"
          title="History"
          right={
            <>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>2</Text>
              </View> 
              <Icon name="chevron-forward" size={20} color={BLACK} />
            </>
          }
          onPress={() => {}}
        /> */}

          <View style={styles.menuDivider} />
          {/* <View style={styles.menuRow}>
          <View style={styles.menuLeft}>
            <Icon name="notifications-outline" size={22} color={BLACK} />
            <Text style={styles.menuTitle}>Message Notification</Text>
          </View>
          <Switch
            value={msgNotifications}
            onValueChange={setMsgNotifications}
            trackColor={{ false: '#E5E5EA', true: SOFT_YELLOW_DEEP }}
            thumbColor={msgNotifications ? PRO_YELLOW : '#F4F4F5'}
            ios_backgroundColor="#E5E5EA"
          />
        </View> */}
          <View style={styles.menuDivider} />
          <MenuRow
            icon="person-outline"
            title="Personal Information"
            right={<Icon name="chevron-forward" size={20} color={BLACK} />}
            onPress={() => navigation.navigate('profile-personal-information')}
          />
          {showShopInfo ? (
            <>
              <View style={styles.menuDivider} />
              <MenuRow
                icon="storefront-outline"
                title="Shop info"
                right={<Icon name="chevron-forward" size={20} color={BLACK} />}
                onPress={() => navigation.navigate('profile-shop-info')}
              />
            </>
          ) : null}
          <View style={styles.menuDivider} />
          {/* <MenuRow
          icon="wallet-outline"
          title="Transactions"
          right={<Icon name="chevron-forward" size={20} color={BLACK} />}
          onPress={() => navigation.navigate('profile-transactions')}
        /> */}
          <View style={styles.menuDivider} />
          <MenuRow
            iconComponent={<AiGlyph />}
            title="AI Styling"
            right={<Icon name="chevron-forward" size={20} color={BLACK} />}
            onPress={showAiStylingComingSoonToast}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="document-text-outline"
            title="Privacy policy"
            right={<Icon name="chevron-forward" size={20} color={BLACK} />}
            onPress={() => {
              Linking.openURL('https://deedyte-gccey4ohn-thetabeam.vercel.app/entrepreneur/ng/privacy-policy').catch(() => {
                Alert.alert('Could not open link', 'Unable to open privacy policy.');
              });
            }}
          />
          <View style={styles.menuDivider} />
          <MenuRow
            icon={isAuthenticated ? 'log-out-outline' : 'log-in-outline'}
            title={isAuthenticated ? 'Sign out' : 'Sign in'}
            right={<Icon name="chevron-forward" size={20} color={BLACK} />}
            onPress={() => {
              if (!isAuthenticated) {
                void signOut();
                return;
              }
              Alert.alert('Sign out', 'You will need to sign in again to use the app.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out',
                  style: 'destructive',
                  onPress: () => {
                    void signOut();
                  },
                },
              ]);
            }}
          />
        </View>
      </ScrollView>

      {toastVisible ? (
        <View
          style={[styles.toastWrap, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}
          pointerEvents="none"
        >
          <Animated.View style={[styles.toastPill, { opacity: toastOpacity }]}>
            <Text style={styles.toastText}>AI Styling is coming soon.</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

/** Small “AI” glyph to mirror reference (not a stock Ionicon). */
function AiGlyph() {
  return (
    <View style={styles.aiGlyph}>
      <Text style={styles.aiGlyphText}>AI</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
      onPress={onPress}
    >
      <Icon name={icon} size={22} color={BLACK} />
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function MenuRow({
  icon,
  iconComponent,
  title,
  right,
  onPress,
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
    >
      <View style={styles.menuLeft}>
        {iconComponent ?? <Icon name={icon} size={22} color={BLACK} />}
        <Text style={styles.menuTitle}>{title}</Text>
      </View>
      <View style={styles.menuRight}>{right}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  toastWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  toastPill: {
    maxWidth: 360,
    backgroundColor: 'rgba(33,33,33,0.94)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 6 },
    }),
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  profileBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarOuter: {
    marginBottom: 12,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: AVATAR_SIZE + AVATAR_RING_PAD * 2,
    height: AVATAR_SIZE + AVATAR_RING_PAD * 2,
    borderRadius: (AVATAR_SIZE + AVATAR_RING_PAD * 2) / 2,
    borderWidth: 2,
    borderColor: BLACK,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarPh: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8E8EA',
  },
  avatarPhText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#555',
  },
  proBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    backgroundColor: PRO_YELLOW,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: BADGE_TEXT,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: TEXT_MUTED,
    maxWidth: '92%',
    textAlign: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: SOFT_YELLOW,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 82,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  quickBtnPressed: {
    opacity: 0.9,
  },
  quickLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    color: BLACK,
    textAlign: 'center',
    lineHeight: 14,
  },
  menuCard: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ECECEC',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  menuRowPressed: {
    backgroundColor: '#FAFAFA',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: BLACK,
    flex: 1,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginLeft: 48,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 10,
    backgroundColor: PRO_YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: BLACK,
  },
  aiGlyph: {
    width: 26,
    height: 26,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: BLACK,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SOFT_YELLOW,
  },
  aiGlyphText: {
    fontSize: 11,
    fontWeight: '800',
    color: BLACK,
    letterSpacing: -0.5,
  },
});
