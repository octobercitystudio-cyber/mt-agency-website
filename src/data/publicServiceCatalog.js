const entry = (slug, erpServiceType, icon, group, portfolioCategories, heroImage, ar, en) => ({
  slug, erpServiceType, icon, group, portfolioCategories, heroImage, ar, en,
});

export const publicServiceCatalog = [
  entry('studio-content-production', 'studio', 'Camera', 'production', ['video'], '/service-heroes/studio-content-production.webp', {
    title: 'تصوير وإنتاج المحتوى داخل الاستديو', navLabel: 'الاستديو وصناعة المحتوى', eyebrow: 'استديوهات مجهزة في القاهرة',
    heroSummary: 'مساحة إنتاج متكاملة لتصوير الكورسات والمحتوى التعليمي وحلقات الخبراء بنظام الساعة أو اليوم أو الباقات الشهرية.',
    heroAlt: 'مجسم ثلاثي الأبعاد لاستديو محتوى مجهز بكاميرا سينمائية وإضاءة وشاشة إنتاج.',
    introduction: 'نجهز الاستديو والإضاءة والصوت والكادر بما يناسب أسلوبك، ثم ندير يوم التصوير بكفاءة حتى تحصل على مادة واضحة ومتسقة قابلة للنشر.',
    outcomes: ['صورة وصوت ثابتان عبر كل حلقات المحتوى', 'استغلال أفضل لوقت التصوير والميزانية', 'مادة منظمة تسهّل المونتاج والنشر'],
    deliverables: ['تجهيز الاستديو والإضاءة والخلفية', 'تسجيل متعدد الكاميرات عند الحاجة', 'ملفات خام منظمة أو نسخة مونتاج نهائية', 'باقات ساعة ويوم وشهر قابلة للتخصيص'],
    process: ['تحديد شكل المحتوى وعدد الحلقات', 'اختيار الاستديو والتجهيز المناسب', 'خطة يوم التصوير وترتيب السكربتات', 'التصوير ومراجعة الجودة', 'تسليم الخام أو المونتاج'],
    suitableFor: ['المدربين وصناع الكورسات', 'الأطباء والخبراء', 'قنوات يوتيوب والمحتوى الدوري', 'الشركات التي تبني مكتبة تعليمية'],
    faq: [['هل أقل حجز ساعة؟', 'نعم، ثم يمكن احتساب الزيادات بربع أو نصف ساعة حسب الاتفاق.'], ['هل يمكن حجز يوم كامل؟', 'نعم، تتوفر باقات بالساعة واليوم والشهر حسب حجم الإنتاج.'], ['هل المونتاج مشمول؟', 'يمكن تسليم الملفات الخام أو إضافة المونتاج والهوية البصرية حسب نطاق المشروع.']],
    seoTitle: 'استديو تصوير محتوى وكورسات في 6 أكتوبر', metaDescription: 'استديو تصوير مجهز للكورسات والمحتوى التعليمي والفيديو الاحترافي في مدينة 6 أكتوبر، بباقات ساعة ويوم وشهر.', keywords: ['استوديو تصوير في القاهرة', 'تصوير كورسات', 'تصوير محتوى تعليمي', 'إيجار استوديو تصوير مجهز'],
  }, {
    title: 'Studio Content Production', navLabel: 'Studio & Content', eyebrow: 'Equipped studios in Cairo',
    heroSummary: 'An end-to-end studio setup for courses, expert-led content and recurring series, available by the hour, day or monthly package.',
    heroAlt: 'A 3D content studio equipped with a cinema camera, production lighting and monitor.',
    introduction: 'We align the set, lighting, sound and framing with your format, then run an efficient shoot that produces consistent, publication-ready footage.',
    outcomes: ['Consistent picture and sound across episodes', 'Better use of shoot time and budget', 'Organized footage that speeds up editing'],
    deliverables: ['Studio, lighting and set preparation', 'Multi-camera recording when needed', 'Organized raw files or final edits', 'Flexible hourly, daily and monthly packages'],
    process: ['Define the format and episode count', 'Select the studio and setup', 'Plan scripts and the shoot day', 'Record and review quality', 'Deliver raw or edited files'],
    suitableFor: ['Educators and course creators', 'Doctors and subject experts', 'YouTube and recurring content teams', 'Companies building training libraries'],
    faq: [['Is the minimum booking one hour?', 'Yes. Additional time can be calculated in quarter- or half-hour increments by agreement.'], ['Can I book a full production day?', 'Yes. Hourly, daily and monthly packages are available.'], ['Is editing included?', 'You can receive organized raw footage or add editing and visual branding to the scope.']],
    seoTitle: 'Content and Course Filming Studio in 6th of October', metaDescription: 'Equipped 6th of October studio for courses, educational content and professional video, with hourly, daily and monthly packages.', keywords: ['Cairo content studio', 'course filming', 'educational video production', 'equipped filming studio'],
  }),
  entry('reels-production', 'reels', 'Smartphone', 'production', ['reels'], '/service-heroes/reels-production.webp', {
    title: 'تصوير ومونتاج ريلز في 6 أكتوبر والجيزة', navLabel: 'تصوير الريلز', eyebrow: 'محتوى قصير يلفت من أول ثانية',
    heroSummary: 'نحوّل أفكار الشركات والخبراء في 6 أكتوبر والجيزة إلى Reels وTikTok وShorts واضحة، من التخطيط والتصوير حتى المونتاج والنسخ الجاهزة للنشر.',
    heroAlt: 'مجسم ثلاثي الأبعاد لهاتف رأسي وكاميرا وإضاءة حلقية ومسار مونتاج للفيديو القصير.',
    introduction: 'نبني مجموعة فيديوهات مترابطة تناسب شخصيتك والجمهور والمنصة، بدل إنتاج مقاطع منفصلة بلا اتجاه.',
    outcomes: ['خطاف بصري ورسالة أسرع', 'دفعة محتوى متسقة لأسابيع', 'نسخ مناسبة للمنصات العمودية'],
    deliverables: ['أفكار وسيناريوهات قصيرة', 'جلسة تصوير مخصصة لعدد الريلز', 'مونتاج عمودي وترجمة وحركة نصوص', 'نسخ تسليم جاهزة للنشر'],
    process: ['تحديد الهدف والجمهور', 'بناء قائمة الأفكار والهوكس', 'تحضير وتصوير الدفعة', 'مونتاج ومراجعة', 'تسليم وجدولة اختيارية'],
    suitableFor: ['البراندات والمتاجر', 'الأطباء والخبراء', 'المطاعم والخدمات المحلية', 'صناع المحتوى الشخصي'],
    faq: [['هل التسعير على وقت التصوير؟', 'يتم تخصيص وقت في الجدول، بينما التسعير الأساسي يكون حسب عدد الريلز ونطاق التنفيذ.'], ['هل تكتبون الأفكار؟', 'نعم، يمكن أن تشمل الباقة البحث والأفكار والسيناريوهات القصيرة.'], ['هل تصلح الفيديوهات لكل المنصات؟', 'نسلم مقاسات عمودية مناسبة لـReels وTikTok وShorts مع مراعاة اختلاف كل منصة.']],
    serviceType: 'تصوير ومونتاج الريلز والفيديوهات القصيرة',
    localExpertise: {
      eyebrow: 'خبرة محلية في إنتاج المحتوى القصير',
      title: 'جلسة ريلز منظمة من الفكرة إلى نسخ النشر',
      summary: 'نخطط دفعة محتوى مترابطة ونرتب التصوير والمونتاج حول هدف البراند بدل إنتاج مقاطع منفصلة بلا اتجاه.',
      items: [
        { title: 'ما نقدمه', text: 'أفكار وهوكس وسيناريوهات قصيرة، جلسة تصوير، مونتاج رأسي، ترجمة وحركة نصوص ونسخ جاهزة للمنصات.' },
        { title: 'لمن تناسب', text: 'للبراندات والمتاجر والعيادات والخبراء والمطاعم والخدمات المحلية وصناع المحتوى.' },
        { title: 'نطاق التنفيذ', text: 'نخدم مدينة 6 أكتوبر والشيخ زايد ومناطق الجيزة، مع التصوير داخل الاستديو أو في موقع العميل حسب الفكرة.' },
      ],
    },
    seoTitle: 'تصوير ومونتاج ريلز في 6 أكتوبر والجيزة', metaDescription: 'تصوير ومونتاج ريلز وفيديوهات قصيرة للبراندات والخبراء في 6 أكتوبر والجيزة، من الأفكار والهوكس حتى النسخ الجاهزة للنشر.', keywords: ['تصوير ريلز احترافي', 'مونتاج ريلز', 'فيديوهات قصيرة', 'صناعة محتوى سوشيال ميديا'],
  }, {
    title: 'Reels Production in 6th of October and Giza', navLabel: 'Reels Production', eyebrow: 'Short content that earns attention',
    heroSummary: 'We turn ideas for businesses and experts in 6th of October and Giza into focused Reels, TikToks and Shorts—from hooks and filming to polished vertical edits.',
    heroAlt: 'A 3D vertical phone, compact camera, ring light and short-form editing timeline.',
    introduction: 'We build a connected batch of videos around your voice, audience and platform instead of producing isolated clips without direction.',
    outcomes: ['A stronger first-second hook', 'A consistent content batch for weeks', 'Platform-ready vertical formats'],
    deliverables: ['Short ideas and scripts', 'A planned batch filming session', 'Vertical editing, captions and motion text', 'Exported publish-ready versions'],
    process: ['Define goals and audience', 'Build ideas and hooks', 'Prepare and film the batch', 'Edit and review', 'Deliver with optional scheduling'],
    suitableFor: ['Brands and retailers', 'Doctors and experts', 'Restaurants and local services', 'Personal creators'],
    faq: [['Is pricing based on shoot time?', 'The shoot receives a calendar slot, while the core price is based on reel count and scope.'], ['Do you write the ideas?', 'Yes. Research, ideas and concise scripts can be included.'], ['Will the videos work across platforms?', 'We provide vertical exports for Reels, TikTok and Shorts while respecting platform differences.']],
    serviceType: 'Reels and short-form video production',
    localExpertise: {
      eyebrow: 'Local short-form production expertise',
      title: 'A structured Reels session from idea to publish-ready exports',
      summary: 'We plan a connected content batch and organize filming and editing around the brand objective rather than producing isolated clips without direction.',
      items: [
        { title: 'What we provide', text: 'Ideas, hooks and short scripts, a planned filming session, vertical editing, captions, motion text and platform-ready exports.' },
        { title: 'Who it is for', text: 'Brands, retailers, clinics, experts, restaurants, local services and personal creators.' },
        { title: 'Where we work', text: 'We serve 6th of October City, Sheikh Zayed and Giza, filming in our studio or at the client location when the concept requires it.' },
      ],
    },
    seoTitle: 'Reels Production in 6th of October and Giza', metaDescription: 'Reels and short-form video production for brands and experts in 6th of October and Giza, from ideas and hooks to publish-ready vertical edits.', keywords: ['professional reels production', 'reels editing', 'short-form video', 'social video production'],
  }),
  entry('commercial-video-production', 'advertising', 'Clapperboard', 'production', ['video'], '/service-heroes/commercial-video-production.webp', {
    title: 'تصوير وإنتاج إعلانات تجارية في 6 أكتوبر والجيزة', navLabel: 'تصوير الإعلانات', eyebrow: 'فكرة محسوبة. تنفيذ سينمائي.',
    heroSummary: 'إنتاج إعلان تجاري أو فيديو براند للشركات في 6 أكتوبر والجيزة، مصمم حول هدف واضح وبمعدات وفريق يتوافقون مع متطلبات المشروع.',
    heroAlt: 'مجسم ثلاثي الأبعاد لكاميرا إعلان سينمائية ومنصة منتج وكلاكيت وإضاءة احترافية.',
    introduction: 'نربط الفكرة بالرسالة والاستخدام النهائي، ثم نبني خطة إنتاج واقعية تشمل التحضير والتصوير والمونتاج والتسليم.',
    outcomes: ['رسالة تجارية مفهومة وقابلة للتذكر', 'شكل بصري يعكس قيمة البراند', 'نسخ متعددة للحملة والمنصات'],
    deliverables: ['معالجة إبداعية وسيناريو', 'خطة تصوير ومعدات وطاقم', 'تصوير المنتج أو الخدمة أو الموقع', 'مونتاج وتصحيح ألوان وصوت', 'نسخ إعلانية بالأبعاد المطلوبة'],
    process: ['الهدف والمعالجة الإبداعية', 'الإعداد والسيناريو وخطة الإنتاج', 'التصوير', 'المونتاج والمراجعات', 'التسليم والنسخ النهائية'],
    suitableFor: ['إطلاق المنتجات', 'حملات العلامات التجارية', 'فيديوهات الشركات', 'الإعلانات الرقمية والتلفزيونية'],
    faq: [['كيف تحدد التكلفة؟', 'حسب المعالجة والمواقع والمعدات والطاقم والممثلين والمخرجات المطلوبة.'], ['هل يمكن تصوير المنتجات؟', 'نعم، من لقطات المنتجات داخل الاستديو إلى قصص استخدام كاملة.'], ['كم تستغرق العملية؟', 'تتحدد المدة بعد اعتماد الفكرة، وتوضح الخطة نقاط المراجعة والتسليم.']],
    serviceType: 'تصوير وإنتاج الفيديوهات والإعلانات التجارية',
    localExpertise: {
      eyebrow: 'إنتاج إعلاني قريب من فريقك',
      title: 'إعلان تجاري مبني حول الرسالة والاستخدام النهائي',
      summary: 'نحوّل الهدف إلى معالجة إنتاجية واقعية، ثم ندير التحضير والتصوير والمونتاج والنسخ المطلوبة للحملة في مسار واحد.',
      items: [
        { title: 'ما نقدمه', text: 'معالجة وسيناريو وخطة تصوير وطاقم ومعدات، ثم مونتاج وتصحيح ألوان وصوت ونسخ مناسبة للحملة والمنصات.' },
        { title: 'لمن تناسب', text: 'لإطلاق المنتجات وحملات البراند وفيديوهات الشركات والإعلانات الرقمية والتلفزيونية.' },
        { title: 'نطاق التنفيذ', text: 'نخطط من مقرنا في مدينة 6 أكتوبر وننفذ داخل الاستديو أو في مواقع الشركات والمنتجات في الجيزة والقاهرة حسب احتياج الإعلان.' },
      ],
    },
    seoTitle: 'تصوير وإنتاج إعلانات في 6 أكتوبر والجيزة', metaDescription: 'شركة تصوير وإنتاج إعلانات تجارية وفيديوهات براند في 6 أكتوبر والجيزة، من الفكرة والسيناريو إلى التصوير والمونتاج والتسليم.', keywords: ['تصوير إعلانات', 'إنتاج فيديو دعائي', 'إعلان تجاري', 'تصوير منتجات'],
  }, {
    title: 'Commercial Video Production in 6th of October and Giza', navLabel: 'Commercial Video', eyebrow: 'A focused idea. Cinematic execution.',
    heroSummary: 'Commercials and brand films for businesses in 6th of October and Giza, built around a clear objective with the right crew, equipment and production scale.',
    heroAlt: 'A 3D commercial film set with cinema camera, product pedestal, clapperboard and lights.',
    introduction: 'We connect the idea to the message and final placement, then shape a practical production plan from pre-production through delivery.',
    outcomes: ['A memorable commercial message', 'Visual direction that reflects brand value', 'Multiple campaign and platform versions'],
    deliverables: ['Creative treatment and script', 'Crew, equipment and shoot plan', 'Product, service or location filming', 'Edit, color and sound finishing', 'Campaign-ready aspect ratios'],
    process: ['Objective and creative treatment', 'Script and pre-production', 'Filming', 'Editing and review', 'Final masters and cut-downs'],
    suitableFor: ['Product launches', 'Brand campaigns', 'Corporate films', 'Digital and broadcast advertising'],
    faq: [['How is the budget calculated?', 'It reflects the treatment, locations, equipment, crew, talent and required outputs.'], ['Can you film products?', 'Yes—from controlled studio product shots to complete use-case stories.'], ['How long does production take?', 'The schedule is confirmed after the idea, with clear review and delivery milestones.']],
    serviceType: 'Commercial and brand video production',
    localExpertise: {
      eyebrow: 'Commercial production close to your team',
      title: 'A commercial built around the message and final placement',
      summary: 'We turn the objective into a practical treatment, then manage pre-production, filming, editing and campaign versions through one accountable workflow.',
      items: [
        { title: 'What we provide', text: 'Treatment, script, shoot plan, crew and equipment followed by editing, color, sound finishing and campaign-ready formats.' },
        { title: 'Who it is for', text: 'Product launches, brand campaigns, corporate films and digital or broadcast advertising.' },
        { title: 'Where we work', text: 'We plan from 6th of October City and film in our studio or at company and product locations across Giza and Cairo as the commercial requires.' },
      ],
    },
    seoTitle: 'Commercial Video Production in 6th of October and Giza', metaDescription: 'Commercial, product and brand video production in 6th of October and Giza, from creative treatment and filming to final campaign delivery.', keywords: ['commercial video production', 'brand film', 'product filming', 'video advertising'],
  }),
  entry('podcast-production', 'podcast', 'Mic2', 'production', ['podcast'], '/service-heroes/podcast-production.webp', {
    title: 'إنتاج وتصوير البودكاست', navLabel: 'تصوير البودكاست', eyebrow: 'صوت وصورة يليقان بالحوار',
    heroSummary: 'تسجيل بودكاست مرئي بصوت نظيف وكادرات متعددة، مع خيارات المونتاج الكامل واستخراج المقاطع القصيرة.',
    heroAlt: 'مجسم ثلاثي الأبعاد لطاولة بودكاست بميكروفونين وسماعات وكاميرا داخل غرفة صوتية.',
    introduction: 'نجهز الشكل البصري ومسارات الصوت والكاميرات قبل التسجيل حتى يركز الضيوف على الحوار ويخرج الموسم بهوية ثابتة.',
    outcomes: ['تسجيل مستقر وواضح للضيوف', 'هوية مرئية متسقة للحلقات', 'حلقة طويلة ومقاطع قصيرة من جلسة واحدة'],
    deliverables: ['إعداد الاستديو والميكروفونات', 'تسجيل صوت وصورة متعدد الكاميرات', 'مونتاج الحلقة وتنظيف الصوت', 'مقدمة وخاتمة وعناوين', 'مقاطع قصيرة اختيارية'],
    process: ['تخطيط الحلقة والشكل', 'تجهيز الاستديو والصوت', 'التسجيل', 'المونتاج والمراجعة', 'الحلقة والمقاطع والتسليم'],
    suitableFor: ['برامج الحوار', 'بودكاست الشركات', 'المقابلات التعليمية', 'المواسم المصورة'],
    faq: [['هل يمكن الحجز بدون مونتاج؟', 'نعم، يمكن حجز وقت الاستديو والتسجيل فقط أو إضافة باقة ما بعد الإنتاج.'], ['كم كاميرا تستخدمون؟', 'يحدد العدد حسب عدد الضيوف والشكل المطلوب للمونتاج.'], ['هل تستخرجون ريلز من الحلقة؟', 'يمكن إضافة حزمة مقاطع قصيرة مترجمة وجاهزة للنشر.']],
    seoTitle: 'استديو وتصوير بودكاست في 6 أكتوبر', metaDescription: 'تصوير وتسجيل بودكاست صوت وصورة متعدد الكاميرات في 6 أكتوبر، مع مونتاج الحلقات واستخراج المقاطع القصيرة.', keywords: ['تصوير بودكاست', 'استوديو بودكاست', 'إنتاج بودكاست مرئي', 'مونتاج بودكاست'],
  }, {
    title: 'Video Podcast Production', navLabel: 'Podcast Production', eyebrow: 'Sound and picture worthy of the conversation',
    heroSummary: 'Clean multi-camera video podcast recording with options for full episode editing and social cut-downs.',
    heroAlt: 'A 3D acoustic podcast room with two microphones, headphones and a production camera.',
    introduction: 'We prepare the set, audio paths and camera coverage before recording so guests can focus on the conversation and the season keeps a consistent identity.',
    outcomes: ['Reliable, clear guest recording', 'A consistent visual identity across episodes', 'Long episodes and short clips from one session'],
    deliverables: ['Studio and microphone setup', 'Multi-camera audio/video recording', 'Episode edit and audio cleanup', 'Titles, intro and outro', 'Optional short clips'],
    process: ['Plan the episode and look', 'Prepare studio and audio', 'Record', 'Edit and review', 'Deliver episode and clips'],
    suitableFor: ['Interview shows', 'Corporate podcasts', 'Educational conversations', 'Filmed podcast seasons'],
    faq: [['Can we book recording without editing?', 'Yes. Book the studio and recording only, or add post-production.'], ['How many cameras are used?', 'Coverage depends on guest count and the preferred editing style.'], ['Can you create Reels from the episode?', 'Yes. Add captioned, publish-ready short clips.']],
    seoTitle: 'Video Podcast Studio in 6th of October', metaDescription: 'Multi-camera video podcast recording in 6th of October with clean audio, episode editing and short social clips.', keywords: ['video podcast studio', 'podcast filming', 'podcast recording', 'podcast editing'],
  }),
  entry('event-coverage', 'event_coverage', 'CalendarRange', 'production', ['video'], '/service-heroes/event-coverage.webp', {
    title: 'تغطية الفعاليات والمؤتمرات', navLabel: 'تغطية الفعاليات', eyebrow: 'لا نفوّت اللحظة التي تحكي الحدث',
    heroSummary: 'تغطية منظمة للمؤتمرات والافتتاحات والفعاليات، بصور وفيديو highlights ومحتوى سريع للنشر حسب احتياج الحدث.',
    heroAlt: 'مجسم ثلاثي الأبعاد لمسرح مؤتمر وجمهور وكاميرا تغطي الحدث تحت إضاءة مسرحية.',
    introduction: 'نخطط لنقاط الحدث والشخصيات واللحظات الأساسية قبل وصول الفريق، ثم نتحرك بخفة دون تعطيل تجربة الحضور.',
    outcomes: ['توثيق اللحظات الرئيسية دون فجوات', 'مواد سريعة للاستخدام الإعلامي', 'فيلم highlights يلخص أثر الحدث'],
    deliverables: ['خطة تغطية ومسارات حركة', 'تصوير فيديو وفوتوغرافيا حسب النطاق', 'مقابلات وتصريحات اختيارية', 'فيديو highlights', 'نسخ سريعة للسوشيال ميديا'],
    process: ['قراءة برنامج الحدث', 'تحديد الفريق والمعدات', 'التغطية الميدانية', 'اختيار ومونتاج المواد', 'التسليم السريع والنهائي'],
    suitableFor: ['المؤتمرات والمعارض', 'الافتتاحات وإطلاق المنتجات', 'فعاليات الشركات', 'الحفلات والأنشطة المجتمعية'],
    faq: [['هل توفرون تصويرًا فوتوغرافيًا وفيديو؟', 'يمكن تخصيص الفريق ليغطي أحدهما أو كليهما.'], ['هل يمكن تسليم محتوى أثناء الحدث؟', 'نعم، عند التخطيط المسبق يمكن تجهيز مواد سريعة للنشر في نفس اليوم.'], ['هل التغطية داخل القاهرة فقط؟', 'نحدد الموقع والسفر واللوجستيات ضمن عرض مخصص لكل حدث.']],
    seoTitle: 'تصوير وتغطية فعاليات ومؤتمرات في الجيزة', metaDescription: 'تغطية إيفنتات ومؤتمرات وافتتاحات في الجيزة والقاهرة بالفيديو والصور، مع highlights ومحتوى سريع للسوشيال.', keywords: ['تصوير فعاليات', 'تغطية إيفنتات', 'تصوير مؤتمرات', 'فيديو highlights'],
  }, {
    title: 'Event & Conference Coverage', navLabel: 'Event Coverage', eyebrow: 'We capture the moments that tell the event',
    heroSummary: 'Planned coverage for conferences, launches and events, with photography, highlight films and rapid social content when required.',
    heroAlt: 'A 3D conference stage, audience and professional camera capturing the event.',
    introduction: 'We map the agenda, people and must-capture moments before the crew arrives, then work discreetly around the attendee experience.',
    outcomes: ['Complete coverage of key moments', 'Fast assets for press and social use', 'A highlight film that carries the event forward'],
    deliverables: ['Coverage plan and crew movement', 'Video and photography by scope', 'Optional interviews and statements', 'Highlight film', 'Fast social-ready cuts'],
    process: ['Review the event program', 'Define crew and equipment', 'Capture on location', 'Select and edit', 'Deliver fast-turnaround and final assets'],
    suitableFor: ['Conferences and exhibitions', 'Openings and product launches', 'Corporate events', 'Celebrations and community programs'],
    faq: [['Do you provide both photo and video?', 'The crew can be scoped for either or both.'], ['Can you deliver during the event?', 'With advance planning, rapid same-day social assets are available.'], ['Do you cover outside Cairo?', 'Location, travel and logistics are included in a custom event quotation.']],
    seoTitle: 'Event and Conference Video Coverage in Cairo', metaDescription: 'Professional event and conference coverage in Cairo and Giza with photography, highlight films and fast social content.', keywords: ['event coverage', 'conference filming', 'event photography', 'highlight video'],
  }),
  entry('social-media-management', 'social_media', 'Share2', 'marketing', ['reels', 'design'], '/service-heroes/social-media-management.webp', {
    title: 'إدارة السوشيال ميديا في 6 أكتوبر والجيزة', navLabel: 'إدارة السوشيال ميديا', eyebrow: 'حضور مستمر بدل النشر العشوائي',
    heroSummary: 'إدارة سوشيال ميديا للشركات في 6 أكتوبر والجيزة تشمل خطة المحتوى والإنتاج والتصميم وإدارة المنصات وتقارير الأداء بنطاق مرن.',
    heroAlt: 'مجسم ثلاثي الأبعاد لهاتف وتقويم محتوى وبطاقات منشورات ورسوم تحليل أداء.',
    introduction: 'نربط الرسائل بالمحتوى والتوزيع والقياس في نظام واحد، مع وضوح ما سينشر ولماذا وكيف يتحسن الأداء.',
    outcomes: ['تقويم نشر واضح ومتوازن', 'صوت وهوية متسقان عبر المنصات', 'قرارات مبنية على تقارير قابلة للفهم'],
    deliverables: ['استراتيجية وخطة محتوى', 'كتابة وتصميم البوستات', 'فيديوهات وريلز حسب الباقة', 'إدارة النشر والتفاعل المتفق عليه', 'تقارير وتحليل وإعلانات ممولة اختيارية'],
    process: ['مراجعة البراند والجمهور', 'بناء الخطة والأعمدة', 'الإنتاج والموافقة', 'النشر وإدارة الدورة', 'القياس والتحسين الشهري'],
    suitableFor: ['الشركات الناشئة', 'العيادات والخدمات', 'المطاعم والمتاجر', 'البراندات متعددة المنصات'],
    faq: [['هل كل الباقات متشابهة؟', 'لا، يتغير النطاق حسب عدد المنصات والبوستات والفيديوهات والإعلانات والخدمات المطلوبة.'], ['هل تشمل الإعلانات الممولة؟', 'يمكن إضافة إدارة الحملات وميزانية الإعلان كبند واضح منفصل.'], ['كيف أتابع التنفيذ؟', 'تظهر مراحل العمل والحالة المالية والتحديثات من خلال لوحة العميل.']],
    serviceType: 'إدارة السوشيال ميديا وصناعة المحتوى',
    localExpertise: {
      eyebrow: 'فريق محتوى قريب من نشاطك',
      title: 'إدارة شهرية تربط الخطة بالتصميم والإنتاج والنشر',
      summary: 'نبني دورة عمل واضحة من أعمدة المحتوى والموافقات إلى التصميم والريلز والنشر والتقارير، مع نطاق يناسب احتياج كل براند.',
      items: [
        { title: 'ما نقدمه', text: 'استراتيجية وتقويم محتوى وكتابة وتصميم بوستات وريلز، مع النشر والتقارير وإدارة الحملات عند إضافتها للنطاق.' },
        { title: 'لمن تناسب', text: 'للشركات الناشئة والعيادات والمطاعم والمتاجر والخدمات والبراندات التي تدير أكثر من منصة.' },
        { title: 'نطاق الخدمة', text: 'نعمل مع الشركات في مدينة 6 أكتوبر والشيخ زايد ومناطق الجيزة، ويمكن تنسيق أيام تصوير المحتوى داخل الاستديو أو في مقر النشاط.' },
      ],
    },
    seoTitle: 'شركة إدارة سوشيال ميديا في 6 أكتوبر والجيزة', metaDescription: 'إدارة صفحات السوشيال ميديا للشركات في 6 أكتوبر والجيزة: خطة محتوى وتصميم وريلز ونشر وتقارير وإعلانات ممولة اختيارية.', keywords: ['إدارة السوشيال ميديا', 'صناعة المحتوى', 'خطة محتوى', 'تصميم بوستات'],
  }, {
    title: 'Social Media Management in 6th of October and Giza', navLabel: 'Social Media', eyebrow: 'A consistent presence, not random posting',
    heroSummary: 'Social media management for businesses in 6th of October and Giza, combining content strategy, production, design, channel management and reporting.',
    heroAlt: 'A 3D phone, content calendar, post cards and analytics shapes for social media management.',
    introduction: 'We connect messaging, production, distribution and measurement in one workflow with clear visibility into what is published and why.',
    outcomes: ['A clear, balanced publishing calendar', 'Consistent brand voice across channels', 'Understandable performance-led decisions'],
    deliverables: ['Strategy and content plan', 'Copywriting and post design', 'Reels and videos by package', 'Publishing and agreed community tasks', 'Reporting, analysis and optional paid media'],
    process: ['Audit brand and audience', 'Build pillars and plan', 'Produce and approve', 'Publish and manage', 'Measure and improve monthly'],
    suitableFor: ['Startups', 'Clinics and service brands', 'Restaurants and retailers', 'Multi-platform brands'],
    faq: [['Are all packages the same?', 'No. Scope changes by platforms, post and video volume, ads and support needs.'], ['Are paid ads included?', 'Campaign management and media budget can be added as clear separate items.'], ['How do I follow progress?', 'Project stages, financial status and updates are visible in the client dashboard.']],
    serviceType: 'Social media management and content production',
    localExpertise: {
      eyebrow: 'A content team close to your business',
      title: 'Monthly management that connects planning, design, production and publishing',
      summary: 'We build a clear workflow from content pillars and approvals to design, Reels, publishing and reporting, with a scope shaped around each brand.',
      items: [
        { title: 'What we provide', text: 'Strategy, content calendar, copywriting, post design and Reels, with publishing, reporting and campaign management when included.' },
        { title: 'Who it is for', text: 'Startups, clinics, restaurants, retailers, service businesses and brands working across multiple platforms.' },
        { title: 'Where we work', text: 'We work with businesses in 6th of October City, Sheikh Zayed and Giza, coordinating content shoots in our studio or at the business location.' },
      ],
    },
    seoTitle: 'Social Media Management in 6th of October and Giza', metaDescription: 'Social media management for businesses in 6th of October and Giza, with content planning, design, Reels, publishing, reporting and optional paid campaigns.', keywords: ['social media management', 'content strategy', 'post design', 'paid social campaigns'],
  }),
  entry('creative-design-branding', 'creative_design', 'Palette', 'marketing', ['design'], '/service-heroes/creative-design-branding.webp', {
    title: 'التصميم الإبداعي والهوية البصرية', navLabel: 'التصميم والهوية', eyebrow: 'هوية يمكن تمييزها وتطبيقها',
    heroSummary: 'نبني لغة بصرية عملية للبراند، من الشعار والنظام اللوني إلى تطبيقات السوشيال والمواد الدعائية.',
    heroAlt: 'مجسم ثلاثي الأبعاد للوحة رسم وقلم وأدلة هندسية وعينات ألوان لتصميم الهوية.',
    introduction: 'التصميم الجيد ليس ملف شعار فقط؛ هو مجموعة قرارات واضحة تجعل كل ظهور للبراند متسقًا وسهل الإنتاج.',
    outcomes: ['تميّز بصري واضح', 'قواعد تقلل العشوائية في التصميم', 'قوالب عملية للاستخدام اليومي'],
    deliverables: ['اتجاه بصري ومودبورد', 'شعار ونظام ألوان وخطوط حسب النطاق', 'دليل استخدام مختصر أو متكامل', 'قوالب سوشيال ومطبوعات اختيارية'],
    process: ['فهم البراند والسوق', 'اتجاهات بصرية', 'تطوير المفهوم المختار', 'تطبيقات ومراجعة', 'تسليم الملفات والدليل'],
    suitableFor: ['براند جديد', 'إعادة تقديم علامة قائمة', 'حملات ومناسبات', 'فرق تحتاج قوالب موحدة'],
    faq: [['هل تقدمون تصميم لوجو فقط؟', 'يمكن تنفيذ شعار مستقل، لكن نوصي بنطاق يوضح الألوان والخطوط والاستخدام.'], ['ما الملفات التي أستلمها؟', 'تحدد الحزمة ملفات الاستخدام الرقمية والطباعة والقوالب المطلوبة.'], ['هل تصممون بوستات شهرية؟', 'نعم، يمكن ربط الهوية بخدمة تصميم محتوى أو إدارة سوشيال ميديا.']],
    seoTitle: 'تصميم هوية بصرية ولوجو في 6 أكتوبر', metaDescription: 'تصميم هوية بصرية وشعار ونظام ألوان وقوالب سوشيال للشركات في 6 أكتوبر والجيزة، مع ملفات استخدام واضحة.', keywords: ['تصميم هوية بصرية', 'تصميم لوجو', 'براندنج', 'تصميمات سوشيال ميديا'],
  }, {
    title: 'Creative Design & Branding', navLabel: 'Design & Branding', eyebrow: 'A recognizable, usable visual system',
    heroSummary: 'A practical visual language for your brand, from logo and color system to social templates and campaign materials.',
    heroAlt: 'A 3D pen tablet, geometric identity guides and color swatches for creative branding.',
    introduction: 'Good design is not only a logo file. It is a set of clear decisions that keeps every brand appearance consistent and easier to produce.',
    outcomes: ['Clear visual distinction', 'Rules that reduce design inconsistency', 'Practical templates for everyday use'],
    deliverables: ['Visual direction and moodboard', 'Logo, color and type system by scope', 'Concise or full usage guide', 'Optional social templates and print items'],
    process: ['Understand brand and market', 'Explore visual directions', 'Develop the selected concept', 'Apply and review', 'Deliver assets and guide'],
    suitableFor: ['New brands', 'Brand refreshes', 'Campaigns and events', 'Teams that need consistent templates'],
    faq: [['Can you design only a logo?', 'Yes, though a small system covering color, type and usage creates more value.'], ['Which files are delivered?', 'The package defines digital, print and template formats.'], ['Can you design monthly posts?', 'Yes. Branding can connect to ongoing content design or social media management.']],
    seoTitle: 'Brand Identity and Logo Design in Giza', metaDescription: 'Logo, visual identity, color system and social templates for Giza businesses, designed to keep every brand appearance consistent.', keywords: ['brand identity design', 'logo design', 'branding', 'social media design'],
  }),
  entry('web-design-development', 'website', 'MonitorSmartphone', 'digital', ['web'], '/service-heroes/web-design-development.webp', {
    title: 'تصميم وإنشاء المواقع والمتاجر الإلكترونية في 6 أكتوبر', navLabel: 'تصميم المواقع', eyebrow: 'شركة تصميم مواقع في 6 أكتوبر والجيزة',
    heroSummary: 'نصمم ونبرمج مواقع شركات ومتاجر إلكترونية سريعة ومتوافقة مع الموبايل ومحركات البحث، من التخطيط وتجربة المستخدم حتى الإطلاق والتدريب.',
    heroAlt: 'مجسم ثلاثي الأبعاد لحاسوب وأجهزة متجاوبة تعرض تخطيطات واجهات مواقع.',
    introduction: 'نبدأ بفهم هدف الموقع والجمهور والمحتوى المطلوب، ثم نرسم رحلة المستخدم ونصمم الواجهة ونطورها على أساس تقني يمكن إدارته وتوسيعه. النتيجة موقع يخدم البيع أو التواصل أو عرض الخدمات بدل أن يكون مجرد واجهة جميلة.',
    outcomes: ['تحويل الزيارة إلى تواصل أو طلب شراء واضح', 'تجربة سريعة ومتجاوبة على الموبايل والكمبيوتر', 'محتوى وهيكل يسهل على محركات البحث فهمهما', 'أساس تقني قابل للصيانة والنمو'],
    deliverables: ['خريطة صفحات وهيكل محتوى ورحلة مستخدم', 'تصميم UI/UX متجاوب مع هوية الشركة', 'برمجة الصفحات والوظائف ولوحة الإدارة حسب النطاق', 'إعداد المتجر والدفع والشحن عند طلب متجر إلكتروني', 'تهيئة تقنية وأساسية للـSEO والأداء والحماية', 'اختبار وتدريب وتسليم موثق حسب المشروع'],
    process: ['الأهداف والمحتوى', 'الهيكل وUX', 'تصميم UI', 'التطوير والاختبار', 'الإطلاق والدعم'],
    suitableFor: ['مواقع الشركات', 'المتاجر الإلكترونية', 'صفحات الحملات', 'منصات المحتوى والخدمات'],
    serviceType: 'تصميم وبرمجة مواقع الشركات والمتاجر الإلكترونية',
    localExpertise: {
      eyebrow: 'خدمة محلية وتنفيذ يصل إلى كل مصر',
      title: 'تصميم مواقع للشركات في 6 أكتوبر يخدم أهداف البيع والتواصل',
      summary: 'تقدم Multi Task Agency خدمة تصميم وإنشاء المواقع من مدينة 6 أكتوبر بالجيزة للشركات والمتاجر داخل أكتوبر والشيخ زايد والقاهرة وكل محافظات مصر، مع إمكانية إدارة المشروع والاجتماعات عن بُعد.',
      items: [
        { title: 'نطاق الخدمة', text: 'مواقع شركات، متاجر إلكترونية، صفحات هبوط للحملات، ومنصات محتوى أو خدمات وفق هدف واضح ونطاق مكتوب.' },
        { title: 'معايير التنفيذ', text: 'تصميم متجاوب، هيكل دلالي واضح، سرعة وأداء، أساس SEO، حماية، واختبار قبل الإطلاق وفق متطلبات المشروع.' },
        { title: 'الحضور المحلي', text: 'فريقنا في مدينة 6 أكتوبر لخدمة مشروعات الجيزة والقاهرة، مع تنفيذ وتسليم رقمي للعملاء في جميع أنحاء مصر.' },
      ],
    },
    decisionGuide: {
      title: 'أي نوع موقع يناسب مشروعك؟',
      summary: 'اختيار النوع الصحيح من البداية يمنع تحميل المشروع وظائف لا يحتاجها ويجعل عرض السعر ومدة التنفيذ أكثر وضوحًا.',
      options: [
        { title: 'موقع شركة', text: 'مناسب لعرض الخدمات والخبرة ونماذج الأعمال وتحويل الزائر إلى مكالمة أو رسالة أو طلب عرض سعر.' },
        { title: 'متجر إلكتروني', text: 'مناسب لعرض المنتجات وإدارة الطلبات والمخزون والدفع والشحن وفق طريقة تشغيل المتجر.' },
        { title: 'صفحة هبوط', text: 'مناسبة لحملة أو عرض واحد وتركز على إجراء محدد مثل التسجيل أو الشراء أو طلب التواصل.' },
      ],
      factorsTitle: 'ما الذي يحدد تكلفة ومدة إنشاء الموقع؟',
      factors: [
        { title: 'عدد الصفحات والمحتوى', text: 'حجم الصفحات، اللغات، وتجهيز النصوص والصور.' },
        { title: 'الوظائف والتكاملات', text: 'النماذج، الحجز، الدفع، الشحن، وربط الأنظمة الخارجية.' },
        { title: 'التصميم والهوية', text: 'مدى تخصيص الواجهة وتوفر هوية ومحتوى جاهزين.' },
        { title: 'الإدارة والدعم', text: 'لوحة التحكم، صلاحيات المستخدمين، التدريب، والصيانة بعد الإطلاق.' },
      ],
    },
    relatedServices: [
      { slug: 'creative-design-branding', title: 'تصميم الهوية البصرية', text: 'لبناء لغة بصرية متماسكة قبل تصميم واجهة الموقع.' },
      { slug: 'social-media-management', title: 'إدارة السوشيال ميديا', text: 'لربط الموقع بالمحتوى والحملات وجذب الزيارات بعد الإطلاق.' },
      { slug: 'software-development', title: 'تطوير البرامج والأنظمة', text: 'عندما يحتاج المشروع إلى بوابة عملاء أو ERP أو CRM أو وظائف مخصصة.' },
    ],
    faq: [['هل الموقع متوافق مع الموبايل؟', 'نعم، نصمم ونختبر الصفحات للشاشات المختلفة من البداية، مع مراعاة وضوح المحتوى وسهولة الإجراء على الموبايل.'], ['هل تنفذون متجرًا إلكترونيًا كاملًا؟', 'نعم، ويحدد النطاق تفاصيل الكتالوج والطلبات والدفع والشحن والمخزون والصلاحيات المطلوبة لإدارة المتجر.'], ['كم تكلفة تصميم وإنشاء موقع إلكتروني؟', 'تتحدد التكلفة بعد معرفة نوع الموقع وعدد الصفحات واللغات والوظائف والتكاملات والمحتوى المطلوب، ثم نقدم نطاقًا وعرض سعر واضحين قبل التنفيذ.'], ['كم يستغرق تنفيذ الموقع؟', 'تحدد المدة بعد اعتماد النطاق وتوفر المحتوى وسرعة المراجعات، ويشمل عرض المشروع مراحل التنفيذ ومواعيد التسليم المتوقعة.'], ['هل أستطيع تعديل محتوى الموقع بنفسي؟', 'يمكن توفير لوحة إدارة وتدريب على تحديث المحتوى والمنتجات وفق التقنية والنطاق المتفق عليهما.'], ['هل تشمل الخدمة الاستضافة وتحسين محركات البحث؟', 'نساعد في اختيار وربط الدومين والاستضافة، وننفذ التهيئة التقنية والأساسية للـSEO. تكاليف الخدمات الخارجية والعمل المستمر على المحتوى أو المنافسة توضح بشكل مستقل.']],
    seoTitle: 'شركة تصميم مواقع في 6 أكتوبر والجيزة', metaDescription: 'تصميم وإنشاء مواقع شركات ومتاجر إلكترونية سريعة ومتوافقة مع الموبايل ومحركات البحث في 6 أكتوبر والجيزة. شاهد أعمالنا واطلب عرض سعر.', keywords: ['شركة تصميم مواقع في 6 أكتوبر', 'تصميم مواقع في الجيزة', 'إنشاء موقع إلكتروني', 'تصميم مواقع شركات', 'برمجة مواقع', 'تصميم متجر إلكتروني', 'شركة برمجة مواقع', 'تصميم UI/UX'],
  }, {
    title: 'Web Design & E-commerce Development in 6th of October', navLabel: 'Web Design', eyebrow: 'A web design agency in 6th of October, Giza',
    heroSummary: 'We design and develop fast, mobile-friendly company websites and online stores, from planning and UX through launch, SEO foundations and team training.',
    heroAlt: 'A 3D laptop and responsive devices displaying abstract website interface layouts.',
    introduction: 'We begin by understanding the website goal, audience and required content. We then map the user journey, design the interface and build it on a maintainable foundation. The result is a website designed to support sales, enquiries or service discovery—not only to look polished.',
    outcomes: ['A clear path from visit to enquiry or purchase', 'Fast, responsive use across mobile and desktop', 'Content and structure search engines can understand', 'A maintainable foundation for growth'],
    deliverables: ['Sitemap, content structure and user journeys', 'Responsive UI/UX aligned with the brand', 'Page, feature and administration development by scope', 'Store, payment and shipping setup when e-commerce is required', 'Technical SEO, performance and security foundations', 'Testing, documented handover and training by scope'],
    process: ['Goals and content', 'Architecture and UX', 'UI design', 'Development and testing', 'Launch and support'],
    suitableFor: ['Company websites', 'Online stores', 'Campaign landing pages', 'Content and service platforms'],
    serviceType: 'Company website and e-commerce design and development',
    localExpertise: {
      eyebrow: 'Local collaboration, nationwide delivery',
      title: 'Web design in 6th of October for companies that need clear commercial outcomes',
      summary: 'Multi Task Agency provides website design and development from 6th of October City, Giza for businesses in October, Sheikh Zayed, Cairo and across Egypt, with remote project management and delivery available.',
      items: [
        { title: 'Service scope', text: 'Company websites, online stores, campaign landing pages and content or service platforms shaped around a written objective and scope.' },
        { title: 'Delivery standards', text: 'Responsive design, semantic structure, performance, SEO foundations, security and pre-launch testing according to project requirements.' },
        { title: 'Local presence', text: 'Our 6th of October team serves Giza and Cairo projects while delivering digitally to clients throughout Egypt.' },
      ],
    },
    decisionGuide: {
      title: 'Which type of website fits your project?',
      summary: 'Choosing the right format early avoids unnecessary features and makes the scope, quotation and delivery schedule easier to understand.',
      options: [
        { title: 'Company website', text: 'Best for presenting services, expertise and work while guiding visitors toward a call, message or quotation request.' },
        { title: 'Online store', text: 'Best for products, orders, inventory, payments and shipping configured around the store operation.' },
        { title: 'Landing page', text: 'Best for one campaign or offer with a focused action such as registration, purchase or enquiry.' },
      ],
      factorsTitle: 'What determines website cost and delivery time?',
      factors: [
        { title: 'Pages and content', text: 'Page count, languages and readiness of copy and imagery.' },
        { title: 'Features and integrations', text: 'Forms, booking, payments, shipping and third-party systems.' },
        { title: 'Design and brand', text: 'The level of interface customization and availability of brand assets.' },
        { title: 'Administration and support', text: 'Dashboard needs, user roles, training and post-launch maintenance.' },
      ],
    },
    relatedServices: [
      { slug: 'creative-design-branding', title: 'Brand identity design', text: 'Build a consistent visual language before designing the website interface.' },
      { slug: 'social-media-management', title: 'Social media management', text: 'Connect the website with content and campaigns that attract relevant visits after launch.' },
      { slug: 'software-development', title: 'Custom software development', text: 'For client portals, ERP, CRM or business-specific functionality beyond a standard website.' },
    ],
    faq: [['Will the website work on mobile?', 'Yes. We design and test for different screens from the beginning, including content clarity and ease of action on mobile.'], ['Do you build complete online stores?', 'Yes. The scope defines the catalog, orders, payments, shipping, inventory and administration required for the store.'], ['How much does website design and development cost?', 'Cost is defined after clarifying the website type, page count, languages, features, integrations and content needs. We then provide a written scope and quotation before development.'], ['How long does a website take to build?', 'The schedule depends on the approved scope, content readiness and review turnaround. The proposal sets out the expected stages and delivery dates.'], ['Can I update the website myself?', 'A content management dashboard and training can be included based on the agreed technology and project scope.'], ['Are hosting and SEO included?', 'We can help select and connect the domain and hosting, and we implement technical and foundational SEO. Third-party costs and ongoing content or competitive SEO work are listed separately.']],
    seoTitle: 'Web Design Agency in 6th of October, Giza', metaDescription: 'Company website and e-commerce design in 6th of October, Giza. Fast, mobile-friendly builds with technical SEO, clear scope and verified work.', keywords: ['web design agency 6th of October', 'web development Giza', 'company website design Egypt', 'ecommerce website development', 'website design company', 'responsive UI UX', 'technical SEO website'],
  }),
  entry('software-development', 'software', 'Code2', 'digital', ['web'], '/service-heroes/software-development.webp', {
    title: 'تطوير البرامج وتطبيقات الويب والموبايل', navLabel: 'تطوير البرامج', eyebrow: 'نظام مبني على طريقة عملك',
    heroSummary: 'تطبيقات ويب وموبايل وبرامج إدارة وERP وCRM مصممة حول العمليات الفعلية بدل إجبار الفريق على نظام جامد.',
    heroAlt: 'مجسم ثلاثي الأبعاد لوحدات برامج مترابطة وقاعدة بيانات وتطبيق موبايل وخادم.',
    introduction: 'نحوّل الخطوات والبيانات والصلاحيات إلى منتج قابل للاستخدام والقياس، مع مراحل واضحة من التحليل حتى الإطلاق.',
    outcomes: ['تقليل العمل اليدوي والتكرار', 'بيانات وصلاحيات أوضح', 'تجربة تناسب الفريق والعملاء'],
    deliverables: ['تحليل العمليات والمتطلبات', 'تصميم تجربة وواجهات', 'تطوير النظام والتكاملات', 'اختبارات وأمان وصلاحيات', 'إطلاق وتدريب ودعم متفق عليه'],
    process: ['اكتشاف وتحليل', 'تحديد النطاق والنموذج', 'تصميم وتطوير مرحلي', 'اختبار وقبول', 'إطلاق وتحسين'],
    suitableFor: ['أنظمة ERP وCRM', 'بوابات العملاء', 'تطبيقات ويب وموبايل', 'أدوات داخلية حسب الطلب'],
    faq: [['هل تطورون نظامًا من الصفر؟', 'نعم، بعد تحليل العمليات وتحديد الأولويات والمراحل.'], ['كيف أتابع التنفيذ؟', 'نقسم العمل إلى مراحل ومخرجات قابلة للمراجعة قبل الانتقال للمرحلة التالية.'], ['هل تقدمون صيانة؟', 'يحدد عرض المشروع فترة الضمان والدعم والتطوير اللاحق.']],
    seoTitle: 'شركة برمجة وتطوير أنظمة ERP وCRM في الجيزة', metaDescription: 'تطوير تطبيقات ويب وموبايل وبرامج إدارة وأنظمة ERP وCRM مخصصة للشركات في الجيزة ومصر.', keywords: ['برمجة تطبيقات موبايل', 'تطوير تطبيقات ويب', 'أنظمة ERP وCRM', 'برامج حسب الطلب'],
  }, {
    title: 'Custom Software Development', navLabel: 'Software Development', eyebrow: 'Software shaped around your operation',
    heroSummary: 'Web and mobile apps, management software, ERP and CRM solutions designed around real workflows rather than rigid templates.',
    heroAlt: 'A 3D connected software system with dashboard modules, database, mobile app and server.',
    introduction: 'We translate steps, data and permissions into a usable, measurable product with clear stages from discovery to launch.',
    outcomes: ['Less repetitive manual work', 'Clearer data and permissions', 'An experience shaped for teams and clients'],
    deliverables: ['Process and requirements analysis', 'UX and interface design', 'System and integration development', 'Testing, security and permissions', 'Launch, training and agreed support'],
    process: ['Discovery and analysis', 'Scope and prototype', 'Iterative design and development', 'Testing and acceptance', 'Launch and improvement'],
    suitableFor: ['ERP and CRM systems', 'Client portals', 'Web and mobile apps', 'Custom internal tools'],
    faq: [['Can you build a system from scratch?', 'Yes, after mapping operations, priorities and delivery phases.'], ['How is progress reviewed?', 'Work is divided into reviewable stages and outputs.'], ['Do you provide maintenance?', 'The proposal defines warranty, support and future development.']],
    seoTitle: 'Custom Software, ERP and CRM Development in Egypt', metaDescription: 'Custom web and mobile apps, company management software, ERP and CRM systems designed around Egyptian business workflows.', keywords: ['mobile app development', 'web application development', 'ERP CRM systems', 'custom software'],
  }),
  entry('ai-video-production', 'ai_video', 'WandSparkles', 'digital', ['video'], '/service-heroes/ai-video-production.webp', {
    title: 'إنتاج فيديوهات بالذكاء الاصطناعي', navLabel: 'فيديو الذكاء الاصطناعي', eyebrow: 'خيال أوسع دون فقدان الهدف',
    heroSummary: 'فيديوهات إعلانية وشرح منتجات وأفاتار وتعليق صوتي باستخدام أدوات AI ضمن معالجة إبداعية ومراجعة بشرية.',
    heroAlt: 'مجسم ثلاثي الأبعاد لإنتاج فيديو بالذكاء الاصطناعي يضم أفاتار وشرائط سينمائية ومسار مونتاج.',
    introduction: 'نختار التقنية المناسبة للفكرة بدل استخدام الذكاء الاصطناعي كغرض بصري فقط، ثم نوحد الأسلوب والصوت والحركة في نتيجة قابلة للنشر.',
    outcomes: ['تنفيذ أفكار يصعب تصويرها تقليديًا', 'نسخ ولغات وأشكال متعددة بكفاءة', 'اتجاه بصري متسق ومراجع بشريًا'],
    deliverables: ['معالجة وسيناريو وstoryboard', 'توليد مشاهد أو أفاتار حسب المشروع', 'تعليق صوتي وموسيقى مرخصة حسب النطاق', 'مونتاج وتصحيح واتساق بصري', 'نسخ نهائية للمنصات'],
    process: ['تحديد الاستخدام والحدود', 'اختبار الأسلوب والمشهد المرجعي', 'الإنتاج والتوليد', 'المونتاج والمراجعة البشرية', 'التسليم والنسخ'],
    suitableFor: ['إعلانات مفاهيمية', 'شرح المنتجات والخدمات', 'أفاتار ومقدم رقمي', 'محتوى متعدد اللغات'],
    faq: [['هل كل الفيديو مولد بالذكاء الاصطناعي؟', 'قد يكون مولدًا بالكامل أو مزيجًا من تصوير وتصميم وAI حسب الهدف.'], ['هل يمكن استخدام أفاتار؟', 'نعم، بعد تحديد الشكل والصوت وحقوق الاستخدام المناسبة.'], ['كيف تحافظون على الاتساق؟', 'نعتمد أسلوبًا مرجعيًا ونراجع المشاهد والمونتاج بشريًا قبل التسليم.']],
    seoTitle: 'إنتاج فيديو بالذكاء الاصطناعي في مصر', metaDescription: 'إنتاج فيديو إعلاني بالذكاء الاصطناعي وأفاتار رقمي وتعليق صوتي في مصر، مع معالجة إبداعية ومراجعة بشرية.', keywords: ['صناعة فيديو بالذكاء الاصطناعي', 'فيديو إعلاني AI', 'أفاتار رقمي', 'تعليق صوتي AI'],
  }, {
    title: 'AI Video Production', navLabel: 'AI Video', eyebrow: 'A wider visual canvas with a clear purpose',
    heroSummary: 'AI-assisted ads, product explainers, avatars and voiceovers shaped by a creative treatment and human review.',
    heroAlt: 'A 3D AI video production scene with synthetic avatar, cinematic frames and editing timeline.',
    introduction: 'We select the technology around the idea—not as a visual gimmick—then unify style, voice and motion into a publishable result.',
    outcomes: ['Execute concepts difficult to film traditionally', 'Create versions, languages and formats efficiently', 'Maintain a consistent, human-reviewed direction'],
    deliverables: ['Treatment, script and storyboard', 'Generated scenes or avatar by scope', 'Voiceover and appropriately licensed music', 'Editing, correction and visual consistency', 'Platform-ready masters'],
    process: ['Define use and boundaries', 'Test style and reference scene', 'Produce and generate', 'Edit and review manually', 'Deliver versions'],
    suitableFor: ['Concept advertising', 'Product and service explainers', 'Digital presenters and avatars', 'Multi-language content'],
    faq: [['Is the whole video AI-generated?', 'It may be fully generated or combine filming, design and AI based on the objective.'], ['Can we use a digital avatar?', 'Yes, after agreeing on appearance, voice and usage rights.'], ['How do you keep it consistent?', 'We approve a reference style and manually review scenes and the final edit.']],
    seoTitle: 'AI Video Production Agency in Egypt', metaDescription: 'AI commercial video, digital avatars, voiceover and product content in Egypt with creative direction and human quality review.', keywords: ['AI video production', 'AI commercial video', 'digital avatar', 'AI voiceover'],
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
