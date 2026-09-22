const { isGenderDrivenCategory, getGenderDrivenTypeOptions } = require('./mvpCategory');

describe('gender-driven category helpers', () => {
  it('detects the category list that should hide sub-category and use gender-driven types', () => {
    expect(isGenderDrivenCategory('apparel & accessories')).toBe(true);
    expect(isGenderDrivenCategory('jewelry & watches & eyewear')).toBe(true);
    expect(isGenderDrivenCategory('shoes & accessories')).toBe(true);
    expect(isGenderDrivenCategory('fashion')).toBe(false);
  });

  it('returns the product types for the selected gender', () => {
    expect(getGenderDrivenTypeOptions('shoes & accessories', 'male')).toContain('sneakers');
    expect(getGenderDrivenTypeOptions('shoes & accessories', 'female')).toContain('heels');
    expect(getGenderDrivenTypeOptions('apparel & accessories', 'female')).toContain('gowns');
    expect(getGenderDrivenTypeOptions('apparel & accessories', 'male')).toContain('t-shirts');
  });
});
