export const CUSTOM_CATEGORY_VALUE = '__custom_category__';

export const FIXED_SERVICE_CATEGORIES = [
  { value: 'تصوير بالساعة', label: 'تصوير بالساعة', unit: 'hour', timer: 1, tone: 'studio' },
  { value: 'باقة يومية', label: 'باقة يومية', unit: 'hour', timer: 1, tone: 'studio' },
  { value: 'باقة شهرية', label: 'باقة شهرية', unit: 'hour', timer: 1, tone: 'studio' },
  { value: 'باقة ريلز', label: 'باقة ريلز', unit: 'reel', timer: 1, tone: 'reels' },
  { value: 'جرافيك', label: 'جرافيك', unit: 'project', timer: 0, tone: 'graphics' },
  { value: 'مونتاج', label: 'مونتاج', unit: 'project', timer: 0, tone: 'montage' },
];

export const RETIRED_SERVICE_CATEGORIES = ['خدمة إضافية', 'خدمات إضافية (جرافيك وغيرها)'];
const reservedCategories = new Set([
  ...FIXED_SERVICE_CATEGORIES.map(item => item.value),
  ...RETIRED_SERVICE_CATEGORIES,
  'تصنيف مخصص',
]);

export const isFixedServiceCategory = category => FIXED_SERVICE_CATEGORIES.some(item => item.value === String(category || '').trim());
export const isProjectServiceCategory = category => ['جرافيك', 'مونتاج'].includes(String(category || '').trim()) || !isFixedServiceCategory(category);

export const categoryEditorValue = category => isFixedServiceCategory(category) ? String(category).trim() : CUSTOM_CATEGORY_VALUE;
export const categoryCustomValue = category => isFixedServiceCategory(category) ? '' : String(category || '').trim();

export const validateCustomCategory = value => {
  const category = String(value || '').trim().replace(/\s+/g, ' ');
  if (category.length < 2 || category.length > 80) return 'اسم التصنيف المخصص يجب أن يكون من 2 إلى 80 حرفًا.';
  if (!/[\p{L}\p{N}]/u.test(category)) return 'اكتب اسم تصنيف واضحًا يحتوي على حروف أو أرقام.';
  if (reservedCategories.has(category)) return 'هذا الاسم محجوز أو متوقف؛ اختر التصنيف من القائمة أو اكتب اسمًا مختلفًا.';
  return '';
};

export const resolveServiceCategory = (selection, customValue = '') => {
  if (selection !== CUSTOM_CATEGORY_VALUE) return { category: String(selection || '').trim(), error: '' };
  const category = String(customValue || '').trim().replace(/\s+/g, ' ');
  return { category, error: validateCustomCategory(category) };
};

export const applyCategoryDefaults = (form, selection) => {
  const fixed = FIXED_SERVICE_CATEGORIES.find(item => item.value === selection);
  const projectStyle = selection === CUSTOM_CATEGORY_VALUE || ['جرافيك', 'مونتاج'].includes(selection);
  if (projectStyle) return { ...form, categorySelection: selection, billing_unit: 'project', auto_start_timer: 0, total_hours: 0, payment_due_hours: 0, total_reels: 0 };
  if (!fixed) return { ...form, categorySelection: selection };
  return { ...form, categorySelection: selection, billing_unit: fixed.unit, auto_start_timer: fixed.timer };
};

export const buildServiceCategoryGroups = services => {
  const categories = [...FIXED_SERVICE_CATEGORIES.map(item => item.value)];
  for (const service of services || []) {
    const category = String(service.category || '').trim() || 'غير مصنف';
    if (!categories.includes(category)) categories.push(category);
  }
  return categories.map(category => ({
    value: category,
    label: category,
    tone: FIXED_SERVICE_CATEGORIES.find(item => item.value === category)?.tone || 'custom',
    services: (services || []).filter(service => (String(service.category || '').trim() || 'غير مصنف') === category),
  }));
};

export const activeServiceCategories = services => buildServiceCategoryGroups((services || []).filter(service => Number(service.is_active ?? 1) === 1 && !service.archived_at));

export const serviceUsesProjectFields = selection => selection === CUSTOM_CATEGORY_VALUE || ['جرافيك', 'مونتاج'].includes(selection);
