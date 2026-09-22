import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import {
  errorCodes,
  isErrorWithCode,
  pick as pickDocument,
  types as documentPickerTypes,
} from '@react-native-documents/picker';
import {
  fetchOwnerShops,
  fetchShopDetails,
  uploadProductImage,
} from '../../api/shop';
import {
  createInventory,
  createProduct,
  getProduct,
  updateInventory,
  updateProduct,
} from '../../api/product';
import { useProfile } from '../../context/ProfileContext';
import {
  selectCategoryTree,
  selectCategoriesState,
} from '../../../redux/categoriesSlice';
import colorJson from '../../json/color.json';
import mvpCategoryData from '../../json/mvp_category.json';
import {
  buildMvpCategoryFilters,
  formatMvpCategoryLabel,
  getGenderDrivenTypeOptions,
  isGenderDrivenCategory,
  mvpCategoryRootKeys,
} from '../../utils/mvpCategory';
import {
  buildColorOptionsFromJson,
  buildVariantSnapshot,
  formatPriceInput,
  getClothingSubtypeConfig,
  materialStringsForSizeKey,
  resolveClothingSubType,
  resolveSizeOptions,
} from '../../utils/variantOptions';
import {
  buildProductCreatePayloads,
  getVariantPriceRange,
} from '../../utils/vendorProductPayload';

const GENDERS = ['Male', 'Female'];

/** @template T @param {T[]} arr @param {number} size @returns {T[][]} */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function normalizeStoredSpecifications(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function normalizeVariantRecord(rawVariant, index) {
  const details = Array.isArray(rawVariant?.details)
    ? rawVariant.details
        .filter(Boolean)
        .map(detail => ({
          label: String(detail?.label ?? '').trim(),
          value: String(detail?.value ?? '').trim(),
        }))
        .filter(detail => detail.label && detail.value)
    : [];
  const stockValue = Number(rawVariant?.stock ?? rawVariant?.quantity ?? 0);

  return {
    id: String(rawVariant?.id ?? `saved-variant-${index}`),
    details,
    stock: Number.isFinite(stockValue) ? stockValue : 0,
  };
}

const VARIANT_FORM_WARNING =
  'Please fill in the variant form. Color, size, stock (greater than 0), and variant price are all required.';

/**
 * Create product flow (nested under Products tab stack).
 */
export default function VendorCreateProductScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { user } = useProfile();
  const reduxCategoryKeys = useSelector(selectCategoryTree);
  const reduxCategoryState = useSelector(selectCategoriesState);
  const [resolvedShopId, setResolvedShopId] = useState(
    /** @type {number | null} */ (null),
  );
  const [shopDetails, setShopDetails] = useState(
    /** @type {Record<string, unknown> | null} */ (null),
  );
  const rawEditProductId = route.params?.productId;
  const editProductId = useMemo(() => {
    const parsed = Number(rawEditProductId ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [rawEditProductId]);
  const [productId] = useState(
    () => `prod_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
  );
  const [saveSubmitting, setSaveSubmitting] = useState(false);
  const defaultCategory = useMemo(
    () =>
      reduxCategoryKeys[0] ||
      mvpCategoryRootKeys(
        /** @type {Record<string, unknown>} */ (mvpCategoryData),
      )[0] ||
      'fashion',
    [reduxCategoryKeys],
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [gender, setGender] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [productType, setProductType] = useState('');
  const [picker, setPicker] = useState(
    /** @type {null | 'category' | 'sub' | 'type' | 'gender' | 'variantColor' | 'variantSize' | 'variantMaterial'} */ (
      null
    ),
  );
  const colorOptionsList = useMemo(
    () => buildColorOptionsFromJson(colorJson),
    [],
  );
  /** @type {Record<string, { value: string; label: string; color: string }>} */
  const colorByValue = useMemo(
    () => Object.fromEntries(colorOptionsList.map(c => [c.value, c])),
    [colorOptionsList],
  );
  const colorPickerValues = useMemo(
    () => colorOptionsList.map(c => c.value),
    [colorOptionsList],
  );
  /** @type {Record<string, string>} */
  const colorSwatchByValue = useMemo(
    () => Object.fromEntries(colorOptionsList.map(c => [c.value, c.color])),
    [colorOptionsList],
  );

  const [variantFields, setVariantFields] = useState({});
  const [dynamicVariantValues, setDynamicVariantValues] = useState({});

  const [variantColor, setVariantColor] = useState(
    /** @type {null | { value: string; label: string; color: string }} */ (
      null
    ),
  );
  const [variantSize, setVariantSize] = useState('');
  const [variantMaterial, setVariantMaterial] = useState('');
  const [variantStock, setVariantStock] = useState('');
  const [variantPrice, setVariantPrice] = useState('');
  const [variantError, setVariantError] = useState('');
  const [savedVariants, setSavedVariants] = useState(
    /** @type {{ id: string; details: { label: string; value: string }[]; stock: number }[]} */ ([]),
  );
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [continueSelling, setContinueSelling] = useState(false);
  const [fragile, setFragile] = useState(false);
  const [weightKg, setWeightKg] = useState('0');
  const [lengthCm, setLengthCm] = useState('0');
  const [widthCm, setWidthCm] = useState('0');
  const [heightCm, setHeightCm] = useState('0');
  const [brandName, setBrandName] = useState('');
  const [allowPickup, setAllowPickup] = useState(false);
  const [allowDelivery, setAllowDelivery] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState(
    /** @type {{ id: string; url: string; type: string }[]} */ ([]),
  );
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState('');
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showFinishSheet, setShowFinishSheet] = useState(false);
  const [loadingExistingProduct, setLoadingExistingProduct] = useState(false);

  const categoryRoots = useMemo(
    () =>
      mvpCategoryRootKeys(
        /** @type {Record<string, unknown>} */ (reduxCategoryKeys),
      ),
    [reduxCategoryKeys],
  );
  const savedShopCategory = useMemo(() => {
    const raw = String(shopDetails?.category ?? '').trim();
    return raw ? raw.toLowerCase() : defaultCategory;
  }, [defaultCategory, shopDetails]);
  const categoryKey =
    String(category || savedShopCategory || defaultCategory).trim() ||
    defaultCategory;
  const { subCategories, typesBySubCategory } = useMemo(
    () =>
      buildMvpCategoryFilters(
        /** @type {Record<string, unknown>} */ (reduxCategoryKeys),
        categoryKey,
      ),
    [categoryKey, reduxCategoryKeys],
  );

  useEffect(() => {
    setDynamicVariantValues({});
    const activeCategory = reduxCategoryState.categories.find(
      item => item.category === categoryKey,
    );
    const parsedVariants = activeCategory?.variants
      ? JSON.parse(activeCategory?.variants)
      : '';

    setVariantFields(parsedVariants instanceof Object ? parsedVariants : {});
  }, [categoryKey, reduxCategoryState.categories]);

  useEffect(() => {
    if (!resolvedShopId || !user?.id || editProductId == null) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingExistingProduct(true);
        const data = await getProduct(resolvedShopId, editProductId, user.id);
        if (cancelled) return;
        const product = data?.product ?? data ?? {};
        const productSpecs = normalizeStoredSpecifications(product.specifications);
        const variantEntries = Array.isArray(productSpecs.variants)
          ? productSpecs.variants.map(normalizeVariantRecord)
          : [];

        setTitle(String(product.name ?? ''));
        setDescription(String(product.description ?? ''));
        setBrandName(String(product.brand ?? ''));
        setCategory(
          String(product.category ?? defaultCategory)
            .trim()
            .toLowerCase() || defaultCategory,
        );
        setGender(String(productSpecs.gender ?? ''));
        setSubCategory(String(product.subcategory ?? ''));
        setProductType(String(productSpecs.type ?? ''));
        setAllowPickup(Boolean(productSpecs.delivery_methods?.pickup));
        setAllowDelivery(Boolean(productSpecs.delivery_methods?.delivery));
        setSavedVariants(variantEntries);

        const images = Array.isArray(product.images)
          ? product.images
              .map(item => String(item ?? '').trim())
              .filter(Boolean)
              .map((url, index) => ({
                id: `${editProductId}-img-${index}`,
                url,
                type: 'image',
              }))
          : [];
        setUploadedMedia(images);
        setThumbnailUrl(String(product.thumbnail_url ?? images[0]?.url ?? ''));

        if (product.weight != null) {
          setWeightKg(String(product.weight));
        }
      } catch (error) {
        if (!cancelled) {
          Alert.alert(
            'Could not load product',
            error instanceof Error ? error.message : 'The product could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingExistingProduct(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [defaultCategory, editProductId, resolvedShopId, user?.id]);

  const dynamicVariantEntries = useMemo(
    () =>
      Object.entries(variantFields ?? {}).filter(
        ([, options]) => Array.isArray(options) && options.length > 0,
      ),
    [variantFields],
  );

  const typeOptions = useMemo(() => {
    if (isGenderDrivenCategory(categoryKey)) {
      return getGenderDrivenTypeOptions(categoryKey, gender);
    }
    const sub = String(subCategory || '').trim();
    if (!sub) return [];
    return typesBySubCategory.get(sub) ?? [];
  }, [categoryKey, gender, subCategory, typesBySubCategory]);

  /** MVP: single shop — always the first shop returned for the signed-in owner. */
  useEffect(() => {
    let cancelled = false;
    const uid = user?.id;

    (async () => {
      if (!uid) {
        if (!cancelled) {
          setResolvedShopId(null);
          setShopDetails(null);
          setCategory(defaultCategory);
        }
        return;
      }

      try {
        const shops = await fetchOwnerShops(uid);
        if (cancelled) return;

        const first =
          Array.isArray(shops) && shops.length > 0 ? shops[0] : null;
        const idRaw = first?.id ?? first?.shop_id;
        const sid =
          typeof idRaw === 'number' ? idRaw : parseInt(String(idRaw ?? ''), 10);

        if (!Number.isNaN(sid) && sid > 0) {
          setResolvedShopId(sid);
          try {
            const shop = await fetchShopDetails(sid, uid);
            if (!cancelled) {
              setShopDetails(shop);
              const savedCategory = String(shop?.category ?? '').trim();
              setCategory(
                savedCategory ? savedCategory.toLowerCase() : defaultCategory,
              );
            }
          } catch {
            if (!cancelled) {
              setShopDetails(null);
              setCategory(defaultCategory);
            }
          }
          return;
        }

        if (!cancelled) {
          setResolvedShopId(null);
          setShopDetails(null);
          setCategory(defaultCategory);
        }
      } catch {
        if (!cancelled) {
          setResolvedShopId(null);
          setShopDetails(null);
          setCategory(defaultCategory);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, defaultCategory]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (mediaUploading) {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation, mediaUploading]);

  const variantCtx = useMemo(() => {
    const cat = categoryKey;
    const sub = String(subCategory || '');
    const typ = String(productType || '');
    const sizeConfig = resolveSizeOptions({
      category: cat,
      subCategory: sub,
      type: typ,
    });
    const clothingSubType = resolveClothingSubType({
      category: cat,
      subCategory: sub,
      type: typ,
    });
    const clothingSubTypeConfig = getClothingSubtypeConfig(clothingSubType);
    const resolvedSizeOptions =
      sizeConfig.key === 'clothing' && clothingSubTypeConfig
        ? clothingSubTypeConfig.options
        : sizeConfig.options;
    const sizeFieldLabel =
      sizeConfig.key === 'clothing' && clothingSubTypeConfig
        ? `${clothingSubTypeConfig.label} size`
        : sizeConfig.label.replace(/s$/i, '');
    const materialStrings = materialStringsForSizeKey(sizeConfig.key);
    const materialFieldLabel =
      sizeConfig.key === 'food' ? 'Packaging' : 'Material';
    const materialPlaceholder =
      sizeConfig.key === 'food' ? 'Select packaging' : 'Select a material';
    const sizePlaceholder =
      sizeConfig.key === 'clothing' && clothingSubTypeConfig
        ? `Select a ${clothingSubTypeConfig.label.toLowerCase()} size`
        : `Select ${sizeConfig.label.toLowerCase()}`;
    return {
      sizeConfigKey: sizeConfig.key,
      resolvedSizeOptions,
      sizeFieldLabel,
      materialStrings,
      materialFieldLabel,
      materialPlaceholder,
      sizePlaceholder,
    };
  }, [categoryKey, subCategory, productType]);

  const canAddVariant = useMemo(() => {
    const stockStr = variantStock.trim();
    const stockOk =
      stockStr !== '' && /^\d+$/.test(stockStr) && Number(stockStr) > 0;
    const priceRaw = String(variantPrice)
      .replace(/,/g, '')
      .replace(/[^\d.]/g, '');
    const priceNum = Number(priceRaw);
    const priceOk = priceRaw !== '' && !Number.isNaN(priceNum) && priceNum > 0;
    return stockOk && priceOk;
  }, [variantStock, variantPrice]);

  useEffect(() => {
    setSubCategory('');
    setProductType('');
    if (isGenderDrivenCategory(categoryKey)) {
      setGender('');
    }
  }, [categoryKey]);

  useEffect(() => {
    if (isGenderDrivenCategory(categoryKey)) {
      setProductType('');
      return;
    }
    setProductType('');
  }, [subCategory, categoryKey]);

  useEffect(() => {
    if (isGenderDrivenCategory(categoryKey) && productType.trim()) {
      setSubCategory(productType);
    }
  }, [categoryKey, productType]);

  useEffect(() => {
    if (isGenderDrivenCategory(categoryKey)) {
      setProductType('');
    }
  }, [gender, categoryKey]);

  const variantStockTotal = useMemo(
    () => savedVariants.reduce((t, v) => t + Number(v?.stock || 0), 0),
    [savedVariants],
  );
  const hasVariantsList = savedVariants.length > 0;
  const variantPriceTotal = useMemo(
    () =>
      savedVariants.every(variant => {
        const priceLine = variant.details.find(
          detail => String(detail?.label ?? '').toLowerCase() === 'price',
        );
        const numeric = Number(
          String(priceLine?.value ?? '')
            .replace(/[^\d.]/g, '')
            .replace(/\.(?=.*\.)/g, ''),
        );
        return Number.isFinite(numeric) && numeric > 0;
      }),
    [savedVariants],
  );
  const isPriceValid = hasVariantsList ? variantPriceTotal : false;
  const isQuantityValid = hasVariantsList ? variantStockTotal > 0 : false;
  const isGenderCategory = isGenderDrivenCategory(categoryKey);
  const hasFashionGender = !isGenderCategory || gender.trim().length > 0;
  const hasCoreFields =
    title.trim().length > 1 &&
    category.trim().length > 0 &&
    hasVariantsList &&
    isPriceValid &&
    isQuantityValid &&
    hasFashionGender &&
    uploadedMedia.length > 0;
  const hasCategoryFields = isGenderCategory
    ? productType.trim().length > 0
    : subCategory.trim().length > 0 && productType.trim().length > 0;

  const handleRemoveMedia = useCallback(mediaId => {
    setUploadedMedia(prev => prev.filter(item => item.id !== mediaId));
    setMediaUploadError('');
  }, []);

  const handlePickMedia = useCallback(async () => {
    if (!resolvedShopId) {
      Alert.alert(
        'No shop',
        'Create a shop in settings before adding products.',
      );
      return;
    }

    try {
      setMediaUploadError('');
      setMediaUploading(true);
      const fileResult = await pickDocument({
        type: [documentPickerTypes.images, documentPickerTypes.video],
        copyTo: 'cachesDirectory',
      });
      const file = Array.isArray(fileResult) ? fileResult[0] : fileResult;

      const formFile = {
        uri: file.uri,
        type: file.type ?? 'application/octet-stream',
        name:
          file.name || `upload.${String(file.uri).split('.').pop() || 'jpg'}`,
      };

      const uploadResponse = await uploadProductImage(
        resolvedShopId,
        formFile,
        productId,
      );
      const image = uploadResponse?.image;
      const url = image?.url || image?.secure_url;
      if (!url) {
        throw new Error('Upload response missing image URL.');
      }

      setUploadedMedia(prev => [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          url,
          type: String(image?.format || formFile.type),
        },
      ]);
      setThumbnailUrl(prev => prev || url);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      setMediaUploadError(
        err instanceof Error ? err.message : 'Upload failed.',
      );
    } finally {
      setMediaUploading(false);
    }
  }, [productId, resolvedShopId]);

  const onSave = useCallback(() => {
    if (!hasCoreFields || !hasCategoryFields) {
      setShowValidationModal(true);
      return;
    }
    setShowFinishSheet(true);
  }, [hasCategoryFields, hasCoreFields]);

  const clearVariantFields = useCallback(() => {
    setVariantColor(null);
    setVariantSize('');
    
    setVariantMaterial('');
    setVariantStock('');
    setVariantPrice('');
    setVariantError('');
  }, []);

  const handleVariantStockChange = useCallback(text => {
    const value = String(text).replace(/,/g, '');
    if (value === '' || /^\d+$/.test(value)) {
      setVariantStock(value);
      setVariantError('');
    }
  }, []);

  const handleVariantPriceChange = useCallback(text => {
    setVariantPrice(formatPriceInput(text));
    setVariantError('');
  }, []);

  const handleSaveVariant = useCallback(() => {
    const stockStr = variantStock.trim();
    const stockInvalid =
      !stockStr || !/^\d+$/.test(stockStr) || Number(stockStr) <= 0;
    const priceRaw = String(variantPrice)
      .replace(/,/g, '')
      .replace(/[^\d.]/g, '');
    const priceNum = Number(priceRaw);
    const priceInvalid = !priceRaw || Number.isNaN(priceNum) || priceNum <= 0;

    if (stockInvalid || priceInvalid) {
      setVariantError(
        'Please enter a valid variant quantity and price. Color, size, and material are optional.',
      );
      return;
    }

    const baseDetails = buildVariantSnapshot({
      color: variantColor,
      size: variantSize.trim(),
      material: variantMaterial.trim(),
      price: variantPrice.trim(),
      stock: variantStock.trim(),
      sizeDetailLabel: variantCtx.sizeFieldLabel,
      materialDetailLabel: variantCtx.materialFieldLabel,
    });

    const dynamicDetails = dynamicVariantEntries.flatMap(([fieldKey, fieldOptions]) => {
      if (!Array.isArray(fieldOptions) || fieldOptions.length === 0) return [];
      const selectedValue =
        fieldKey === 'color'
          ? variantColor?.label
          : fieldKey === 'size'
            ? variantSize
            : fieldKey === 'material'
              ? variantMaterial
              : dynamicVariantValues[fieldKey];
      if (!selectedValue) return [];
      return [{ label: formatMvpCategoryLabel(fieldKey), value: String(selectedValue) }];
    });

    const details = [...baseDetails, ...dynamicDetails].filter(
      (detail, index, arr) =>
        arr.findIndex(item => item.label === detail.label && item.value === detail.value) === index,
    );

    setSavedVariants(prev => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        details,
        stock: Number(variantStock),
      },
    ]);
    clearVariantFields();
    setDynamicVariantValues({});
  }, [
    variantStock,
    variantColor,
    variantSize,
    variantMaterial,
    variantPrice,
    dynamicVariantEntries,
    dynamicVariantValues,
    variantCtx.sizeFieldLabel,
    variantCtx.materialFieldLabel,
    clearVariantFields,
  ]);

  const handleDeleteVariant = useCallback(variantId => {
    setSavedVariants(prev => prev.filter(item => item.id !== variantId));
  }, []);

  const handlePickerSelect = useCallback(
    raw => {
      const s = String(raw);
      if (picker && variantFields && Object.prototype.hasOwnProperty.call(variantFields, picker)) {
        setDynamicVariantValues(prev => ({ ...prev, [picker]: s }));
        if (picker === 'color') {
          const opt = colorByValue[s];
          setVariantColor(
            opt
              ? { value: opt.value, label: opt.label, color: opt.color }
              : null,
          );
        }
        if (picker === 'size') {
          setVariantSize(s);
        }
        if (picker === 'material') {
          setVariantMaterial(s);
        }
        setVariantError('');
        return;
      }

      switch (picker) {
        case 'category':
          setCategory(s);
          break;
        case 'sub':
          setSubCategory(s);
          break;
        case 'type':
          setProductType(s);
          if (isGenderDrivenCategory(categoryKey)) {
            setSubCategory(s);
          }
          break;
        case 'gender':
          setGender(s);
          break;
        case 'variantColor': {
          const opt = colorByValue[s];
          setVariantColor(
            opt
              ? { value: opt.value, label: opt.label, color: opt.color }
              : null,
          );
          setVariantError('');
          break;
        }
        case 'variantSize':
          setVariantSize(s);
          setVariantError('');
          break;
        case 'variantMaterial':
          setVariantMaterial(s);
          setVariantError('');
          break;
        default:
          break;
      }
    },
    [picker, colorByValue, variantFields, categoryKey],
  );

  const optionPickerProps = useMemo(() => {
    if (!picker) {
      return {
        title: '',
        options: /** @type {string[]} */ ([]),
        formatLabel: (/** @type {string} */ s) => s,
        swatchByValue: undefined,
      };
    }
    if (picker === 'category') {
      return {
        title: 'Category',
        options: categoryRoots,
        formatLabel: formatMvpCategoryLabel,
        swatchByValue: undefined,
      };
    }
    if (picker === 'sub') {
      return {
        title: 'Sub category',
        options: subCategories,
        formatLabel: formatMvpCategoryLabel,
        swatchByValue: undefined,
      };
    }
    if (picker === 'type') {
      return {
        title: 'Type',
        options: typeOptions,
        formatLabel: formatMvpCategoryLabel,
        swatchByValue: undefined,
      };
    }
    if (picker === 'gender') {
      return {
        title: 'Gender',
        options: GENDERS,
        formatLabel: s => s,
        swatchByValue: undefined,
      };
    }
    if (picker === 'variantColor') {
      return {
        title: 'Color',
        options: colorPickerValues,
        formatLabel: v => colorByValue[v]?.label ?? v,
        swatchByValue: colorSwatchByValue,
      };
    }
    if (picker === 'variantSize') {
      return {
        title: variantCtx.sizeFieldLabel,
        options: variantCtx.resolvedSizeOptions,
        formatLabel: s => s,
        swatchByValue: undefined,
      };
    }
    if (picker === 'variantMaterial') {
      return {
        title: variantCtx.materialFieldLabel,
        options: variantCtx.materialStrings,
        formatLabel: s => s,
        swatchByValue: undefined,
      };
    }
    if (variantFields[picker]) {
      return {
        title: picker,
        options: variantFields[picker],
        formatLabel: formatMvpCategoryLabel,
        swatchByValue: undefined,
      };
    }
    return {
      title: '',
      options: /** @type {string[]} */ ([]),
      formatLabel: (/** @type {string} */ s) => s,
      swatchByValue: undefined,
    };
  }, [
    picker,
    categoryRoots,
    subCategories,
    typeOptions,
    colorPickerValues,
    colorByValue,
    colorSwatchByValue,
    variantFields,
    variantCtx.sizeFieldLabel,
    variantCtx.resolvedSizeOptions,
    variantCtx.materialFieldLabel,
    variantCtx.materialStrings,
  ]);

  const onContinueFinalSave = useCallback(async () => {
    const uid = user?.id;
    if (!uid) {
      Alert.alert(
        'Sign in required',
        'Sign in as a vendor to create products.',
      );
      return;
    }
    if (!resolvedShopId) {
      Alert.alert(
        'No shop',
        'Create a shop in settings before adding products.',
      );
      return;
    }
    const brandTrim = brandName.trim();
    // if (!brandTrim) {
    //   Alert.alert('Complete the form', 'Brand name is required.');
    //   return;
    // }
    const qtyCheck = hasVariantsList ? variantStockTotal : 0;
    if (!hasVariantsList || !qtyCheck || qtyCheck <= 0) {
      Alert.alert(
        'Complete the form',
        'Add at least one valid variant with quantity greater than 0.',
      );
      return;
    }

    const priceCheck = hasVariantsList
      ? savedVariants.every(variant => {
          const priceLine = variant.details.find(
            detail => String(detail?.label ?? '').toLowerCase() === 'price',
          );
          const numeric = Number(
            String(priceLine?.value ?? '')
              .replace(/[^\d.]/g, '')
              .replace(/\.(?=.*\.)/g, ''),
          );
          return Number.isFinite(numeric) && numeric > 0;
        })
      : false;
    if (!priceCheck) {
      Alert.alert(
        'Complete the form',
        'Each saved variant must have a valid price greater than 0.',
      );
      return;
    }
    // if (!isPriceValid) {
    //   Alert.alert('Complete the form', 'Enter a valid price.');
    //   return;
    // }

    setSaveSubmitting(true);
    try {
      const { productPayload, inventoryPayload } = buildProductCreatePayloads({
        title,
        description,
        category: categoryKey,
        subCategory,
        type: productType,
        gender,
        brand: brandTrim,
        tags: [],
        savedVariants,
        allowPickup,
        allowDelivery,
        price: getVariantPriceRange(savedVariants),
        // price,
        // quantity,
        continueSelling,
        loadedSpecifications: {},
      });

      productPayload.specifications = {
        ...(productPayload.specifications ?? {}),
        generated_product_id: productId,
      };

      if (Array.isArray(uploadedMedia) && uploadedMedia.length > 0) {
        productPayload.images = uploadedMedia.map(item => item.url);
      }
      productPayload.thumbnail_url =
        thumbnailUrl || (uploadedMedia[0] ? uploadedMedia[0].url : null);
      productPayload.image_folder_id = productId;

      if (editProductId != null) {
        const result = await updateProduct(
          resolvedShopId,
          editProductId,
          uid,
          productPayload,
        );
        const rawProduct = result?.product ?? result ?? {};
        const updatedProductId =
          rawProduct.id ?? rawProduct.product_id ?? editProductId;
        if (updatedProductId == null || Number(updatedProductId) <= 0) {
          throw new Error('Invalid response from server (missing product id).');
        }

        const inventoryRows = Array.isArray(result?.inventory)
          ? result.inventory
          : [];

        if (inventoryRows.length > 0) {
          await Promise.all(
            inventoryRows.map(row =>
              updateInventory(
                resolvedShopId,
                Number(updatedProductId),
                row.id ?? row.inventory_id,
                uid,
                inventoryPayload,
              ),
            ),
          );
        } else {
          await createInventory(
            resolvedShopId,
            Number(updatedProductId),
            uid,
            inventoryPayload,
          );
        }
      } else {
        const data = await createProduct(resolvedShopId, uid, productPayload);
        const rawProduct = data?.product;
        const product =
          rawProduct && typeof rawProduct === 'object'
            ? /** @type {Record<string, unknown>} */ (rawProduct)
            : {};
        const productIdRaw = product.id ?? product.product_id;
        const createdProductId =
          typeof productIdRaw === 'number'
            ? productIdRaw
            : parseInt(String(productIdRaw ?? ''), 10);
        if (
          createdProductId == null ||
          Number.isNaN(Number(createdProductId)) ||
          Number(createdProductId) <= 0
        ) {
          throw new Error('Invalid response from server (missing product id).');
        }
        await createInventory(
          resolvedShopId,
          createdProductId,
          uid,
          inventoryPayload,
        );
      }
      setShowFinishSheet(false);
      Alert.alert('Saved', 'Product is live as active.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert(
        'Save failed',
        e instanceof Error ? e.message : 'Something went wrong.',
      );
    } finally {
      setSaveSubmitting(false);
    }
  }, [
    user?.id,
    resolvedShopId,
    brandName,
    allowPickup,
    allowDelivery,
    hasVariantsList,
    variantStockTotal,
    savedVariants,
    title,
    description,
    categoryKey,
    subCategory,
    productType,
    gender,
    continueSelling,
    uploadedMedia,
    thumbnailUrl,
    productId,
    editProductId,
    navigation,
  ]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: 0 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {/* <View style={styles.header}>
        <TouchableOpacity
          style={styles.backHit}
          onPress={() => navigation.goBack()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="chevron-back" size={26} color="#111111" />
        </TouchableOpacity>
        <Text style={styles.title}>New product</Text>
        <View style={styles.headerSpacer} />
      </View> */}

      {loadingExistingProduct ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#00926e" />
          <Text style={styles.loadingOverlayText}>Loading product details…</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={[styles.scroll, { paddingBottom: 16 }]}
        pointerEvents={mediaUploading || loadingExistingProduct ? 'none' : 'auto'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.label}>Product title</Text>
          <TextInput
            style={styles.input}
            placeholder="Product Title"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={[styles.label, styles.spaceTop]}>
            Product description
          </Text>
          <View style={styles.toolbarRow}>
            <Icon name="text" size={18} color="#111111" />
            <Icon name="text-outline" size={18} color="#111111" />
            <Icon name="remove-outline" size={18} color="#111111" />
            <Icon name="arrow-undo-outline" size={18} color="#111111" />
            <Icon name="arrow-redo-outline" size={18} color="#111111" />
          </View>
          <TextInput
            style={styles.descriptionInput}
            multiline
            textAlignVertical="top"
            placeholder=""
            value={description}
            onChangeText={setDescription}
          />

          <Text style={[styles.label, styles.spaceTop]}>Media</Text>
          <View style={styles.mediaBox}>
            <View style={styles.mediaBtnsRow}>
              <TouchableOpacity
                style={[
                  styles.mediaBtnActive,
                  mediaUploading && styles.mediaBtnDisabled,
                ]}
                activeOpacity={0.88}
                onPress={mediaUploading ? undefined : handlePickMedia}
                disabled={mediaUploading}
              >
                <Text style={styles.mediaBtnActiveText}>
                  {mediaUploading ? 'Uploading…' : 'Upload new'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.mediaBtnGhost,
                  mediaUploading && styles.mediaBtnDisabled,
                ]}
                activeOpacity={0.88}
                onPress={mediaUploading ? undefined : handlePickMedia}
                disabled={mediaUploading}
              >
                <Text style={styles.mediaBtnGhostText}>Select existing</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.mediaHint}>Accepts video and images</Text>
            {mediaUploadError ? (
              <Text style={styles.errorText}>{mediaUploadError}</Text>
            ) : null}
          </View>
          {uploadedMedia.length > 0 ? (
            <View style={styles.uploadedMediaGrid}>
              {uploadedMedia.map(item => (
                <View style={styles.uploadedMediaCard} key={item.id}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.uploadedMediaImage}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.uploadedMediaRemove}
                    onPress={
                      mediaUploading
                        ? undefined
                        : () => handleRemoveMedia(item.id)
                    }
                    disabled={mediaUploading}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Remove media"
                  >
                    <Icon name="close-circle" size={22} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Category</Text>
          <SelectField
            value={formatMvpCategoryLabel(categoryKey)}
            onPress={() => undefined}
            disabled
          />
          <Text style={styles.infoText}>
            <Text style={styles.infoPrefix}>info:</Text>{' '}
            <Text style={styles.infoTextItalic}>
              Category can only be set in the shop settings.
            </Text>
          </Text>
          {isGenderCategory ? (
            <>
              <Text style={[styles.label, styles.spaceTop]}>Gender</Text>
              <SelectField
                value={
                  gender ? formatMvpCategoryLabel(gender) : 'Select gender'
                }
                onPress={() => setPicker('gender')}
              />
            </>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attributes</Text>
          <View style={styles.row}>
            {!isGenderCategory ? (
              <View style={styles.half}>
                <Text style={styles.label}>Sub-Category</Text>
                <SelectField
                  value={
                    subCategory
                      ? formatMvpCategoryLabel(subCategory)
                      : 'Select sub category'
                  }
                  onPress={() => setPicker('sub')}
                  disabled={subCategories.length === 0}
                />
              </View>
            ) : null}
            <View
              style={isGenderCategory ? styles.fullWidthField : styles.half}
            >
              <Text style={styles.label}>Product-Type</Text>
              <SelectField
                value={
                  productType
                    ? formatMvpCategoryLabel(productType)
                    : 'Select type'
                }
                onPress={() =>
                  isGenderCategory
                    ? gender.trim() && setPicker('type')
                    : subCategory.trim() && setPicker('type')
                }
                disabled={
                  isGenderCategory
                    ? !gender.trim() || typeOptions.length === 0
                    : !subCategory.trim() || typeOptions.length === 0
                }
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Options (Variant)</Text>
          <View style={styles.optionHeader}>
            <Icon name="add-circle-outline" size={20} color="#111111" />
            <Text style={styles.optionHeaderText}>
              Add options like color or size.
            </Text>
          </View>
          <Text style={styles.variantFormHint}>
            Quantity and variant price are required. Color, size, and material
            are optional.
          </Text>
          {dynamicVariantEntries.length > 0
            ? dynamicVariantEntries.map(([fieldKey, fieldOptions]) => {
                const displayLabel = formatMvpCategoryLabel(fieldKey);
                const selectedValue =
                  fieldKey === 'color'
                    ? variantColor?.label
                    : fieldKey === 'size'
                      ? variantSize
                      : fieldKey === 'material'
                        ? variantMaterial
                        : dynamicVariantValues[fieldKey];

                return (
                  <View key={fieldKey || `variant-${displayLabel}`}>
                    <VariantFieldLabel title={displayLabel} optional />
                    <SelectField
                      value={
                        selectedValue
                          ? String(selectedValue)
                          : `Select a ${displayLabel.toLowerCase()}`
                      }
                      onPress={() => setPicker(fieldKey)}
                    />
                  </View>
                );
              })
            : null}
          {/* const fieldName = String(variant ?? '').trim();
                const normalized = fieldName.toLowerCase();
                const pickerKey =
                  normalized.includes('color')
                    ? 'variantColor'
                    : normalized.includes('size')
                      ? 'variantSize'
                      : normalized.includes('material')
                        ? 'variantMaterial'
                        : 'variantColor';
                const displayLabel = fieldName ? fieldName.charAt(0).toUpperCase() + fieldName.slice(1) : 'Variant'; */}

          {/* <VariantFieldLabel title="Color" />
          <SelectField
            value={variantColor ? variantColor.label : 'Select a color'}
            onPress={() => setPicker('variantColor')}
            leadingSwatch={variantColor?.color}
          />
          <VariantFieldLabel title={variantCtx.sizeFieldLabel} />
          <SelectField
            value={variantSize || variantCtx.sizePlaceholder}
            onPress={() => setPicker('variantSize')}
          />
          <VariantFieldLabel title={variantCtx.materialFieldLabel} optional />
          <SelectField
            value={variantMaterial || variantCtx.materialPlaceholder}
            onPress={() => setPicker('variantMaterial')}
          />
          <VariantFieldLabel title="Stock" />
          <TextInput
            style={styles.input}
            placeholder="Enter variant stock"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            value={variantStock}
            onChangeText={handleVariantStockChange}
          /> */}

          <VariantFieldLabel title="Quantity" />
          <TextInput
            style={styles.input}
            placeholder="Enter variant quantity"
            placeholderTextColor="#9CA3AF"
            value={variantStock}
            onChangeText={handleVariantStockChange}
          />

          <VariantFieldLabel title="Variant price" />
          <NairaInput
            value={variantPrice}
            onChangeText={handleVariantPriceChange}
            placeholder="Enter variant price"
          />

          {variantError ? (
            <Text style={styles.variantErrorText}>{variantError}</Text>
          ) : null}

          <View style={styles.rowBtnWrap}>
            <TouchableOpacity
              style={[
                styles.addVariantBtn,
                !canAddVariant && styles.addVariantBtnDisabled,
              ]}
              activeOpacity={0.88}
              onPress={handleSaveVariant}
            >
              <Text
                style={[
                  styles.addVariantBtnText,
                  !canAddVariant && styles.addVariantBtnTextDisabled,
                ]}
              >
                Add variant
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.clearBtn}
              activeOpacity={0.88}
              onPress={clearVariantFields}
            >
              <Text style={styles.clearBtnText}>Clear fields</Text>
            </TouchableOpacity>
          </View>

          {savedVariants.length > 0 ? (
            <View style={styles.savedVariants}>
              {savedVariants.map((variant, index) => (
                <View style={styles.savedVariantCard} key={variant.id}>
                  <View style={styles.savedVariantCardTop}>
                    <Text style={styles.savedVariantTitle}>
                      Variant {index + 1}
                    </Text>
                    <TouchableOpacity
                      style={styles.savedVariantDeleteBtn}
                      onPress={() => handleDeleteVariant(variant.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Delete variant"
                      activeOpacity={0.85}
                    >
                      <Text style={styles.savedVariantDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.savedVariantGrid}>
                    {chunkArray(variant.details, 4).map((row, rowIndex) => (
                      <View
                        style={styles.savedVariantGridRow}
                        key={`${variant.id}-row-${rowIndex}`}
                      >
                        {row.map(detail => (
                          <View
                            style={[
                              styles.savedVariantCell,
                              row.length === 1
                                ? styles.savedVariantCellQuarter
                                : styles.savedVariantCellFlex,
                            ]}
                            key={`${variant.id}-${detail.label}`}
                          >
                            <Text style={styles.savedVariantCellLabel}>
                              {String(detail.label).toUpperCase()}
                            </Text>
                            <Text
                              style={styles.savedVariantCellValue}
                              numberOfLines={2}
                            >
                              {detail.value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pricing</Text>
          <Text style={styles.label}>Price</Text>
          <NairaInput
            value={price}
            onChangeText={setPrice}
            placeholder="Product price"
          />
          {price.trim().length > 0 && !isPriceValid ? (
            <Text style={styles.errorText}>Enter a valid price.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Inventory</Text>
          <Text style={styles.label}>Quantity</Text>
          <View style={styles.inventoryRow}>
            <TextInput
              style={styles.qtyInput}
              keyboardType="number-pad"
              value={quantity}
              onChangeText={setQuantity}
            />
          </View>
          <CheckRow
            label="Continue selling when out of stock"
            checked={continueSelling}
            onToggle={() => setContinueSelling(v => !v)}
          />
        </View> */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shipping (Optional)</Text>
          <CheckRow
            label="Fragile (Is this product fragile.)"
            checked={fragile}
            onToggle={() => setFragile(v => !v)}
          />

          <Text style={[styles.label, styles.spaceTop]}>Weight</Text>
          <SuffixInput
            value={weightKg}
            onChangeText={setWeightKg}
            suffix="kg"
          />

          <Text style={[styles.label, styles.spaceTop]}>
            Dimension (Optional)
          </Text>
          <View style={styles.row}>
            <View style={styles.third}>
              <Text style={styles.dimLabel}>Length</Text>
              <SuffixInput
                value={lengthCm}
                onChangeText={setLengthCm}
                suffix="cm"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.dimLabel}>Width</Text>
              <SuffixInput
                value={widthCm}
                onChangeText={setWidthCm}
                suffix="cm"
              />
            </View>
            <View style={styles.third}>
              <Text style={styles.dimLabel}>Height</Text>
              <SuffixInput
                value={heightCm}
                onChangeText={setHeightCm}
                suffix="cm"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <TouchableOpacity
          style={[
            styles.primaryBtnBar,
            (mediaUploading || saveSubmitting) && styles.primaryBtnDisabled,
          ]}
          onPress={mediaUploading ? undefined : onSave}
          activeOpacity={0.88}
          disabled={mediaUploading || saveSubmitting}
        >
          <Text style={styles.primaryBtnText}>Save</Text>
        </TouchableOpacity>
      </View>
      {mediaUploading ? (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.uploadOverlayText}>Uploading images…</Text>
        </View>
      ) : null}
      <Modal transparent visible={showValidationModal} animationType="fade">
        <View style={styles.modalRoot}>
          <View style={styles.validationModalCard}>
            <Text style={styles.validationTitle}>Complete the form</Text>
            <Text style={styles.validationText}>
              Please fill in every required field on this page, including at
              least one valid variant with quantity and price, before saving.
              Shipping is optional and does not need to be completed.
            </Text>
            <TouchableOpacity
              style={styles.validationOkBtn}
              onPress={() => setShowValidationModal(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.validationOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <OptionPickerModal
        visible={picker !== null}
        title={optionPickerProps.title}
        options={optionPickerProps.options}
        formatLabel={optionPickerProps.formatLabel}
        swatchByValue={optionPickerProps.swatchByValue}
        onSelect={handlePickerSelect}
        onClose={() => setPicker(null)}
        insetBottom={insets.bottom}
      />

      <Modal transparent visible={showFinishSheet} animationType="slide">
        <View style={styles.sheetRoot}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setShowFinishSheet(false)}
          />
          <View
            style={[styles.sheetCard, { paddingBottom: insets.bottom + 14 }]}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Finish & save</Text>
              <TouchableOpacity
                onPress={() => setShowFinishSheet(false)}
                hitSlop={8}
              >
                <Icon name="close" size={22} color="#111111" />
              </TouchableOpacity>
            </View>
            {/* <Text style={styles.sheetHint}>
              Add brand and how you deliver. We'll validate the full product
              when you continue.
            </Text>
            <Text style={styles.label}>Product organization</Text>
            <TextInput
              style={styles.input}
              placeholder="Brand name (manufacturer)"
              placeholderTextColor="#9CA3AF"
              value={brandName}
              onChangeText={setBrandName}
            /> */}
            <Text style={[styles.label, styles.spaceTop]}>
              Delivery methods
            </Text>
            <CheckRow
              label="Allow customers to pick up orders from your location"
              checked={allowPickup}
              onToggle={() => setAllowPickup(v => !v)}
            />
            <CheckRow
              label="Deliver orders to the customer's address"
              checked={allowDelivery}
              onToggle={() => setAllowDelivery(v => !v)}
            />
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                saveSubmitting && styles.primaryBtnDisabled,
              ]}
              onPress={() => {
                if (!saveSubmitting) onContinueFinalSave();
              }}
              activeOpacity={0.88}
              disabled={saveSubmitting}
            >
              {saveSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/**
 * @param {{ title: string; optional?: boolean }} p
 */
function VariantFieldLabel({ title, optional }) {
  return (
    <View style={styles.variantLabelRow}>
      <Text style={styles.variantLabelTitle}>{title}</Text>
      <View
        style={[
          styles.variantLabelBadge,
          optional
            ? styles.variantLabelBadgeOptional
            : styles.variantLabelBadgeRequired,
        ]}
      >
        <Text
          style={[
            styles.variantLabelBadgeText,
            optional
              ? styles.variantLabelBadgeTextOptional
              : styles.variantLabelBadgeTextRequired,
          ]}
        >
          {optional ? 'Optional' : 'Required'}
        </Text>
      </View>
    </View>
  );
}

/**
 * @param {{ value: string; onPress: () => void; disabled?: boolean; leadingSwatch?: string }} p
 */
function SelectField({ value, onPress, disabled, leadingSwatch }) {
  return (
    <TouchableOpacity
      style={[styles.selectField, disabled && styles.selectFieldDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.88}
      disabled={disabled}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <View style={styles.selectFieldLeft}>
        {leadingSwatch ? (
          <View
            style={[
              styles.selectSwatch,
              { backgroundColor: leadingSwatch },
              leadingSwatch.toLowerCase() === '#ffffff' &&
                styles.selectSwatchLight,
            ]}
          />
        ) : null}
        <Text
          style={[styles.selectText, disabled && styles.selectTextDisabled]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
      <Icon
        name="chevron-down"
        size={18}
        color={disabled ? '#111111' : '#00926e'}
        style={{ opacity: disabled ? 0.35 : 1 }}
      />
    </TouchableOpacity>
  );
}

/**
 * @param {{
 *   visible: boolean;
 *   title: string;
 *   options: string[];
 *   formatLabel: (raw: string) => string;
 *   swatchByValue?: Record<string, string>;
 *   onSelect: (raw: string) => void;
 *   onClose: () => void;
 *   insetBottom: number;
 * }} p
 */
function OptionPickerModal({
  visible,
  title,
  options,
  formatLabel,
  swatchByValue,
  onSelect,
  onClose,
  insetBottom,
}) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.pickerModalRoot}>
        <Pressable
          style={styles.pickerBackdrop}
          onPress={onClose}
          accessibilityLabel="Dismiss picker"
        />
        <View
          style={[
            styles.pickerSheet,
            { paddingBottom: Math.max(insetBottom, 16) + 12 },
          ]}
        >
          <View style={styles.pickerSheetHeader}>
            <Text style={styles.pickerSheetTitle}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close"
            >
              <Icon name="close" size={24} color="#111111" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item, index) => `${item}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={styles.pickerList}
            renderItem={({ item }) => {
              const swatch = swatchByValue?.[item];
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.pickerRow,
                    pressed && styles.pickerRowPressed,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                >
                  <View style={styles.pickerRowInner}>
                    {swatch ? (
                      <View
                        style={[
                          styles.pickerSwatch,
                          { backgroundColor: swatch },
                          String(swatch).toLowerCase() === '#ffffff' &&
                            styles.pickerSwatchLight,
                        ]}
                      />
                    ) : null}
                    <Text style={styles.pickerRowText}>
                      {formatLabel(item)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.pickerEmpty}>
                No options for this selection.
              </Text>
            }
          />
        </View>
      </View>
    </Modal>
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

function SuffixInput({ value, onChangeText, suffix }) {
  return (
    <View style={styles.suffixWrap}>
      <TextInput
        style={styles.suffixInput}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={onChangeText}
      />
      <View style={styles.suffixBadge}>
        <Text style={styles.suffixText}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  backHit: {
    padding: 4,
    width: 40,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
  },
  headerSpacer: {
    width: 40,
  },
  scrollFlex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  saveBar: {
    paddingTop: 10,
    paddingHorizontal: 8,
    backgroundColor: '#F4F5F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  primaryBtnBar: {
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F0F2F4',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3F3F46',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoText: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  infoPrefix: {
    color: '#5B6470',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  infoTextItalic: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111111',
  },
  descriptionInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111111',
    marginTop: 6,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  mediaBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D6D9DE',
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  mediaBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mediaBtnActive: {
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  mediaBtnDisabled: {
    opacity: 0.45,
  },
  mediaBtnGhost: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F6F7F9',
  },
  mediaBtnActiveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  mediaBtnGhostText: {
    color: '#565D67',
    fontSize: 13,
    fontWeight: '600',
  },
  mediaHint: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  uploadedMediaGrid: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  uploadedMediaCard: {
    width: 100,
    height: 100,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginTop: 12,
  },
  uploadedMediaImage: {
    width: '100%',
    height: '100%',
  },
  uploadedMediaRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 16,
    padding: 2,
  },
  selectField: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    color: '#111111',
    fontSize: 16,
  },
  selectFieldDisabled: {
    opacity: 0.5,
  },
  selectTextDisabled: {
    opacity: 0.65,
  },
  selectFieldLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  selectSwatch: {
    width: 14,
    height: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  selectSwatchLight: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  variantFormHint: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
    marginBottom: 4,
  },
  variantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  variantLabelTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  variantLabelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  variantLabelBadgeOptional: {
    backgroundColor: '#F3F4F6',
  },
  variantLabelBadgeRequired: {
    backgroundColor: '#E0F4EE',
  },
  variantLabelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  variantLabelBadgeTextOptional: {
    color: '#6B7280',
  },
  variantLabelBadgeTextRequired: {
    color: '#00926e',
  },
  variantErrorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#B91C1C',
    fontWeight: '600',
  },
  savedVariants: {
    marginTop: 14,
    gap: 12,
  },
  savedVariantCard: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  savedVariantCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  savedVariantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3F3F46',
  },
  savedVariantDeleteBtn: {
    backgroundColor: '#FCE7E7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  savedVariantDeleteText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  uploadOverlayText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  savedVariantGrid: {
    gap: 8,
  },
  savedVariantGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savedVariantCell: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 72,
    justifyContent: 'flex-start',
  },
  savedVariantCellFlex: {
    flex: 1,
    minWidth: 0,
  },
  savedVariantCellQuarter: {
    width: '24%',
    flexGrow: 0,
  },
  savedVariantCellLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  savedVariantCellValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#18181B',
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '72%',
  },
  pickerSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  pickerSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111111',
  },
  pickerList: {
    flexGrow: 0,
    maxHeight: 400,
  },
  pickerRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  pickerRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerSwatch: {
    width: 14,
    height: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  pickerSwatchLight: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
  },
  pickerRowPressed: {
    backgroundColor: '#E0F4EE',
  },
  pickerRowText: {
    fontSize: 16,
    color: '#111111',
  },
  pickerEmpty: {
    paddingVertical: 24,
    textAlign: 'center',
    color: '#00926e',
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  fullWidthField: {
    flex: 1,
    width: '100%',
  },
  third: {
    flex: 1,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  optionHeaderText: {
    fontSize: 14,
    color: '#52525B',
  },
  currencyWrap: {
    minHeight: 46,
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
    flex: 1,
    fontSize: 16,
    color: '#111111',
    paddingVertical: 10,
  },
  rowBtnWrap: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  addVariantBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#111111',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVariantBtnDisabled: {
    backgroundColor: '#D6DBE2',
    opacity: 1,
  },
  addVariantBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  addVariantBtnTextDisabled: {
    color: '#9CA3AF',
  },
  clearBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  clearBtnText: {
    color: '#2F3540',
    fontSize: 16,
    fontWeight: '600',
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 28,
    color: '#0F172A',
  },
  qtyInput: {
    width: 80,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#BFC4CD',
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 18,
    color: '#111111',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 10,
    borderWidth: 1.5,
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
    color: '#404A57',
  },
  suffixWrap: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#BFC4CD',
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  suffixInput: {
    flex: 1,
    fontSize: 16,
    color: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suffixBadge: {
    minHeight: 44,
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#BFC4CD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  suffixText: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  dimLabel: {
    fontSize: 15,
    color: '#3F3F46',
    marginBottom: 4,
  },
  errorText: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 15,
  },
  spaceTop: {
    marginTop: 12,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#111111',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.75,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  validationModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
  },
  validationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 10,
  },
  validationText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3F3F46',
  },
  validationOkBtn: {
    marginTop: 18,
    minHeight: 50,
    backgroundColor: '#111111',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validationOkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111111',
  },
  sheetHint: {
    marginTop: 6,
    marginBottom: 12,
    color: '#52525B',
    fontSize: 14,
    lineHeight: 21,
  },
});
