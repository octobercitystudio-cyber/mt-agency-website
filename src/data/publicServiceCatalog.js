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
    "title": "تصوير إعلانات للشركات والمصانع في 6 أكتوبر والجيزة",
    "navLabel": "تصوير الإعلانات",
    "eyebrow": "إنتاج إعلاني يناسب نشاطك",
    "heroSummary": "نصوّر إعلانات وفيديوهات تعريفية للشركات والمصانع والمتاجر والعيادات ومكاتب المحاماة، من الفكرة والسيناريو إلى التصوير والمونتاج ونسخ النشر.",
    "heroAlt": "مجسم ثلاثي الأبعاد لكاميرا إعلان سينمائية ومنصة منتج وكلاكيت وإضاءة احترافية.",
    "introduction": "Multi Task Agency شركة إنتاج إعلامي في مدينة 6 أكتوبر، الجيزة. نقدم تصوير الإعلانات التجارية وفيديوهات الشركات والمنتجات، داخل الاستديو أو في مقر العميل بالجيزة والقاهرة حسب نطاق المشروع. نبدأ بتحديد جمهورك والرسالة المطلوبة، ثم نرتب السيناريو والموقع والإضاءة والصوت والمونتاج ليعكس الإعلان طبيعة نشاطك وهويته.",
    "outcomes": [
        "شرح المنتج أو الخدمة بصورة يسهل فهمها",
        "إظهار المكان والفريق وتفاصيل العمل الفعلية",
        "نسخ إعلانية تناسب الموقع ومنصات التواصل والحملة"
    ],
    "deliverables": [
        "فكرة إعلانية ومعالجة بصرية وسيناريو معتمد",
        "خطة تصوير تحدد المواقع والطاقم والمعدات والمشاهد",
        "تصوير المنتجات أو الخدمات أو مقر النشاط حسب الاتفاق",
        "مونتاج وتصحيح ألوان ومعالجة صوت وإضافة الهوية",
        "ترجمة أو تعليق صوتي عند تضمينهما في نطاق المشروع",
        "نسخ أفقية أو رأسية أو مربعة بحسب منصات النشر المتفق عليها"
    ],
    "process": [
        "تحديد النشاط والجمهور وهدف الإعلان",
        "اعتماد الفكرة والسيناريو وعرض السعر",
        "تجهيز الموقع والمنتجات وجدول التصوير",
        "التصوير ثم المونتاج ومراجعة النسخة",
        "تسليم الملفات بالمقاسات المتفق عليها"
    ],
    "suitableFor": [
        "الشركات والعلامات التجارية",
        "المصانع والمنشآت الصناعية",
        "المتاجر والأنشطة التجارية",
        "الأطباء والعيادات والمراكز الطبية",
        "المحامين ومكاتب المحاماة",
        "المطاعم والكافيهات"
    ],
    "serviceType": "تصوير الإعلانات التجارية وفيديوهات الشركات والمصانع والمنتجات",
    "localExpertise": {
        "eyebrow": "من 6 أكتوبر إلى موقع مشروعك",
        "title": "شركة تصوير إعلانات في 6 أكتوبر تخدم الجيزة والقاهرة",
        "summary": "يمكن تنفيذ الإعلان داخل الاستديو أو في مقر الشركة أو المصنع أو العيادة، حسب المشاهد المطلوبة وتجهيزات الموقع. نحدد نطاق الانتقال وتفاصيل التنفيذ ضمن عرض السعر.",
        "items": [
            {
                "title": "الخدمة",
                "text": "إنتاج فيديو إعلاني متكامل: فكرة وسيناريو وتحضير وتصوير ومونتاج وتصحيح ألوان وصوت ونسخ للنشر حسب الاتفاق."
            },
            {
                "title": "الأنشطة التي نخدمها",
                "text": "الشركات والمصانع والمتاجر والمطاعم، والأطباء والعيادات والمحامون ومقدمو الخدمات المهنية."
            },
            {
                "title": "المقر ونطاق التصوير",
                "text": "مقر Multi Task Agency في مدينة 6 أكتوبر، الجيزة، مصر. ننسق التصوير في الاستديو أو بمواقع العملاء في الجيزة والقاهرة وفق متطلبات المشروع."
            }
        ]
    },
    "decisionGuide": {
        "title": "ما نوع الفيديو المناسب لنشاطك؟",
        "summary": "نختار شكل الإعلان بناءً على ما يحتاج عميلك إلى معرفته، ثم نحدد المشاهد والمخرجات المناسبة بدل استخدام قالب واحد لكل الأنشطة.",
        "options": [
            {
                "title": "تصوير إعلانات وفيديو تعريفي للشركات",
                "text": "عرض خدمات الشركة وفريقها ومقرها وطريقة العمل، لاستخدام الفيديو في الموقع والعروض التعريفية وحملات إطلاق الخدمات."
            },
            {
                "title": "تصوير المصانع وخطوط الإنتاج",
                "text": "فيديو تعريفي للمصنع يوضح مراحل التصنيع والمعدات والمنتجات. ننسق المشاهد مع فريق المصنع ومواعيد التشغيل وتعليمات الدخول والتصوير."
            },
            {
                "title": "تصوير المنتجات والمتاجر والأنشطة التجارية",
                "text": "لقطات توضح تفاصيل المنتج وطريقة استخدامه، أو جولة في المتجر وتجربة الخدمة، مع نسخ مناسبة للمتجر الإلكتروني والإعلانات الرقمية."
            },
            {
                "title": "تصوير إعلانات للأطباء والعيادات",
                "text": "فيديو تعريفي بالطبيب والعيادة، وشرح مبسط للخدمات والمعلومات التي يقدمها الطبيب. يعتمد العميل المحتوى قبل النشر، وتُراعى خصوصية الأشخاص الظاهرين في التصوير."
            },
            {
                "title": "تصوير محتوى للمحامين ومكاتب المحاماة",
                "text": "تقديم المحامي وفريق المكتب ومجالات العمل، وتصوير محتوى تعريفي وتوعوي يشرح الخدمات بلغة واضحة، دون عرض معلومات سرية تخص العملاء."
            },
            {
                "title": "تصوير إعلانات المطاعم والكافيهات",
                "text": "إبراز الأطباق والمشروبات والمكان وتجربة الزيارة، مع مشاهد تناسب الإعلانات والريلز والعروض الموسمية."
            }
        ],
        "factorsTitle": "ما الذي يحدد تكلفة تصوير الإعلان؟",
        "factors": [
            {
                "title": "الفكرة والسيناريو",
                "text": "عدد المشاهد، مدة الفيديو، واحتياج المشروع إلى كتابة أو تعليق صوتي أو ظهور أشخاص أمام الكاميرا."
            },
            {
                "title": "المواقع وأيام التصوير",
                "text": "التصوير داخل الاستديو أو خارجه، وعدد المواقع وأيام العمل وترتيبات الانتقال والتجهيز."
            },
            {
                "title": "الفريق والمعدات",
                "text": "عدد الكاميرات ومتطلبات الإضاءة والصوت والطاقم بما يناسب جودة التنفيذ المتفق عليها."
            },
            {
                "title": "المونتاج ونسخ التسليم",
                "text": "الجرافيك والترجمة ومعالجة الصوت والألوان وعدد المقاسات والنسخ وجولات المراجعة."
            }
        ]
    },
    "faq": [
        [
            "هل تصورون إعلانات للشركات والمصانع في 6 أكتوبر؟",
            "نعم. تقدم Multi Task Agency تصوير الإعلانات التجارية والفيديوهات التعريفية للشركات والمصانع من مقرها في مدينة 6 أكتوبر، مع تنفيذ التصوير في الاستديو أو موقع العميل في الجيزة والقاهرة حسب الاتفاق."
        ],
        [
            "هل يمكن تصوير الإعلان داخل المصنع أو مقر الشركة؟",
            "نعم، حسب متطلبات المشروع وإتاحة الموقع. نحدد المشاهد والمساحات المطلوبة، وننسق مواعيد التصوير وتجهيزات الإضاءة والصوت مع مسؤول الموقع قبل التنفيذ."
        ],
        [
            "هل الخدمة مناسبة للأطباء والمحامين والأنشطة التجارية؟",
            "نعم. نخصص الفكرة والسيناريو لطبيعة العيادة أو مكتب المحاماة أو المتجر أو النشاط، مع اعتماد المعلومات من العميل قبل التنفيذ والنشر ومراعاة خصوصية من يظهرون في الفيديو."
        ],
        [
            "ما الفرق بين الإعلان التجاري والفيديو التعريفي للشركة؟",
            "الإعلان التجاري يركز على منتج أو خدمة ورسالة محددة لحملة، بينما يشرح الفيديو التعريفي هوية الشركة وفريقها وقدراتها وطريقة عملها. يمكن إنتاج النوعين ونسخ قصيرة منهما ضمن نطاق متفق عليه."
        ],
        [
            "كم تكلفة تصوير إعلان أو فيديو تعريفي لمصنع؟",
            "لا يوجد سعر موحد لكل المشروعات. تُحسب التكلفة وفق الفكرة وعدد المواقع وأيام التصوير والطاقم والمعدات والمونتاج والنسخ المطلوبة. أرسل وصف النشاط والهدف ومكان التصوير للحصول على عرض سعر واضح قبل البدء."
        ],
        [
            "هل تشمل الخدمة كتابة السيناريو والمونتاج؟",
            "يمكن أن يشمل المشروع الفكرة والسيناريو والتحضير والتصوير والمونتاج وتصحيح الألوان والصوت. نوضح في عرض السعر ما إذا كانت الترجمة والتعليق الصوتي والجرافيك ضمن التسليمات."
        ],
        [
            "هل أحصل على نسخ مناسبة للسوشيال ميديا والموقع؟",
            "نعم، نحدد مسبقًا المقاسات والمدد المطلوبة للموقع وInstagram وFacebook وTikTok وYouTube، ونسلم النسخ المتفق عليها. إدارة الحملات وميزانية نشر الإعلان تُناقشان بشكل مستقل."
        ],
        [
            "كم يستغرق التنفيذ وكيف أطلب عرض سعر؟",
            "تتحدد المدة بعد اعتماد الفكرة وتوفر الموقع والمنتجات والمواد المطلوبة. تواصل عبر نموذج الخدمة أو واتساب، وأرسل نوع النشاط والهدف ومكان التصوير وعدد الفيديوهات ومنصات النشر؛ ثم نحدد النطاق والجدول والمراجعات والتسليم."
        ]
    ],
    "relatedServicesTitle": "خدمات تكمل إعلانك",
    "relatedServicesSummary": "اربط الفيديو بنسخ قصيرة وهوية واضحة وخطة نشر مناسبة لنشاطك.",
    "relatedServices": [
        {
            "slug": "reels-production",
            "title": "تصوير ومونتاج الريلز",
            "text": "محتوى قصير ومتجدد للمنتجات والخدمات ومنصات التواصل."
        },
        {
            "slug": "creative-design-branding",
            "title": "التصميم والهوية البصرية",
            "text": "هوية ورسائل بصرية متسقة مع شكل الإعلان والبراند."
        },
        {
            "slug": "social-media-management",
            "title": "إدارة السوشيال ميديا",
            "text": "تنظيم نشر المحتوى ومتابعة حضور النشاط على المنصات."
        }
    ],
    "seoTitle": "تصوير إعلانات للشركات والمصانع في 6 أكتوبر والجيزة",
    "metaDescription": "تصوير إعلانات للشركات والمصانع والمنتجات والعيادات ومكاتب المحاماة في 6 أكتوبر والجيزة والقاهرة. Multi Task Agency: سيناريو وتصوير ومونتاج. اطلب عرض سعر.",
    "keywords": [
        "تصوير إعلانات للشركات",
        "تصوير إعلانات للمصانع",
        "تصوير فيديو تعريفي للشركات",
        "تصوير مصانع وخطوط إنتاج",
        "تصوير منتجات احترافي",
        "تصوير إعلانات للأطباء والعيادات",
        "تصوير محتوى للمحامين",
        "شركة تصوير إعلانات في 6 أكتوبر",
        "إنتاج فيديو إعلاني في الجيزة",
        "تصوير إعلانات تجارية في القاهرة"
    ]
}, {
    "title": "Commercial Video Production for Companies and Factories in Giza",
    "navLabel": "Commercial Video",
    "eyebrow": "Production shaped around your business",
    "heroSummary": "Commercials and corporate films for companies, factories, retailers, clinics and law firms, from concept and script to filming, editing and platform-ready exports.",
    "heroAlt": "A 3D commercial film set with cinema camera, product pedestal, clapperboard and lights.",
    "introduction": "Multi Task Agency is a media production company based in 6th of October City, Giza, Egypt. We produce commercial videos, corporate profiles and product films in our studio or at client locations in Giza and Cairo, according to the project scope. We define the audience and message before planning the script, location, lighting, sound and edit around your business identity.",
    "outcomes": [
        "Make products and services easier to understand",
        "Show the actual workplace, team and process",
        "Deliver versions suited to websites, social platforms and campaigns"
    ],
    "deliverables": [
        "Approved concept, visual treatment and script",
        "Shoot plan covering locations, crew, equipment and scenes",
        "Product, service or business-location filming by scope",
        "Editing, color correction, sound finishing and brand elements",
        "Captions or voice-over when included in the scope",
        "Agreed landscape, vertical or square delivery formats"
    ],
    "process": [
        "Define the business, audience and campaign objective",
        "Approve the concept, script and quotation",
        "Prepare the location, products and shoot schedule",
        "Film, edit and review the draft",
        "Deliver the agreed file formats"
    ],
    "suitableFor": [
        "Companies and brands",
        "Factories and industrial businesses",
        "Retailers and commercial businesses",
        "Doctors, clinics and medical centers",
        "Lawyers and law firms",
        "Restaurants and cafes"
    ],
    "serviceType": "Commercial, corporate, industrial and product video production",
    "localExpertise": {
        "eyebrow": "From 6th of October to your location",
        "title": "A Giza video production company serving 6th of October and Cairo",
        "summary": "We can film in the studio, an office, a factory or a clinic, depending on the required scenes and location setup. Travel and production arrangements are defined in the quotation.",
        "items": [
            {
                "title": "The service",
                "text": "Concept, script, preparation, filming, editing, color and sound finishing, with publish-ready versions according to the agreed scope."
            },
            {
                "title": "Who we work with",
                "text": "Companies, manufacturers, retailers and restaurants, as well as doctors, clinics, lawyers and professional service providers."
            },
            {
                "title": "Location and filming area",
                "text": "Multi Task Agency is based in 6th of October City, Giza, Egypt. Studio shoots and client-location filming in Giza and Cairo are arranged according to project needs."
            }
        ]
    },
    "decisionGuide": {
        "title": "Which video format fits your business?",
        "summary": "We choose the format around what your customer needs to understand, then plan the scenes and deliverables for that purpose.",
        "options": [
            {
                "title": "Commercials and corporate profile videos",
                "text": "Introduce company services, people, premises and working methods for a website, business presentation or service launch campaign."
            },
            {
                "title": "Factory and production-line filming",
                "text": "An industrial profile showing manufacturing stages, equipment and products. We coordinate scenes with the factory team, operating schedule and site access requirements."
            },
            {
                "title": "Product, retail and commercial videos",
                "text": "Show product details and use cases, or the store and service experience, with versions suited to an online shop and digital advertising."
            },
            {
                "title": "Video production for doctors and clinics",
                "text": "Introduce the doctor and clinic and explain services using information supplied and approved by the client. The privacy of people appearing in the video is respected."
            },
            {
                "title": "Content for lawyers and law firms",
                "text": "Introduce the lawyer, team and practice areas, with clear service explanations and educational content that does not disclose confidential client information."
            },
            {
                "title": "Restaurant and cafe commercials",
                "text": "Show dishes, drinks, interiors and the visitor experience through scenes for advertising, Reels and seasonal offers."
            }
        ],
        "factorsTitle": "What determines the video production cost?",
        "factors": [
            {
                "title": "Concept and script",
                "text": "Scene count, running time, writing, voice-over and any on-camera participants required by the concept."
            },
            {
                "title": "Locations and shoot days",
                "text": "Studio or location filming, the number of sites and working days, travel and preparation."
            },
            {
                "title": "Crew and equipment",
                "text": "Camera count, lighting, sound and the crew needed for the agreed production approach."
            },
            {
                "title": "Editing and deliverables",
                "text": "Graphics, captions, sound and color work, output formats, versions and review rounds."
            }
        ]
    },
    "faq": [
        [
            "Do you film companies and factories in 6th of October?",
            "Yes. Multi Task Agency provides commercials and corporate and factory profile videos from its base in 6th of October City. Filming takes place in the studio or at client locations in Giza and Cairo by agreement."
        ],
        [
            "Can you film inside our factory or office?",
            "Yes, subject to project needs and location availability. We define the scenes and spaces and coordinate the schedule, lighting and sound setup with the site contact before production."
        ],
        [
            "Is the service suitable for doctors, lawyers and retailers?",
            "Yes. We adapt the concept and script to the clinic, law firm, store or other business. The client approves the information before production and publication, and the privacy of people appearing on camera is respected."
        ],
        [
            "What is the difference between a commercial and a corporate profile?",
            "A commercial focuses on a product, service and campaign message. A corporate profile explains the company identity, team, capabilities and working methods. Both formats and shorter versions can be included in an agreed scope."
        ],
        [
            "How much does a commercial or factory profile video cost?",
            "There is no single price for every project. Cost depends on the concept, locations, filming days, crew, equipment, editing and deliverables. Send your business description, objective and filming location for a clear quotation before work begins."
        ],
        [
            "Are scriptwriting and editing included?",
            "The scope can cover the concept, script, preparation, filming, editing, color and sound finishing. The quotation specifies whether captions, voice-over and graphics are included."
        ],
        [
            "Can you deliver versions for social media and our website?",
            "Yes. We agree the formats and lengths for your website, Instagram, Facebook, TikTok and YouTube before production. Campaign management and advertising spend are discussed separately."
        ],
        [
            "How long does production take and how do I request a quote?",
            "Timing is agreed after the concept is approved and locations, products and materials are available. Use the service contact form or WhatsApp to send your business type, goal, location, video count and publishing platforms. We then define the scope, schedule, reviews and delivery."
        ]
    ],
    "relatedServicesTitle": "Services that support your commercial",
    "relatedServicesSummary": "Connect your video to short-form content, consistent branding and a suitable publishing plan.",
    "relatedServices": [
        {
            "slug": "reels-production",
            "title": "Reels production",
            "text": "Regular short-form product and service content for social platforms."
        },
        {
            "slug": "creative-design-branding",
            "title": "Creative design and branding",
            "text": "A consistent visual identity and message across the commercial and brand."
        },
        {
            "slug": "social-media-management",
            "title": "Social media management",
            "text": "Organized publishing and support for your business presence on social platforms."
        }
    ],
    "seoTitle": "Corporate & Factory Video Production in Giza",
    "metaDescription": "Multi Task Agency films commercial, corporate, factory and product videos for businesses, clinics and law firms in 6th of October, Giza and Cairo. Request a quote.",
    "keywords": [
        "commercial video production Giza",
        "corporate video production Egypt",
        "factory video production",
        "industrial video production",
        "product filming Cairo",
        "clinic video production",
        "law firm video production",
        "video production company 6th of October"
    ]
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
  entry('social-media-management', 'social_media', 'Share2', 'marketing', ['design'], '/service-heroes/social-media-management.webp', {
    title: 'إدارة السوشيال ميديا في 6 أكتوبر والجيزة', navLabel: 'إدارة السوشيال ميديا', eyebrow: 'حضور مستمر بدل النشر العشوائي',
    heroSummary: 'إدارة سوشيال ميديا للشركات في 6 أكتوبر والجيزة تشمل خطة المحتوى وكتابة وتصميم المنشورات وإدارة المنصات وتقارير الأداء بنطاق مرن.',
    heroAlt: 'مجسم ثلاثي الأبعاد لهاتف وتقويم محتوى وبطاقات منشورات ورسوم تحليل أداء.',
    introduction: 'نربط الرسائل بالمحتوى والتوزيع والقياس في نظام واحد، مع وضوح ما سينشر ولماذا وكيف يتحسن الأداء.',
    outcomes: ['تقويم نشر واضح ومتوازن', 'صوت وهوية متسقان عبر المنصات', 'قرارات مبنية على تقارير قابلة للفهم'],
    deliverables: ['استراتيجية وخطة محتوى', 'كتابة وتصميم المنشورات', 'قوالب بصرية متسقة للمنصات', 'إدارة النشر والتفاعل المتفق عليه', 'تقارير وتحليل وإعلانات ممولة اختيارية'],
    process: ['مراجعة البراند والجمهور', 'بناء الخطة والأعمدة', 'الإنتاج والموافقة', 'النشر وإدارة الدورة', 'القياس والتحسين الشهري'],
    suitableFor: ['الشركات الناشئة', 'العيادات والخدمات', 'المطاعم والمتاجر', 'البراندات متعددة المنصات'],
    faq: [['هل كل الباقات متشابهة؟', 'لا، يتغير النطاق حسب عدد المنصات والمنشورات والتصميمات والإعلانات والخدمات المطلوبة.'], ['هل تشمل الإعلانات الممولة؟', 'يمكن إضافة إدارة الحملات وميزانية الإعلان كبند واضح منفصل.'], ['كيف أتابع التنفيذ؟', 'تظهر مراحل العمل والحالة المالية والتحديثات من خلال لوحة العميل.']],
    serviceType: 'إدارة السوشيال ميديا وصناعة المحتوى',
    localExpertise: {
      eyebrow: 'فريق محتوى قريب من نشاطك',
      title: 'إدارة شهرية تربط الخطة بالتصميم والنشر',
      summary: 'نبني دورة عمل واضحة من أعمدة المحتوى والموافقات إلى الكتابة والتصميم والنشر والتقارير، مع نطاق يناسب احتياج كل براند.',
      items: [
        { title: 'ما نقدمه', text: 'استراتيجية وتقويم محتوى وكتابة وتصميم منشورات، مع النشر والتقارير وإدارة الحملات عند إضافتها للنطاق.' },
        { title: 'لمن تناسب', text: 'للشركات الناشئة والعيادات والمطاعم والمتاجر والخدمات والبراندات التي تدير أكثر من منصة.' },
        { title: 'نطاق الخدمة', text: 'نعمل مع الشركات في مدينة 6 أكتوبر والشيخ زايد ومناطق الجيزة، مع اجتماعات تخطيط ومراجعات محتوى منتظمة.' },
      ],
    },
    seoTitle: 'شركة إدارة سوشيال ميديا في 6 أكتوبر والجيزة', metaDescription: 'إدارة صفحات السوشيال ميديا للشركات في 6 أكتوبر والجيزة: استراتيجية وخطة محتوى وكتابة وتصميم منشورات ونشر وتقارير وإعلانات ممولة اختيارية.', keywords: ['إدارة السوشيال ميديا', 'صناعة المحتوى', 'خطة محتوى', 'تصميم بوستات'],
  }, {
    title: 'Social Media Management in 6th of October and Giza', navLabel: 'Social Media', eyebrow: 'A consistent presence, not random posting',
    heroSummary: 'Social media management for businesses in 6th of October and Giza, combining content strategy, copywriting, post design, channel management and reporting.',
    heroAlt: 'A 3D phone, content calendar, post cards and analytics shapes for social media management.',
    introduction: 'We connect messaging, production, distribution and measurement in one workflow with clear visibility into what is published and why.',
    outcomes: ['A clear, balanced publishing calendar', 'Consistent brand voice across channels', 'Understandable performance-led decisions'],
    deliverables: ['Strategy and content plan', 'Copywriting and post design', 'Consistent visual templates for each channel', 'Publishing and agreed community tasks', 'Reporting, analysis and optional paid media'],
    process: ['Audit brand and audience', 'Build pillars and plan', 'Produce and approve', 'Publish and manage', 'Measure and improve monthly'],
    suitableFor: ['Startups', 'Clinics and service brands', 'Restaurants and retailers', 'Multi-platform brands'],
    faq: [['Are all packages the same?', 'No. Scope changes by platforms, post and design volume, ads and support needs.'], ['Are paid ads included?', 'Campaign management and media budget can be added as clear separate items.'], ['How do I follow progress?', 'Project stages, financial status and updates are visible in the client dashboard.']],
    serviceType: 'Social media management and content production',
    localExpertise: {
      eyebrow: 'A content team close to your business',
      title: 'Monthly management that connects planning, design and publishing',
      summary: 'We build a clear workflow from content pillars and approvals to copywriting, design, publishing and reporting, with a scope shaped around each brand.',
      items: [
        { title: 'What we provide', text: 'Strategy, content calendar, copywriting and post design, with publishing, reporting and campaign management when included.' },
        { title: 'Who it is for', text: 'Startups, clinics, restaurants, retailers, service businesses and brands working across multiple platforms.' },
        { title: 'Where we work', text: 'We work with businesses in 6th of October City, Sheikh Zayed and Giza, with regular planning sessions and content reviews.' },
      ],
    },
    seoTitle: 'Social Media Management in 6th of October and Giza', metaDescription: 'Social media management for businesses in 6th of October and Giza, with strategy, content planning, copywriting, post design, publishing, reporting and optional paid campaigns.', keywords: ['social media management', 'content strategy', 'post design', 'paid social campaigns'],
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
const isReelsPortfolioItem = item => {
  const category = `${normalizedCategory(item)} ${String(item?.type || '')} ${String(item?.format || '')} ${String(item?.mediaType || '')}`.toLowerCase();
  const title = titleText(item);
  const mediaUrl = `${item?.embedUrl || ''} ${item?.projectUrl || ''}`.toLowerCase();
  return /(?:^|[\s/_-])reels?(?:$|[\s/_-])/.test(category)
    || /(?:^|[\s/_-])ريل(?:ز)?(?:$|[\s/_-])/.test(category)
    || /(?:^|[\s/_-])reels?(?:$|[\s/_-])/.test(title)
    || /(?:^|[\s/_-])ريل(?:ز)?(?:$|[\s/_-])/.test(title)
    || /(?:youtube\.com\/shorts|youtu\.be\/shorts)/.test(mediaUrl);
};

export const portfolioMatchesService = (item, serviceOrSlug) => {
  const slug = typeof serviceOrSlug === 'string' ? serviceOrSlug : serviceOrSlug?.slug;
  if (!slug) return false;
  if (slug === 'social-media-management' && isReelsPortfolioItem(item)) return false;
  const explicit = normalizedSlugs(item);
  if (explicit.length) return explicit.includes(slug);
  const category = normalizedCategory(item);
  if (category === 'reels') return slug === 'reels-production';
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
