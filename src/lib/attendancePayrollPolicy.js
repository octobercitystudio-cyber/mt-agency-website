export const ATTENDANCE_START_TIME = '12:00';
export const ATTENDANCE_GRACE_MINUTES = 15;
export const ATTENDANCE_LATE_UNIT_MINUTES = 30;
export const ATTENDANCE_LATE_UNIT_EGP = 10;

export const calculateAttendanceLateCharge = rawLateMinutes => {
  const lateMinutes = Math.max(0, Math.floor(Number(rawLateMinutes) || 0));
  if (lateMinutes <= ATTENDANCE_GRACE_MINUTES) {
    return { rawLateMinutes: lateMinutes, units: 0, billableMinutes: 0, amount: 0 };
  }
  const units = Math.ceil(lateMinutes / ATTENDANCE_LATE_UNIT_MINUTES);
  return {
    rawLateMinutes: lateMinutes,
    units,
    billableMinutes: units * ATTENDANCE_LATE_UNIT_MINUTES,
    amount: units * ATTENDANCE_LATE_UNIT_EGP,
  };
};
