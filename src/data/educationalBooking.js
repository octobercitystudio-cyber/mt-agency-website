import { STUDIO_GALLERIES } from './studioGalleries.js';

export const EDUCATIONAL_BOOKING_TARGET = '/dashboard?tab=book-studio';
export const EDUCATIONAL_BOOKING_SERVICE = '/services/studio-content-production';
export const EDUCATIONAL_BOOKING_IMAGE = STUDIO_GALLERIES.october[0];

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
