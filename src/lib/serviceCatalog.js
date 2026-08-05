export const CUSTOM_SERVICE_TYPES = [
  { value: 'reels', label: 'تصوير الريلز' },
  { value: 'advertising', label: 'تصوير الإعلانات' },
  { value: 'website', label: 'تصميم المواقع الإلكترونية' },
  { value: 'software', label: 'برامج الكمبيوتر والموبايل والويب' },
  { value: 'podcast', label: 'تصوير البودكاست' },
  { value: 'social_media', label: 'إدارة السوشيال ميديا' },
  { value: 'event_coverage', label: 'تغطية الإيفنتات' },
  { value: 'ai_video', label: 'فيديوهات الذكاء الاصطناعي' },
];

export const isStudioPackageService = service => {
  if (!service) return false;
  const unit = String(service.billing_unit || '').toLowerCase();
  const category = String(service.category || '').trim().toLowerCase();
  return ['hour', 'day', 'month'].includes(unit)
    && (Number(service.total_hours || 0) > 0 || ['studio', 'تصوير بالساعة', 'باقة يومية', 'باقة شهرية'].includes(category));
};

export const customServiceLabel = type => CUSTOM_SERVICE_TYPES.find(item => item.value === type)?.label || 'خدمة مخصصة';
