import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { formatNaira } from '../utils/formatNaira';
import { fetchBuyerDispute } from '../api/buyer';
import { fetchOwnerShops, fetchReturnId, fetchShopDispute } from '../api';
import { getStoredUser } from '../auth/session';
import { connectChatSocket, emitSocketAck } from '../socket/chatSocket';
import { set_disputeInfo } from '../../redux/dispute';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { set_disputeList } from '../../redux/disputes';
dayjs.extend(relativeTime);

const PAGE_BG = '#F5F5F5';
const WHITE = '#FFFFFF';
const BLACK = '#111111';
const MUTED = '#8E8E93';
const LIME = '#A4C639';
const LINK = '#1565C0';
const TEAL = '#0D9488';
const LINE_DONE = '#C5E075';
const LINE_PENDING = '#E0E0E0';
const DOT_PENDING = '#D8D8D8';

const STATUS_DISPLAY = {
  open: 'Opened',
  escalated: 'Escalated',
  resolved: 'Resolved',
};

const STATUS_PILL = {
  open: { bg: '#FFF3E0', fg: '#C45C00' },
  escalated: { bg: '#E3F2FD', fg: '#1565C0' },
  resolved: { bg: '#E8F5E9', fg: '#2E7D32' },
};


function MetaCell({ label, value, valueIsLink }) {
  return (
    <View style={styles.metaCell}>
      <Text style={styles.metaCaps}>{label}</Text>
      {valueIsLink ? (
        <Text style={styles.metaLink} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        <Text style={[styles.metaStrong, { textTransform: "capitalize" }]} numberOfLines={2}>
          {value}
        </Text>
      )}
    </View>
  );
}

function AnalysisField({ label, value, highlight }) {
  return (
    <View style={styles.analysisField}>
      <Text style={styles.analysisLabel}>{label}</Text>
      <Text style={[styles.analysisValue, highlight && styles.limeText]}>{value}</Text>
    </View>
  );
}

function EvidenceGalleryItem({ uri, kind, caption }) {
  const isVideo = kind === 'video';
  return (
    <View style={styles.galleryItem}>
      <View style={styles.thumbOuter}>
        <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
        <View style={styles.thumbBadge}>
          <Text style={styles.thumbBadgeText}>{isVideo ? 'VIDEO' : 'IMAGE'}</Text>
        </View>
      </View>
      {caption ? (
        <Text style={styles.galleryCaption} numberOfLines={2}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

function DisputeDetailHeaderRight({ onOpenActions }) {
  return (
    <View style={styles.headerTools}>
      <Pressable
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.headerEllipsis}
        onPress={onOpenActions}
        accessibilityRole="button"
        accessibilityLabel="More dispute actions"
      >
        <Icon name="ellipsis-horizontal" size={22} color={BLACK} />
      </Pressable>
    </View>
  );
}

export default function DisputeDetailScreen() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const auth = useSelector((s) => s.auth);
  const { disputeInfo: dispute } = useSelector((s) => s.disputeInfo);
  const isCustomer = auth?.activeRole === 'customer';
  const counterpartLabel = isCustomer ? 'Vendor' : 'Buyer';
  const summaryTitle = isCustomer ? 'Your summary' : 'Buyer’s summary';
  const messageActionLabel = isCustomer ? 'Message vendor' : 'Message customer';

  const [actionsOpen, setActionsOpen] = useState(false);

  const disputeIdParam =
    route.params?.disputeId ??
    route.params?.dispute_id ??
    route.params?.dispute?.id ??
    null;

  useEffect(() => {
    connectChatSocket();
  }, []);

  useEffect(() => {
    if (disputeIdParam == null || disputeIdParam === '') return;
    const currentId = dispute?.id ?? dispute?.dispute?.id;
    if (currentId != null && String(currentId) === String(disputeIdParam)) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (auth?.activeRole === 'customer') {
          const result = await fetchBuyerDispute(disputeIdParam);
          if (!cancelled) {
            dispatch(set_disputeInfo(result?.dispute ?? result));
          }
        } else {
          const user = await getStoredUser();
          const userId = user?.id;
          if (!userId) return;
          const shops = await fetchOwnerShops(userId);
          const sid = shops?.[0]?.id;
          if (!sid) return;
          const result = await fetchShopDispute(sid, disputeIdParam, userId);
          if (!cancelled) {
            dispatch(set_disputeInfo(result?.dispute ?? result));
          }
        }
      } catch (err) {
        console.log('[DisputeDetail] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disputeIdParam, auth?.activeRole, dispatch, dispute?.id]);


  const openActions = useCallback(() => {
    setActionsOpen(true);
  }, []);

  const renderHeaderRight = useCallback(
    () => <DisputeDetailHeaderRight onOpenActions={openActions} />,
    [openActions],
  );

  useLayoutEffect(() => {
    if (!dispute) {
      navigation.setOptions({ headerRight: undefined });
      return undefined;
    }

    navigation.setOptions({
      headerTitle: () => (
        <View style={[styles.statusRow, { flexDirection: "column" }]}>
          <Text style={styles.disputeId}>{dispute.dispute_ref}</Text>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.fg, textTransform: "capitalize" }]}>{statusText}</Text>
          </View>
        </View>
      )
    })
    navigation.setOptions({
      headerRight: renderHeaderRight,
    });
    return () => navigation.setOptions({ headerRight: undefined });
  }, [navigation, dispute, renderHeaderRight]);

  const statusKey = dispute?.status ?? 'open';
  const pill = STATUS_PILL[statusKey] ?? STATUS_PILL.open;
  const statusText = STATUS_DISPLAY[statusKey] ?? statusKey;
  const isResolved = statusKey === 'resolved';

  const closeActions = () => setActionsOpen(false);

  const makeCall = async (phoneNumber) => {
    try {
      const url = `tel:${phoneNumber}`;

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Unable to open phone dialer');
      console.log(error);
    }
  };

  const onAcceptOffer = async () => {
    if (dispute.status === "escalated") {
      await makeCall(9047263572);
      return;
    }

    if (dispute.status === "resolved") {
      setLoading(true)
      let id = await fetchReturnId(dispute.order_id, auth.activeRole);
      setLoading(false)
      navigation.navigate("Return-detail", {
        returnId: id.id,
      });
      return;
    }
    if (dispute.status === "open") {
      if (isCustomer) return;
      navigation.navigate("Dispute-action", {
        action: "acceptance",
        data: {
          dispute_id: dispute.id
        }
      });
      return;
    }
  };

  const onSubmitEvidenceFab = () => {
    Alert.alert('Submit evidence', 'Upload photos or documents from your library or camera.');
  };

  const onEscalate = () => {
    closeActions();
    if (isResolved) {
      Alert.alert('Escalate', 'This dispute is already resolved.');
      return;
    }
    Alert.alert(
      'Escalate dispute',
      'Request a senior reviewer for this case?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          // onPress: () =>
          //   Alert.alert('Request sent', 'Our team will prioritise your case.'),
          onPress: () => escalateDispute()
        },
      ],
    );


  };
  let escalateDispute = async (params) => {
    setLoading(true);
    const u = await getStoredUser();
    const response = await emitSocketAck(
      "dispute_escalation",
      {
        status: "escalated",
        dispute_id: dispute.id,
        notes: "",
        action: "escalation",
        actor_id: u.id,
      }
    );
    if (response.success) {
      Alert.alert('Request sent', 'Our team will prioritise your case.')
      dispatch(set_disputeInfo(response.dispute.vendor.vdi));
      dispatch(set_disputeList(response.dispute.vendor.vdl));
      navigation.goBack();
    }
  }

  const onAddEvidence = () => {
    closeActions();
    if (isResolved) {
      Alert.alert('Add evidence', 'Evidence cannot be added to a resolved dispute.');
      return;
    }
    onSubmitEvidenceFab();
  };

  const onMessageCounterpart = () => {
    closeActions();
    if (isCustomer) {
      Alert.alert('Message vendor', 'Chat with the seller will open here when connected.');
    } else {
      Alert.alert('Message customer', 'Chat with the buyer will open here when connected.');
    }
  };

  const onSubmitVendorResponse = () => {
    closeActions();
    if (isResolved) {
      Alert.alert('Respond', 'This dispute is already resolved.');
      return;
    }
    Alert.alert('Submit response', 'Vendor response form will open here when connected.');
  };

  /** Platform / Deedyte support (Material Icons `support-agent` — closest to “customer care” in this bundle). */
  const onContactSupport = () => {
    closeActions();
    Alert.alert('Contact support', 'Deedyte support will open here when connected.');
  };

  const onWithdraw = () => {
    closeActions();
    if (isResolved) {
      Alert.alert('Withdraw', 'This dispute is already closed.');
      return;
    }
    Alert.alert(
      'Withdraw dispute',
      `Withdraw ${dispute?.id ?? 'this dispute'}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Withdrawn', 'Your dispute has been withdrawn.');
            navigation.goBack();
          },
        },
      ],
    );
  };

  const onDownloadSummary = () => {
    closeActions();
    Alert.alert('Summary', 'PDF download will be available when connected.');
  };

  if (!dispute) {
    return (
      <View style={[styles.empty, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>Dispute not found.</Text>
      </View>
    );
  }

  const renderOrderItems = useCallback((dispute, index) => {

    return (
      <>

        <View style={styles.tableRow}>
          <Text style={[styles.tableCell, styles.tableHName]} numberOfLines={2}>
            {dispute.name ?? '—'}
          </Text>
          <Text style={styles.tableCell}>
            {dispute.qty != null ? String(dispute.qty) : '—'}
          </Text>
          <Text style={styles.tableCell}>
            {dispute.unit_price != null
              ? formatNaira(dispute.unit_price)
              : '—'}
          </Text>
          <Text style={styles.tableCellStrong}>
            {dispute.total_price != null
              ? formatNaira(dispute.total_price)
              : '—'}
          </Text>
        </View>
      </>
    )
  }, [])


  function Spinner() {
    return (
      <>
        <View
          style={{
            height: '100%',
            width: '100%',
            position: 'absolute',
            top: 0,
            backgroundColor: 'rgba(0,0,0,0.3)',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
        >
          <ActivityIndicator size="large" color="green" />
        </View>
      </>
    );
  }

  const fabBottom = Math.max(insets.bottom, 12) + 8;
  const scrollBottomPad = fabBottom + 72;
  const getButtonText = () => {
    if (dispute.status === "resolved") {
      return 'View return';
    }

    if (dispute.status === "escalated") {
      return 'Contact support';
    }

    if (dispute.status === "open") {
      return isCustomer
        ? 'Awaiting response'
        : 'Accept claim';
    }

    return '';
  };
  return (
    <View style={styles.root}>
      {loading && <Spinner />}
      <Modal
        visible={actionsOpen}
        transparent
        animationType="slide"
        onRequestClose={closeActions}
      >
        <View style={styles.actionModalRoot}>
          <Pressable
            style={styles.actionModalDismiss}
            onPress={closeActions}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.actionSheet,
              { paddingBottom: Math.max(insets.bottom, 16) + 8 },
            ]}
          >
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Dispute actions</Text>

            {!isResolved ? (
              <>
                {/* <Pressable
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                  onPress={onEscalate}
                >
                  <Icon name="trending-up-outline" size={22} color={BLACK} />
                  <Text style={styles.actionRowLabel}>Escalate dispute</Text>
                </Pressable> */}

                {/* {isCustomer ? (
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                    onPress={onAddEvidence}
                  >
                    <Icon name="images-outline" size={22} color={BLACK} />
                    <Text style={styles.actionRowLabel}>Add evidence</Text>
                  </Pressable>
                ) : null} */}

                {!isCustomer ? (
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                    onPress={onSubmitVendorResponse}
                  >
                    <Icon name="create-outline" size={22} color={BLACK} />
                    <Text style={styles.actionRowLabel}>Submit response</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                  onPress={onMessageCounterpart}
                >
                  <Icon name="chatbubbles-outline" size={22} color={BLACK} />
                  <Text style={styles.actionRowLabel}>{messageActionLabel}</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                  onPress={onContactSupport}
                >
                  <MaterialIcons name="support-agent" size={22} color={BLACK} />
                  <Text style={styles.actionRowLabel}>Contact support</Text>
                </Pressable>

                {/* {isCustomer ? (
                  <Pressable
                    style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                    onPress={onWithdraw}
                  >
                    <Icon name="remove-circle-outline" size={22} color="#C62828" />
                    <Text style={styles.actionRowLabelDestructive}>Withdraw dispute</Text>
                  </Pressable>
                ) : null} */}
              </>
            ) : (
              <>
                {/* <Pressable
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                  onPress={onDownloadSummary}
                >
                  <Icon name="download-outline" size={22} color={BLACK} />
                  <Text style={styles.actionRowLabel}>Download summary</Text>
                </Pressable> */}

                <Pressable
                  style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                  onPress={onContactSupport}
                >
                  <MaterialIcons name="support-agent" size={22} color={BLACK} />
                  <Text style={styles.actionRowLabel}>Contact support</Text>
                </Pressable>
              </>
            )}

            <Pressable
              style={({ pressed }) => [styles.actionDismissRow, pressed && styles.actionRowPressed]}
              onPress={closeActions}
            >
              <Text style={styles.actionDismissText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          styles.scrollContentTop,
          { paddingBottom: scrollBottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, styles.cardSpaced]}>
          <View style={styles.cardTitleRow}>
            <Icon name="shield-checkmark-outline" size={22} color={BLACK} />
            <Text style={styles.cardTitle}>Dispute Details</Text>
          </View>
          <AnalysisField
            label="Dispute reason"
            value={dispute.reason}
            highlight
          />
          {/* <AnalysisField label="Item condition" value={"_"} highlight /> */}
          <AnalysisField
            label="Payment made to Escrow"
            value={formatNaira(dispute?.order?.amount_paid)}
            highlight={false}
          />
          <AnalysisField
            label={
              isCustomer
                ? 'Your preferred resolution'
                : 'Customer preferred resolution'
            }
            value={dispute.metadata.preferred_resolution_label}
            highlight={false}
          />
        </View>
        <View style={[styles.card, styles.cardSpaced]}>
          <View style={styles.noteHeader}>
            <Icon
              name={isCustomer ? 'storefront-outline' : 'person-outline'}
              size={18}
              color={MUTED}
            />
            <Text style={styles.noteTitle}>{summaryTitle}</Text>
          </View>
          <Text style={styles.noteBody}>{dispute.description}</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.metaGrid}>
            <MetaCell
              label={counterpartLabel}
              value={isCustomer ? `${dispute?.vendor?.fname} ${dispute?.vendor?.lname}` : `${dispute?.customer?.fname} ${dispute?.customer?.lname}`}
            />
            <MetaCell label="Order date" value={dayjs().to(dayjs(dispute?.order?.created_at))} />
            <MetaCell label="Delivery date" value={dayjs().to(dayjs(dispute?.order_event?.created_at))} />
            <MetaCell label="Order no." value={dispute.orderNumberDisplay} valueIsLink />
          </View>

          {dispute?.order_items?.length > 0 ? (
            <>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHCell, styles.tableHName]}>Item name</Text>
                <Text style={styles.tableHCell}>Qty</Text>
                <Text style={styles.tableHCell}>Unit</Text>
                <Text style={styles.tableHCell}>Total</Text>
              </View>
              {dispute?.metadata?.selected_items?.map((item, index) => renderOrderItems(item, index))}
            </>
          ) : (
            <View style={styles.noLineItemRow}>
              <Icon name="cube-outline" size={18} color={MUTED} />
              <Text style={styles.noLineItemText}>
                No order line item linked to this dispute.
              </Text>
              {/* order_items */}
            </View>
          )}
        </View>

        <View style={[styles.card, styles.cardSpaced]}>
          <View style={styles.cardTitleRow}>
            <Icon name="document-text-outline" size={22} color={BLACK} />
            <View style={styles.evidenceTitleBlock}>
              <Text style={styles.cardTitle}>Evidence</Text>
              <Text style={styles.evidenceSubtitle}>
                {isCustomer ? 'Your photos & video' : 'Customer photos & video'}
              </Text>
            </View>
          </View>
          {dispute.metadata.evidence.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.evidenceRow}
            >
              {dispute.metadata.evidence.map((ev, idx) => (
                <EvidenceGalleryItem
                  key={`${ev.uri}-${idx}`}
                  uri={ev.url}
                  kind={ev.kind}
                  caption={ev.caption}
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.evidenceEmpty}>
              <Icon name="images-outline" size={28} color={MUTED} />
              <Text style={styles.evidenceEmptyText}>
                No photos were submitted with this dispute.
              </Text>
            </View>
          )}
        </View>

        {dispute.resolution ? (
          <View style={[styles.card, styles.cardSpaced]}>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <Text style={[styles.bodyText, styles.resolutionText]}>{dispute.resolution}</Text>
          </View>
        ) : null}

      </ScrollView>

      {(
        <View style={[styles.fabBar, { bottom: 0, paddingBottom: 4 }]}>
          <Pressable
            style={({ pressed }) => [styles.fabAccept, pressed && styles.fabPressed, {
              backgroundColor: STATUS_PILL[dispute.status]?.fg
            }]}
            onPress={onAcceptOffer}
          // disabled={dispute.status === "escalated"};
          >
            {dispute.status === "open" && <Icon name="checkmark-circle" size={20} color={WHITE} />}
            <Text style={styles.fabAcceptText} numberOfLines={1}>{
              getButtonText()
            }</Text>
          </Pressable>

          {
            !isCustomer &&
            dispute.status === "open" &&
            <Pressable
              style={({ pressed }) => [styles.fabMore, pressed && styles.fabPressed]}
              onPress={onEscalate}
            >
              <Text style={styles.fabSecondaryText}>Deny (Escalate)</Text>
            </Pressable>
          }
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  headerTools: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 4,
  },
  headerEllipsis: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  actionModalDismiss: {
    flex: 1,
  },
  actionSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 8,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 16 },
    }),
  },
  actionSheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 5,
    backgroundColor: '#D8D8D8',
    marginBottom: 12,
  },
  actionSheetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionRowPressed: {
    backgroundColor: '#F5F5F5',
  },
  actionRowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: BLACK,
  },
  actionRowLabelDestructive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
  },
  actionDismissRow: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  actionDismissText: {
    fontSize: 16,
    fontWeight: '600',
    color: MUTED,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  scrollContentTop: {
    paddingTop: 12,
  },
  empty: {
    flex: 1,
    backgroundColor: PAGE_BG,
    paddingHorizontal: 20,
  },
  muted: {
    color: MUTED,
    fontSize: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  disputeId: {
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pageHeadline: {
    fontSize: 17,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 14,
    lineHeight: 24,
  },
  card: {
    backgroundColor: WHITE,
    borderRadius: 5,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8E8E8',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardSpaced: {
    marginTop: 12,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 12,
  },
  metaCell: {
    width: '47%',
    minWidth: '45%',
  },
  metaCaps: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaStrong: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
  },
  metaLink: {
    fontSize: 15,
    fontWeight: '700',
    color: LINK,
  },
  tableHeader: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
    paddingTop: 12,
    paddingBottom: 8,
  },
  tableHCell: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    width: '18%',
    textAlign: 'right',
  },
  tableHName: {
    width: '46%',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
  },
  tableCell: {
    fontSize: 9,
    color: BLACK,
    width: '18%',
    textAlign: 'right',
  },
  tableCellStrong: {
    fontSize: 9,
    fontWeight: '700',
    color: BLACK,
    width: '18%',
    textAlign: 'right',
  },
  noLineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEEEEE',
  },
  noLineItemText: {
    flex: 1,
    fontSize: 13,
    color: MUTED,
    lineHeight: 19,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BLACK,
  },
  noteBody: {
    fontSize: 15,
    color: BLACK,
    lineHeight: 22,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
  },
  evidenceTitleBlock: {
    flex: 1,
  },
  evidenceSubtitle: {
    fontSize: 13,
    color: MUTED,
    marginTop: 2,
  },
  evidenceRow: {
    flexDirection: 'row',
    gap: 14,
    paddingRight: 8,
    paddingBottom: 4,
  },
  galleryItem: {
    width: 132,
  },
  galleryCaption: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    color: BLACK,
    lineHeight: 18,
  },
  evidenceEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  evidenceEmptyText: {
    fontSize: 14,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  thumbOuter: {
    width: 132,
    height: 100,
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#F0F0F0',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  thumbBadgeText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  analysisField: {
    marginBottom: 14,
  },
  analysisLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  analysisValue: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
    lineHeight: 21,
  },
  limeText: {
    color: LIME,
    fontWeight: '700',
  },
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  subSectionSpaced: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 15,
    color: BLACK,
    lineHeight: 22,
  },
  resolutionText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  fabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 80,
    // bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: WHITE,
    borderRadius: 5,
    paddingVertical: 0,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E4',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  fabAccept: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TEAL,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 5,
    flexGrow: 1,
    flexShrink: 1,
  },
  fabAcceptText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  fabSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F0F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexShrink: 0,
  },
  fabSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: WHITE,
  },
  fabMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 5,
    flexShrink: 0,
  },
  fabPressed: {
    opacity: 0.88,
  },
  tlWrap: {
    paddingTop: 4,
  },
  tlRow: {
    flexDirection: 'row',
    minHeight: 56,
  },
  tlTrack: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  tlDotOuter: {
    width: 16,
    height: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tlDotOuterDone: {
    backgroundColor: LIME,
  },
  tlDotOuterPending: {
    backgroundColor: DOT_PENDING,
    borderWidth: 2,
    borderColor: '#C8C8C8',
  },
  tlDotInner: {
    width: 5,
    height: 5,
    borderRadius: 10,
    backgroundColor: WHITE,
  },
  tlConnector: {
    width: 2,
    flex: 1,
    minHeight: 28,
    marginTop: 2,
    marginBottom: -2,
  },
  tlConnectorDone: {
    backgroundColor: LINE_DONE,
  },
  tlConnectorPending: {
    backgroundColor: LINE_PENDING,
  },
  tlBody: {
    flex: 1,
    paddingBottom: 8,
  },
  tlTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: BLACK,
  },
  tlTime: {
    fontSize: 13,
    color: MUTED,
    marginTop: 4,
  },
});
