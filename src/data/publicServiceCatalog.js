const entry = (slug, erpServiceType, icon, group, portfolioCategories, ar, en) => ({
  slug, erpServiceType, icon, group, portfolioCategories, ar, en,
});

export const publicServiceCatalog = [
  entry('studio-content-production', 'studio', 'Camera', 'production', ['video'], {
    title: 'تصوير وإنتاج المحتوى داخل الاستديو', navLabel: 'الاستديو وصناعة المحتوى', eyebrow: 'استديوهات مجهزة في القاهرة',
    heroSummary: 'مساحة إنتاج متكاملة لتصوير الكورسات والمحتوى التعليمي وحلقات الخبراء بنظام الساعة أو اليوم أو الباقات الشهرية.',
    introduction: 'نجهز الاستديو والإضاءة والصوت والكادر بما يناسب أسلوبك، ثم ندير يوم التصوير بكفاءة حتى تحصل على مادة واضحة ومتسقة قابلة للنشر.',
    outcomes: ['صورة وصوت ثابتان عبر كل حلقات المحتوى', 'استغلال أفضل لوقت التصوير والميزانية', 'مادة منظمة تسهّل المونتاج والنشر'],
    deliverables: ['تجهيز الاستديو والإضاءة والخلفية', 'تسجيل متعدد الكاميرات عند الحاجة', 'ملفات خام منظمة أو نسخة مونتاج نهائية', 'باقات ساعة ويوم وشهر قابلة للتخصيص'],
    process: ['تحديد شكل المحتوى وعدد الحلقات', 'اختيار الاستديو والتجهيز المناسب', 'خطة يوم التصوير وترتيب السكربتات', 'التصوير ومراجعة الجودة', 'تسليم الخام أو المونتاج'],
    suitableFor: ['المدربين وصناع الكورسات', 'الأطباء والخبراء', 'قنوات يوتيوب والمحتوى الدوري', 'الشركات التي تبني مكتبة تعليمية'],
    faq: [['هل أقل حجز ساعة؟', 'نعم، ثم يمكن احتساب الزيادات بربع أو نصف ساعة حسب الاتفاق.'], ['هل يمكن حجز يوم كامل؟', 'نعم، تتوفر باقات بالساعة واليوم والشهر حسب حجم الإنتاج.'], ['هل المونتاج مشمول؟', 'يمكن تسليم الملفات الخام أو إضافة المونتاج والهوية البصرية حسب نطاق المشروع.']],
    seoTitle: 'استديو تصوير محتوى وكورسات في القاهرة', metaDescription: 'استديو تصوير مجهز للكورسات والمحتوى التعليمي والفيديو الاحترافي بباقات ساعة ويوم وشهر في القاهرة.', keywords: ['استوديو تصوير في القاهرة', 'تصوير كورسات', 'تصوير محتوى تعليمي', 'إيجار استوديو تصوير مجهز'],
  }, {
    title: 'Studio Content Production', navLabel: 'Studio & Content', eyebrow: 'Equipped studios in Cairo',
    heroSummary: 'An end-to-end studio setup for courses, expert-led content and recurring series, available by the hour, day or monthly package.',
    introduction: 'We align the set, lighting, sound and framing with your format, then run an efficient shoot that produces consistent, publication-ready footage.',
    outcomes: ['Consistent picture and sound across episodes', 'Better use of shoot time and budget', 'Organized footage that speeds up editing'],
    deliverables: ['Studio, lighting and set preparation', 'Multi-camera recording when needed', 'Organized raw files or final edits', 'Flexible hourly, daily and monthly packages'],
    process: ['Define the format and episode count', 'Select the studio and setup', 'Plan scripts and the shoot day', 'Record and review quality', 'Deliver raw or edited files'],
    suitableFor: ['Educators and course creators', 'Doctors and subject experts', 'YouTube and recurring content teams', 'Companies building training libraries'],
    faq: [['Is the minimum booking one hour?', 'Yes. Additional time can be calculated in quarter- or half-hour increments by agreement.'], ['Can I book a full production day?', 'Yes. Hourly, daily and monthly packages are available.'], ['Is editing included?', 'You can receive organized raw footage or add editing and visual branding to the scope.']],
    seoTitle: 'Content and Course Filming Studio in Cairo', metaDescription: 'Equipped Cairo studio for courses, educational content and professional video, with hourly, daily and monthly production packages.', keywords: ['Cairo content studio', 'course filming', 'educational video production', 'equipped filming studio'],
  }),
  entry('reels-production', 'reels', 'Smartphone', 'production', ['reels'], {
    title: 'إنتاج الريلز والفيديوهات القصيرة', navLabel: 'تصوير الريلز', eyebrow: 'محتوى قصير يلفت من أول ثانية',
    heroSummary: 'نحوّل أفكارك إلى Reels وTikTok وShorts سريعة وواضحة، من التخطيط والتصوير حتى المونتاج والنسخ الجاهزة للنشر.',
    introduction: 'نبني مجموعة فيديوهات مترابطة تناسب شخصيتك والجمهور والمنصة، بدل إنتاج مقاطع منفصلة بلا اتجاه.',
    outcomes: ['خطاف بصري ورسالة أسرع', 'دفعة محتوى متسقة لأسابيع', 'نسخ مناسبة للمنصات العمودية'],
    deliverables: ['أفكار وسيناريوهات قصيرة', 'جلسة تصوير مخصصة لعدد الريلز', 'مونتاج عمودي وترجمة وحركة نصوص', 'نسخ تسليم جاهزة للنشر'],
    process: ['تحديد الهدف والجمهور', 'بناء قائمة الأفكار والهوكس', 'تحضير وتصوير الدفعة', 'مونتاج ومراجعة', 'تسليم وجدولة اختيارية'],
    suitableFor: ['البراندات والمتاجر', 'الأطباء والخبراء', 'المطاعم والخدمات المحلية', 'صناع المحتوى الشخصي'],
    faq: [['هل التسعير على وقت التصوير؟', 'يتم تخصيص وقت في الجدول، بينما التسعير الأساسي يكون حسب عدد الريلز ونطاق التنفيذ.'], ['هل تكتبون الأفكار؟', 'نعم، يمكن أن تشمل الباقة البحث والأفكار والسيناريوهات القصيرة.'], ['هل تصلح الفيديوهات لكل المنصات؟', 'نسلم مقاسات عمودية مناسبة لـReels وTikTok وShorts مع مراعاة اختلاف كل منصة.']],
    seoTitle: 'تصوير ومونتاج ريلز احترافي', metaDescription: 'إنتاج فيديوهات قصيرة وريلز احترافية للبراندات والخبراء، من الفكرة والتصوير إلى المونتاج الجاهز للنشر.', keywords: ['تصوير ريلز احترافي', 'مونتاج ريلز', 'فيديوهات قصيرة', 'صناعة محتوى سوشيال ميديا'],
  }, {
    title: 'Reels & Short-Form Video Production', navLabel: 'Reels Production', eyebrow: 'Short content that earns attention',
    heroSummary: 'We turn ideas into focused Reels, TikToks and Shorts—from hooks and filming to polished vertical edits ready to publish.',
    introduction: 'We build a connected batch of videos around your voice, audience and platform instead of producing isolated clips without direction.',
    outcomes: ['A stronger first-second hook', 'A consistent content batch for weeks', 'Platform-ready vertical formats'],
    deliverables: ['Short ideas and scripts', 'A planned batch filming session', 'Vertical editing, captions and motion text', 'Exported publish-ready versions'],
    process: ['Define goals and audience', 'Build ideas and hooks', 'Prepare and film the batch', 'Edit and review', 'Deliver with optional scheduling'],
    suitableFor: ['Brands and retailers', 'Doctors and experts', 'Restaurants and local services', 'Personal creators'],
    faq: [['Is pricing based on shoot time?', 'The shoot receives a calendar slot, while the core price is based on reel count and scope.'], ['Do you write the ideas?', 'Yes. Research, ideas and concise scripts can be included.'], ['Will the videos work across platforms?', 'We provide vertical exports for Reels, TikTok and Shorts while respecting platform differences.']],
    seoTitle: 'Professional Reels Production and Editing', metaDescription: 'Short-form video and Reels production for brands and experts, from ideas and filming to publish-ready vertical edits.', keywords: ['professional reels production', 'reels editing', 'short-form video', 'social video production'],
  }),
  entry('commercial-video-production', 'advertising', 'Clapperboard', 'production', ['video'], {
    title: 'إنتاج الفيديوهات والإعلانات التجارية', navLabel: 'تصوير الإعلانات', eyebrow: 'فكرة محسوبة. تنفيذ سينمائي.',
    heroSummary: 'إنتاج إعلان تجاري أو فيديو براند مصمم حول هدف واضح، بميزانية ومعدات وفريق يتوافقون مع متطلبات المشروع.',
    introduction: 'نربط الفكرة بالرسالة والاستخدام النهائي، ثم نبني خطة إنتاج واقعية تشمل التحضير والتصوير والمونتاج والتسليم.',
    outcomes: ['رسالة تجارية مفهومة وقابلة للتذكر', 'شكل بصري يعكس قيمة البراند', 'نسخ متعددة للحملة والمنصات'],
    deliverables: ['معالجة إبداعية وسيناريو', 'خطة تصوير ومعدات وطاقم', 'تصوير المنتج أو الخدمة أو الموقع', 'مونتاج وتصحيح ألوان وصوت', 'نسخ إعلانية بالأبعاد المطلوبة'],
    process: ['الهدف والمعالجة الإبداعية', 'الإعداد والسيناريو وخطة الإنتاج', 'التصوير', 'المونتاج والمراجعات', 'التسليم والنسخ النهائية'],
    suitableFor: ['إطلاق المنتجات', 'حملات العلامات التجارية', 'فيديوهات الشركات', 'الإعلانات الرقمية والتلفزيونية'],
    faq: [['كيف تحدد التكلفة؟', 'حسب المعالجة والمواقع والمعدات والطاقم والممثلين والمخرجات المطلوبة.'], ['هل يمكن تصوير المنتجات؟', 'نعم، من لقطات المنتجات داخل الاستديو إلى قصص استخدام كاملة.'], ['كم تستغرق العملية؟', 'تتحدد المدة بعد اعتماد الفكرة، وتوضح الخطة نقاط المراجعة والتسليم.']],
    seoTitle: 'تصوير وإنتاج إعلانات تجارية', metaDescription: 'إنتاج فيديو دعائي وإعلان تجاري وفيديو براند، من الفكرة والسيناريو إلى التصوير والمونتاج والتسليم.', keywords: ['تصوير إعلانات', 'إنتاج فيديو دعائي', 'إعلان تجاري', 'تصوير منتجات'],
  }, {
    title: 'Commercial Video Production', navLabel: 'Commercial Video', eyebrow: 'A focused idea. Cinematic execution.',
    heroSummary: 'Commercials and brand films built around a clear objective, with the right crew, equipment and production scale for the brief.',
    introduction: 'We connect the idea to the message and final placement, then shape a practical production plan from pre-production through delivery.',
    outcomes: ['A memorable commercial message', 'Visual direction that reflects brand value', 'Multiple campaign and platform versions'],
    deliverables: ['Creative treatment and script', 'Crew, equipment and shoot plan', 'Product, service or location filming', 'Edit, color and sound finishing', 'Campaign-ready aspect ratios'],
    process: ['Objective and creative treatment', 'Script and pre-production', 'Filming', 'Editing and review', 'Final masters and cut-downs'],
    suitableFor: ['Product launches', 'Brand campaigns', 'Corporate films', 'Digital and broadcast advertising'],
    faq: [['How is the budget calculated?', 'It reflects the treatment, locations, equipment, crew, talent and required outputs.'], ['Can you film products?', 'Yes—from controlled studio product shots to complete use-case stories.'], ['How long does production take?', 'The schedule is confirmed after the idea, with clear review and delivery milestones.']],
    seoTitle: 'Commercial and Brand Video Production', metaDescription: 'Commercial, product and brand video production from creative treatment and filming to editing and final campaign delivery.', keywords: ['commercial video production', 'brand film', 'product filming', 'video advertising'],
  }),
  entry('podcast-production', 'podcast', 'Mic2', 'production', ['podcast'], {
    title: 'إنتاج وتصوير البودكاست', navLabel: 'تصوير البودكاست', eyebrow: 'صوت وصورة يليقان بالحوار',
    heroSummary: 'تسجيل بودكاست مرئي بصوت نظيف وكادرات متعددة، مع خيارات المونتاج الكامل واستخراج المقاطع القصيرة.',
    introduction: 'نجهز الشكل البصري ومسارات الصوت والكاميرات قبل التسجيل حتى يركز الضيوف على الحوار ويخرج الموسم بهوية ثابتة.',
    outcomes: ['تسجيل مستقر وواضح للضيوف', 'هوية مرئية متسقة للحلقات', 'حلقة طويلة ومقاطع قصيرة من جلسة واحدة'],
    deliverables: ['إعداد الاستديو والميكروفونات', 'تسجيل صوت وصورة متعدد الكاميرات', 'مونتاج الحلقة وتنظيف الصوت', 'مقدمة وخاتمة وعناوين', 'مقاطع قصيرة اختيارية'],
    process: ['تخطيط الحلقة والشكل', 'تجهيز الاستديو والصوت', 'التسجيل', 'المونتاج والمراجعة', 'الحلقة والمقاطع والتسليم'],
    suitableFor: ['برامج الحوار', 'بودكاست الشركات', 'المقابلات التعليمية', 'المواسم المصورة'],
    faq: [['هل يمكن الحجز بدون مونتاج؟', 'نعم، يمكن حجز وقت الاستديو والتسجيل فقط أو إضافة باقة ما بعد الإنتاج.'], ['كم كاميرا تستخدمون؟', 'يحدد العدد حسب عدد الضيوف والشكل المطلوب للمونتاج.'], ['هل تستخرجون ريلز من الحلقة؟', 'يمكن إضافة حزمة مقاطع قصيرة مترجمة وجاهزة للنشر.']],
    seoTitle: 'استديو وإنتاج بودكاست مرئي', metaDescription: 'تصوير وتسجيل بودكاست صوت وصورة متعدد الكاميرات مع مونتاج الحلقات واستخراج المقاطع القصيرة.', keywords: ['تصوير بودكاست', 'استوديو بودكاست', 'إنتاج بودكاست مرئي', 'مونتاج بودكاست'],
  }, {
    title: 'Video Podcast Production', navLabel: 'Podcast Production', eyebrow: 'Sound and picture worthy of the conversation',
    heroSummary: 'Clean multi-camera video podcast recording with options for full episode editing and social cut-downs.',
    introduction: 'We prepare the set, audio paths and camera coverage before recording so guests can focus on the conversation and the season keeps a consistent identity.',
    outcomes: ['Reliable, clear guest recording', 'A consistent visual identity across episodes', 'Long episodes and short clips from one session'],
    deliverables: ['Studio and microphone setup', 'Multi-camera audio/video recording', 'Episode edit and audio cleanup', 'Titles, intro and outro', 'Optional short clips'],
    process: ['Plan the episode and look', 'Prepare studio and audio', 'Record', 'Edit and review', 'Deliver episode and clips'],
    suitableFor: ['Interview shows', 'Corporate podcasts', 'Educational conversations', 'Filmed podcast seasons'],
    faq: [['Can we book recording without editing?', 'Yes. Book the studio and recording only, or add post-production.'], ['How many cameras are used?', 'Coverage depends on guest count and the preferred editing style.'], ['Can you create Reels from the episode?', 'Yes. Add captioned, publish-ready short clips.']],
    seoTitle: 'Video Podcast Studio and Production', metaDescription: 'Multi-camera video podcast recording with clean audio, episode editing and short social clips.', keywords: ['video podcast studio', 'podcast filming', 'podcast recording', 'podcast editing'],
  }),
  entry('event-coverage', 'event_coverage', 'CalendarRange', 'production', ['video'], {
    title: 'تغطية الفعاليات والمؤتمرات', navLabel: 'تغطية الفعاليات', eyebrow: 'لا نفوّت اللحظة التي تحكي الحدث',
    heroSummary: 'تغطية منظمة للمؤتمرات والافتتاحات والفعاليات، بصور وفيديو highlights ومحتوى سريع للنشر حسب احتياج الحدث.',
    introduction: 'نخطط لنقاط الحدث والشخصيات واللحظات الأساسية قبل وصول الفريق، ثم نتحرك بخفة دون تعطيل تجربة الحضور.',
    outcomes: ['توثيق اللحظات الرئيسية دون فجوات', 'مواد سريعة للاستخدام الإعلامي', 'فيلم highlights يلخص أثر الحدث'],
    deliverables: ['خطة تغطية ومسارات حركة', 'تصوير فيديو وفوتوغرافيا حسب النطاق', 'مقابلات وتصريحات اختيارية', 'فيديو highlights', 'نسخ سريعة للسوشيال ميديا'],
    process: ['قراءة برنامج الحدث', 'تحديد الفريق والمعدات', 'التغطية الميدانية', 'اختيار ومونتاج المواد', 'التسليم السريع والنهائي'],
    suitableFor: ['المؤتمرات والمعارض', 'الافتتاحات وإطلاق المنتجات', 'فعاليات الشركات', 'الحفلات والأنشطة المجتمعية'],
    faq: [['هل توفرون تصويرًا فوتوغرافيًا وفيديو؟', 'يمكن تخصيص الفريق ليغطي أحدهما أو كليهما.'], ['هل يمكن تسليم محتوى أثناء الحدث؟', 'نعم، عند التخطيط المسبق يمكن تجهيز مواد سريعة للنشر في نفس اليوم.'], ['هل التغطية داخل القاهرة فقط؟', 'نحدد الموقع والسفر واللوجستيات ضمن عرض مخصص لكل حدث.']],
    seoTitle: 'تصوير وتغطية فعاليات ومؤتمرات', metaDescription: 'تغطية إيفنتات ومؤتمرات وافتتاحات بالفيديو والصور، مع highlights ومحتوى سريع للسوشيال ميديا.', keywords: ['تصوير فعاليات', 'تغطية إيفنتات', 'تصوير مؤتمرات', 'فيديو highlights'],
  }, {
    title: 'Event & Conference Coverage', navLabel: 'Event Coverage', eyebrow: 'We capture the moments that tell the event',
    heroSummary: 'Planned coverage for conferences, launches and events, with photography, highlight films and rapid social content when required.',
    introduction: 'We map the agenda, people and must-capture moments before the crew arrives, then work discreetly around the attendee experience.',
    outcomes: ['Complete coverage of key moments', 'Fast assets for press and social use', 'A highlight film that carries the event forward'],
    deliverables: ['Coverage plan and crew movement', 'Video and photography by scope', 'Optional interviews and statements', 'Highlight film', 'Fast social-ready cuts'],
    process: ['Review the event program', 'Define crew and equipment', 'Capture on location', 'Select and edit', 'Deliver fast-turnaround and final assets'],
    suitableFor: ['Conferences and exhibitions', 'Openings and product launches', 'Corporate events', 'Celebrations and community programs'],
    faq: [['Do you provide both photo and video?', 'The crew can be scoped for either or both.'], ['Can you deliver during the event?', 'With advance planning, rapid same-day social assets are available.'], ['Do you cover outside Cairo?', 'Location, travel and logistics are included in a custom event quotation.']],
    seoTitle: 'Event and Conference Video Coverage', metaDescription: 'Professional event, conference and launch coverage with photography, highlight films and fast social media content.', keywords: ['event coverage', 'conference filming', 'event photography', 'highlight video'],
  }),
  entry('social-media-management', 'social_media', 'Share2', 'marketing', ['reels', 'design'], {
    title: 'إدارة السوشيال ميديا وصناعة المحتوى', navLabel: 'إدارة السوشيال ميديا', eyebrow: 'حضور مستمر بدل النشر العشوائي',
    heroSummary: 'خطة محتوى وإنتاج وتصميم وإدارة منصات وتقارير أداء، بنطاق مرن يناسب أهداف البراند وعدد القنوات.',
    introduction: 'نربط الرسائل بالمحتوى والتوزيع والقياس في نظام واحد، مع وضوح ما سينشر ولماذا وكيف يتحسن الأداء.',
    outcomes: ['تقويم نشر واضح ومتوازن', 'صوت وهوية متسقان عبر المنصات', 'قرارات مبنية على تقارير قابلة للفهم'],
    deliverables: ['استراتيجية وخطة محتوى', 'كتابة وتصميم البوستات', 'فيديوهات وريلز حسب الباقة', 'إدارة النشر والتفاعل المتفق عليه', 'تقارير وتحليل وإعلانات ممولة اختيارية'],
    process: ['مراجعة البراند والجمهور', 'بناء الخطة والأعمدة', 'الإنتاج والموافقة', 'النشر وإدارة الدورة', 'القياس والتحسين الشهري'],
    suitableFor: ['الشركات الناشئة', 'العيادات والخدمات', 'المطاعم والمتاجر', 'البراندات متعددة المنصات'],
    faq: [['هل كل الباقات متشابهة؟', 'لا، يتغير النطاق حسب عدد المنصات والبوستات والفيديوهات والإعلانات والخدمات المطلوبة.'], ['هل تشمل الإعلانات الممولة؟', 'يمكن إضافة إدارة الحملات وميزانية الإعلان كبند واضح منفصل.'], ['كيف أتابع التنفيذ؟', 'تظهر مراحل العمل والحالة المالية والتحديثات من خلال لوحة العميل.']],
    seoTitle: 'إدارة السوشيال ميديا وصناعة المحتوى', metaDescription: 'إدارة صفحات التواصل الاجتماعي وخطة المحتوى والتصميم والريلز والإعلانات الممولة وتقارير الأداء.', keywords: ['إدارة السوشيال ميديا', 'صناعة المحتوى', 'خطة محتوى', 'تصميم بوستات'],
  }, {
    title: 'Social Media Management', navLabel: 'Social Media', eyebrow: 'A consistent presence, not random posting',
    heroSummary: 'Content strategy, production, design, channel management and reporting in a flexible scope built around your goals.',
    introduction: 'We connect messaging, production, distribution and measurement in one workflow with clear visibility into what is published and why.',
    outcomes: ['A clear, balanced publishing calendar', 'Consistent brand voice across channels', 'Understandable performance-led decisions'],
    deliverables: ['Strategy and content plan', 'Copywriting and post design', 'Reels and videos by package', 'Publishing and agreed community tasks', 'Reporting, analysis and optional paid media'],
    process: ['Audit brand and audience', 'Build pillars and plan', 'Produce and approve', 'Publish and manage', 'Measure and improve monthly'],
    suitableFor: ['Startups', 'Clinics and service brands', 'Restaurants and retailers', 'Multi-platform brands'],
    faq: [['Are all packages the same?', 'No. Scope changes by platforms, post and video volume, ads and support needs.'], ['Are paid ads included?', 'Campaign management and media budget can be added as clear separate items.'], ['How do I follow progress?', 'Project stages, financial status and updates are visible in the client dashboard.']],
    seoTitle: 'Social Media Management and Content', metaDescription: 'Social media management, content planning, design, Reels, paid campaigns and clear performance reporting.', keywords: ['social media management', 'content strategy', 'post design', 'paid social campaigns'],
  }),
  entry('creative-design-branding', 'creative_design', 'Palette', 'marketing', ['design'], {
    title: 'التصميم الإبداعي والهوية البصرية', navLabel: 'التصميم والهوية', eyebrow: 'هوية يمكن تمييزها وتطبيقها',
    heroSummary: 'نبني لغة بصرية عملية للبراند، من الشعار والنظام اللوني إلى تطبيقات السوشيال والمواد الدعائية.',
    introduction: 'التصميم الجيد ليس ملف شعار فقط؛ هو مجموعة قرارات واضحة تجعل كل ظهور للبراند متسقًا وسهل الإنتاج.',
    outcomes: ['تميّز بصري واضح', 'قواعد تقلل العشوائية في التصميم', 'قوالب عملية للاستخدام اليومي'],
    deliverables: ['اتجاه بصري ومودبورد', 'شعار ونظام ألوان وخطوط حسب النطاق', 'دليل استخدام مختصر أو متكامل', 'قوالب سوشيال ومطبوعات اختيارية'],
    process: ['فهم البراند والسوق', 'اتجاهات بصرية', 'تطوير المفهوم المختار', 'تطبيقات ومراجعة', 'تسليم الملفات والدليل'],
    suitableFor: ['براند جديد', 'إعادة تقديم علامة قائمة', 'حملات ومناسبات', 'فرق تحتاج قوالب موحدة'],
    faq: [['هل تقدمون تصميم لوجو فقط؟', 'يمكن تنفيذ شعار مستقل، لكن نوصي بنطاق يوضح الألوان والخطوط والاستخدام.'], ['ما الملفات التي أستلمها؟', 'تحدد الحزمة ملفات الاستخدام الرقمية والطباعة والقوالب المطلوبة.'], ['هل تصممون بوستات شهرية؟', 'نعم، يمكن ربط الهوية بخدمة تصميم محتوى أو إدارة سوشيال ميديا.']],
    seoTitle: 'تصميم هوية بصرية ولوجو وبراندنج', metaDescription: 'تصميم هوية بصرية وشعار ونظام ألوان وقوالب سوشيال ومواد دعائية تساعد البراند على الظهور باتساق.', keywords: ['تصميم هوية بصرية', 'تصميم لوجو', 'براندنج', 'تصميمات سوشيال ميديا'],
  }, {
    title: 'Creative Design & Branding', navLabel: 'Design & Branding', eyebrow: 'A recognizable, usable visual system',
    heroSummary: 'A practical visual language for your brand, from logo and color system to social templates and campaign materials.',
    introduction: 'Good design is not only a logo file. It is a set of clear decisions that keeps every brand appearance consistent and easier to produce.',
    outcomes: ['Clear visual distinction', 'Rules that reduce design inconsistency', 'Practical templates for everyday use'],
    deliverables: ['Visual direction and moodboard', 'Logo, color and type system by scope', 'Concise or full usage guide', 'Optional social templates and print items'],
    process: ['Understand brand and market', 'Explore visual directions', 'Develop the selected concept', 'Apply and review', 'Deliver assets and guide'],
    suitableFor: ['New brands', 'Brand refreshes', 'Campaigns and events', 'Teams that need consistent templates'],
    faq: [['Can you design only a logo?', 'Yes, though a small system covering color, type and usage creates more value.'], ['Which files are delivered?', 'The package defines digital, print and template formats.'], ['Can you design monthly posts?', 'Yes. Branding can connect to ongoing content design or social media management.']],
    seoTitle: 'Brand Identity and Logo Design', metaDescription: 'Logo, visual identity, color system, social templates and campaign design that keep your brand consistent.', keywords: ['brand identity design', 'logo design', 'branding', 'social media design'],
  }),
  entry('web-design-development', 'website', 'MonitorSmartphone', 'digital', ['web'], {
    title: 'تصميم وبرمجة المواقع والمتاجر', navLabel: 'تصميم المواقع', eyebrow: 'موقع واضح وسريع ويخدم الهدف',
    heroSummary: 'تصميم UI/UX وبرمجة مواقع شركات ومتاجر متوافقة مع الموبايل، مع أساس تقني قابل للإدارة والتطوير.',
    introduction: 'نبدأ برحلة المستخدم والمحتوى والهدف التجاري قبل الواجهة، ثم نبني تجربة سريعة وواضحة على الشاشات المختلفة.',
    outcomes: ['مسار واضح للزائر نحو الإجراء', 'تجربة متجاوبة وسريعة', 'أساس قابل للصيانة والنمو'],
    deliverables: ['هيكل ومخططات تجربة المستخدم', 'تصميم واجهة متجاوبة', 'تطوير الصفحات والوظائف', 'تهيئة أساسية لمحركات البحث والأداء', 'تدريب وتسليم حسب المشروع'],
    process: ['الأهداف والمحتوى', 'الهيكل وUX', 'تصميم UI', 'التطوير والاختبار', 'الإطلاق والدعم'],
    suitableFor: ['مواقع الشركات', 'المتاجر الإلكترونية', 'صفحات الحملات', 'منصات المحتوى والخدمات'],
    faq: [['هل الموقع متوافق مع الموبايل؟', 'نعم، التصميم والاختبار يشملان الشاشات الرئيسية من البداية.'], ['هل تقدمون المتاجر؟', 'نعم، نحدد الكتالوج والدفع والشحن والإدارة حسب احتياج المتجر.'], ['هل تشمل الخدمة الاستضافة؟', 'نساعد في الإعداد والربط، وتوضح التكاليف الخارجية بشكل مستقل.']],
    seoTitle: 'تصميم وبرمجة مواقع شركات ومتاجر', metaDescription: 'تصميم UI/UX وبرمجة مواقع ومتاجر سريعة ومتوافقة مع الموبايل ومحركات البحث وقابلة للإدارة.', keywords: ['تصميم مواقع شركات', 'برمجة مواقع', 'متجر إلكتروني', 'تصميم UI/UX'],
  }, {
    title: 'Web Design & Development', navLabel: 'Web Design', eyebrow: 'A clear, fast website built for its goal',
    heroSummary: 'Responsive UI/UX and development for company sites and online stores, built on a maintainable foundation.',
    introduction: 'We begin with the user journey, content and commercial objective before visual design, then build a fast experience across screens.',
    outcomes: ['A clear path to visitor action', 'Fast, responsive user experience', 'A maintainable foundation for growth'],
    deliverables: ['Information architecture and UX flows', 'Responsive interface design', 'Page and feature development', 'Foundational SEO and performance setup', 'Handover and training by scope'],
    process: ['Goals and content', 'Architecture and UX', 'UI design', 'Development and testing', 'Launch and support'],
    suitableFor: ['Company websites', 'Online stores', 'Campaign landing pages', 'Content and service platforms'],
    faq: [['Will the site work on mobile?', 'Yes. Responsive design and testing are part of the process from the start.'], ['Do you build online stores?', 'Yes. Catalog, payment, shipping and administration are scoped to the store.'], ['Is hosting included?', 'We support setup and connection, while external costs are listed separately.']],
    seoTitle: 'Company Website and E-commerce Development', metaDescription: 'Responsive UI/UX, company website and e-commerce development focused on speed, clarity and maintainability.', keywords: ['company website design', 'web development', 'ecommerce website', 'responsive UI UX'],
  }),
  entry('software-development', 'software', 'Code2', 'digital', ['web'], {
    title: 'تطوير البرامج وتطبيقات الويب والموبايل', navLabel: 'تطوير البرامج', eyebrow: 'نظام مبني على طريقة عملك',
    heroSummary: 'تطبيقات ويب وموبايل وبرامج إدارة وERP وCRM مصممة حول العمليات الفعلية بدل إجبار الفريق على نظام جامد.',
    introduction: 'نحوّل الخطوات والبيانات والصلاحيات إلى منتج قابل للاستخدام والقياس، مع مراحل واضحة من التحليل حتى الإطلاق.',
    outcomes: ['تقليل العمل اليدوي والتكرار', 'بيانات وصلاحيات أوضح', 'تجربة تناسب الفريق والعملاء'],
    deliverables: ['تحليل العمليات والمتطلبات', 'تصميم تجربة وواجهات', 'تطوير النظام والتكاملات', 'اختبارات وأمان وصلاحيات', 'إطلاق وتدريب ودعم متفق عليه'],
    process: ['اكتشاف وتحليل', 'تحديد النطاق والنموذج', 'تصميم وتطوير مرحلي', 'اختبار وقبول', 'إطلاق وتحسين'],
    suitableFor: ['أنظمة ERP وCRM', 'بوابات العملاء', 'تطبيقات ويب وموبايل', 'أدوات داخلية حسب الطلب'],
    faq: [['هل تطورون نظامًا من الصفر؟', 'نعم، بعد تحليل العمليات وتحديد الأولويات والمراحل.'], ['كيف أتابع التنفيذ؟', 'نقسم العمل إلى مراحل ومخرجات قابلة للمراجعة قبل الانتقال للمرحلة التالية.'], ['هل تقدمون صيانة؟', 'يحدد عرض المشروع فترة الضمان والدعم والتطوير اللاحق.']],
    seoTitle: 'برمجة تطبيقات وأنظمة ERP وCRM', metaDescription: 'تطوير تطبيقات ويب وموبايل وبرامج إدارة شركات وأنظمة ERP وCRM وحلول مخصصة حسب العمليات.', keywords: ['برمجة تطبيقات موبايل', 'تطوير تطبيقات ويب', 'أنظمة ERP وCRM', 'برامج حسب الطلب'],
  }, {
    title: 'Custom Software Development', navLabel: 'Software Development', eyebrow: 'Software shaped around your operation',
    heroSummary: 'Web and mobile apps, management software, ERP and CRM solutions designed around real workflows rather than rigid templates.',
    introduction: 'We translate steps, data and permissions into a usable, measurable product with clear stages from discovery to launch.',
    outcomes: ['Less repetitive manual work', 'Clearer data and permissions', 'An experience shaped for teams and clients'],
    deliverables: ['Process and requirements analysis', 'UX and interface design', 'System and integration development', 'Testing, security and permissions', 'Launch, training and agreed support'],
    process: ['Discovery and analysis', 'Scope and prototype', 'Iterative design and development', 'Testing and acceptance', 'Launch and improvement'],
    suitableFor: ['ERP and CRM systems', 'Client portals', 'Web and mobile apps', 'Custom internal tools'],
    faq: [['Can you build a system from scratch?', 'Yes, after mapping operations, priorities and delivery phases.'], ['How is progress reviewed?', 'Work is divided into reviewable stages and outputs.'], ['Do you provide maintenance?', 'The proposal defines warranty, support and future development.']],
    seoTitle: 'Custom App, ERP and CRM Development', metaDescription: 'Custom web and mobile apps, company management software, ERP and CRM systems designed around your workflow.', keywords: ['mobile app development', 'web application development', 'ERP CRM systems', 'custom software'],
  }),
  entry('ai-video-production', 'ai_video', 'WandSparkles', 'digital', ['video'], {
    title: 'إنتاج فيديوهات بالذكاء الاصطناعي', navLabel: 'فيديو الذكاء الاصطناعي', eyebrow: 'خيال أوسع دون فقدان الهدف',
    heroSummary: 'فيديوهات إعلانية وشرح منتجات وأفاتار وتعليق صوتي باستخدام أدوات AI ضمن معالجة إبداعية ومراجعة بشرية.',
    introduction: 'نختار التقنية المناسبة للفكرة بدل استخدام الذكاء الاصطناعي كغرض بصري فقط، ثم نوحد الأسلوب والصوت والحركة في نتيجة قابلة للنشر.',
    outcomes: ['تنفيذ أفكار يصعب تصويرها تقليديًا', 'نسخ ولغات وأشكال متعددة بكفاءة', 'اتجاه بصري متسق ومراجع بشريًا'],
    deliverables: ['معالجة وسيناريو وstoryboard', 'توليد مشاهد أو أفاتار حسب المشروع', 'تعليق صوتي وموسيقى مرخصة حسب النطاق', 'مونتاج وتصحيح واتساق بصري', 'نسخ نهائية للمنصات'],
    process: ['تحديد الاستخدام والحدود', 'اختبار الأسلوب والمشهد المرجعي', 'الإنتاج والتوليد', 'المونتاج والمراجعة البشرية', 'التسليم والنسخ'],
    suitableFor: ['إعلانات مفاهيمية', 'شرح المنتجات والخدمات', 'أفاتار ومقدم رقمي', 'محتوى متعدد اللغات'],
    faq: [['هل كل الفيديو مولد بالذكاء الاصطناعي؟', 'قد يكون مولدًا بالكامل أو مزيجًا من تصوير وتصميم وAI حسب الهدف.'], ['هل يمكن استخدام أفاتار؟', 'نعم، بعد تحديد الشكل والصوت وحقوق الاستخدام المناسبة.'], ['كيف تحافظون على الاتساق؟', 'نعتمد أسلوبًا مرجعيًا ونراجع المشاهد والمونتاج بشريًا قبل التسليم.']],
    seoTitle: 'صناعة فيديو بالذكاء الاصطناعي', metaDescription: 'إنتاج فيديو إعلاني AI وأفاتار رقمي وتعليق صوتي وفيديوهات منتجات، مع معالجة إبداعية ومراجعة بشرية.', keywords: ['صناعة فيديو بالذكاء الاصطناعي', 'فيديو إعلاني AI', 'أفاتار رقمي', 'تعليق صوتي AI'],
  }, {
    title: 'AI Video Production', navLabel: 'AI Video', eyebrow: 'A wider visual canvas with a clear purpose',
    heroSummary: 'AI-assisted ads, product explainers, avatars and voiceovers shaped by a creative treatment and human review.',
    introduction: 'We select the technology around the idea—not as a visual gimmick—then unify style, voice and motion into a publishable result.',
    outcomes: ['Execute concepts difficult to film traditionally', 'Create versions, languages and formats efficiently', 'Maintain a consistent, human-reviewed direction'],
    deliverables: ['Treatment, script and storyboard', 'Generated scenes or avatar by scope', 'Voiceover and appropriately licensed music', 'Editing, correction and visual consistency', 'Platform-ready masters'],
    process: ['Define use and boundaries', 'Test style and reference scene', 'Produce and generate', 'Edit and review manually', 'Deliver versions'],
    suitableFor: ['Concept advertising', 'Product and service explainers', 'Digital presenters and avatars', 'Multi-language content'],
    faq: [['Is the whole video AI-generated?', 'It may be fully generated or combine filming, design and AI based on the objective.'], ['Can we use a digital avatar?', 'Yes, after agreeing on appearance, voice and usage rights.'], ['How do you keep it consistent?', 'We approve a reference style and manually review scenes and the final edit.']],
    seoTitle: 'AI Video, Avatar and Product Content', metaDescription: 'AI-assisted commercial video, digital avatars, voiceover and product content with creative direction and human quality review.', keywords: ['AI video production', 'AI commercial video', 'digital avatar', 'AI voiceover'],
  }),
];

// The order is deliberate: studio-led production first, then campaign and digital delivery services.
export const publicServiceGroups = [
  { id: 'production', ar: 'الإنتاج والاستديوهات', en: 'Production & Studios' },
  { id: 'marketing', ar: 'التسويق والهوية', en: 'Marketing & Brand' },
  { id: 'digital', ar: 'المنتجات الرقمية', en: 'Digital Products' },
];

export const getPublicService = slug => publicServiceCatalog.find(service => service.slug === slug) || null;

const normalizedSlugs = item => Array.isArray(item?.serviceSlugs) ? item.serviceSlugs.filter(Boolean) : [];
const titleText = item => `${item?.title || ''} ${item?.titleEn || ''}`.toLowerCase();
const normalizedCategory = item => String(item?.category || '').trim().toLowerCase();
const categoryIn = (category, values) => values.includes(category);

export const portfolioMatchesService = (item, serviceOrSlug) => {
  const slug = typeof serviceOrSlug === 'string' ? serviceOrSlug : serviceOrSlug?.slug;
  if (!slug) return false;
  const explicit = normalizedSlugs(item);
  if (explicit.length) return explicit.includes(slug);
  const category = normalizedCategory(item);
  if (category === 'reels') return ['reels-production', 'social-media-management'].includes(slug);
  if (category === 'podcast') return slug === 'podcast-production';
  if (categoryIn(category, ['تغطية فعاليات', 'event', 'events', 'event_coverage', 'event-coverage'])) return slug === 'event-coverage';
  if (categoryIn(category, ['محتوى تعليمي', 'educational', 'educational-content', 'studio', 'course'])) return slug === 'studio-content-production';
  if (category === 'design') return ['creative-design-branding', 'social-media-management'].includes(slug);
  if (category === 'web') {
    const softwareEvidence = ['تطبيق', 'نظام', 'بوابة', 'برنامج', 'erp', 'crm', 'portal', 'dashboard', 'software', 'mobile app', 'web app'];
    const isSoftware = softwareEvidence.some(token => titleText(item).includes(token));
    return slug === (isSoftware ? 'software-development' : 'web-design-development');
  }
  if (category !== 'video') return false;
  const title = titleText(item);
  const evidence = {
    'event-coverage': ['فعالية', 'إيفنت', 'مؤتمر', 'event', 'conference', 'افتتاح'],
    'studio-content-production': ['استديو', 'studio', 'كورس', 'course', 'تعليمي', 'educational', 'محتوى'],
    'ai-video-production': ['ذكاء اصطناعي', 'ai ', 'artificial', 'avatar', 'أفاتار'],
  };
  const specializedService = Object.entries(evidence).find(([, tokens]) => tokens.some(token => title.includes(token)))?.[0];
  return slug === (specializedService || 'commercial-video-production');
};

export const getServicePortfolio = (items, serviceOrSlug) => (Array.isArray(items) ? items : []).filter(item => portfolioMatchesService(item, serviceOrSlug));

export const publicServiceSlugs = publicServiceCatalog.map(service => service.slug);
