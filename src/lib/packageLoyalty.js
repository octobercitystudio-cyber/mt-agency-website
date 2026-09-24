export const monthlyPackageLoyalty = service => {
  if (service?.package_validity_mode === 'shooting_day') return false;
  const category = String(service?.category || service?.service_category || '').trim().toLowerCase();
  return ['monthly', 'month', 'monthly package', 'monthly packages', 'باقة شهرية', 'الباقة الشهرية', 'باقات شهرية', 'الباقات الشهرية'].includes(category)
    || (!category && service?.billing_unit === 'month');
};
