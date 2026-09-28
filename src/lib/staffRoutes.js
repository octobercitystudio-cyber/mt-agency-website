import portal from '../../staff-portal.json' with { type: 'json' };

export const STAFF_BASE = portal.path;
export const STAFF_LOGIN_PATH = `${STAFF_BASE}/login`;
export const staffPath = (suffix = '') => `${STAFF_BASE}${suffix}`;
export const isStaffPortalPath = pathname => pathname === STAFF_BASE || pathname.startsWith(`${STAFF_BASE}/`);
export const legacyStaffDestination = pathname => {
  if (/^\/erp(\/|$)/.test(pathname)) return staffPath(pathname.slice(4));
  if (pathname === '/adminmt/login') return STAFF_LOGIN_PATH;
  if (/^\/adminmt(\/|$)/.test(pathname)) return staffPath(`/site${pathname.slice(8)}`);
  return null;
};
