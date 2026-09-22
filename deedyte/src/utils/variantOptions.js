/**
 * Variant option resolution (shoe / clothing / food / default sizes, materials, clothing subtypes).
 * Ported from web create-product Variant component.
 */

export const SIZE_TYPE_OPTIONS = [
  {
    key: 'shoes',
    label: 'Shoe sizes',
    options: Array.from({ length: 25 }, (_, index) => String(index + 36)),
  },
  {
    key: 'clothing',
    label: 'Clothing sizes',
    options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  },
  {
    key: 'food',
    label: 'Food sizes',
    options: ['Small', 'Medium', 'Large'],
  },
  {
    key: 'default',
    label: 'General sizes',
    options: ['One Size', 'Small', 'Medium', 'Large', 'Extra Large'],
  },
];

export const CLOTHING_SUBTYPE_OPTIONS = [
  {
    key: 'trousers',
    label: 'Trousers',
    options: Array.from({ length: 23 }, (_, index) => String(index + 28)),
  },
  {
    key: 'shorts',
    label: 'Shorts',
    options: Array.from({ length: 23 }, (_, index) => String(index + 28)),
  },
  {
    key: 'shirt',
    label: 'Shirt',
    options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  },
  {
    key: 'gown',
    label: 'Gown',
    options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  },
  {
    key: 'skirt',
    label: 'Skirt',
    options: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'],
  },
];

export const MATERIAL_OPTIONS = {
  clothing: ['Cotton', 'Polyester', 'Wool', 'Linen', 'Denim', 'Silk'],
  shoes: ['Leather', 'Canvas', 'Mesh', 'Rubber', 'Suede'],
  food: ['Bottle', 'Can', 'Box', 'Pack', 'Plate'],
  default: ['Cotton', 'Polyester', 'Leather', 'Plastic', 'Paper'],
};

export function getSizeTypeConfig(sizeTypeKey) {
  return (
    SIZE_TYPE_OPTIONS.find((item) => item.key === sizeTypeKey) ??
    SIZE_TYPE_OPTIONS.find((item) => item.key === 'default')
  );
}

export function getClothingSubtypeConfig(subTypeKey) {
  return CLOTHING_SUBTYPE_OPTIONS.find((item) => item.key === subTypeKey) ?? null;
}

export function resolveSizeOptions({ category = '', subCategory = '', type = '' } = {}) {
  const labels = [type, subCategory, category]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const matches = (keywords) =>
    labels.some((label) => keywords.some((keyword) => label.includes(keyword)));

  if (
    matches([
      'shoe',
      'shoes',
      'sneaker',
      'sneakers',
      'boot',
      'boots',
      'sandal',
      'sandals',
      'slipper',
      'slippers',
      'foot wear',
      'footwear',
      'palms',
      'cotina',
    ])
  ) {
    return {
      key: 'shoes',
      label: 'Shoe sizes',
      options: getSizeTypeConfig('shoes').options,
    };
  }

  if (
    matches([
      'pizza',
      'shawarma',
      'sharwarma',
      'sharwama',
      'burger',
      'food',
      'meal',
      'snack',
      'snacks',
      'drink',
      'drinks',
      'beverage',
      'beverages',
    ])
  ) {
    return {
      key: 'food',
      label: 'Food sizes',
      options: getSizeTypeConfig('food').options,
    };
  }

  if (
    matches([
      'cloth',
      'clothing',
      'skirt',
      'gown',
      'dress',
      'top',
      'trouser',
      'trousees',
      'underwear',
      'sports-wear',
      'swim-suit',
      'shirt',
      't-shirt',
      'jacket',
      'hoodie',
    ])
  ) {
    return {
      key: 'clothing',
      label: 'Clothing sizes',
      options: getSizeTypeConfig('clothing').options,
    };
  }

  return {
    key: 'default',
    label: 'General sizes',
    options: getSizeTypeConfig('default').options,
  };
}

export function resolveClothingSubType({ category = '', subCategory = '', type = '' } = {}) {
  const labels = [type, subCategory, category]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  const matches = (keywords) =>
    labels.some((label) => keywords.some((keyword) => label.includes(keyword)));

  if (matches(['trouser', 'trousees', 'pants'])) {
    return 'trousers';
  }

  if (matches(['short', 'shorts', 'nicker'])) {
    return 'shorts';
  }

  if (matches(['shirt', 't-shirt', 'top', 'hoodie', 'jacket'])) {
    return 'shirt';
  }

  if (matches(['gown', 'dress'])) {
    return 'gown';
  }

  if (matches(['skirt'])) {
    return 'skirt';
  }

  return '';
}

export function buildColorOptionsFromJson(colors) {
  if (!Array.isArray(colors)) return [];
  return colors.map(({ name, code }) => ({
    value: String(name).toLowerCase(),
    label: name,
    color: code,
  }));
}

export function materialStringsForSizeKey(sizeKey) {
  return MATERIAL_OPTIONS[sizeKey] ?? MATERIAL_OPTIONS.default;
}

export const priceFormatter = new Intl.NumberFormat('en-NG');

export function formatPriceInput(value) {
  const normalizedValue = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');

  if (!normalizedValue) {
    return '';
  }

  const [integerPart = '', decimalPart] = normalizedValue.split('.');
  const formattedInteger = integerPart
    ? priceFormatter.format(Number(integerPart))
    : '0';

  return decimalPart !== undefined
    ? `${formattedInteger}.${decimalPart}`
    : formattedInteger;
}

export function createEmptyVariantDraft() {
  return {
    color: null,
    size: '',
    material: '',
    price: '',
    stock: '',
  };
}

export function buildVariantSnapshot({
  color,
  size,
  material,
  price,
  stock,
  sizeDetailLabel,
  materialDetailLabel,
}) {
  return [
    color?.label && { label: 'Color', value: color.label },
    size && { label: sizeDetailLabel || 'Size', value: size },
    material && { label: materialDetailLabel || 'Material', value: material },
    price && { label: 'Price', value: `₦${price}` },
    stock && { label: 'Stock', value: String(stock) },
  ].filter(Boolean);
}
