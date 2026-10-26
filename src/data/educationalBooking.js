export const EDUCATIONAL_BOOKING_TARGET = '/dashboard?tab=book-studio';
export const EDUCATIONAL_BOOKING_SERVICE = '/services/studio-content-production';
export const EDUCATIONAL_BOOKING_GALLERY = [
  {
    id: 'camera-and-smartboard',
    url: '/studio/educational-cinematic/camera-and-smartboard.webp',
    thumbnail: '/studio/educational-cinematic/camera-and-smartboard-thumb.webp',
    alt: 'كاميرا التصوير أمام الشاشة التفاعلية داخل استديو أكتوبر',
    altEn: 'Filming camera facing the interactive smartboard inside October Studio',
    label: 'داخل الاستديو', labelEn: 'The studio',
  },
  {
    id: 'interactive-smartboard',
    url: '/studio/educational-cinematic/interactive-smartboard.webp',
    thumbnail: '/studio/educational-cinematic/interactive-smartboard-thumb.webp',
    alt: 'الشاشة التفاعلية وجدران العزل الصوتي في استديو التصوير التعليمي',
    altEn: 'Interactive smartboard and acoustic wall panels in the educational filming studio',
    label: 'الشاشة التفاعلية', labelEn: 'Smartboard',
  },
  {
    id: 'recording-detail',
    url: '/studio/educational-cinematic/recording-detail.webp',
    thumbnail: '/studio/educational-cinematic/recording-detail-thumb.webp',
    alt: 'لقطة قريبة لكاميرا الاستديو وشاشة معاينة التصوير',
    altEn: 'Close-up of the studio camera and recording preview display',
    label: 'تفاصيل التصوير', labelEn: 'Camera detail',
  },
];
export const EDUCATIONAL_BOOKING_IMAGE = EDUCATIONAL_BOOKING_GALLERY[0];

export const EDUCATIONAL_BOOKING_COPY = {
  ar: {
    eyebrow: 'للمدرسين والمحاضرين وصنّاع الكورسات',
    title: 'تصوير المحاضرات والكورسات',
    description: 'استديو مجهز بالكاميرا والصوت لتصوير محتواك التعليمي. اختر الباقة والموعد من حسابك.',
    stepsLabel: 'حجزك في ثلاث خطوات',
    steps: ['اختر نظام التصوير', 'حدد موعدًا أو أكثر', 'أرسل طلب الحجز'],
    action: 'حجز موعد تصوير محتوى تعليمي',
    note: 'سجّل الدخول أو أنشئ حسابًا؛ ستراجع تفاصيل الباقة والتكلفة قبل إرسال الطلب.',
    details: 'تعرّف على خدمة التصوير',
    appLabel: 'تطبيق MTA للأندرويد',
    appTitle: 'احجز وتابع باقتك من موبايلك',
    appDescription: 'احجز المواعيد وتابع الساعات والمدفوعات والتسليمات.',
    appAction: 'حمّل تطبيق MTA للأندرويد',
    appNote: 'تحميل مباشر للتطبيق بصيغة APK.',
    imageLabel: 'من داخل استديو أكتوبر',
    imageCaption: 'استديو مجهز للتصوير التعليمي',
  },
  en: {
    eyebrow: 'For teachers, lecturers and course creators',
    title: 'Film lectures and courses',
    description: 'A studio with cameras and sound for educational filming. Choose a package and session time from your account.',
    stepsLabel: 'Book in three steps',
    steps: ['Choose a filming plan', 'Select one or more sessions', 'Send your booking request'],
    action: 'Book an educational filming session',
    note: 'Log in or create an account; review the package and price before submitting.',
    details: 'Explore our filming service',
    appLabel: 'MTA app for Android',
    appTitle: 'Book and track your package on your phone',
    appDescription: 'Book sessions and track hours, payments and deliveries.',
    appAction: 'Download MTA for Android',
    appNote: 'Direct app download in APK format.',
    imageLabel: 'Inside October Studio',
    imageCaption: 'Studio for educational filming',
  },
};
