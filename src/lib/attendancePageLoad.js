const attendanceRequest = async (label, request) => {
  try {
    return await request();
  } catch (error) {
    throw new Error(`${label}: ${error?.message || 'تعذر الاتصال بالخادم.'}`, { cause: error });
  }
};

export async function loadAttendancePage(api, month, { isOwner = false } = {}) {
  // Owners are exempt from attendance; viewing payroll must not check them in.
  if (!isOwner) await attendanceRequest('تسجيل الحضور', () => api.checkIn());
  return Promise.all([
    attendanceRequest('ملخص الحضور والرواتب', () => api.summary(month)),
    attendanceRequest('سياسات حضور الموظفين', () => api.policies()),
    attendanceRequest('حضور اليوم', () => api.today()),
  ]);
}
