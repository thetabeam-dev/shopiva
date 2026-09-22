import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { formatNaira } from '../../utils/formatNaira';
import { BRAND, sharedStyles } from './shippingShared';
import { deleteShippingZone, getShippingZones } from '../../api/shop';

/** @typedef {{ id: string; name: string; locations: string[]; baseFee: number; discountPercent: number; pinColor: string }} ShippingZone */

/** @param {Record<string, unknown>} row @returns {ShippingZone} */
function mapZoneRow(row) {
  return {
    id: String(row.zone_id ?? row.id ?? ''),
    name: String(row.name ?? ''),
    locations: Array.isArray(row.locations) ? row.locations : [],
    baseFee: Number(row.base_fee ?? 0),
    discountPercent: Number(row.discount_percent ?? 0),
    pinColor: String(row.pin_color ?? BRAND),
  };
}

/**
 * Screen 3 — list shipping zones with base fee and discount summary.
 */
export default function ShippingZonesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const [zones, setZones] = useState(/** @type {ShippingZone[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [menuZoneId, setMenuZoneId] = useState(/** @type {string | null} */(null));

  const model = route.params?.model ?? 'multi_item_discount';
  const defaultBaseFee = route.params?.baseFee ?? 1000;
  const defaultDiscount = route.params?.discountPercent ?? 50;
  const shopId = route.params?.shopId;
  const userId = route.params?.userId;

  const loadZones = useCallback(async () => {
    if (!shopId || !userId) return;
    setLoading(true);
    try {
      const rows = await getShippingZones(shopId, userId);
      setZones((Array.isArray(rows) ? rows : []).map(mapZoneRow));
    } catch (error) {
      Alert.alert('Failed to load zones', error?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shopId, userId]);

  useFocusEffect(
    useCallback(() => {
      loadZones();
    }, [loadZones]),
  );

  useFocusEffect(
    useCallback(() => {
      const pending = route.params?.pendingZone;
      if (!pending || typeof pending !== 'object') return;

      setZones((prev) => {
        const idx = prev.findIndex((z) => z.id === pending.id);
        if (idx >= 0) {
          const next = prev.slice();
          next[idx] = { ...prev[idx], ...pending };
          return next;
        }
        return [...prev, pending];
      });

      navigation.setParams({ pendingZone: undefined });
    }, [navigation, route.params?.pendingZone]),
  );

  useEffect(() => {
    if (route.params?.deletedZoneId) {
      setZones((prev) => prev.filter((z) => z.id !== route.params.deletedZoneId));
      navigation.setParams({ deletedZoneId: undefined });
    }
  }, [navigation, route.params?.deletedZoneId]);

  const openAddZone = () => {
    navigation.navigate('shipping-zone-edit', {
      mode: 'add',
      model,
      defaultBaseFee,
      defaultDiscount,
      shopId,
      userId,
    });
  };

  const openEditZone = (zone) => {
    navigation.navigate('shipping-zone-edit', {
      mode: 'edit',
      zone,
      model,
      defaultBaseFee,
      defaultDiscount,
      shopId,
      userId,
    });
  };

  const onZoneMenu = (zone) => {
    setMenuZoneId(zone.id);
  };

  const selectedMenuZone = zones.find((z) => z.id === menuZoneId) ?? null;

  return (
    <View style={sharedStyles.screen}>
      <ScrollView
        contentContainerStyle={[
          sharedStyles.scrollContent,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={sharedStyles.sectionSubtitle}>
              Manage shipping fees for different locations.
            </Text>
          </View>

        </View>

        {loading ? (
          <Text style={sharedStyles.sectionSubtitle}>Loading zones…</Text>
        ) : zones.length === 0 ? (
          <Text style={sharedStyles.sectionSubtitle}>
            No shipping zones yet. Tap "Add Zone" to create one.
          </Text>
        ) : null}

        {zones.map((zone) => (
          <TouchableOpacity
            key={zone.id}
            activeOpacity={0.9}
            onPress={() => openEditZone(zone)}
            style={sharedStyles.zoneCard}
          >
            <View
              style={[
                sharedStyles.zonePin,
                { backgroundColor: `${zone.pinColor}22` },
              ]}
            >
              <Icon name="location" size={20} color={zone.pinColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sharedStyles.zoneName}>{zone.name}</Text>
              <Text style={sharedStyles.zoneMeta}>
                Base Fee (1st item): {formatNaira(zone.baseFee)}
              </Text>
              <Text style={sharedStyles.zoneMeta}>
                Discount: {zone.discountPercent}%
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation?.();
                onZoneMenu(zone);
              }}
              style={{ padding: 4 }}
            >
              <Icon name="ellipsis-vertical" size={20} color="#6B7280" />
            </Pressable>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={{
        position: 'absolute',
        bottom: 45,
        right: 22,

      }}>
        <TouchableOpacity
          style={sharedStyles.outlineBtn}
          activeOpacity={0.88}
          onPress={openAddZone}
        >
          <Text style={sharedStyles.outlineBtnText}>+ Add Zone</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={Boolean(selectedMenuZone)}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuZoneId(null)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.35)',
            justifyContent: 'flex-end',
          }}
          onPress={() => setMenuZoneId(null)}
        >
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              paddingBottom: insets.bottom + 12,
              paddingTop: 8,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#E5E7EB',
                alignSelf: 'center',
                marginBottom: 12,
              }}
            />
            <TouchableOpacity
              style={{ paddingVertical: 16, paddingHorizontal: 24 }}
              onPress={() => {
                const zone = selectedMenuZone;
                setMenuZoneId(null);
                if (zone) openEditZone(zone);
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: TEXT_COLOR }}>
                Edit zone
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ paddingVertical: 16, paddingHorizontal: 24 }}
              onPress={() => {
                const zone = selectedMenuZone;
                setMenuZoneId(null);
                if (!zone) return;
                Alert.alert(
                  'Delete zone',
                  `Remove "${zone.name}" from your shipping zones?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          if (shopId && userId) {
                            await deleteShippingZone(shopId, zone.id, userId);
                          }
                          setZones((prev) => prev.filter((z) => z.id !== zone.id));
                        } catch (error) {
                          Alert.alert('Delete failed', error?.message || 'Please try again.');
                        }
                      },
                    },
                  ],
                );
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#DC2626' }}>
                Delete zone
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const TEXT_COLOR = '#111111';
