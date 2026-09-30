import { isStaffPortalPath } from './staffRoutes.js';

export const authAudience = (pathname = globalThis.location?.pathname || '') =>
  isStaffPortalPath(pathname) || /^\/(erp|adminmt|admin)(\/|$)/.test(pathname) ? 'staff' : 'client';

export const roleMatchesAudience = (role, audience = authAudience()) =>
  (audience === 'staff' ? ['owner', 'admin', 'operations', 'finance', 'staff'] : ['client', 'applicant']).includes(role);

export const authCsrfCookieNames = (audience = authAudience()) => [`__Host-mt_csrf_${audience}`, `mt_csrf_${audience}`];
