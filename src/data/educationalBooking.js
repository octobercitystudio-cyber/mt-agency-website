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
    title: 'تصوير محاضراتك وكورساتك يبدأ من هنا',
    description: 'حوّل شرحك إلى محتوى تعليمي مصوّر، في استديو مجهّز للتصوير وتسجيل الصوت. اختر نظام التصوير المناسب لمحاضراتك أو كورسك، وحدد مواعيدك من حسابك.',
    stepsLabel: 'حجزك في ثلاث خطوات',
    steps: ['اختر نظام التصوير', 'حدد موعدًا أو أكثر', 'أرسل طلب الحجز'],
    action: 'حجز موعد تصوير محتوى تعليمي',
    note: 'سجّل الدخول أو أنشئ حسابًا للمتابعة. ستظهر تفاصيل الباقة والتكلفة قبل إرسال الطلب.',
    details: 'تعرّف على خدمة التصوير',
    imageLabel: 'من داخل استديو أكتوبر',
    imageCaption: 'مساحة مجهّزة لتسجيل محتواك',
  },
  en: {
    eyebrow: 'For teachers, lecturers and course creators',
    title: 'Your next lecture or course starts here',
    description: 'Turn your expertise into educational video in a studio equipped for filming and audio recording. Choose a filming plan for your lectures or course and arrange your sessions from your account.',
    stepsLabel: 'Book in three steps',
    steps: ['Choose a filming plan', 'Select one or more sessions', 'Send your booking request'],
    action: 'Book an educational filming session',
    note: 'Log in or create an account to continue. Review package details and pricing before sending your request.',
    details: 'Explore our filming service',
    imageLabel: 'Inside October Studio',
    imageCaption: 'A space ready for your next recording',
  },
};
