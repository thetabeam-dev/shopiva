import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import {
  fetchOwnerShops,
  fetchShopDetails,
  fetchShopOrders,
  updateVendorShop,
  uploadShopVerificationDocument,
  verifyShopBvn,
  checkShippingConfigStatus,
} from '../api/shop';
import { getProducts } from '../api/product';
import { useProfile } from '../context/ProfileContext';
import { isVendorAccountRole } from '../profile/normalizeUser';
import DeliveryPolicyModal from '../components/DeliveryPolicyModal';
import { mapOrderRowToListItem } from '../utils/buyerUi';
import { formatNaira } from '../utils/formatNaira';
import {
  getCurrentCoordinates,
  requestLocationPermission,
  reverseGeocodeToPlace,
} from '../utils/deviceLocation';
import { useSelector } from 'react-redux';
import { formatMvpCategoryLabel } from '../utils/mvpCategory';
import { selectCategoryKeys } from '../../redux/categoriesSlice';
import geoZones from '../json/zones.json';
import { formatPriceInput } from '../utils/variantOptions';

const BRAND = '#0D4F3C';
const BRAND_LIGHT = '#1A6B52';
const PAGE_BG = '#F4F5F7';
const CARD = '#FFFFFF';
const BLACK = '#111111';
const MUTED = '#6B7280';
const BORDER = '#E8EAEF';
const GREEN_OK = '#16A34A';
const ORANGE_PENDING = '#B45309';

const DEFAULT_LOCATION = {
  address: null,
  city: null,
  state: null,
  country: null,
  zipcode: null,
  coordinates: null,
};

const DEFAULT_SOCIAL = {
  facebook: null,
  instagram: null,
  twitter: null,
  website: null,
  tiktok: null,
};

const DEFAULT_VERIFICATION = {
  businessLicense: { url: null, verified: false, submittedAt: null },
  taxId: { url: null, verified: false, submittedAt: null },
  identityProof: { url: null, verified: false, submittedAt: null },
  idCard: { url: null, verified: false, submittedAt: null },
  proofOfAddress: { url: null, verified: false, submittedAt: null },
  cacDocument: { url: null, verified: false, submittedAt: null },
};

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
];

/** @param {unknown} value @param {unknown} fallback */
function parseMaybeJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const o = JSON.parse(value);
      return typeof o === 'object' && o != null && !Array.isArray(o)
        ? o
        : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** @param {Record<string, unknown>} r */
function pickStr(r, ...keys) {
  for (const k of keys) {
    const v = r[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/** @param {Record<string, unknown> | null | undefined} row */
function shopIdOf(row) {
  if (!row) return 0;
  const v = row.id ?? row.shopid ?? row.shop_id;
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** @param {string | undefined} status */
function statusDisplayLabel(status) {
  const s = String(status ?? 'pending_approval').toLowerCase();
  if (s === 'pending_approval') return 'Pending approval';
  if (s === 'active') return 'Active';
  if (s === 'suspended') return 'Suspended';
  if (s === 'closed') return 'Closed';
  return s.replace(/_/g, ' ');
}

function defaultOpeningHours() {
  const o = {};
  for (const { key } of DAYS) {
    o[key] = key === 'sat' || key === 'sun' ? 'Closed' : '09:00–18:00';
  }
  return o;
}

/** @param {unknown} raw */
function parseOpeningHours(raw) {
  const base = defaultOpeningHours();
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const out = { ...base };
  for (const { key } of DAYS) {
    if (o[key] != null && String(o[key]).trim() !== '')
      out[key] = String(o[key]).trim();
  }
  return out;
}

/** @param {number} n */
function pad2(n) {
  return String(Math.max(0, Math.min(99, Math.floor(n)))).padStart(2, '0');
}

/**
 * Parse one day's stored value (e.g. "09:00–18:00" or "Closed") into a
 * structured shape used by the editor.
 * @param {unknown} raw
 * @returns {{ closed: boolean; openH: number; openM: number; closeH: number; closeM: number }}
 */
function parseDayHours(raw) {
  const fallback = { closed: false, openH: 9, openM: 0, closeH: 18, closeM: 0 };
  const s = String(raw ?? '').trim();
  if (!s) return fallback;
  if (/^closed$/i.test(s)) return { ...fallback, closed: true };
  const m = s.match(/^(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const oh = Math.min(23, parseInt(m[1], 10));
  const om = Math.min(59, parseInt(m[2], 10));
  const ch = Math.min(23, parseInt(m[3], 10));
  const cm = Math.min(59, parseInt(m[4], 10));
  return { closed: false, openH: oh, openM: om, closeH: ch, closeM: cm };
}

/** @param {{ closed: boolean; openH: number; openM: number; closeH: number; closeM: number }} h */
function formatDayHours(h) {
  if (h.closed) return 'Closed';
  return `${pad2(h.openH)}:${pad2(h.openM)}–${pad2(h.closeH)}:${pad2(
    h.closeM,
  )}`;
}

/**
 * Pull the most recent delivery clause stored on the shop row.
 * The server keeps `policies.deliverypolicy.clauses` (newest appended last).
 * @param {unknown} policies
 */
function pickLatestDeliveryClause(policies) {
  if (!policies || typeof policies !== 'object' || Array.isArray(policies))
    return null;
  const p = /** @type {Record<string, unknown>} */ (policies);
  let d = p.deliverypolicy ?? p.deliveryPolicy ?? null;
  if (typeof d === 'string') {
    try {
      const parsed = JSON.parse(d);
      d = parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const clauses = /** @type {Record<string, unknown>} */ (d).clauses;
  if (!Array.isArray(clauses) || clauses.length === 0) return null;
  const last = clauses[clauses.length - 1];
  if (!last || typeof last !== 'object') return null;
  return /** @type {Record<string, unknown>} */ (last);
}

/**
 * Parse the multi-line `content` field saved by `DeliveryPolicyModal` into an
 * ordered list of `[label, value]` rows for display. Empty / unparsable input
 * → `[]`.
 *
 * The content is generated as e.g.:
 *   Delivery timeline: 1-2 days
 *   Delivery location: Same city
 *   Delivery method: Vendor self-delivery
 *   Processing time before shipping: 1 days
 *   If customer is not available: Customer must reschedule
 *
 * @param {unknown} content
 * @returns {Array<{ label: string; value: string }>}
 */
function parseDeliveryContent(content) {
  const text = typeof content === 'string' ? content : '';
  if (!text.trim()) return [];
  const out = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(':');
    if (idx <= 0) continue;
    const label = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!label || !value) continue;
    out.push({ label, value });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} row
 * @param {{
 *   name: string;
 *   slug: string;
 *   description: string;
 *   category: string;
 *   contactEmail: string;
 *   contactPhone: string;
 *   location: Record<string, unknown>;
 * }} form
 */
function buildUpdateBody(row, form, verificationDocumentsOverride) {
  const socialLinks = parseMaybeJson(
    row.socialLinks ?? row.sociallinks,
    DEFAULT_SOCIAL,
  );
  const verificationDocuments =
    verificationDocumentsOverride != null
      ? verificationDocumentsOverride
      : {
        ...DEFAULT_VERIFICATION,
        ...parseMaybeJson(
          row.verificationDocuments ?? row.verificationdocuments,
          {},
        ),
      };
  const tags = Array.isArray(row.tags) ? row.tags : [];
  const vendorType =
    String(row.vendortype ?? row.vendorType ?? 'reseller').trim() || 'reseller';
  const isActive = Boolean(row.isactive ?? row.isActive ?? true);
  const isVerified = Boolean(row.isverified ?? row.isVerified ?? false);
  const status =
    String(row.status ?? 'pending_approval').trim() || 'pending_approval';

  const loc = {
    ...DEFAULT_LOCATION,
    ...parseMaybeJson(row.location ?? row.Location, DEFAULT_LOCATION),
    ...form.location,
  };

  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    description: form.description.trim() || null,
    logo: row.logo != null ? String(row.logo) : null,
    banner: row.banner != null ? String(row.banner) : null,
    category: form.category.trim() || null,
    tags,
    contactEmail: form.contactEmail.trim() || null,
    contactPhone: form.contactPhone.trim() || null,
    vendorType,
    location: loc,
    socialLinks,
    isActive,
    isVerified,
    status,
    verificationDocuments,
  };
}

/** @param {{ url?: unknown; verified?: unknown } | null | undefined} doc */
function docVerificationStatus(doc) {
  if (!doc) return { label: 'Not submitted', passed: false, pending: false };
  const v = Boolean(doc.verified);
  const hasUrl = doc.url != null && String(doc.url).trim() !== '';
  if (v) return { label: 'Passed', passed: true, pending: false };
  if (hasUrl) return { label: 'Pending', passed: false, pending: true };
  return { label: 'Not submitted', passed: false, pending: false };
}

/** @param {unknown} bvn */
function bvnVerificationStatus(bvn) {
  if (bvn && typeof bvn === 'object') {
    const o =
      /** @type {{ verified?: unknown; last4?: unknown; submittedAt?: unknown }} */ (
        bvn
      );
    if (o.verified === true)
      return { label: 'Passed', passed: true, pending: false };
    if (
      (o.last4 != null && String(o.last4).trim() !== '') ||
      o.submittedAt != null
    ) {
      return { label: 'Pending', passed: false, pending: true };
    }
  }
  return { label: 'Not submitted', passed: false, pending: false };
}

export default function ProfileShopInfoScreen() {
  const insets = useSafeAreaInsets();
  const { user, refresh } = useProfile();
  const preferredShopIdRef = useRef(0);
  const navigation = useNavigation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [shopsList, setShopsList] = useState(
    /** @type {Record<string, unknown>[]} */([]),
  );
  const [activeShopId, setActiveShopId] = useState(0);
  const [shopRow, setShopRow] = useState(
    /** @type {Record<string, unknown> | null} */(null),
  );

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [locationState, setLocationState] = useState({ ...DEFAULT_LOCATION });
  const [openingHours, setOpeningHours] = useState(() => defaultOpeningHours());

  const [metrics, setMetrics] = useState({
    revenue: 0,
    orders: 0,
    products: 0,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalBasics, setModalBasics] = useState(false);
  const [modalDesc, setModalDesc] = useState(false);
  const [modalCategory, setModalCategory] = useState(false);

  const [zones, setZones] = useState([]);
  const [hoursDraft, setHoursDraft] = useState(() => defaultOpeningHours());
  /**
   * Time-picker target. `null` when closed; otherwise points at the day + edge
   * being edited so the wheel modal knows what to write back on Save.
   * @type {[null | { dayKey: string; edge: 'open' | 'close'; initialHour: number; initialMinute: number }, Function]}
   */
  const [selectedZones, setSelectedZones] = useState([]);
  const [shippingPriceList, setShippingPriceList] = useState({
    'north central': [],
    'north east': [],
    'north west': [],
    'south south': [],
    'south east': [],
    'south west': [],
  });
  const [shippingConfigStatus, setShippingConfigStatus] = useState({
    hasFeeModel: false,
    hasZones: false,
    status: 'not_set',
  });

  const [verDocModal, setVerDocModal] = useState(
    /** @type {{ title: string; help: string; docKey: string } | null} */(
      null
    ),
  );
  const [verPickedName, setVerPickedName] = useState('');
  const [verPickedFile, setVerPickedFile] = useState(
    /** @type {{ uri: string; name: string; type: string } | null} */(null),
  );
  const [verBusy, setVerBusy] = useState(false);
  const [modalBvn, setModalBvn] = useState(false);
  const [bvnDraft, setBvnDraft] = useState('');
  const [bvnBusy, setBvnBusy] = useState(false);
  const [modalDeliveryPolicy, setModalDeliveryPolicy] = useState(false);

  const uid = user?.id;

  const load = useCallback(async () => {
    if (!uid || !isVendorAccountRole(user?.roleRaw)) {
      setShopsList([]);
      setActiveShopId(0);
      setShopRow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const shops = await fetchOwnerShops(uid);
      const list = shops.map(s => /** @type {Record<string, unknown>} */(s));
      setShopsList(list);
      const ids = list.map(shopIdOf).filter(id => id > 0);
      let nextId = preferredShopIdRef.current;
      if (!nextId || !ids.includes(nextId)) nextId = ids[0] ?? 0;
      preferredShopIdRef.current = nextId;
      setActiveShopId(nextId);
      if (!nextId) {
        setShopRow(null);
        setMetrics({ revenue: 0, orders: 0, products: 0 });
        return;
      }
      const detail = await fetchShopDetails(nextId, uid);
      setShopRow(detail);
      setName(pickStr(detail, 'name', 'Name'));
      setSlug(pickStr(detail, 'slug', 'Slug'));
      setDescription(pickStr(detail, 'description', 'Description'));
      setCategory(pickStr(detail, 'category', 'Category'));
      setContactEmail(pickStr(detail, 'contactEmail', 'contactemail'));
      setContactPhone(pickStr(detail, 'contactPhone', 'contactphone'));
      const loc = {
        ...DEFAULT_LOCATION,
        ...parseMaybeJson(detail.location ?? detail.Location, DEFAULT_LOCATION),
      };
      const { openingHours: _drop, ...locRest } = loc;
      void _drop;
      setLocationState(locRest);
      const oh = parseOpeningHours(loc.openingHours);
      setOpeningHours(oh);
      setHoursDraft(oh);

      const [ordersRows, productsRes] = await Promise.all([
        fetchShopOrders(nextId, uid).catch(() => []),
        getProducts(nextId, uid).catch(() => ({ products: [] })),
      ]);
      const ordersArr = Array.isArray(ordersRows) ? ordersRows : [];
      const items = ordersArr.map(r =>
        mapOrderRowToListItem(/** @type {Record<string, unknown>} */(r)),
      );
      const revenue = items.reduce(
        (sum, row) => sum + (Number(row.valueRupees) || 0),
        0,
      );
      const prods = Array.isArray(productsRes?.products)
        ? productsRes.products
        : [];
      setMetrics({ revenue, orders: ordersArr.length, products: prods.length });

      // Load shipping configuration status
      try {
        const shippingStatus = await checkShippingConfigStatus(nextId, uid);
        setShippingConfigStatus(shippingStatus);
      } catch (e) {
        // Silently fail for shipping status - not critical
        setShippingConfigStatus({ hasFeeModel: false, hasZones: false, status: 'not_set' });
      }
    } catch (e) {
      setShopRow(null);
      Alert.alert(
        'Could not load shop',
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setLoading(false);
    }
  }, [uid, user?.roleRaw]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => { });
    }, [load]),
  );

  useEffect(() => {
    setZones(Object.entries(geoZones));
    console.log('zones: ', Object.entries(geoZones));
  }, []);
  /**
   * Persist current form state to the server.
   * Returns `true` when the save succeeded so callers (e.g. modal "Done")
   * can dismiss themselves only on success.
   *
   * `overrides` lets a caller force values that haven't propagated to state yet
   * (e.g. the opening-hours modal applies `hoursDraft` directly without waiting
   * for the next render). When `silent`, skip the success alert (used by modal
   * Done buttons so we don't double-prompt).
   *
   * @param {{ silent?: boolean; openingHours?: Record<string, string> }} [opts]
   */
  const persist = useCallback(
    async opts => {
      if (!uid || !shopRow || !activeShopId) {
        Alert.alert('Shop', 'No shop to update.');
        return false;
      }
      if (!name.trim()) {
        Alert.alert('Shop name', 'Enter a shop name.');
        return false;
      }
      if (!slug.trim()) {
        Alert.alert('Shop URL', 'Enter a shop slug.');
        return false;
      }
      setSaving(true);
      try {
        const hoursToSave = opts?.openingHours ?? openingHours;
        const locPayload = { ...locationState, openingHours: hoursToSave };
        const body = buildUpdateBody(shopRow, {
          name,
          slug,
          description,
          category,
          contactEmail,
          contactPhone,
          location: locPayload,
        });
        await updateVendorShop(activeShopId, uid, body);
        await refresh().catch(() => { });
        await load();
        if (!opts?.silent) Alert.alert('Saved', 'Your shop has been updated.');
        return true;
      } catch (e) {
        Alert.alert(
          'Could not save',
          e instanceof Error ? e.message : String(e),
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      uid,
      shopRow,
      activeShopId,
      name,
      slug,
      description,
      category,
      contactEmail,
      contactPhone,
      locationState,
      openingHours,
      load,
      refresh,
    ],
  );

  /**
   * Generic helper used by every editing modal's "Done" button:
   * persist current form state and only close the modal on success.
   * @param {() => void} closeModal
   * @param {{ openingHours?: Record<string, string> }} [overrides]
   */
  const persistAndClose = useCallback(
    async (closeModal, overrides) => {
      const ok = await persist({ silent: true, ...overrides });
      if (ok) {
        closeModal();
        Alert.alert('Saved', 'Your shop has been updated.');
      }
    },
    [persist],
  );

  const onSelectShop = useCallback(
    id => {
      preferredShopIdRef.current = id;
      setActiveShopId(id);
      setPickerOpen(false);
      load().catch(() => { });
    },
    [load],
  );

  const onUseMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location',
          'Permission was denied. You can still edit location fields after we add manual entry.',
        );
        return;
      }
      const c = await getCurrentCoordinates();
      const place = await reverseGeocodeToPlace(c.latitude, c.longitude);
      setLocationState(prev => ({
        ...prev,
        city: place.city || prev.city,
        state: place.state || prev.state,
        country: place.country || prev.country,
        coordinates: { lat: c.latitude, lng: c.longitude },
        address:
          [place.city, place.state, place.country].filter(Boolean).join(', ') ||
          prev.address,
      }));
    } catch (e) {
      Alert.alert('Location', e instanceof Error ? e.message : String(e));
    } finally {
      setLocating(false);
    }
  }, []);

  const policies = shopRow?.policies;

  const onDeliveryPolicySaved = useCallback(async () => {
    await load();
    Alert.alert('Saved', 'Delivery policy was updated.');
  }, [load]);

  const locationSummary = useMemo(() => {
    const city = String(locationState.city ?? '').trim();
    const state = String(locationState.state ?? '').trim();
    const country = String(locationState.country ?? '').trim();
    const parts = [city, state, country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }, [locationState.city, locationState.state, locationState.country]);

  const coordsLine = useMemo(() => {
    const c = locationState.coordinates;
    if (!c || typeof c !== 'object') return '—';
    const lat = /** @type {{ lat?: number }} */ (c).lat;
    const lng = /** @type {{ lng?: number }} */ (c).lng;
    if (typeof lat === 'number' && typeof lng === 'number') {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
    return '—';
  }, [locationState.coordinates]);

  const verDocs = useMemo(() => {
    const parsed = parseMaybeJson(
      shopRow?.verificationDocuments ?? shopRow?.verificationdocuments,
      {},
    );
    return { ...DEFAULT_VERIFICATION, ...parsed };
  }, [shopRow]);

  const openVerDocModal = useCallback(payload => {
    setVerPickedFile(null);
    setVerPickedName('');
    setVerDocModal(payload);
  }, []);

  const pickVerificationFile = useCallback(async () => {
    try {
      const [f] = await pick({
        type: [types.images, types.pdf],
      });
      const [copy] = await keepLocalCopy({
        files: [
          {
            uri: f.uri,
            fileName: f.name || 'document',
            ...(f.isVirtual && f.convertibleToMimeTypes?.[0]?.mimeType
              ? {
                convertVirtualFileToType:
                  f.convertibleToMimeTypes[0].mimeType,
              }
              : {}),
          },
        ],
        destination: 'cachesDirectory',
      });
      const uri = copy.status === 'success' ? copy.localUri : f.uri;
      const name = f.name || 'document';
      const type = f.type || 'application/octet-stream';
      setVerPickedFile({ uri, name, type });
      setVerPickedName(name);
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('File', e instanceof Error ? e.message : String(e));
    }
  }, []);

  const saveVerDocToShop = useCallback(async () => {
    if (!verPickedFile || !uid || !activeShopId || !shopRow || !verDocModal) {
      Alert.alert('Document', 'Choose a file first.');
      return;
    }
    setVerBusy(true);
    try {
      const { url } = await uploadShopVerificationDocument(
        activeShopId,
        verPickedFile,
      );
      const merged = {
        ...verDocs,
        [verDocModal.docKey]: {
          url,
          verified: false,
          submittedAt: new Date().toISOString(),
        },
      };
      const locPayload = { ...locationState, openingHours };
      const body = buildUpdateBody(
        shopRow,
        {
          name,
          slug,
          description,
          category,
          contactEmail,
          contactPhone,
          location: locPayload,
        },
        merged,
      );
      await updateVendorShop(activeShopId, uid, body);
      await refresh().catch(() => { });
      await load();
      setVerDocModal(null);
      Alert.alert('Saved', 'Document saved to your shop.');
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : String(e));
    } finally {
      setVerBusy(false);
    }
  }, [
    verPickedFile,
    uid,
    activeShopId,
    shopRow,
    verDocModal,
    verDocs,
    locationState,
    openingHours,
    name,
    slug,
    description,
    category,
    contactEmail,
    contactPhone,
    load,
    refresh,
  ]);
  const handleShippingPriceChange = useCallback(data => {
    setShippingPriceList(prevList => {
      const zoneStates = prevList[data.zone];

      const stateIndex = zoneStates.findIndex(
        item => item.state.toLowerCase() === data.state.toLowerCase(),
      );

      // State already exists → update its price
      if (stateIndex !== -1) {
        const updatedZoneStates = [...zoneStates];

        updatedZoneStates[stateIndex] = {
          ...updatedZoneStates[stateIndex],
          price: formatPriceInput(data.price),
        };

        return {
          ...prevList,
          [data.zone]: updatedZoneStates,
        };
      }

      // State doesn't exist → add it
      return {
        ...prevList,
        [data.zone]: [
          ...zoneStates,
          {
            state: data.state,
            price: formatPriceInput(data.price),
          },
        ],
      };
    });
  }, []);

  const submitBvn = useCallback(async () => {
    if (!uid || !activeShopId) return;
    const digits = bvnDraft.replace(/\D/g, '');
    if (digits.length !== 11) {
      Alert.alert('BVN', 'Enter exactly 11 digits.');
      return;
    }
    setBvnBusy(true);
    try {
      await verifyShopBvn(activeShopId, digits);
      await refresh().catch(() => { });
      await load();
      setModalBvn(false);
      setBvnDraft('');
      Alert.alert('Verified', 'Your BVN was recorded.');
    } catch (e) {
      Alert.alert('BVN', e instanceof Error ? e.message : String(e));
    } finally {
      setBvnBusy(false);
    }
  }, [uid, activeShopId, bvnDraft, load, refresh]);

  const idDoc = verDocs.idCard ?? verDocs.identityProof;
  const idSt = docVerificationStatus(idDoc);
  const addrSt = docVerificationStatus(verDocs.proofOfAddress);
  const cacSt = docVerificationStatus(
    verDocs.cacDocument ?? verDocs.businessLicense,
  );
  const bvnSt = bvnVerificationStatus(verDocs.bvn);

  const categoryOptions = useSelector(selectCategoryKeys);

  if (!isVendorAccountRole(user?.roleRaw)) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.muted}>
          Shop info is only available for seller (vendor) accounts.
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 24 }]}>
        <ActivityIndicator size="large" color={BRAND} />
        <Text style={[styles.muted, { marginTop: 12 }]}>
          Loading your shop…
        </Text>
      </View>
    );
  }

  if (!shopRow || !activeShopId) {
    return (
      <View
        style={[
          styles.centered,
          { paddingTop: insets.top + 24, paddingHorizontal: 24 },
        ]}
      >
        <Text style={styles.emptyTitle}>No shop yet</Text>
        <Text style={styles.muted}>
          Enable vendor mode in Settings and complete shop setup to manage your
          virtual shop here.
        </Text>
      </View>
    );
  }

  const shopStatus = pickStr(shopRow, 'status', 'Status') || 'pending_approval';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom, 28) + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[styles.hero, { paddingTop: Math.max(insets.top, 12) + 8 }]}
        >
          <View style={styles.heroInner}>
            <View style={styles.avatarCircle}>
              <Icon name="storefront-outline" size={36} color={BRAND} />
            </View>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.statusText}>
            {statusDisplayLabel(shopStatus)}
          </Text>

          {shopsList.length > 1 ? (
            <Pressable
              style={styles.viewShopsRow}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={styles.viewShopsTitle}>View shops</Text>
              <View style={styles.addCircle}>
                <Icon name="chevron-down" size={20} color={CARD} />
              </View>
            </Pressable>
          ) : (
            <Text style={styles.singleShopHint}>Your shop</Text>
          )}

          <Pressable
            style={styles.shopNameRow}
            onPress={() => setModalBasics(true)}
          >
            <Text style={styles.shopNameTitle} numberOfLines={1}>
              {name || 'Shop'}
            </Text>
            <View style={styles.iconCircle}>
              <Icon name="create-outline" size={18} color={BRAND} />
            </View>
          </Pressable>

          <View style={styles.metricsRow}>
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>
                {formatNaira(metrics.revenue)}
              </Text>
              <Text style={styles.metricLabel}>Revenue</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>{String(metrics.orders)}</Text>
              <Text style={styles.metricLabel}>Orders</Text>
            </View>
            <View style={styles.metricCol}>
              <Text style={styles.metricValue}>{String(metrics.products)}</Text>
              <Text style={styles.metricLabel}>Products</Text>
            </View>
          </View>

          <View style={styles.sectionDivider} />

          <SectionHeader
            title="Category"
            onEdit={() => setModalCategory(true)}
          />
          <View style={styles.chipWrap}>
            {category.trim() ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {formatMvpCategoryLabel(category)}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderLine}>No category set</Text>
            )}
          </View>



          <View style={styles.sectionDivider} />

          <SectionHeader
            title="Description"
            onEdit={() => setModalDesc(true)}
          />
          <Text style={styles.bodyText}>
            {description.trim() || 'Add a short description for buyers.'}
          </Text>

          <View style={styles.sectionDivider} />

          <Text style={styles.sectionTitlePlain}>Verification</Text>
          <VerificationRow
            label="ID Card"
            status={idSt}
            hasProgress={idSt.passed || idSt.pending}
            onPress={() =>
              openVerDocModal({
                title: 'ID Card',
                help: 'Government-issued ID (JPEG, PNG, or PDF).',
                docKey: 'idCard',
              })
            }
          />
          <VerificationRow
            label="Address"
            status={addrSt}
            hasProgress={addrSt.passed || addrSt.pending}
            onPress={() =>
              openVerDocModal({
                title: 'Address',
                help: 'Utility bill or bank statement as proof of address (image or PDF).',
                docKey: 'proofOfAddress',
              })
            }
          />
          <VerificationRow
            label="BVN"
            status={bvnSt}
            hasProgress={bvnSt.passed || bvnSt.pending}
            onPress={() => {
              setBvnDraft('');
              setModalBvn(true);
            }}
          />
          <VerificationRow
            label="CAC"
            status={cacSt}
            hasProgress={cacSt.passed || cacSt.pending}
            onPress={() =>
              openVerDocModal({
                title: 'CAC',
                help: 'CAC certificate or business registration (JPEG, PNG, or PDF).',
                docKey: 'cacDocument',
              })
            }
          />

          <View style={styles.sectionDivider} />

          <View>
            <View
              style={styles.policyRow}
            // onPress={() => setModalDeliveryPolicy(true)}
            >
              <Text style={styles.policyLabel}>Delivery/Logistics</Text>
            </View>
            <View style={styles.shippingCardsWrap}>
              <TouchableOpacity style={styles.optionRow} onPress={() => navigation.navigate("shipping-fee-model", { shopId: activeShopId, userId: uid })} activeOpacity={0.85}>
                <View style={[styles.optionIcon, styles.optionIconBrand]}>
                  <Icon name="options-outline" size={22} color="#00926e" />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Shipping Model</Text>
                  <Text style={styles.optionDesc}>Choose how shipping fees are calculated for orders.</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  {shippingConfigStatus.hasFeeModel ? (
                    <View style={styles.statusBadgeSet}>
                      <Icon name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={styles.statusBadgeText}>Set</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgeNotSet}>
                      <Icon name="alert-circle-outline" size={16} color="#B45309" />
                      <Text style={styles.statusBadgeTextNotSet}>Not set</Text>
                    </View>
                  )}
                  <Icon name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.optionRow, { marginBottom: 0 }]} onPress={() => navigation.navigate("shipping-zones", { shopId: activeShopId, userId: uid })} activeOpacity={0.85}>
                <View style={[styles.optionIcon, styles.optionIconBrand]}>
                  <Icon name="map-outline" size={22} color="#00926e" />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Shipping Zones</Text>
                  <Text style={styles.optionDesc}>Set base fees and discounts for different locations.</Text>
                </View>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  {shippingConfigStatus.hasZones ? (
                    <View style={styles.statusBadgeSet}>
                      <Icon name="checkmark-circle" size={16} color="#16A34A" />
                      <Text style={styles.statusBadgeText}>Set</Text>
                    </View>
                  ) : (
                    <View style={styles.statusBadgeNotSet}>
                      <Icon name="alert-circle-outline" size={16} color="#B45309" />
                      <Text style={styles.statusBadgeTextNotSet}>Not set</Text>
                    </View>
                  )}
                  <Icon name="chevron-forward" size={18} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionDivider} />



          <Text style={styles.sectionTitlePlain}>Shop location</Text>
          <Pressable
            style={({ pressed }) => [
              styles.outlineBtn,
              pressed && styles.outlineBtnPressed,
            ]}
            onPress={() => {
              onUseMyLocation().catch(() => { });
            }}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator color={BRAND} />
            ) : (
              <Text style={styles.outlineBtnText}>Use my current location</Text>
            )}
          </Pressable>
          <Text style={styles.helperGrey}>
            Set where you operate. We read your device position once to suggest
            city and state — you can save after reviewing.
          </Text>
          <Text style={styles.locationBold}>{locationSummary}</Text>
          <View style={styles.kv}>
            <Text style={styles.kvMuted}>State</Text>
            <Text style={styles.kvVal}>
              {String(locationState.state ?? '—')}
            </Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvMuted}>City</Text>
            <Text style={styles.kvVal}>
              {String(locationState.city ?? '—')}
            </Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvMuted}>Country</Text>
            <Text style={styles.kvVal}>
              {String(locationState.country ?? '—')}
            </Text>
          </View>
          <View style={styles.kv}>
            <Text style={styles.kvMuted}>Coordinates</Text>
            <Text style={styles.kvVal}>{coordsLine}</Text>
          </View>

          <View style={styles.sectionDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              pressed && styles.saveBtnPressed,
              saving && styles.saveBtnDisabled,
            ]}
            onPress={() => {
              persist().catch(() => { });
            }}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save changes</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={pickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerOpen(false)}
        />
        <View
          style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}
        >
          <Text style={styles.modalTitle}>Select shop</Text>
          {shopsList.map(s => {
            const id = shopIdOf(s);
            const sn = pickStr(s, 'name', 'Name') || `Shop ${id}`;
            const selected = id === activeShopId;
            return (
              <Pressable
                key={String(id)}
                style={[
                  styles.pickerItem,
                  selected && styles.pickerItemSelected,
                ]}
                onPress={() => onSelectShop(id)}
              >
                <Text style={styles.pickerItemText}>{sn}</Text>
                {selected ? (
                  <Icon name="checkmark-circle" size={22} color={BRAND} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </Modal>

      <FormModal
        visible={modalBasics}
        title="Shop details"
        saving={saving}
        onClose={() => !saving && setModalBasics(false)}
        onSave={() => persistAndClose(() => setModalBasics(false))}
      >
        <Text style={styles.modalLabel}>Shop name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.modalInput}
          placeholder="Shop name"
        />
        <Text style={styles.modalLabel}>Slug (URL)</Text>
        <TextInput
          value={slug}
          onChangeText={t => setSlug(t.toLowerCase().replace(/\s+/g, '-'))}
          style={styles.modalInput}
          autoCapitalize="none"
        />
        <Text style={styles.modalLabel}>Contact email</Text>
        <TextInput
          value={contactEmail}
          onChangeText={setContactEmail}
          style={styles.modalInput}
          keyboardType="email-address"
        />
        <Text style={styles.modalLabel}>Contact phone</Text>
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          style={styles.modalInput}
          keyboardType="phone-pad"
        />
      </FormModal>

      <FormModal
        visible={modalDesc}
        title="Description"
        saving={saving}
        onClose={() => !saving && setModalDesc(false)}
        onSave={() => persistAndClose(() => setModalDesc(false))}
      >
        <TextInput
          value={description}
          onChangeText={setDescription}
          style={[styles.modalInput, styles.modalInputTall]}
          multiline
          textAlignVertical="top"
          placeholder="Tell buyers what you sell"
        />
      </FormModal>

      <FormModal
        visible={modalCategory}
        title="Category"
        saving={saving}
        onClose={() => !saving && setModalCategory(false)}
        onSave={() => persistAndClose(() => setModalCategory(false))}
      >
        {categoryOptions.length === 0 ? (
          <Text style={styles.placeholderLine}>No categories available.</Text>
        ) : (
          categoryOptions.map(opt => {
            const selected =
              category.trim().toLowerCase() === opt.toLowerCase();
            return (
              <Pressable
                key={opt}
                style={[
                  styles.pickerItem,
                  selected && styles.pickerItemSelected,
                ]}
                onPress={() => setCategory(opt)}
              >
                <Text style={styles.pickerItemText}>
                  {formatMvpCategoryLabel(opt)}
                </Text>
                {selected ? (
                  <Icon name="checkmark-circle" size={22} color={BRAND} />
                ) : null}
              </Pressable>
            );
          })
        )}
      </FormModal>

      <Modal
        visible={Boolean(verDocModal)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!verBusy) setVerDocModal(null);
        }}
      >
        <View style={styles.formModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !verBusy && setVerDocModal(null)}
          />
          <View style={styles.formModalCard}>
            <Text style={styles.modalTitle}>{verDocModal?.title ?? ''}</Text>
            <Text style={[styles.helperGrey, { marginBottom: 14 }]}>
              {verDocModal?.help ?? ''}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.outlineBtn,
                pressed && styles.outlineBtnPressed,
              ]}
              onPress={() => pickVerificationFile().catch(() => { })}
              disabled={verBusy}
            >
              <Text style={styles.outlineBtnText}>
                {verPickedName ? 'Change file' : 'Choose file'}
              </Text>
            </Pressable>
            <Text style={styles.modalHint}>
              {verPickedName || 'No file chosen'}
            </Text>
            <View style={[styles.modalActions, { marginTop: 18 }]}>
              <Pressable
                onPress={() => !verBusy && setVerDocModal(null)}
                style={styles.modalGhostBtn}
                disabled={verBusy}
              >
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => saveVerDocToShop().catch(() => { })}
                style={[
                  styles.modalPrimaryBtn,
                  verBusy && styles.saveBtnDisabled,
                ]}
                disabled={verBusy}
              >
                {verBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Save to shop</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalBvn}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!bvnBusy) setModalBvn(false);
        }}
      >
        <View style={styles.formModalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !bvnBusy && setModalBvn(false)}
          />
          <View style={styles.formModalCard}>
            <Text style={styles.modalTitle}>BVN verification</Text>
            <Text style={[styles.helperGrey, { marginBottom: 12 }]}>
              Enter your 11-digit BVN. We only store a masked record after
              verification. Connect Paystack or Mono for live NIBSS checks when
              ready.
            </Text>
            {bvnSt.passed &&
              verDocs.bvn &&
              typeof verDocs.bvn === 'object' &&
              verDocs.bvn.last4 != null &&
              String(verDocs.bvn.last4).trim() !== '' ? (
              <Text style={styles.bvnOnFile}>
                On file: ••••{String(verDocs.bvn.last4)} (verified)
              </Text>
            ) : null}
            <TextInput
              value={bvnDraft}
              onChangeText={t => setBvnDraft(t.replace(/\D/g, '').slice(0, 11))}
              style={styles.modalInput}
              placeholder="11-digit BVN"
              keyboardType="number-pad"
              maxLength={11}
              editable={!bvnBusy}
            />
            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <Pressable
                onPress={() => !bvnBusy && setModalBvn(false)}
                style={styles.modalGhostBtn}
                disabled={bvnBusy}
              >
                <Text style={styles.modalGhostText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => submitBvn().catch(() => { })}
                style={[
                  styles.modalPrimaryBtn,
                  bvnBusy && styles.saveBtnDisabled,
                ]}
                disabled={bvnBusy}
              >
                {bvnBusy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Verify</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <DeliveryPolicyModal
        visible={modalDeliveryPolicy && activeShopId > 0}
        onClose={() => setModalDeliveryPolicy(false)}
        shopId={activeShopId}
        onSaved={onDeliveryPolicySaved}
      />
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ title, onEdit }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionTitlePlain}>{title}</Text>
      <TouchableOpacity
        onPress={onEdit}
        hitSlop={12}
        style={styles.iconCircle}
        accessibilityLabel={`Edit ${title}`}
      >
        <Icon name="create-outline" size={18} color={BRAND} />
      </TouchableOpacity>
    </View>
  );
}

function NairaInput({ value, onChangeText, placeholder }) {
  return (
    <View style={styles.currencyWrap}>
      <Text style={styles.currencySymbol}>₦</Text>
      <TextInput
        style={styles.currencyInput}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

/** @param {{ label: string; status: { label: string; passed: boolean; pending: boolean }; hasProgress: boolean; onPress: () => void }} props */
function VerificationRow({ label, status, hasProgress, onPress }) {
  return (
    <Pressable style={styles.verRow} onPress={onPress}>
      <View style={styles.verLeft}>
        <Text style={styles.verLabel}>{label}</Text>
        <Text
          style={[
            styles.verStatus,
            status.passed && styles.verStatusOk,
            status.pending && styles.verStatusPending,
          ]}
        >
          {status.label}
        </Text>
      </View>
      <View style={styles.iconCircle}>
        <Icon
          name={hasProgress ? 'create-outline' : 'add'}
          size={18}
          color={BRAND}
        />
      </View>
    </Pressable>
  );
}

const WHEEL_ITEM_HEIGHT = 40;
const WHEEL_VISIBLE_ITEMS = 5; // odd → centred selection
const WHEEL_PADDING = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ITEMS / 2);

/**
 * Vertical wheel-style picker built on a snapping ScrollView (no native dep).
 * The currently-selected value sits in the centre row, highlighted with rules
 * above/below. Selection commits on momentum-end so taps outside the wheel
 * don't fight the scroll.
 *
 * @param {{
 *   data: number[];
 *   value: number;
 *   onChange: (n: number) => void;
 * }} props
 */
function WheelColumn({ data, value, onChange }) {
  const scrollRef = useRef(/** @type {ScrollView | null} */(null));
  const idx = Math.max(0, data.indexOf(value));

  // Keep the centred row in sync when `value` changes from outside (e.g. when
  // the user taps Open/Close on a different day).
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ y: idx * WHEEL_ITEM_HEIGHT, animated: false });
  }, [idx]);

  return (
    <View style={styles.wheelCol}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={WHEEL_ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
        onMomentumScrollEnd={e => {
          const y = e.nativeEvent.contentOffset.y;
          const i = Math.max(
            0,
            Math.min(data.length - 1, Math.round(y / WHEEL_ITEM_HEIGHT)),
          );
          const next = data[i];
          if (next != null && next !== value) onChange(next);
        }}
      >
        {data.map(d => {
          const selected = d === value;
          return (
            <View key={d} style={styles.wheelItem}>
              <Text
                style={[
                  styles.wheelItemText,
                  selected && styles.wheelItemTextSelected,
                ]}
              >
                {pad2(d)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View pointerEvents="none" style={styles.wheelHighlight} />
    </View>
  );
}

function CheckRow({ label, checked, onToggle }) {
  return (
    <TouchableOpacity
      style={styles.checkRow}
      onPress={onToggle}
      activeOpacity={0.88}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5); // 00, 05, 10, …, 55

/**
 * Bottom-sheet style time picker used by the opening-hours editor. Caller
 * passes the initial `(h, m)` and we hand back the new pair on Save. We snap
 * minutes to the nearest 5-minute increment so the wheel always lands on a
 * value that exists in `MINUTE_OPTIONS`.
 *
 * @param {{
 *   visible: boolean;
 *   title: string;
 *   initialHour: number;
 *   initialMinute: number;
 *   onCancel: () => void;
 *   onSave: (h: number, m: number) => void;
 * }} props
 */
function TimePickerModal({
  visible,
  title,
  initialHour,
  initialMinute,
  onCancel,
  onSave,
}) {
  const insets = useSafeAreaInsets();
  const snapMinute = m => {
    const idx = Math.round(m / 5);
    return MINUTE_OPTIONS[
      Math.max(0, Math.min(MINUTE_OPTIONS.length - 1, idx))
    ];
  };
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(snapMinute(initialMinute));

  // Reset wheels every time the modal is reopened.
  useEffect(() => {
    if (!visible) return;
    setHour(initialHour);
    setMinute(snapMinute(initialMinute));
  }, [visible, initialHour, initialMinute]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={styles.formModalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            styles.formModalCard,
            { paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.timePreview}>
            {pad2(hour)}:{pad2(minute)}
          </Text>
          <View style={styles.wheelRow}>
            <WheelColumn data={HOUR_OPTIONS} value={hour} onChange={setHour} />
            <Text style={styles.wheelColon}>:</Text>
            <WheelColumn
              data={MINUTE_OPTIONS}
              value={minute}
              onChange={setMinute}
            />
          </View>
          <Text style={styles.timeHelper}>
            Scroll each column to choose hour and minute.
          </Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalGhostBtn}>
              <Text style={styles.modalGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(hour, minute)}
              style={styles.modalPrimaryBtn}
            >
              <Text style={styles.modalPrimaryText}>Set time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** @param {{ visible: boolean; title: string; children: unknown; onClose: () => void; onSave: () => void; saving?: boolean }} props */
function FormModal({ visible, title, children, onClose, onSave, saving }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.formModalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.formModalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={styles.modalGhostBtn}
              disabled={saving}
            >
              <Text style={styles.modalGhostText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              style={[styles.modalPrimaryBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryText}>Done</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: PAGE_BG },
  scroll: { flex: 1, backgroundColor: PAGE_BG },
  hero: {
    backgroundColor: BRAND,
    paddingBottom: 48,
  },
  heroInner: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  sheet: {
    marginTop: -36,
    backgroundColor: CARD,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: BLACK,
    textAlign: 'center',
    marginBottom: 16,
  },
  viewShopsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewShopsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: BLACK,
  },
  addCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleShopHint: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 8,
  },
  shopNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  shopNameTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: BLACK,
    flex: 1,
    marginRight: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 7,
    fontSize: 16,
    // width: '60%',
    color: '#111111',
  },
  currencyWrap: {
    minHeight: 46,
    width: 190,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 18,
    color: '#1F2937',
    marginRight: 8,
  },
  currencyInput: {
    // flex: 1,
    fontSize: 16,
    color: '#111111',
    paddingVertical: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(13,79,60,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,79,60,0.06)',
  },
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 14,
    marginBottom: 8,
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: MUTED,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionIconOrange: {
    backgroundColor: '#FFEDD5',
  },
  optionIconGray: {
    backgroundColor: '#F3F4F6',
  },
  optionIconBrand: {
    backgroundColor: '#E8F6F1',
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111111',
  },
  optionDesc: {
    marginTop: 4,
    fontSize: 14,
    color: '#6B7280',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginVertical: 16,
    marginHorizontal: -4,
  },
  zoneStates: {
    width: '100%',
    paddingHorizontal: 7,
    paddingVertical: 7,
    fontSize: 20,
    background: '#f9f9f9',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitlePlain: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
    gap: 7,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: '#B5BAC3',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#111111',
    borderColor: '#111111',
  },
  checkLabel: {
    flex: 1,
    fontSize: 16,
    textTransform: 'capitalize',
    fontWeight: '500',
    color: '#000',
    marginTop: 5,
  },
  chipWrap: { marginBottom: 4 },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  chipText: { fontSize: 14, fontWeight: '600', color: BLACK },
  placeholderLine: { fontSize: 14, color: MUTED },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    marginBottom: 4,
  },
  th: { fontSize: 12, fontWeight: '700', color: MUTED },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  td: { fontSize: 14, color: BLACK, flex: 1 },
  tdMuted: { fontSize: 14, color: MUTED, flex: 1.2, textAlign: 'right' },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    color: BLACK,
  },
  verRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  verLeft: { flex: 1 },
  verLabel: { fontSize: 15, fontWeight: '500', color: BLACK },
  verStatus: { fontSize: 13, color: MUTED, marginTop: 2 },
  verStatusOk: { color: GREEN_OK, fontWeight: '600' },
  verStatusPending: { color: ORANGE_PENDING, fontWeight: '600' },
  modalHint: { fontSize: 13, color: MUTED, marginTop: 8 },
  bvnOnFile: {
    fontSize: 13,
    color: GREEN_OK,
    fontWeight: '600',
    marginBottom: 8,
  },
  outlineBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BRAND,
    marginBottom: 10,
  },
  outlineBtnPressed: { opacity: 0.85 },
  outlineBtnText: { color: BRAND, fontWeight: '700', fontSize: 14 },
  helperGrey: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
    marginBottom: 14,
  },
  locationBold: {
    fontSize: 16,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 12,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  kvMuted: { fontSize: 14, color: MUTED },
  kvVal: {
    fontSize: 14,
    fontWeight: '500',
    color: BLACK,
    maxWidth: '62%',
    textAlign: 'right',
  },
  policyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  shippingCardsWrap: {
    backgroundColor: '#EFEFEF',
    width: '100%',
    paddingHorizontal: 5,
    paddingVertical: 5,
    borderRadius: 7,
    marginBottom: 7,
    flexDirection: 'column',
    // gap: 7,
  },
  shippingCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  shippingCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 4,
  },
  shippingCardDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: MUTED,
  },
  policyLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: BLACK },
  policyStatus: { fontSize: 14, color: MUTED, marginRight: 4 },
  policyStatusOk: { color: GREEN_OK, fontWeight: '600' },
  policyDetailCard: {
    backgroundColor: '#F8FAF7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 4,
  },
  policyDetailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 8,
  },
  saveBtn: {
    marginTop: 20,
    backgroundColor: BRAND,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnPressed: { opacity: 0.9 },
  saveBtnDisabled: { opacity: 0.65 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  centered: {
    flex: 1,
    backgroundColor: PAGE_BG,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  muted: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BLACK,
    marginBottom: 8,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '22%',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    color: BLACK,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  pickerItemSelected: { backgroundColor: 'rgba(13,79,60,0.05)' },
  pickerItemText: { fontSize: 16, color: BLACK },
  formModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  formModalCard: {
    backgroundColor: CARD,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 28,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    marginTop: 10,
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
    color: BLACK,
  },
  modalInputTall: { minHeight: 120, textAlignVertical: 'top' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 20,
  },
  modalGhostBtn: { paddingVertical: 10, paddingHorizontal: 12 },
  modalGhostText: { fontSize: 16, color: MUTED, fontWeight: '600' },
  modalPrimaryBtn: {
    backgroundColor: BRAND,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modalPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  hourLabel: { width: 84, fontSize: 14, color: BLACK, fontWeight: '500' },
  hourInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  hourTimeBtn: {
    flex: 1,
    height: 38,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourTimeBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#EAEAEA',
  },
  hourTimeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: BLACK,
  },
  hourTimeBtnTextDisabled: {
    color: MUTED,
    fontWeight: '500',
  },
  hourArrow: {
    fontSize: 14,
    color: MUTED,
    marginHorizontal: 4,
  },
  hourClosedBadge: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: MUTED,
    fontStyle: 'italic',
  },
  switchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  switchLabel: {
    fontSize: 12,
    color: MUTED,
  },
  wheelRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  wheelCol: {
    width: 80,
    height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_ITEMS,
    overflow: 'hidden',
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemText: {
    fontSize: 18,
    color: MUTED,
    fontVariant: ['tabular-nums'],
  },
  wheelItemTextSelected: {
    color: BLACK,
    fontWeight: '700',
  },
  wheelHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ITEMS / 2),
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: 'rgba(13,79,60,0.04)',
  },
  wheelColon: {
    fontSize: 22,
    fontWeight: '700',
    color: BLACK,
  },
  timePreview: {
    fontSize: 28,
    fontWeight: '700',
    color: BLACK,
    textAlign: 'center',
    marginVertical: 6,
    fontVariant: ['tabular-nums'],
  },
  timeHelper: {
    fontSize: 12,
    color: MUTED,
    textAlign: 'center',
    marginTop: 8,
  },
  statusBadgeSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  statusBadgeNotSet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FFFBEB',
  },
  statusBadgeTextNotSet: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
  },
});
