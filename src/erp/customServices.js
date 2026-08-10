import {
  CalendarCheck2, Clapperboard, Code2, Globe2, Megaphone,
  Mic2, Share2, Sparkles,
} from 'lucide-react';

export const CUSTOM_SERVICES = {
  reels: { label: 'إنتاج الريلز', hint: 'السعر لكل ريل', icon: Clapperboard, unit: 'ريل', pricing: ['per_reel', 'custom'] },
  advertising: { label: 'إنتاج إعلاني', hint: 'عرض ثابت حسب المتطلبات', icon: Megaphone, unit: 'مشروع', pricing: ['custom', 'equipment'] },
  website: { label: 'تصميم موقع', hint: 'سعر ثابت للمشروع', icon: Globe2, unit: 'موقع', pricing: ['project', 'custom'] },
  software: { label: 'تطوير برمجيات', hint: 'نطاق وتسعير مخصص', icon: Code2, unit: 'تطبيق', pricing: ['project', 'custom'] },
  podcast: { label: 'إنتاج بودكاست', hint: 'السعر لكل ساعة تصوير', icon: Mic2, unit: 'ساعة تصوير', pricing: ['hourly', 'custom'] },
  social_media: { label: 'إدارة سوشيال', hint: 'باقة شهرية أو مخصصة', icon: Share2, unit: 'شهر', pricing: ['monthly', 'custom'] },
  event_coverage: { label: 'تغطية فعالية', hint: 'حسب التجهيزات والموعد', icon: CalendarCheck2, unit: 'فعالية', pricing: ['custom', 'project'] },
  ai_video: { label: 'فيديو بالذكاء الاصطناعي', hint: 'لكل فيديو أو إنتاج مخصص', icon: Sparkles, unit: 'فيديو', pricing: ['per_video', 'custom'] },
  custom: { label: 'خدمة مخصصة', hint: 'مرنة بالكامل حسب احتياج العميل', icon: Sparkles, unit: 'مشروع', pricing: ['custom'] },
};

export const serviceMeta = type => CUSTOM_SERVICES[type] || {
  label: 'خدمة مخصصة', hint: 'تسعير مخصص', icon: Sparkles, unit: 'وحدة', pricing: ['custom'],
};
