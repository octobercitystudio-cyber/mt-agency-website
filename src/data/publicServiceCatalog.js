const entry = (slug, erpServiceType, icon, group, portfolioCategories, heroImage, ar, en) => ({
  slug, erpServiceType, icon, group, portfolioCategories,
  heroImage: heroImage.replace('/service-heroes/', '/brand/gold/services/'),
  ar: { ...ar, heroAlt: `صورة توضيحية لخدمة ${ar.navLabel} بإضاءة ذهبية دافئة.` },
  en: { ...en, heroAlt: `Illustrative image of ${en.navLabel} in warm golden light.` },
});

export const publicServiceCatalog = [
  entry('studio-content-production', 'studio', 'Camera', 'production', ['video'], '/service-heroes/studio-content-production.webp', {
    title: "تصوير المحتوى داخل الاستديو", navLabel: 'الاستديو وصناعة المحتوى', eyebrow: 'استديوهات مجهزة في القاهرة',
    heroSummary: "استديو مجهز لتصوير الكورسات وحلقات الخبراء. احجز بالساعة أو اليوم أو ضمن باقة شهرية.", cardSummary: "تصوير كورسات ومحتوى تعليمي داخل الاستديو.",
    heroAlt: 'مجسم ثلاثي الأبعاد لاستديو محتوى مجهز بكاميرا سينمائية وإضاءة وشاشة إنتاج.',
    deliverables: ["تجهيز الاستديو والإضاءة والصوت","تصوير بكاميرات متعددة عند الحاجة","ملفات خام منظمة، والمونتاج حسب الاتفاق"],
    suitableFor: ['المدربين وصناع الكورسات', 'الأطباء والخبراء', 'قنوات يوتيوب والمحتوى الدوري', 'الشركات التي تبني مكتبة تعليمية'],
    faq: [['هل أقل حجز ساعة؟', 'نعم، ثم يمكن احتساب الزيادات بربع أو نصف ساعة حسب الاتفاق.'], ['هل المونتاج مشمول؟', 'يمكن تسليم الملفات الخام أو إضافة المونتاج والهوية البصرية حسب نطاق المشروع.']],
    seoTitle: 'استديو تصوير محتوى وكورسات في 6 أكتوبر', metaDescription: 'استديو تصوير مجهز للكورسات والمحتوى التعليمي والفيديو الاحترافي في مدينة 6 أكتوبر، بباقات ساعة ويوم وشهر.', keywords: ['استوديو تصوير في القاهرة', 'تصوير كورسات', 'تصوير محتوى تعليمي', 'إيجار استوديو تصوير مجهز'],
  }, {
    title: "Studio Content Filming", navLabel: 'Studio & Content', eyebrow: 'Equipped studios in Cairo',
    heroSummary: "Film courses and expert videos in an equipped studio. Book by the hour, day or monthly package.", cardSummary: "Film courses and educational content in our studio.",
    heroAlt: 'A 3D content studio equipped with a cinema camera, production lighting and monitor.',
    deliverables: ["Studio, lighting and sound setup","Multi-camera recording when needed","Organized raw files, with editing by agreement"],
    suitableFor: ['Educators and course creators', 'Doctors and subject experts', 'YouTube and recurring content teams', 'Companies building training libraries'],
    faq: [['Is the minimum booking one hour?', 'Yes. Additional time can be calculated in quarter- or half-hour increments by agreement.'], ['Is editing included?', 'You can receive organized raw footage or add editing and visual branding to the scope.']],
    seoTitle: 'Content and Course Filming Studio in 6th of October', metaDescription: 'Equipped 6th of October studio for courses, educational content and professional video, with hourly, daily and monthly packages.', keywords: ['Cairo content studio', 'course filming', 'educational video production', 'equipped filming studio'],
  }),
  entry('reels-production', 'reels', 'Smartphone', 'production', ['reels'], '/service-heroes/reels-production.webp', {
    title: "تصوير ومونتاج ريلز", navLabel: 'تصوير الريلز', eyebrow: 'محتوى قصير يلفت من أول ثانية',
    heroSummary: "نخطط مجموعة ريلز، نصورها، ونسلم فيديوهات عمودية جاهزة للنشر. يتحدد العرض حسب عدد الريلز ونطاق التصوير والمونتاج.", cardSummary: "أفكار وتصوير ومونتاج فيديوهات قصيرة.",
    heroAlt: 'مجسم ثلاثي الأبعاد لهاتف رأسي وكاميرا وإضاءة حلقية ومسار مونتاج للفيديو القصير.',
    deliverables: ["أفكار وسيناريوهات قصيرة حسب الاتفاق","جلسة تصوير للعدد المتفق عليه","مونتاج عمودي وترجمة ونسخ جاهزة للنشر"],
    suitableFor: ['البراندات والمتاجر', 'الأطباء والخبراء', 'المطاعم والخدمات المحلية', 'صناع المحتوى الشخصي'],
    faq: [['هل التسعير على وقت التصوير؟', 'يتم تخصيص وقت في الجدول، بينما التسعير الأساسي يكون حسب عدد الريلز ونطاق التنفيذ.'], ['هل تكتبون الأفكار؟', 'نعم، يمكن أن تشمل الباقة البحث والأفكار والسيناريوهات القصيرة.']],
    serviceType: 'تصوير ومونتاج الريلز والفيديوهات القصيرة',
    seoTitle: 'تصوير ومونتاج ريلز في 6 أكتوبر والجيزة', metaDescription: 'تصوير ومونتاج ريلز وفيديوهات قصيرة للبراندات والخبراء في 6 أكتوبر والجيزة، من الأفكار والهوكس حتى النسخ الجاهزة للنشر.', keywords: ['تصوير ريلز احترافي', 'مونتاج ريلز', 'فيديوهات قصيرة', 'صناعة محتوى سوشيال ميديا'],
  }, {
    title: "Reels Filming and Editing", navLabel: 'Reels Production', eyebrow: 'Short content that earns attention',
    heroSummary: "We plan and film a batch of Reels, then deliver vertical videos ready to publish. Pricing depends on the number of videos and production scope.", cardSummary: "Ideas, filming and editing for short videos.",
    heroAlt: 'A 3D vertical phone, compact camera, ring light and short-form editing timeline.',
    deliverables: ["Ideas and short scripts by agreement","A shoot for the agreed video count","Vertical edits, captions and publish-ready files"],
    suitableFor: ['Brands and retailers', 'Doctors and experts', 'Restaurants and local services', 'Personal creators'],
    faq: [['Is pricing based on shoot time?', 'The shoot receives a calendar slot, while the core price is based on reel count and scope.'], ['Do you write the ideas?', 'Yes. Research, ideas and concise scripts can be included.']],
    serviceType: 'Reels and short-form video production',
    seoTitle: 'Reels Production in 6th of October and Giza', metaDescription: 'Reels and short-form video production for brands and experts in 6th of October and Giza, from ideas and hooks to publish-ready vertical edits.', keywords: ['professional reels production', 'reels editing', 'short-form video', 'social video production'],
  }),
  entry('commercial-video-production', 'advertising', 'Clapperboard', 'production', ['video'], '/service-heroes/commercial-video-production.webp', {
    "title": "تصوير إعلانات وفيديوهات تعريفية",
    "navLabel": "تصوير الإعلانات",
    "eyebrow": "إنتاج إعلاني يناسب نشاطك",
    "heroSummary": "نصور إعلانات وفيديوهات تعريفية للمنتجات والشركات والمصانع، داخل الاستديو أو في موقع العمل. يشمل العرض المونتاج ونسخ التسليم المتفق عليها.", cardSummary: "إعلانات وفيديوهات تعريفية للمنتجات والشركات.",
    "heroAlt": "مجسم ثلاثي الأبعاد لكاميرا إعلان سينمائية ومنصة منتج وكلاكيت وإضاءة احترافية.",
    "deliverables": ["فكرة وسيناريو وخطة تصوير حسب الاتفاق","تصوير المنتج أو الخدمة أو مقر العمل","مونتاج ومعالجة صوت وألوان","نسخ للموقع والمنصات بالمقاسات المتفق عليها"],
    "suitableFor": ["الشركات والعلامات التجارية", "المصانع والمنشآت الصناعية", "الأطباء والعيادات والمراكز الطبية"],
    "serviceType": "تصوير الإعلانات التجارية وفيديوهات الشركات والمصانع والمنتجات",
    "decisionGuide": {
        "title": "ما نوع الفيديو المناسب لنشاطك؟",
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

    },
    "faq": [[
            "هل يمكن تصوير الإعلان داخل المصنع أو مقر الشركة؟",
            "نعم، حسب متطلبات المشروع وإتاحة الموقع. نحدد المشاهد والمساحات المطلوبة، وننسق مواعيد التصوير وتجهيزات الإضاءة والصوت مع مسؤول الموقع قبل التنفيذ."
        ], [
            "ما الفرق بين الإعلان التجاري والفيديو التعريفي للشركة؟",
            "الإعلان التجاري يركز على منتج أو خدمة ورسالة محددة لحملة، بينما يشرح الفيديو التعريفي هوية الشركة وفريقها وقدراتها وطريقة عملها. يمكن إنتاج النوعين ونسخ قصيرة منهما ضمن نطاق متفق عليه."
        ], [
            "كم تكلفة تصوير إعلان أو فيديو تعريفي لمصنع؟",
            "لا يوجد سعر موحد لكل المشروعات. تُحسب التكلفة وفق الفكرة وعدد المواقع وأيام التصوير والطاقم والمعدات والمونتاج والنسخ المطلوبة. أرسل وصف النشاط والهدف ومكان التصوير للحصول على عرض سعر واضح قبل البدء."
        ], [
            "هل تشمل الخدمة كتابة السيناريو والمونتاج؟",
            "يمكن أن يشمل المشروع الفكرة والسيناريو والتحضير والتصوير والمونتاج وتصحيح الألوان والصوت. نوضح في عرض السعر ما إذا كانت الترجمة والتعليق الصوتي والجرافيك ضمن التسليمات."
        ]],
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
    "title": "Commercial and Corporate Video Production",
    "navLabel": "Commercial Video",
    "eyebrow": "Production shaped around your business",
    "heroSummary": "We film commercials and profile videos for products, companies and factories in studio or on location. Editing and agreed delivery formats are included in the scope.", cardSummary: "Commercials and profile videos for products and businesses.",
    "heroAlt": "A 3D commercial film set with cinema camera, product pedestal, clapperboard and lights.",
    "deliverables": ["Concept, script and shoot plan by agreement","Product, service or workplace filming","Editing, sound and color finishing","Agreed formats for websites and social platforms"],
    "suitableFor": ["Companies and brands", "Factories and industrial businesses", "Doctors, clinics and medical centers"],
    "serviceType": "Commercial, corporate, industrial and product video production",
    "decisionGuide": {
        "title": "Which video format fits your business?",
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

    },
    "faq": [[
            "Can you film inside our factory or office?",
            "Yes, subject to project needs and location availability. We define the scenes and spaces and coordinate the schedule, lighting and sound setup with the site contact before production."
        ], [
            "What is the difference between a commercial and a corporate profile?",
            "A commercial focuses on a product, service and campaign message. A corporate profile explains the company identity, team, capabilities and working methods. Both formats and shorter versions can be included in an agreed scope."
        ], [
            "How much does a commercial or factory profile video cost?",
            "There is no single price for every project. Cost depends on the concept, locations, filming days, crew, equipment, editing and deliverables. Send your business description, objective and filming location for a clear quotation before work begins."
        ], [
            "Are scriptwriting and editing included?",
            "The scope can cover the concept, script, preparation, filming, editing, color and sound finishing. The quotation specifies whether captions, voice-over and graphics are included."
        ]],
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
    title: "تصوير وإنتاج البودكاست", navLabel: 'تصوير البودكاست', eyebrow: 'صوت وصورة يليقان بالحوار',
    heroSummary: "نسجل البودكاست بصوت واضح وتصوير متعدد الكاميرات. يمكنك استلام الملفات الخام أو إضافة مونتاج الحلقة والمقاطع القصيرة.", cardSummary: "تسجيل بودكاست صوت وصورة مع خيارات المونتاج.",
    heroAlt: 'مجسم ثلاثي الأبعاد لطاولة بودكاست بميكروفونين وسماعات وكاميرا داخل غرفة صوتية.',
    deliverables: ["استديو وميكروفونات وكاميرات مناسبة","تسجيل صوت وصورة","مونتاج الحلقة أو مقاطع قصيرة حسب الاتفاق"],
    suitableFor: ['برامج الحوار', 'بودكاست الشركات', 'المقابلات التعليمية', 'المواسم المصورة'],
    faq: [['هل يمكن الحجز بدون مونتاج؟', 'نعم، يمكن حجز وقت الاستديو والتسجيل فقط أو إضافة باقة ما بعد الإنتاج.'], ['كم كاميرا تستخدمون؟', 'يحدد العدد حسب عدد الضيوف والشكل المطلوب للمونتاج.'], ['هل تستخرجون ريلز من الحلقة؟', 'يمكن إضافة حزمة مقاطع قصيرة مترجمة وجاهزة للنشر.']],
    seoTitle: 'استديو وتصوير بودكاست في 6 أكتوبر', metaDescription: 'تصوير وتسجيل بودكاست صوت وصورة متعدد الكاميرات في 6 أكتوبر، مع مونتاج الحلقات واستخراج المقاطع القصيرة.', keywords: ['تصوير بودكاست', 'استوديو بودكاست', 'إنتاج بودكاست مرئي', 'مونتاج بودكاست'],
  }, {
    title: "Video Podcast Production", navLabel: 'Podcast Production', eyebrow: 'Sound and picture worthy of the conversation',
    heroSummary: "Record a podcast with clear audio and multiple cameras. Receive raw files or add episode edits and short clips.", cardSummary: "Record video podcasts with optional editing.",
    heroAlt: 'A 3D acoustic podcast room with two microphones, headphones and a production camera.',
    deliverables: ["Studio, microphones and suitable cameras","Audio and video recording","Episode editing or short clips by agreement"],
    suitableFor: ['Interview shows', 'Corporate podcasts', 'Educational conversations', 'Filmed podcast seasons'],
    faq: [['Can we book recording without editing?', 'Yes. Book the studio and recording only, or add post-production.'], ['How many cameras are used?', 'Coverage depends on guest count and the preferred editing style.'], ['Can you create Reels from the episode?', 'Yes. Add captioned, publish-ready short clips.']],
    seoTitle: 'Video Podcast Studio in 6th of October', metaDescription: 'Multi-camera video podcast recording in 6th of October with clean audio, episode editing and short social clips.', keywords: ['video podcast studio', 'podcast filming', 'podcast recording', 'podcast editing'],
  }),
  entry('event-coverage', 'event_coverage', 'CalendarRange', 'production', ['video'], '/service-heroes/event-coverage.webp', {
    title: "تغطية الفعاليات والمؤتمرات", navLabel: 'تغطية الفعاليات', eyebrow: 'لا نفوّت اللحظة التي تحكي الحدث',
    heroSummary: "نغطي المؤتمرات والافتتاحات بالتصوير الفوتوغرافي والفيديو. حدد ما تحتاجه من صور وفيلم مختصر ومحتوى سريع للنشر.", cardSummary: "تصوير فوتوغرافي وفيديو للمؤتمرات والفعاليات.",
    heroAlt: 'مجسم ثلاثي الأبعاد لمسرح مؤتمر وجمهور وكاميرا تغطي الحدث تحت إضاءة مسرحية.',
    deliverables: ["خطة تغطية حسب برنامج الحدث","صور وفيديو حسب النطاق","فيلم مختصر أو نسخ سريعة عند الاتفاق"],
    suitableFor: ['المؤتمرات والمعارض', 'الافتتاحات وإطلاق المنتجات', 'فعاليات الشركات', 'الحفلات والأنشطة المجتمعية'],
    faq: [['هل توفرون تصويرًا فوتوغرافيًا وفيديو؟', 'يمكن تخصيص الفريق ليغطي أحدهما أو كليهما.'], ['هل يمكن تسليم محتوى أثناء الحدث؟', 'نعم، عند التخطيط المسبق يمكن تجهيز مواد سريعة للنشر في نفس اليوم.'], ['هل التغطية داخل القاهرة فقط؟', 'نحدد الموقع والسفر واللوجستيات ضمن عرض مخصص لكل حدث.']],
    seoTitle: 'تصوير وتغطية فعاليات ومؤتمرات في الجيزة', metaDescription: 'تغطية إيفنتات ومؤتمرات وافتتاحات في الجيزة والقاهرة بالفيديو والصور، مع highlights ومحتوى سريع للسوشيال.', keywords: ['تصوير فعاليات', 'تغطية إيفنتات', 'تصوير مؤتمرات', 'فيديو highlights'],
  }, {
    title: "Event and Conference Coverage", navLabel: 'Event Coverage', eyebrow: 'We capture the moments that tell the event',
    heroSummary: "We cover conferences and launches with photo and video. Choose the photos, highlight film and fast-turnaround content your event needs.", cardSummary: "Photo and video coverage for events and conferences.",
    heroAlt: 'A 3D conference stage, audience and professional camera capturing the event.',
    deliverables: ["Coverage plan based on the event schedule","Photo and video by scope","Highlight film or rapid edits by agreement"],
    suitableFor: ['Conferences and exhibitions', 'Openings and product launches', 'Corporate events', 'Celebrations and community programs'],
    faq: [['Do you provide both photo and video?', 'The crew can be scoped for either or both.'], ['Can you deliver during the event?', 'With advance planning, rapid same-day social assets are available.'], ['Do you cover outside Cairo?', 'Location, travel and logistics are included in a custom event quotation.']],
    seoTitle: 'Event and Conference Video Coverage in Cairo', metaDescription: 'Professional event and conference coverage in Cairo and Giza with photography, highlight films and fast social content.', keywords: ['event coverage', 'conference filming', 'event photography', 'highlight video'],
  }),
  entry('social-media-management', 'social_media', 'Share2', 'marketing', ['design'], '/service-heroes/social-media-management.webp', {
    title: "إدارة منصات التواصل الاجتماعي", navLabel: 'إدارة السوشيال ميديا', eyebrow: 'حضور مستمر بدل النشر العشوائي',
    heroSummary: "ندير محتوى حساباتك من الخطة والكتابة والتصميم إلى النشر وتقارير الأداء. يتحدد عدد المنشورات والمنصات والتفاعل في العرض.", cardSummary: "خطة محتوى وكتابة وتصميم ونشر وتقارير.",
    heroAlt: 'مجسم ثلاثي الأبعاد لهاتف وتقويم محتوى وبطاقات منشورات ورسوم تحليل أداء.',
    deliverables: ["خطة وتقويم محتوى","كتابة وتصميم المنشورات المتفق عليها","نشر وتقارير أداء","الإعلانات الممولة أو إدارة التعليقات عند الاتفاق"],
    suitableFor: ['الشركات الناشئة', 'العيادات والخدمات', 'المطاعم والمتاجر', 'البراندات متعددة المنصات'],
    faq: [['هل كل الباقات متشابهة؟', 'لا، يتغير النطاق حسب عدد المنصات والمنشورات والتصميمات والإعلانات والخدمات المطلوبة.'], ['هل تشمل الإعلانات الممولة؟', 'يمكن إضافة إدارة الحملات وميزانية الإعلان كبند واضح منفصل.'], ['كيف أتابع التنفيذ؟', 'تظهر مراحل العمل والحالة المالية والتحديثات من خلال لوحة العميل.']],
    serviceType: 'إدارة السوشيال ميديا وصناعة المحتوى',
    seoTitle: 'شركة إدارة سوشيال ميديا في 6 أكتوبر والجيزة', metaDescription: 'إدارة صفحات السوشيال ميديا للشركات في 6 أكتوبر والجيزة: استراتيجية وخطة محتوى وكتابة وتصميم منشورات ونشر وتقارير وإعلانات ممولة اختيارية.', keywords: ['إدارة السوشيال ميديا', 'صناعة المحتوى', 'خطة محتوى', 'تصميم بوستات'],
  }, {
    title: "Social Media Management", navLabel: 'Social Media', eyebrow: 'A consistent presence, not random posting',
    heroSummary: "We manage content from planning, copy and design to publishing and performance reports. The proposal sets post volume, channels and community tasks.", cardSummary: "Content planning, posts, publishing and reports.",
    heroAlt: 'A 3D phone, content calendar, post cards and analytics shapes for social media management.',
    deliverables: ["Content plan and calendar","Copy and design for agreed posts","Publishing and performance reports","Paid ads or community management by agreement"],
    suitableFor: ['Startups', 'Clinics and service brands', 'Restaurants and retailers', 'Multi-platform brands'],
    faq: [['Are all packages the same?', 'No. Scope changes by platforms, post and design volume, ads and support needs.'], ['Are paid ads included?', 'Campaign management and media budget can be added as clear separate items.'], ['How do I follow progress?', 'Project stages, financial status and updates are visible in the client dashboard.']],
    serviceType: 'Social media management and content production',
    seoTitle: 'Social Media Management in 6th of October and Giza', metaDescription: 'Social media management for businesses in 6th of October and Giza, with strategy, content planning, copywriting, post design, publishing, reporting and optional paid campaigns.', keywords: ['social media management', 'content strategy', 'post design', 'paid social campaigns'],
  }),
  entry('creative-design-branding', 'creative_design', 'Palette', 'marketing', ['design'], '/service-heroes/creative-design-branding.webp', {
    title: "التصميم الإبداعي والهوية البصرية", navLabel: 'التصميم والهوية', eyebrow: 'هوية يمكن تمييزها وتطبيقها',
    heroSummary: "نصمم شعارًا وهوية بصرية قابلة للاستخدام عبر المنصات. يمكنك إضافة قوالب سوشيال أو مواد مطبوعة حسب نطاق المشروع.", cardSummary: "هوية بصرية وقوالب ومواد تصميم حسب احتياجك.",
    heroAlt: 'مجسم ثلاثي الأبعاد للوحة رسم وقلم وأدلة هندسية وعينات ألوان لتصميم الهوية.',
    deliverables: ["اتجاه بصري وشعار حسب الاتفاق","ألوان وخطوط وقواعد استخدام","ملفات الهوية والقوالب أو المطبوعات المتفق عليها"],
    suitableFor: ['براند جديد', 'إعادة تقديم علامة قائمة', 'حملات ومناسبات', 'فرق تحتاج قوالب موحدة'],
    faq: [['هل تقدمون تصميم لوجو فقط؟', 'يمكن تنفيذ شعار مستقل، لكن نوصي بنطاق يوضح الألوان والخطوط والاستخدام.'], ['ما الملفات التي أستلمها؟', 'تحدد الحزمة ملفات الاستخدام الرقمية والطباعة والقوالب المطلوبة.'], ['هل تصممون بوستات شهرية؟', 'نعم، يمكن ربط الهوية بخدمة تصميم محتوى أو إدارة سوشيال ميديا.']],
    seoTitle: 'تصميم هوية بصرية ولوجو في 6 أكتوبر', metaDescription: 'تصميم هوية بصرية وشعار ونظام ألوان وقوالب سوشيال للشركات في 6 أكتوبر والجيزة، مع ملفات استخدام واضحة.', keywords: ['تصميم هوية بصرية', 'تصميم لوجو', 'براندنج', 'تصميمات سوشيال ميديا'],
  }, {
    title: "Creative Design and Branding", navLabel: 'Design & Branding', eyebrow: 'A recognizable, usable visual system',
    heroSummary: "We design a logo and visual identity for use across channels. Social templates or print materials can be added to the project scope.", cardSummary: "Brand identities, templates and design assets.",
    heroAlt: 'A 3D pen tablet, geometric identity guides and color swatches for creative branding.',
    deliverables: ["Visual direction and logo by agreement","Color, typography and usage rules","Brand files and agreed templates or print items"],
    suitableFor: ['New brands', 'Brand refreshes', 'Campaigns and events', 'Teams that need consistent templates'],
    faq: [['Can you design only a logo?', 'Yes, though a small system covering color, type and usage creates more value.'], ['Which files are delivered?', 'The package defines digital, print and template formats.'], ['Can you design monthly posts?', 'Yes. Branding can connect to ongoing content design or social media management.']],
    seoTitle: 'Brand Identity and Logo Design in Giza', metaDescription: 'Logo, visual identity, color system and social templates for Giza businesses, designed to keep every brand appearance consistent.', keywords: ['brand identity design', 'logo design', 'branding', 'social media design'],
  }),
  entry('web-design-development', 'website', 'MonitorSmartphone', 'digital', ['web'], '/service-heroes/web-design-development.webp', {
    title: "تصميم مواقع ومتاجر إلكترونية", navLabel: 'تصميم المواقع', eyebrow: 'شركة تصميم مواقع في 6 أكتوبر والجيزة',
    heroSummary: "نصمم ونطور مواقع شركات ومتاجر إلكترونية تعمل على الموبايل. نحدد الصفحات والوظائف والإدارة والتكاملات قبل بدء التنفيذ.", cardSummary: "مواقع شركات ومتاجر إلكترونية متوافقة مع الموبايل.",
    heroAlt: 'مجسم ثلاثي الأبعاد لحاسوب وأجهزة متجاوبة تعرض تخطيطات واجهات مواقع.',
    deliverables: ["هيكل صفحات وتصميم متجاوب","تطوير الصفحات ولوحة الإدارة حسب النطاق","إعداد المتجر والدفع والشحن عند الاتفاق","اختبار وتسليم وتهيئة تقنية أساسية لمحركات البحث"],
    suitableFor: ['مواقع الشركات', 'المتاجر الإلكترونية', 'صفحات الحملات', 'منصات المحتوى والخدمات'],
    serviceType: 'تصميم وبرمجة مواقع الشركات والمتاجر الإلكترونية',
    decisionGuide: {
      title: 'أي نوع موقع يناسب مشروعك؟',
      options: [
        { title: 'موقع شركة', text: 'مناسب لعرض الخدمات والخبرة ونماذج الأعمال وتحويل الزائر إلى مكالمة أو رسالة أو طلب عرض سعر.' },
        { title: 'متجر إلكتروني', text: 'مناسب لعرض المنتجات وإدارة الطلبات والمخزون والدفع والشحن وفق طريقة تشغيل المتجر.' },
        { title: 'صفحة هبوط', text: 'مناسبة لحملة أو عرض واحد وتركز على إجراء محدد مثل التسجيل أو الشراء أو طلب التواصل.' },
      ],
    },
    faq: [['هل تنفذون متجرًا إلكترونيًا كاملًا؟', 'نعم، ويحدد النطاق تفاصيل الكتالوج والطلبات والدفع والشحن والمخزون والصلاحيات المطلوبة لإدارة المتجر.'], ['كم تكلفة تصميم وإنشاء موقع إلكتروني؟', 'تتحدد التكلفة بعد معرفة نوع الموقع وعدد الصفحات واللغات والوظائف والتكاملات والمحتوى المطلوب، ثم نقدم نطاقًا وعرض سعر واضحين قبل التنفيذ.'], ['هل أستطيع تعديل محتوى الموقع بنفسي؟', 'يمكن توفير لوحة إدارة وتدريب على تحديث المحتوى والمنتجات وفق التقنية والنطاق المتفق عليهما.'], ['هل تشمل الخدمة الاستضافة وتحسين محركات البحث؟', 'نساعد في اختيار وربط الدومين والاستضافة، وننفذ التهيئة التقنية والأساسية للـSEO. تكاليف الخدمات الخارجية والعمل المستمر على المحتوى أو المنافسة توضح بشكل مستقل.']],
    seoTitle: 'شركة تصميم مواقع في 6 أكتوبر والجيزة', metaDescription: 'تصميم وإنشاء مواقع شركات ومتاجر إلكترونية سريعة ومتوافقة مع الموبايل ومحركات البحث في 6 أكتوبر والجيزة. شاهد أعمالنا واطلب عرض سعر.', keywords: ['شركة تصميم مواقع في 6 أكتوبر', 'تصميم مواقع في الجيزة', 'إنشاء موقع إلكتروني', 'تصميم مواقع شركات', 'برمجة مواقع', 'تصميم متجر إلكتروني', 'شركة برمجة مواقع', 'تصميم UI/UX'],
  }, {
    title: "Website and Online Store Development", navLabel: 'Web Design', eyebrow: 'A web design agency in 6th of October, Giza',
    heroSummary: "We design and build mobile-friendly company sites and online stores. Pages, features, administration and integrations are agreed before development.", cardSummary: "Mobile-friendly company websites and online stores.",
    heroAlt: 'A 3D laptop and responsive devices displaying abstract website interface layouts.',
    deliverables: ["Site structure and responsive design","Pages and dashboard by scope","Store, payments and shipping when agreed","Testing, handover and basic technical SEO setup"],
    suitableFor: ['Company websites', 'Online stores', 'Campaign landing pages', 'Content and service platforms'],
    serviceType: 'Company website and e-commerce design and development',
    decisionGuide: {
      title: 'Which type of website fits your project?',
      options: [
        { title: 'Company website', text: 'Best for presenting services, expertise and work while guiding visitors toward a call, message or quotation request.' },
        { title: 'Online store', text: 'Best for products, orders, inventory, payments and shipping configured around the store operation.' },
        { title: 'Landing page', text: 'Best for one campaign or offer with a focused action such as registration, purchase or enquiry.' },
      ],
    },
    faq: [['Do you build complete online stores?', 'Yes. The scope defines the catalog, orders, payments, shipping, inventory and administration required for the store.'], ['How much does website design and development cost?', 'Cost is defined after clarifying the website type, page count, languages, features, integrations and content needs. We then provide a written scope and quotation before development.'], ['Can I update the website myself?', 'A content management dashboard and training can be included based on the agreed technology and project scope.'], ['Are hosting and SEO included?', 'We can help select and connect the domain and hosting, and we implement technical and foundational SEO. Third-party costs and ongoing content or competitive SEO work are listed separately.']],
    seoTitle: 'Web Design Agency in 6th of October, Giza', metaDescription: 'Company website and e-commerce design in 6th of October, Giza. Fast, mobile-friendly builds with technical SEO, clear scope and verified work.', keywords: ['web design agency 6th of October', 'web development Giza', 'company website design Egypt', 'ecommerce website development', 'website design company', 'responsive UI UX', 'technical SEO website'],
  }),
  entry('software-development', 'software', 'Code2', 'digital', ['web'], '/service-heroes/software-development.webp', {
    title: "تطوير البرامج والتطبيقات", navLabel: 'تطوير البرامج', eyebrow: 'نظام مبني على طريقة عملك',
    heroSummary: "نطور تطبيقات ويب وموبايل وأنظمة إدارة تناسب إجراءات فريقك. نبدأ بتحليل المتطلبات ثم نتفق على مراحل التنفيذ والتسليم.", cardSummary: "تطبيقات وأنظمة إدارة مصممة لسير عملك.",
    heroAlt: 'مجسم ثلاثي الأبعاد لوحدات برامج مترابطة وقاعدة بيانات وتطبيق موبايل وخادم.',
    deliverables: ["تحليل المتطلبات والصلاحيات","تصميم الواجهات وتطوير الوظائف المتفق عليها","اختبارات وإطلاق وتدريب","دعم لاحق حسب الاتفاق"],
    suitableFor: ['أنظمة ERP وCRM', 'بوابات العملاء', 'تطبيقات ويب وموبايل', 'أدوات داخلية حسب الطلب'],
    faq: [['هل تطورون نظامًا من الصفر؟', 'نعم، بعد تحليل العمليات وتحديد الأولويات والمراحل.'], ['كيف أتابع التنفيذ؟', 'نقسم العمل إلى مراحل ومخرجات قابلة للمراجعة قبل الانتقال للمرحلة التالية.'], ['هل تقدمون صيانة؟', 'يحدد عرض المشروع فترة الضمان والدعم والتطوير اللاحق.']],
    seoTitle: 'شركة برمجة وتطوير أنظمة ERP وCRM في الجيزة', metaDescription: 'تطوير تطبيقات ويب وموبايل وبرامج إدارة وأنظمة ERP وCRM مخصصة للشركات في الجيزة ومصر.', keywords: ['برمجة تطبيقات موبايل', 'تطوير تطبيقات ويب', 'أنظمة ERP وCRM', 'برامج حسب الطلب'],
  }, {
    title: "Custom Software Development", navLabel: 'Software Development', eyebrow: 'Software shaped around your operation',
    heroSummary: "We build web and mobile apps and management systems around your workflow. Requirements, development stages and deliverables are agreed first.", cardSummary: "Apps and management systems built for your workflow.",
    heroAlt: 'A 3D connected software system with dashboard modules, database, mobile app and server.',
    deliverables: ["Requirements and permissions analysis","Interface design and agreed feature development","Testing, launch and training","Ongoing support by agreement"],
    suitableFor: ['ERP and CRM systems', 'Client portals', 'Web and mobile apps', 'Custom internal tools'],
    faq: [['Can you build a system from scratch?', 'Yes, after mapping operations, priorities and delivery phases.'], ['How is progress reviewed?', 'Work is divided into reviewable stages and outputs.'], ['Do you provide maintenance?', 'The proposal defines warranty, support and future development.']],
    seoTitle: 'Custom Software, ERP and CRM Development in Egypt', metaDescription: 'Custom web and mobile apps, company management software, ERP and CRM systems designed around Egyptian business workflows.', keywords: ['mobile app development', 'web application development', 'ERP CRM systems', 'custom software'],
  }),
  entry('ai-video-production', 'ai_video', 'WandSparkles', 'digital', ['video'], '/service-heroes/ai-video-production.webp', {
    title: "إنتاج فيديو بالذكاء الاصطناعي", navLabel: 'فيديو الذكاء الاصطناعي', eyebrow: 'خيال أوسع دون فقدان الهدف',
    heroSummary: "ننتج فيديوهات إعلانية وشرح منتجات باستخدام أدوات الذكاء الاصطناعي مع مونتاج ومراجعة بشرية. يتحدد استخدام الأفاتار أو التعليق الصوتي حسب المشروع.", cardSummary: "فيديوهات إعلانية وشرح منتجات بأدوات الذكاء الاصطناعي.",
    heroAlt: 'مجسم ثلاثي الأبعاد لإنتاج فيديو بالذكاء الاصطناعي يضم أفاتار وشرائط سينمائية ومسار مونتاج.',
    deliverables: ["فكرة وسيناريو حسب الاتفاق","مشاهد مولدة أو أفاتار عند الحاجة","مونتاج ومراجعة بشرية","نسخ نهائية بالمقاسات المتفق عليها"],
    suitableFor: ['إعلانات مفاهيمية', 'شرح المنتجات والخدمات', 'أفاتار ومقدم رقمي', 'محتوى متعدد اللغات'],
    faq: [['هل كل الفيديو مولد بالذكاء الاصطناعي؟', 'قد يكون مولدًا بالكامل أو مزيجًا من تصوير وتصميم وAI حسب الهدف.'], ['هل يمكن استخدام أفاتار؟', 'نعم، بعد تحديد الشكل والصوت وحقوق الاستخدام المناسبة.'], ['كيف تحافظون على الاتساق؟', 'نعتمد أسلوبًا مرجعيًا ونراجع المشاهد والمونتاج بشريًا قبل التسليم.']],
    seoTitle: 'إنتاج فيديو بالذكاء الاصطناعي في مصر', metaDescription: 'إنتاج فيديو إعلاني بالذكاء الاصطناعي وأفاتار رقمي وتعليق صوتي في مصر، مع معالجة إبداعية ومراجعة بشرية.', keywords: ['صناعة فيديو بالذكاء الاصطناعي', 'فيديو إعلاني AI', 'أفاتار رقمي', 'تعليق صوتي AI'],
  }, {
    title: "AI Video Production", navLabel: 'AI Video', eyebrow: 'A wider visual canvas with a clear purpose',
    heroSummary: "We produce ads and product explainers with AI tools, editing and human review. Avatars or voiceovers are included when agreed for the project.", cardSummary: "AI-assisted ads and product explainer videos.",
    heroAlt: 'A 3D AI video production scene with synthetic avatar, cinematic frames and editing timeline.',
    deliverables: ["Concept and script by agreement","Generated scenes or avatar when needed","Editing and human review","Final versions in agreed formats"],
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
