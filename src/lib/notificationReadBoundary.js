export const notificationBoundary = items => Math.max(0, ...(Array.isArray(items) ? items : []).map(item => Number(item?.id) || 0));

export const markNotificationsReadThrough = (items, boundary, readAt = new Date().toISOString()) => (Array.isArray(items) ? items : []).map(item => Number(item?.id) <= Number(boundary) && !item?.read_at ? { ...item, read_at: readAt } : item);

export const unreadNotifications = items => (Array.isArray(items) ? items : []).filter(item => !item?.read_at).length;

export const captureNotificationOpen = (items, unreadCount, readAt = new Date().toISOString()) => {
  const snapshotItems = Array.isArray(items) ? items : [];
  const boundary = notificationBoundary(snapshotItems);
  const optimisticItems = markNotificationsReadThrough(snapshotItems, boundary, readAt);
  return {
    boundary,
    snapshotItems,
    snapshotUnreadCount: Math.max(0, Number(unreadCount) || 0),
    optimisticItems,
    optimisticUnreadCount: unreadNotifications(optimisticItems),
  };
};

export const reconcileNotificationOpen = (received, boundary, readAt = new Date().toISOString()) => {
  const items = markNotificationsReadThrough(received, boundary, readAt);
  return { items, unreadCount: unreadNotifications(items) };
};

export const resolveNotificationOpenBoundary = (capturedBoundary, openedBeforeInitialLoad, received) => {
  const boundary = Math.max(0, Number(capturedBoundary) || 0);
  return boundary || (openedBeforeInitialLoad ? notificationBoundary(received) : 0);
};
