export const PROJECT_STAGE_TEMPLATES = {
  reels: [
    ['reels_brief', 'الأفكار والسيناريوهات'],
    ['reels_preparation', 'التحضير وتأكيد الحجز'],
    ['reels_shooting', 'التصوير'],
    ['reels_editing', 'المونتاج'],
    ['reels_review', 'مراجعة العميل'],
    ['reels_delivery', 'التسليم النهائي'],
  ],
  advertising: [
    ['advertising_brief', 'التحضير والفكرة الإعلانية'],
    ['advertising_preproduction', 'ما قبل الإنتاج والتجهيزات'],
    ['advertising_shooting', 'التصوير'],
    ['advertising_post', 'المونتاج والألوان والصوت'],
    ['advertising_review', 'مراجعة العميل'],
    ['advertising_delivery', 'التسليم النهائي'],
  ],
  website: [
    ['website_discovery', 'الاستكشاف وجمع المتطلبات'],
    ['website_ux', 'خريطة الموقع وتجربة الاستخدام'],
    ['website_design', 'تصميم الواجهات'],
    ['website_development', 'التطوير'],
    ['website_testing', 'الاختبار ومراجعة العميل'],
    ['website_launch', 'الإطلاق والتسليم'],
  ],
  software: [
    ['software_requirements', 'تحليل المتطلبات'],
    ['software_architecture', 'المعمارية والنموذج الأولي'],
    ['software_development', 'التطوير'],
    ['software_qa', 'ضمان الجودة والاختبار'],
    ['software_acceptance', 'قبول العميل'],
    ['software_deployment', 'النشر والتسليم'],
  ],
  podcast: [
    ['podcast_preparation', 'تحضير الحلقة'],
    ['podcast_booking', 'تجهيز الاستوديو والحجز'],
    ['podcast_recording', 'التسجيل'],
    ['podcast_editing', 'المونتاج والمعالجة الصوتية'],
    ['podcast_review', 'مراجعة العميل'],
    ['podcast_delivery', 'التسليم والنشر'],
  ],
  social_media: [
    ['social_strategy', 'الاستراتيجية والمتطلبات'],
    ['social_calendar', 'تقويم المحتوى'],
    ['social_production', 'الإنتاج والتصميم'],
    ['social_approval', 'اعتماد العميل'],
    ['social_publishing', 'الجدولة والنشر'],
    ['social_reporting', 'التقرير والنتائج'],
  ],
  event_coverage: [
    ['event_brief', 'الملخص وجدول الفعالية'],
    ['event_logistics', 'اللوجستيات والتجهيزات'],
    ['event_coverage', 'التغطية المباشرة'],
    ['event_post', 'الاختيار وما بعد الإنتاج'],
    ['event_review', 'مراجعة العميل'],
    ['event_delivery', 'التسليم النهائي'],
  ],
  ai_video: [
    ['ai_concept', 'الفكرة والسيناريو'],
    ['ai_styleframes', 'الهوية البصرية والمراجع'],
    ['ai_generation', 'الإنتاج بالذكاء الاصطناعي'],
    ['ai_editing', 'المونتاج والصوت'],
    ['ai_review', 'مراجعة العميل'],
    ['ai_delivery', 'التسليم النهائي'],
  ],
};

export const getProjectStageTemplate = (serviceType, { editingIncluded = true } = {}) =>
  (PROJECT_STAGE_TEMPLATES[serviceType] || [
    ['custom_requirements', 'اعتماد المتطلبات'], ['custom_execution', 'التنفيذ'],
    ['custom_review', 'المراجعة'], ['custom_delivery', 'التسليم النهائي'],
  ])
    .filter(([key]) => editingIncluded || key !== 'podcast_editing')
    .map(([key, title], index) => ({ key, title, sort_order: index }));
