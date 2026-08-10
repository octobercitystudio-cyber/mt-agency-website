export const isOwner = user => user?.role === 'owner';

export const OWNER_PROTECTED_ENTITIES = Object.freeze([
  'clients', 'bookings', 'client_packages', 'projects', 'project_tasks',
  'project_items', 'project_milestones', 'content_items', 'reminders',
  'offers', 'invoices', 'users', 'resources', 'services',
]);

export const ownerActionEvent = entity => `erp:${entity}:changed`;
