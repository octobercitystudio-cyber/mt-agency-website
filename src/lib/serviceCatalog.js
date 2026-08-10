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

export { isSellablePackageTemplate as isStudioPackageService } from './clientPackageDraft.js';

export const customServiceLabel = type => CUSTOM_SERVICE_TYPES.find(item => item.value === type)?.label || 'خدمة مخصصة';
