import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarClock, CheckCheck, CircleDollarSign, FileText, FolderKanban, History, Package, RefreshCw, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { captureNotificationOpen, reconcileNotificationOpen, resolveNotificationOpenBoundary, unreadNotifications } from '../lib/notificationReadBoundary';
import './ClientNotifications.css';

const safeItems = value => Array.isArray(value) ? value.filter(item => item && Number(item.id) > 0 && item.title && item.message) : [];
const cacheKey = clientId => `mt_client_notifications_cache:${clientId}`;
const destinationFor = item => {
  const destination = item.action_tab || ({ offers: 'offers', invoices: 'finance', payments: 'finance', payment_proofs: 'finance', bookings: 'schedule', booking_sessions: 'history', projects: 'projects', client_packages: 'home' }[item.entity_type] || 'home');
  return destination === 'montage' ? 'videos' : destination;
};
const iconFor = item => {
  if (item.entity_type === 'client_packages') return Package;
  if (['bookings', 'booking_sessions', 'reschedule_requests'].includes(item.entity_type)) return CalendarClock;
  if (['projects', 'project_milestones', 'project_items', 'content_items'].includes(item.entity_type)) return FolderKanban;
  if (['payments', 'payment_proofs', 'invoices', 'finance'].includes(item.entity_type)) return CircleDollarSign;
  if (item.entity_type === 'offers') return FileText;
  return History;
};
const dateBucket = value => {
  const date = new Date(value); const now = new Date(); const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()); const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()); const delta = Math.round((day - target) / 86400000);
  return delta <= 0 ? 'اليوم' : delta === 1 ? 'أمس' : 'الأقدم';
};
const timeLabel = value => {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000); const relative = new Intl.RelativeTimeFormat('ar-EG', { numeric: 'auto' });
  if (Math.abs(diffMinutes) < 60) return relative.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60); if (Math.abs(diffHours) < 24) return relative.format(diffHours, 'hour');
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
};

export default function ClientNotifications({ clientId, onNavigate }) {
  const bellRef = useRef(null); const previousUnreadRef = useRef(null); const openRequestRef = useRef(0); const initialLoadedRef = useRef(false); const initialRequestInFlightRef = useRef(false); const pendingInitialOpenRef = useRef(null);
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState('all'); const [items, setItems] = useState(() => {
    try { return safeItems(JSON.parse(localStorage.getItem(cacheKey(clientId)) || '[]')); } catch { return []; }
  });
  const [unreadCount, setUnreadCount] = useState(() => items.filter(item => !item.read_at).length);
  const [loading, setLoading] = useState(!items.length); const [loadingOlder, setLoadingOlder] = useState(false); const [nextCursor, setNextCursor] = useState(null); const [error, setError] = useState(''); const [announcement, setAnnouncement] = useState('');
  const close = useCallback(() => { openRequestRef.current += 1; pendingInitialOpenRef.current = null; setOpen(false); }, []); const dialogRef = useModalDialog(open, close, { returnFocusRef: bellRef });

  const load = useCallback(async ({ quiet = false, cursor = null, append = false } = {}) => {
    const initialRequest = !append && !cursor && !initialLoadedRef.current; if (initialRequest) initialRequestInFlightRef.current = true;
    if (append) setLoadingOlder(true); else if (!quiet) setLoading(true); setError('');
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const { data, error: requestError } = await dataClient.request(`/app-notifications?status=all&limit=50${cursorQuery}`, { method: 'GET' });
    if (requestError) {
      const pending = pendingInitialOpenRef.current;
      if (pending && openRequestRef.current === pending.requestId) { setItems(pending.captured.snapshotItems); setUnreadCount(pending.captured.snapshotUnreadCount); }
      if (initialRequest) initialRequestInFlightRef.current = false; setError('تعذر تحديث الإشعارات. نعرض آخر نسخة محفوظة لديك.'); setLoading(false); setLoadingOlder(false); return;
    }
    const received = safeItems(data?.items);
    const pending = !append && !cursor ? pendingInitialOpenRef.current : null;
    if (pending && openRequestRef.current === pending.requestId && !initialLoadedRef.current) {
      const boundary = resolveNotificationOpenBoundary(pending.captured.boundary, true, received); const reconciled = reconcileNotificationOpen(received, boundary);
      initialLoadedRef.current = true; initialRequestInFlightRef.current = false; pendingInitialOpenRef.current = null; setNextCursor(data?.next_cursor || null); setUnreadCount(reconciled.unreadCount); setLoading(false); setLoadingOlder(false);
      setItems(reconciled.items); try { localStorage.setItem(cacheKey(clientId), JSON.stringify(reconciled.items)); } catch { /* cache is best effort */ }
      if (boundary) {
        const { error: readError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary }) });
        if (openRequestRef.current !== pending.requestId) return;
        if (readError) { setItems(received); try { localStorage.setItem(cacheKey(clientId), JSON.stringify(received)); } catch { /* cache is best effort */ } setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setError('تعذر حفظ حالة القراءة. أُعيد العداد كما كان.'); }
      }
      return;
    }
    initialLoadedRef.current = true; if (initialRequest) initialRequestInFlightRef.current = false;
    setNextCursor(data?.next_cursor || null); setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setLoading(false); setLoadingOlder(false);
    setItems(current => { const nextItems = append ? [...current, ...received.filter(item => !current.some(existing => Number(existing.id) === Number(item.id)))] : received; try { localStorage.setItem(cacheKey(clientId), JSON.stringify(nextItems)); } catch { /* cache is best effort */ } return nextItems; });
  }, [clientId]);

  // Notification data is remote session state and must refresh when the signed-in client changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = () => load({ quiet: true }); const storage = event => { if (event.key === 'mt_agency_erp_demo_v12') refresh(); };
    window.addEventListener('clientNotificationsRefresh', refresh); window.addEventListener('demoDataChanged', refresh); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('clientNotificationsRefresh', refresh); window.removeEventListener('demoDataChanged', refresh); window.removeEventListener('storage', storage); };
  }, [load]);
  useEffect(() => {
    if (previousUnreadRef.current !== null && previousUnreadRef.current !== unreadCount) setAnnouncement(unreadCount ? `لديك ${unreadCount} إشعارات غير مقروءة` : 'تمت قراءة كل الإشعارات');
    previousUnreadRef.current = unreadCount;
  }, [unreadCount]);

  const visibleItems = useMemo(() => filter === 'unread' ? items.filter(item => !item.read_at) : items, [filter, items]);
  const groups = useMemo(() => ['اليوم', 'أمس', 'الأقدم'].map(label => ({ label, items: visibleItems.filter(item => dateBucket(item.created_at) === label) })).filter(group => group.items.length), [visibleItems]);
  const updateItems = next => { setItems(current => { const value = typeof next === 'function' ? next(current) : next; try { localStorage.setItem(cacheKey(clientId), JSON.stringify(value)); } catch { /* cache is best effort */ } return value; }); };
  const openNotifications = async () => {
    const requestId = openRequestRef.current + 1; openRequestRef.current = requestId;
    const openedBeforeInitialLoad = !initialLoadedRef.current; const captured = captureNotificationOpen(items, unreadCount);
    updateItems(captured.optimisticItems); setUnreadCount(captured.optimisticUnreadCount); setOpen(true); setError('');
    if (openedBeforeInitialLoad) { pendingInitialOpenRef.current = { requestId, captured }; if (!initialRequestInFlightRef.current) load({ quiet: true }); return; }
    const { data, error: requestError } = await dataClient.request('/app-notifications?status=all&limit=50', { method: 'GET' });
    if (openRequestRef.current !== requestId) return;
    if (requestError) {
      updateItems(captured.snapshotItems); setUnreadCount(captured.snapshotUnreadCount); setLoading(false); setError('تعذر تحديث الإشعارات. لم تتغير حالة القراءة.');
      return;
    }
    const received = safeItems(data?.items); const reconciled = reconcileNotificationOpen(received, captured.boundary);
    if (captured.boundary) {
      const { error: readError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: captured.boundary }) });
      if (openRequestRef.current !== requestId) return;
      if (readError) {
        updateItems(received); setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setError('تعذر حفظ حالة القراءة. أُعيد العداد كما كان.');
        return;
      }
    }
    updateItems(reconciled.items); setUnreadCount(reconciled.unreadCount); setNextCursor(data?.next_cursor || null); setLoading(false);
  };
  const markRead = async item => {
    if (item.read_at) return; const stamp = new Date().toISOString(); updateItems(current => current.map(row => Number(row.id) === Number(item.id) ? { ...row, read_at: stamp } : row)); setUnreadCount(count => Math.max(0, count - 1));
    const { error: requestError } = await dataClient.request(`/app-notifications/${item.id}/read`, { method: 'POST', body: '{}' }); if (requestError) load({ quiet: true });
  };
  const openItem = async item => { await markRead(item); close(); onNavigate(destinationFor(item), item.payload || {}); };
  const readAll = async () => {
    const upToId = Math.max(0, ...items.map(item => Number(item.id) || 0)); if (!upToId || !unreadCount) return; const stamp = new Date().toISOString(); updateItems(current => current.map(item => Number(item.id) <= upToId ? { ...item, read_at: item.read_at || stamp } : item)); setUnreadCount(0);
    const { error: requestError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: upToId }) }); if (requestError) load({ quiet: true });
  };
  const dismiss = async (event, item) => { event.stopPropagation(); updateItems(current => current.filter(row => Number(row.id) !== Number(item.id))); if (!item.read_at) setUnreadCount(count => Math.max(0, count - 1)); const { error: requestError } = await dataClient.request(`/app-notifications/${item.id}/dismiss`, { method: 'POST', body: '{}' }); if (requestError) load({ quiet: true }); };

  return <div className="client-notifications">
    <button ref={bellRef} type="button" className={`client-notifications__bell ${unreadCount ? 'has-unread' : ''}`} aria-label={unreadCount ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'} aria-expanded={open} aria-controls="client-notification-center" onClick={() => open ? close() : openNotifications()}>
      <Bell aria-hidden="true" />{unreadCount > 0 && <span className="client-notifications__badge" aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    <span className="client-sr-only" aria-live="polite">{announcement}</span>
    {open && <div className="client-notifications__backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={dialogRef} id="client-notification-center" className="client-notifications__panel" role="dialog" aria-modal="true" aria-labelledby="client-notifications-title">
        <header><div><h2 id="client-notifications-title">الإشعارات</h2><span>{unreadCount ? `${unreadCount} إشعار جديد` : 'أنت على اطلاع بكل جديد'}</span></div><button type="button" className="client-notifications__close" aria-label="إغلاق الإشعارات" onClick={close} data-dialog-initial><X /></button></header>
        <div className="client-notifications__toolbar"><span>تحديثات مواعيدك وباقاتك ومدفوعاتك</span><button type="button" onClick={readAll} disabled={!unreadCount}><CheckCheck /> تعليم الكل كمقروء</button></div>
        <div className="client-notifications__tabs" role="tablist" aria-label="تصفية الإشعارات"><button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>الكل</button><button type="button" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>غير المقروء{unreadCount > 0 && <b>{unreadCount > 99 ? '99+' : unreadCount}</b>}</button></div>
        {error && <div className="client-notifications__error" role="status"><span>{error}</span><button type="button" onClick={() => load()}><RefreshCw /> إعادة المحاولة</button></div>}
        <div className="client-notifications__list">
          {loading && !items.length && <div className="client-notifications__skeleton" aria-label="جارٍ تحميل الإشعارات">{[1, 2, 3].map(value => <i key={value} />)}</div>}
          {!loading && !visibleItems.length && <div className="client-notifications__empty"><Bell /><strong>{filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات حاليًا'}</strong><p>{filter === 'unread' ? 'كل تحديثات حسابك تمت مراجعتها.' : 'ستظهر هنا تحديثات الباقات والمواعيد والخدمات والمدفوعات.'}</p></div>}
          {groups.map(group => <section className="client-notifications__group" key={group.label}><h3>{group.label}</h3>{group.items.map(item => { const Icon = iconFor(item); return <article key={item.id} className={`client-notification-item is-${item.severity || 'info'} ${item.read_at ? 'is-read' : 'is-unread'}`}><button type="button" className="client-notification-item__main" onClick={() => openItem(item)}><span className="client-notification-item__icon"><Icon aria-hidden="true" /></span><span className="client-notification-item__copy"><strong>{item.title}</strong><span>{item.message}</span><time dateTime={item.created_at}>{timeLabel(item.created_at)}</time></span>{!item.read_at && <i className="client-notification-item__dot" aria-label="غير مقروء" />}</button><button type="button" className="client-notification-item__dismiss" aria-label={`إخفاء إشعار: ${item.title}`} onClick={event => dismiss(event, item)}><X /></button></article>; })}</section>)}
          {filter === 'all' && nextCursor && <button type="button" className="client-notifications__load-more" style={{ width: '100%', minHeight: 44, marginTop: 10 }} disabled={loadingOlder} onClick={() => load({ cursor: nextCursor, append: true })}><RefreshCw aria-hidden="true" />{loadingOlder ? 'جارٍ التحميل…' : 'تحميل إشعارات أقدم'}</button>}
        </div>
      </section>
    </div>}
  </div>;
}
