import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Dropdown } from 'react-native-element-dropdown';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../context/ProfileContext';
import {
  createShopPayoutAccount,
  deleteShopPayoutAccount,
  fetchOwnerShops,
  fetchPayoutBanks,
  fetchShopPayoutAccount,
  updateShopPayoutAccount,
  verifyPayoutAccount,
} from '../api/shop';
import FormKeyboardAvoiding from '../components/FormKeyboardAvoiding';

const PAGE_BG = '#F7F7F8';
const CARD = '#FFFFFF';
const MUTED = '#6B7280';
const BLACK = '#111111';
const BRAND = '#00926e';
const SUCCESS = '#2E7D32';
const BORDER = '#E5E7EB';

/** @param {Record<string, unknown>} row */
function shopIdOf(row) {
  const v = row.id ?? row.shopid ?? row.shop_id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {Record<string, unknown>} row */
function shopNameOf(row) {
  return String(row.name ?? row.shopname ?? row.shop_name ?? 'Shop').trim() || 'Shop';
}

/** @param {Record<string, unknown> | null} row */
function payoutField(row, snake, camel) {
  if (!row) return '';
  const a = row[snake];
  const b = row[camel];
  const v = a != null ? a : b;
  return v != null ? String(v) : '';
}

export default function SettingsPayoutScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const userId = Number(user?.id);

  const [shops, setShops] = useState(/** @type {Record<string, unknown>[]} */ ([]));
  const [selectedShopId, setSelectedShopId] = useState(/** @type {number | null} */ (null));
  const [payout, setPayout] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [banner, setBanner] = useState(/** @type {string | null} */ (null));

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(/** @type {'add' | 'edit'} */ ('add'));
  const [banks, setBanks] = useState(/** @type {Record<string, unknown>[]> */ ([]));
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const shopOptions = useMemo(
    () =>
      shops.map((s) => ({
        label: shopNameOf(s),
        value: shopIdOf(s),
      })),
    [shops],
  );

  const bankOptions = useMemo(() => {
    return banks
      .map((b) => {
        const code = String(b.code ?? b.bank_code ?? '').trim();
        const name = String(b.name ?? b.bank_name ?? '').trim();
        if (!code || !name) return null;
        return { label: name, value: code };
      })
      .filter(Boolean);
  }, [banks]);

  const loadShops = useCallback(async () => {
    if (!Number.isFinite(userId) || userId <= 0) {
      setShops([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchOwnerShops(userId);
      setShops(list);
      setSelectedShopId((prev) => {
        if (prev && list.some((s) => shopIdOf(s) === prev)) return prev;
        if (list.length === 1) return shopIdOf(list[0]);
        return list.length ? shopIdOf(list[0]) : null;
      });
    } catch {
      setShops([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadPayout = useCallback(async () => {
    if (!selectedShopId || !Number.isFinite(userId) || userId <= 0) {
      setPayout(null);
      return;
    }
    setPayoutLoading(true);
    try {
      const row = await fetchShopPayoutAccount(selectedShopId, userId);
      setPayout(row);
    } catch {
      setPayout(null);
    } finally {
      setPayoutLoading(false);
    }
  }, [selectedShopId, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadShops();
    }, [loadShops]),
  );

  useEffect(() => {
    void loadPayout();
  }, [loadPayout]);

  const openAddForm = async () => {
    setBanner(null);
    setFormMode('add');
    setBankCode('');
    setAccountNumber('');
    setAccountName('');
    setFormOpen(true);
    setBanksLoading(true);
    try {
      const list = await fetchPayoutBanks(userId);
      setBanks(list);
    } catch (e) {
      Alert.alert('Banks', e instanceof Error ? e.message : String(e));
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  };

  const openEditForm = async () => {
    if (!payout) return;
    setBanner(null);
    setFormMode('edit');
    setBankCode(payoutField(payout, 'bank_code', 'bankCode'));
    setAccountNumber('');
    setAccountName(payoutField(payout, 'account_name', 'accountName'));
    setFormOpen(true);
    setBanksLoading(true);
    try {
      const list = await fetchPayoutBanks(userId);
      setBanks(list);
    } catch (e) {
      Alert.alert('Banks', e instanceof Error ? e.message : String(e));
      setBanks([]);
    } finally {
      setBanksLoading(false);
    }
  };

  const onVerify = async () => {
    const acct = accountNumber.replace(/\D/g, '');
    if (acct.length !== 10) {
      Alert.alert('Account number', 'Enter a valid 10-digit account number.');
      return;
    }
    if (!bankCode) {
      Alert.alert('Bank', 'Select a bank first.');
      return;
    }
    setVerifyBusy(true);
    try {
      const data = await verifyPayoutAccount(userId, acct, bankCode);
      const name = data?.account_name != null ? String(data.account_name) : '';
      if (name) setAccountName(name);
      else Alert.alert('Verify', 'Could not resolve account name. Enter it manually.');
    } catch (e) {
      Alert.alert('Verify', e instanceof Error ? e.message : String(e));
    } finally {
      setVerifyBusy(false);
    }
  };

  const bankLabelForCode = useCallback(
    (code) => {
      const row = banks.find((b) => String(b.code ?? '').trim() === String(code).trim());
      return row ? String(row.name ?? '').trim() : '';
    },
    [banks],
  );

  const onSaveForm = async () => {
    if (!selectedShopId) return;
    const acct = accountNumber.replace(/\D/g, '');
    if (acct.length !== 10) {
      Alert.alert('Account number', 'Enter a valid 10-digit account number.');
      return;
    }
    if (!bankCode) {
      Alert.alert('Bank', 'Select a bank.');
      return;
    }
    const name = accountName.trim();
    if (name.length < 2) {
      Alert.alert('Account name', 'Enter the account holder name (use Verify or type manually).');
      return;
    }
    const bank_name =
      bankLabelForCode(bankCode) ||
      (formMode === 'edit' ? payoutField(payout, 'bank_name', 'bankName') : '') ||
      name;
    const body = {
      bank_name,
      bank_code: bankCode,
      account_name: name,
      account_number: acct,
    };
    setSaveBusy(true);
    try {
      if (formMode === 'add') {
        await createShopPayoutAccount(selectedShopId, userId, body);
      } else {
        await updateShopPayoutAccount(selectedShopId, userId, body);
      }
      setFormOpen(false);
      await loadPayout();
      Alert.alert('Saved', formMode === 'add' ? 'Payout account added.' : 'Payout account updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  };

  const onDelete = () => {
    if (!selectedShopId || !payout) return;
    Alert.alert('Delete payout account', 'Remove bank details for this shop? You can add them again later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const data = await deleteShopPayoutAccount(selectedShopId, userId);
            setPayout(null);
            const msg = typeof data?.message === 'string' ? data.message : 'Payout account deleted.';
            setBanner(msg);
          } catch (e) {
            Alert.alert('Delete failed', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);
  };

  const bankDisplay = payoutField(payout, 'bank_name', 'bankName');
  const acctName = payoutField(payout, 'account_name', 'accountName');
  const last4 = payoutField(payout, 'account_number', 'accountNumber').replace(/\D/g, '');
  const masked = last4 ? `****${last4.slice(-4)}` : '—';
  const status = payoutField(payout, 'status', 'status').toLowerCase() || '—';

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>Sign in to manage payout details.</Text>
      </View>
    );
  }

  return (
    <>
    <FormKeyboardAvoiding>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Add the bank details used to settle your earnings after successful orders.
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} color={BRAND} />
        ) : shops.length === 0 ? (
          <Text style={styles.muted}>You do not have a shop yet. Create one from Settings (vendor mode).</Text>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Shop</Text>
            <Dropdown
              style={styles.dropdown}
              containerStyle={styles.dropdownList}
              placeholderStyle={styles.dropdownPh}
              selectedTextStyle={styles.dropdownSel}
              itemTextStyle={styles.dropdownItem}
              data={shopOptions}
              labelField="label"
              valueField="value"
              placeholder="Select shop"
              value={selectedShopId}
              onChange={(item) => {
                setSelectedShopId(item.value);
                setBanner(null);
              }}
            />

            {banner ? <Text style={styles.banner}>{banner}</Text> : null}

            {payoutLoading ? (
              <ActivityIndicator style={styles.loader} color={BRAND} />
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Payout account</Text>
                {!payout ? (
                  <>
                    <Text style={styles.cardDesc}>
                      You have not added any payout account yet. Add your bank details so settled earnings can be
                      transferred to your account.
                    </Text>
                    <Pressable
                      style={({ pressed }) => [styles.addLinkRow, pressed && styles.pressed]}
                      onPress={() => {
                        void openAddForm();
                      }}
                    >
                      <Icon name="add-circle-outline" size={22} color={BRAND} style={styles.addIcon} />
                      <Text style={styles.addLink}>Add payout details</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={styles.grid}>
                      <PayoutCell label="Bank" value={bankDisplay || '—'} />
                      <PayoutCell label="Account name" value={acctName || '—'} />
                      <PayoutCell label="Account number" value={masked} />
                      <PayoutCell label="Status" value={status} />
                    </View>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                        onPress={() => {
                          void openEditForm();
                        }}
                      >
                        <Text style={styles.outlineBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
                        onPress={onDelete}
                      >
                        <Text style={styles.outlineBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </FormKeyboardAvoiding>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <FormKeyboardAvoiding offset={0} style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => !saveBusy && setFormOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{formMode === 'add' ? 'Add payout details' : 'Edit payout details'}</Text>
              <Pressable onPress={() => !saveBusy && setFormOpen(false)} hitSlop={12}>
                <Icon name="close" size={26} color={BLACK} />
              </Pressable>
            </View>
            <Text style={styles.sheetHint}>
              {formMode === 'edit'
                ? 'Enter the full account number again to update with Paystack.'
                : 'Select your bank, enter your account number, then verify before saving.'}
            </Text>

            {banksLoading ? (
              <ActivityIndicator color={BRAND} style={{ marginVertical: 16 }} />
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Bank</Text>
                <Dropdown
                  style={styles.dropdown}
                  containerStyle={styles.dropdownList}
                  placeholderStyle={styles.dropdownPh}
                  selectedTextStyle={styles.dropdownSel}
                  itemTextStyle={styles.dropdownItem}
                  data={bankOptions}
                  labelField="label"
                  valueField="value"
                  placeholder="Select bank"
                  search
                  searchField="label"
                  searchPlaceholder="Search banks..."
                  value={bankCode}
                  onChange={(item) => setBankCode(item.value)}
                />

                <Text style={styles.fieldLabel}>Account number</Text>
                <TextInput
                  style={styles.input}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  placeholder="10 digits"
                  placeholderTextColor="#A0A0A0"
                  keyboardType="number-pad"
                  maxLength={10}
                />

                <Pressable
                  style={[styles.secondaryBtn, verifyBusy && styles.btnDisabled]}
                  onPress={() => {
                    void onVerify();
                  }}
                  disabled={verifyBusy}
                >
                  {verifyBusy ? (
                    <ActivityIndicator color={BRAND} />
                  ) : (
                    <Text style={styles.secondaryBtnText}>Verify account</Text>
                  )}
                </Pressable>

                <Text style={styles.fieldLabel}>Account name</Text>
                <TextInput
                  style={styles.input}
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Account holder name"
                  placeholderTextColor="#A0A0A0"
                  autoCapitalize="words"
                />

                <Pressable
                  style={[styles.primaryBtn, saveBusy && styles.btnDisabled]}
                  onPress={() => {
                    void onSaveForm();
                  }}
                  disabled={saveBusy}
                >
                  {saveBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Save</Text>
                  )}
                </Pressable>
              </ScrollView>
            )}
          </View>
        </FormKeyboardAvoiding>
      </Modal>
    </>
  );
}

function PayoutCell({ label, value }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: PAGE_BG },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  subtitle: { fontSize: 15, color: MUTED, lineHeight: 22, marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#222', marginBottom: 8 },
  dropdown: {
    height: 48,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: CARD,
  },
  dropdownList: { borderRadius: 10 },
  dropdownPh: { fontSize: 14, color: '#A0A0A0' },
  dropdownSel: { fontSize: 14, color: BLACK },
  dropdownItem: { fontSize: 14, color: BLACK },
  banner: { fontSize: 14, color: SUCCESS, fontWeight: '600', marginBottom: 12 },
  loader: { marginVertical: 24 },
  muted: { fontSize: 15, color: MUTED, lineHeight: 22 },
  centered: { flex: 1, paddingHorizontal: 24, backgroundColor: PAGE_BG },
  card: {
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginTop: 4,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: BLACK, marginBottom: 10 },
  cardDesc: { fontSize: 14, color: MUTED, lineHeight: 21, marginBottom: 16 },
  addLinkRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  addIcon: { marginRight: 8 },
  addLink: { fontSize: 16, fontWeight: '600', color: BRAND },
  pressed: { opacity: 0.75 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 },
  cell: { width: '50%', paddingHorizontal: 8, marginBottom: 14 },
  cellLabel: { fontSize: 12, color: MUTED, marginBottom: 4 },
  cellValue: { fontSize: 15, fontWeight: '700', color: BLACK },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  outlineBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '600', color: BLACK },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '88%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: BLACK, flex: 1 },
  sheetHint: { fontSize: 13, color: MUTED, lineHeight: 19, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 15,
    color: BLACK,
    marginBottom: 12,
    backgroundColor: CARD,
  },
  secondaryBtn: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: BRAND },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: BRAND,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.65 },
});
