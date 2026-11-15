import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PlaceLocationField from '../../components/PlaceLocationField';
import ShopBrowseCard from '../../components/ShopBrowseCard';
import {
  SHEET_EXPANDED,
  SHEET_PEEK,
  SHOP_CARD_W,
  exploreMapStyles as styles,
} from './exploreMapCommon';

/**
 * Shared chrome around a platform map surface.
 * Layout: map pane (flex) + shop sheet (sibling height) so native maps cannot cover controls.
 */
export default function ExploreMapShell({
  ctrl,
  navigation,
  FlatListComponent,
  mapSurface,
  cardDelayPressIn = 0,
}) {
  const {
    insets,
    query,
    setQuery,
    suggestionsOpen,
    setSuggestionsOpen,
    suggestions,
    suggestionError,
    locationPickerOpen,
    setLocationPickerOpen,
    locationPickerBusy,
    loading,
    selectedCategory,
    setSelectedCategory,
    mapListRef,
    searchRef,
    sheetExpanded,
    sheetHeight,
    sheetListDragging,
    snapSheet,
    sheetPan,
    categoryOptions,
    visibleShops,
    selectPlace,
    zoomBy,
    goToMyLocation,
    pickLocationFromModal,
    openShop,
    clearSearch,
  } = ctrl;

  return (
    <View style={styles.screen}>
      <View style={styles.topChrome} pointerEvents="box-none">
        <View style={styles.searchWrap}>
          <Icon name="location-outline" size={18} color="#8A8A8A" />
          <TextInput
            ref={searchRef}
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              setSuggestionsOpen(true);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder="Start your search"
            placeholderTextColor="#9A9A9A"
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query ? (
            <TouchableOpacity
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear location search"
            >
              <Icon name="close" size={20} color="#111111" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryChips}
          contentContainerStyle={styles.categoryChipsContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={[styles.categoryChip, !selectedCategory ? styles.categoryChipSelected : null]}
            onPress={() => setSelectedCategory(null)}
            accessibilityRole="button"
            accessibilityState={{ selected: !selectedCategory }}
            accessibilityLabel="All shop categories"
          >
            <Icon
              name="grid-outline"
              size={15}
              color={!selectedCategory ? '#FFFFFF' : '#374151'}
            />
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory ? styles.categoryChipTextSelected : null,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categoryOptions.map((option) => {
            const selected = selectedCategory === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.categoryChip, selected ? styles.categoryChipSelected : null]}
                onPress={() => setSelectedCategory(selected ? null : option.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Filter by ${option.label}`}
              >
                <Icon
                  name="storefront-outline"
                  size={15}
                  color={selected ? '#FFFFFF' : '#374151'}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    selected ? styles.categoryChipTextSelected : null,
                  ]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {suggestionError && suggestionsOpen ? (
        <Text style={styles.suggestError}>{suggestionError}</Text>
      ) : null}
      {suggestions.length > 0 && suggestionsOpen ? (
        <View style={styles.suggestBox}>
          {suggestions.map((option) => (
            <Pressable
              key={option.key}
              style={styles.suggestRow}
              onPressIn={() => selectPlace(option)}
            >
              <Icon name="location-outline" size={16} color="#00926E" />
              <View style={styles.suggestCopy}>
                <Text style={styles.suggestLabel} numberOfLines={1}>{option.label}</Text>
                <Text style={styles.suggestSub} numberOfLines={1}>{option.subtitle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.mapPane} collapsable={false}>
          {mapSurface}
        </View>

        <Animated.View
          style={[styles.mapSheetHost, { height: sheetHeight }]}
          collapsable={false}
          pointerEvents="auto"
        >
          {/* Radius on a plain View — Animated.View height + radius often fails to clip on iOS. */}
          <View
            style={[
              styles.mapSheet,
              { paddingBottom: sheetExpanded ? Math.max(insets.bottom, 10) : 4 },
            ]}
            collapsable={false}
          >
            <View {...sheetPan.panHandlers} style={styles.mapSheetHandleWrap}>
              <View style={styles.mapSheetGrabber} />
              <Pressable
                style={styles.mapSheetHead}
                onPress={() => snapSheet(!sheetExpanded)}
                accessibilityRole="button"
                accessibilityLabel={sheetExpanded ? 'Collapse shop list' : 'Expand shop list'}
              >
                <View style={styles.mapSheetHeadCopy}>
                  <Text style={styles.mapSheetTitle}>Shops in this area</Text>
                  <Text style={styles.mapSheetSubtitle}>
                    <Text style={styles.mapSheetCount}>{visibleShops.length}</Text>
                    {visibleShops.length === 1 ? ' shop nearby' : ' shops nearby'}
                  </Text>
                </View>
                <View style={styles.mapSheetHeadActions}>
                  <TouchableOpacity
                    style={styles.mapSheetAction}
                    onPress={() => navigation.navigate('Area-shops', {
                      shopIds: visibleShops.map((item) => item.shop.id),
                    })}
                    accessibilityRole="button"
                    accessibilityLabel="See all shops in this area"
                  >
                    <Icon name="arrow-forward" size={18} color="#111111" />
                  </TouchableOpacity>
                  <Icon
                    name={sheetExpanded ? 'chevron-down' : 'chevron-up'}
                    size={20}
                    color="#6B7280"
                  />
                </View>
              </Pressable>
            </View>

            {loading ? (
              <ActivityIndicator color="#00926E" style={{ marginTop: 18 }} />
            ) : visibleShops.length === 0 ? (
              <Text style={styles.mapSheetEmpty}>No shops in this part of the map.</Text>
            ) : (
              <FlatListComponent
                ref={mapListRef}
                style={styles.mapSheetList}
                data={visibleShops}
                keyExtractor={(item) => String(item.shop.id)}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                scrollEnabled
                bounces
                overScrollMode="never"
                removeClippedSubviews={false}
                contentContainerStyle={styles.mapCardColumn}
                onScrollBeginDrag={() => {
                  sheetListDragging.current = true;
                  if (!sheetExpanded) snapSheet(true);
                }}
                onScrollEndDrag={() => {
                  requestAnimationFrame(() => {
                    sheetListDragging.current = false;
                  });
                }}
                onMomentumScrollEnd={() => {
                  sheetListDragging.current = false;
                }}
                onScrollToIndexFailed={() => {}}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <ShopBrowseCard
                    item={item.shop}
                    width={SHOP_CARD_W}
                    delayPressIn={cardDelayPressIn}
                    onPress={() => {
                      if (sheetListDragging.current) return;
                      openShop(item.shop);
                    }}
                  />
                )}
              />
            )}
          </View>
        </Animated.View>

        {/* Docked above the sheet (sibling of map) so map native views cannot cover them. */}
        <View
          pointerEvents="box-none"
          style={[
            styles.mapControlsDock,
            {
              bottom: (sheetExpanded ? SHEET_EXPANDED : SHEET_PEEK) + 12,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.locateBtnDock}
            onPress={goToMyLocation}
            accessibilityRole="button"
            accessibilityLabel="Show my location"
          >
            <Icon name="locate" size={22} color="#111111" />
          </TouchableOpacity>
          <View style={styles.zoomStackDock}>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(0.8)}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Icon name="add" size={22} color="#111111" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.zoomBtn}
              onPress={() => zoomBy(1.25)}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Icon name="remove" size={22} color="#111111" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={locationPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!locationPickerBusy) setLocationPickerOpen(false);
        }}
      >
        <View style={styles.locationModalRoot}>
          <ScrollView
            contentContainerStyle={styles.locationModalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.locationModalCard}>
              <View style={styles.locationModalIcon}>
                <Icon name="location-outline" size={36} color="#00926E" />
              </View>
              <Text style={styles.locationModalTitle}>Set your location</Text>
              <Text style={styles.locationModalBody}>
                We could not read your position. Type a city or area and choose a suggestion so shops near you can show on the map.
              </Text>
              <PlaceLocationField
                disabled={locationPickerBusy}
                onPlace={pickLocationFromModal}
              />
              {locationPickerBusy ? <ActivityIndicator color="#00926E" style={{ marginTop: 16 }} /> : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
