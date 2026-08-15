import { hostingerClient } from './hostingerClient';

const request = async (path, options) => {
  const result = await hostingerClient.request(path, options);
  if (result.error) throw result.error;
  return result.data;
};

export const attendanceApi = {
  today: () => request('/attendance/today'),
  checkIn: () => request('/attendance/check-in', { method: 'POST', body: '{}' }),
  checkOut: () => request('/attendance/check-out', { method: 'POST', body: '{}' }),
  summary: (month, userId) => request(`/attendance/summary?month=${encodeURIComponent(month)}${userId ? `&user_id=${userId}` : ''}`),
  records: (month, userId) => request(`/attendance/records?month=${encodeURIComponent(month)}${userId ? `&user_id=${userId}` : ''}`),
  policies: (userId) => request(`/attendance/policies${userId ? `?user_id=${userId}` : ''}`),
  savePolicy: (policy) => request('/attendance/policies', { method: 'PUT', body: JSON.stringify(policy) }),
  correctRecord: (id, values) => request(`/attendance/records/${id}`, { method: 'PATCH', body: JSON.stringify(values) }),
  addAdjustment: (values) => request('/attendance/adjustments', { method: 'POST', body: JSON.stringify(values) }),
  correctAdjustment: (id, values) => request(`/attendance/adjustments/${id}/correct`, { method: 'POST', body: JSON.stringify(values) }),
  employeeAccounts: (month) => request(`/attendance/employee-accounts?month=${encodeURIComponent(month)}`),
  addEmployeeMovement: (values) => request('/attendance/employee-accounts/movements', { method: 'POST', body: JSON.stringify(values) }),
};
