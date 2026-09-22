import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BRAND,
  buildPreviewLines,
  sharedStyles,
  SHIPPING_FEE_MODELS,
  ShippingPreviewCard, 
} from './shippingShared';
import { getShippingMultiItemDiscount } from '../../api/shop';

const DEFAULT_BASE_FEE = 1500;
const DEFAULT_DISCOUNT = 50;

/**
 * Screen 1 — choose shipping fee model (currently only multi-item discount).
 */
export default function ShippingFeeModelScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const initialModel = route.params?.model ?? 'multi_item_discount';
  const [selectedModel, setSelectedModel] = useState(initialModel);
  const [baseFee, setBaseFee] = useState(route.params?.baseFee ?? null);
  const [discountPercent, setDiscountPercent] = useState(route.params?.discountPercent ?? null);
  const shopId = route.params?.shopId;
  const userId = route.params?.userId;

  useEffect(() => {
    if (route.params?.baseFee != null && route.params?.discountPercent != null) return;
    if (!shopId || !userId) return;      
    let active = true;
    getShippingMultiItemDiscount(shopId, userId)
      .then((data) => {
        if (!active || !data) return;
        setBaseFee(Number(data.base_fee ?? data.baseFee));
        setDiscountPercent(Number(data.discount_percent ?? data.discountPercent));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [shopId, userId, route.params?.baseFee, route.params?.discountPercent]);

  const effectiveBaseFee = baseFee ?? DEFAULT_BASE_FEE;
  const effectiveDiscount = discountPercent ?? DEFAULT_DISCOUNT;

  const previewLines = useMemo(
    () => buildPreviewLines(selectedModel, effectiveBaseFee, effectiveDiscount),
    [selectedModel, effectiveBaseFee, effectiveDiscount],
  );

  const onConfigure = () => {
    navigation.navigate('shipping-discount', {
      model: selectedModel,
      baseFee: effectiveBaseFee,
      discountPercent: effectiveDiscount,
      shopId,
      userId,
    });
  };

  return (
    <View style={sharedStyles.screen}>
      <ScrollView
        contentContainerStyle={[
          sharedStyles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >

        <Text style={sharedStyles.sectionSubtitle}>
          Choose how you want to charge shipping fees.
          <Pressable
            hitSlop={8}
            onPress={() =>
              Alert.alert(
                'Shipping fee model',
                'Pick how shipping is calculated for orders. You can set different fees per zone afterward.',
              )
            }
          >
            <Icon name="information-circle-outline" size={20} color={BRAND} />
          </Pressable>
        </Text>

        {SHIPPING_FEE_MODELS.map((model) => {
          const selected = selectedModel === model.id;
          return (
            <TouchableOpacity
              key={model.id}
              activeOpacity={0.9}
              onPress={() => setSelectedModel(model.id)}
              style={[
                sharedStyles.modelCard,
                selected && sharedStyles.modelCardSelected,
              ]}
            >
              <View
                style={[
                  sharedStyles.modelIconWrap,
                  selected && sharedStyles.modelIconWrapSelected,
                ]}
              >
                <Icon
                  name={model.icon}
                  size={22}
                  color={selected ? BRAND : '#6B7280'}
                />
              </View>
              <View style={sharedStyles.modelBody}>
                <View style={sharedStyles.modelTitleRow}>
                  <Text style={sharedStyles.modelTitle}>{model.title}</Text>
                  {model.recommended ? (
                    <View style={sharedStyles.recommendedBadge}>
                      <Text style={sharedStyles.recommendedBadgeText}>Recommended</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={sharedStyles.modelDescription}>{model.description}</Text>
              </View>
              <View
                style={[
                  sharedStyles.radioOuter,
                  selected && sharedStyles.radioOuterSelected,
                ]}
              >
                {selected ? <View style={sharedStyles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}

        <ShippingPreviewCard lines={previewLines} />
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          backgroundColor: '#fff',
          display: 'flex',
          alignItems: 'center', 
          justifyContent: 'center',
          width: '100%',
          height: 90,
          paddingHorizontal: 10,
          // paddingVertical: 10
          // 
        }}
      >
        <TouchableOpacity
          style={[sharedStyles.primaryBtn, {marginTop: 0}]}
          activeOpacity={0.88}
          onPress={onConfigure}
        >
          <Text style={sharedStyles.primaryBtnText}>Setup Model</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}
