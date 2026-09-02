import { formatDurationMinutes } from './businessFormat.js';

export const POST_PRODUCTION_STATUS = {
  editing_in_progress: { label: 'جاري العمل في المونتاج', short: 'المونتاج', step: 1, tone: 'editing' },
  editing_completed: { label: 'اكتمل المونتاج', short: 'اكتمل المونتاج', step: 2, tone: 'completed' },
  uploading: { label: 'جاري الرفع', short: 'جاري الرفع', step: 3, tone: 'uploading' },
  upload_completed: { label: 'اكتمل الرفع', short: 'اكتمل الرفع', step: 4, tone: 'ready' },
  ready_for_pickup: { label: 'جاهزة للاستلام', short: 'استلام من الشركة', step: 4, tone: 'pickup' },
  delivered: { label: 'تم التسليم', short: 'تم التسليم', step: 5, tone: 'delivered' },
};

export const ACTIVE_POST_PRODUCTION_STATUSES = [
  'editing_in_progress', 'editing_completed', 'uploading', 'upload_completed', 'ready_for_pickup',
];

export const postProductionMeta = status => POST_PRODUCTION_STATUS[status] || { label: 'حالة غير معروفة', short: 'غير محدد', step: 0, tone: 'unknown' };

export const postProductionDuration = seconds => {
  const totalMinutes = Math.max(0, Math.round(Number(seconds || 0) / 60));
  return formatDurationMinutes(totalMinutes);
};

export const postProductionSessionLabel = job => job.package_name || job.service || 'جلسة تصوير';
