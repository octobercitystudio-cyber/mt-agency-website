import { getBookingAvailability } from './bookingAvailability';

const isFriday = date => Boolean(date) && new Date(`${date}T12:00:00`).getDay() === 5;
const minutes = value => {
  const [hour = 0, minute = 0] = String(value || '').split(':').map(Number);
  return (hour === 24 ? 1440 : hour * 60) + minute;
};

export function customSlotValidation(slot, bookings = []) {
  if (!slot.resource_id || !slot.date || !slot.start_time || !slot.end_time) return { status: 'incomplete', available: false, message: 'اختر المورد والتاريخ والوقت لفحص الإتاحة.' };
  if (isFriday(slot.date)) return { status: 'invalid', available: false, message: 'يوم الجمعة إجازة رسمية للشركة.' };
  const duration = minutes(slot.end_time) - minutes(slot.start_time);
  if (minutes(slot.start_time) < 720 || minutes(slot.end_time) > 1440 || duration < 60 || duration % 15 !== 0) return { status: 'invalid', available: false, message: 'الموعد من 12:00 م إلى 12:00 ص، بحد أدنى ساعة وزيادات 15 دقيقة.' };
  const result = getBookingAvailability(slot, bookings);
  if (!result.available) {
    const conflict = result.conflicts[0];
    return { ...result, message: `الموعد متعارض مع ${conflict?.client_name || 'عميل آخر'} من ${String(conflict?.start_time || '').slice(0, 5)} إلى ${String(conflict?.end_time || '').slice(0, 5)}.` };
  }
  return { ...result, message: 'الموعد متاح وسيُرسل كطلب بانتظار التأكيد.' };
}
