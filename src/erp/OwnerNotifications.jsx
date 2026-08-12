import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarClock, CheckCheck, CircleDollarSign, FileCheck2, Inbox, RefreshCw, Trash2, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { captureNotificationOpen, markNotificationsReadThrough, notificationBoundary, reconcileNotificationOpen, resolveNotificationOpenBoundary, unreadNotifications } from '../lib/notificationReadBoundary';
import './OwnerNotifications.css';

const safeItems = value => Array.isArray(value) ? value.filter(item => item && Number(item.id) > 0 && item.title && item.message) : [];
const routes = { requests: '/erp/requests', bookings: '/erp/bookings', offers: '/erp/offers', finance: '/erp/finance', packages: '/erp/packages', projects: '/erp/projects', clients: '/erp/clients' };
const destination = item => routes[item.action_tab] || '/erp';
const itemIcon = item => item.action_tab === 'finance' ? CircleDollarSign : item.action_tab === 'offers' ? FileCheck2 : item.action_tab === 'requests' ? Inbox : CalendarClock;
const clientInitial = title => String(title).split('—').at(-1)?.trim()?.charAt(0) || 'ع';
const dateBucket = value => {
  const date = new Date(value); const now = new Date();
  if (Number.isNaN(date.getTime())) return 'الأقدم';
  const delta = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  return delta <= 0 ? 'اليوم' : delta === 1 ? 'أمس' : 'الأقدم';
};
const timeLabel = value => {
  const date = new Date(value); if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
};

export default function OwnerNotifications({ userId, onNavigate }) {
  const bellRef = useRef(null);
  const openRequestRef = useRef(0);
  const initialLoadedRef = useRef(false);
  const initialRequestInFlightRef = useRef(false);
  const pendingInitialOpenRef = useRef(null);
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState('unread'); const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); const [loading, setLoading] = useState(true); const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null); const [error, setError] = useState(''); const [announcement, setAnnouncement] = useState('');
  const close = useCallback(() => { openRequestRef.current += 1; pendingInitialOpenRef.current = null; setOpen(false); }, []); const dialogRef = useModalDialog(open, close, { returnFocusRef: bellRef, isolateBackground: true });

  const load = useCallback(async ({ quiet = false, cursor = null, append = false } = {}) => {
    const initialRequest = !append && !cursor && !initialLoadedRef.current; if (initialRequest) initialRequestInFlightRef.current = true;
    if (append) setLoadingOlder(true); else if (!quiet) setLoading(true); setError('');
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const { data, error: requestError } = await dataClient.request(`/app-notifications?channel=client-actions&status=all&limit=30${cursorQuery}`, { method: 'GET' });
    if (requestError) {
      const pending = pendingInitialOpenRef.current;
      if (pending && openRequestRef.current === pending.requestId) { setItems(pending.captured.snapshotItems); setUnreadCount(pending.captured.snapshotUnreadCount); }
      if (initialRequest) initialRequestInFlightRef.current = false; setError('تعذر تحديث إشعارات العملاء الآن.'); setLoading(false); setLoadingOlder(false); return;
    }
    const received = safeItems(data?.items);
    const pending = !append && !cursor ? pendingInitialOpenRef.current : null;
    if (pending && openRequestRef.current === pending.requestId && !initialLoadedRef.current) {
      const boundary = resolveNotificationOpenBoundary(pending.captured.boundary, true, received); const reconciled = reconcileNotificationOpen(received, boundary);
      initialLoadedRef.current = true; initialRequestInFlightRef.current = false; pendingInitialOpenRef.current = null; setItems(reconciled.items); setUnreadCount(reconciled.unreadCount); setNextCursor(data?.next_cursor || null); setLoading(false); setLoadingOlder(false);
      if (boundary) {
        const { error: readError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary, channel: 'client-actions' }) });
        if (openRequestRef.current !== pending.requestId) return;
        if (readError) { setItems(received); setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setError('تعذر حفظ حالة القراءة. أُعيد العداد كما كان.'); }
      }
      return;
    }
    initialLoadedRef.current = true; if (initialRequest) initialRequestInFlightRef.current = false;
    setItems(current => append ? [...current, ...received.filter(item => !current.some(existing => Number(existing.id) === Number(item.id)))] : received);
    setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setNextCursor(data?.next_cursor || null); setLoading(false); setLoadingOlder(false);
  }, []);

  // Remote notification state must refresh when the signed-in owner changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load, userId]);
  useEffect(() => {
    const refresh = () => load({ quiet: true }); const timer = window.setInterval(refresh, 60000);
    window.addEventListener('erpRequestsUpdated', refresh); window.addEventListener('demoDataChanged', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('erpRequestsUpdated', refresh); window.removeEventListener('demoDataChanged', refresh); };
  }, [load]);

  const updateItem = (id, update) => setItems(current => current.map(item => Number(item.id) === Number(id) ? { ...item, ...update } : item));
  const openCenter = async () => {
    const requestId = openRequestRef.current + 1; openRequestRef.current = requestId;
    const openedBeforeInitialLoad = !initialLoadedRef.current; const captured = captureNotificationOpen(items, unreadCount);
    setItems(captured.optimisticItems); setUnreadCount(captured.optimisticUnreadCount); setAnnouncement('تمت قراءة إشعارات العملاء'); setOpen(true); setError('');
    if (openedBeforeInitialLoad) { pendingInitialOpenRef.current = { requestId, captured }; if (!initialRequestInFlightRef.current) load({ quiet: true }); return; }
    const { data, error: requestError } = await dataClient.request('/app-notifications?channel=client-actions&status=all&limit=30', { method: 'GET' });
    if (openRequestRef.current !== requestId) return;
    if (requestError) {
      setItems(captured.snapshotItems); setUnreadCount(captured.snapshotUnreadCount); setLoading(false); setError('تعذر تحديث إشعارات العملاء الآن. لم تتغير حالة القراءة.');
      return;
    }
    const received = safeItems(data?.items); const reconciled = reconcileNotificationOpen(received, captured.boundary);
    if (captured.boundary) {
      const { error: readError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: captured.boundary, channel: 'client-actions' }) });
      if (openRequestRef.current !== requestId) return;
      if (readError) {
        setItems(received); setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setError('تعذر حفظ حالة القراءة. أُعيد العداد كما كان.');
        return;
      }
    }
    setItems(reconciled.items); setUnreadCount(reconciled.unreadCount); setNextCursor(data?.next_cursor || null); setLoading(false);
  };
  const markRead = async item => { if (item.read_at) return; updateItem(item.id, { read_at: new Date().toISOString() }); setUnreadCount(count => Math.max(0, count - 1)); const { error: requestError } = await dataClient.request(`/app-notifications/${item.id}/read`, { method: 'POST', body: '{}' }); if (requestError) load({ quiet: true }); };
  const openItem = async item => { await markRead(item); close(); onNavigate(destination(item)); };
  const dismiss = async (event, item) => { event.stopPropagation(); setItems(current => current.filter(row => Number(row.id) !== Number(item.id))); if (!item.read_at) setUnreadCount(count => Math.max(0, count - 1)); const { error: requestError } = await dataClient.request(`/app-notifications/${item.id}/dismiss`, { method: 'POST', body: '{}' }); if (requestError) load({ quiet: true }); };
  const readAll = async () => { const boundary = notificationBoundary(items); if (!boundary) return; setItems(current => markNotificationsReadThrough(current, boundary)); setUnreadCount(0); const { error: requestError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary, channel: 'client-actions' }) }); if (requestError) load({ quiet: true }); };

  const visible = useMemo(() => filter === 'unread' ? items.filter(item => !item.read_at) : items, [filter, items]);
  const groups = useMemo(() => ['اليوم', 'أمس', 'الأقدم'].map(label => ({ label, items: visible.filter(item => dateBucket(item.created_at) === label) })).filter(group => group.items.length), [visible]);

  return <div className="owner-notifications">
    <button ref={bellRef} type="button" className={`owner-notifications__bell ${unreadCount ? 'has-unread' : ''}`} aria-label={unreadCount ? `إجراءات العملاء، ${unreadCount} غير مقروء` : 'إجراءات العملاء، لا توجد إشعارات غير مقروءة'} aria-expanded={open} aria-controls="owner-notification-center" onClick={() => open ? close() : openCenter()}>
      <Bell aria-hidden="true"/><span>إجراءات العملاء</span>{unreadCount > 0 && <b aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</b>}
    </button>
    <span className="owner-notifications__sr" aria-live="polite">{announcement}</span>
    {open && createPortal(<div className="owner-notifications__backdrop" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} id="owner-notification-center" className="owner-notifications__panel" role="dialog" aria-modal="true" aria-labelledby="owner-notifications-title">
        <header><div><span>مركز إجراءات العميل</span><h2 id="owner-notifications-title">الإشعارات الواردة</h2></div><button data-dialog-initial type="button" onClick={close} aria-label="إغلاق الإشعارات"><X/></button></header>
        <div className="owner-notifications__toolbar"><div role="tablist" aria-label="تصفية الإشعارات"><button type="button" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>غير المقروء</button><button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>الكل</button></div><button type="button" onClick={readAll} disabled={!unreadCount}><CheckCheck/> قراءة الكل</button></div>
        {error && <div className="owner-notifications__error" role="status"><span>{error}</span><button type="button" onClick={() => load()}><RefreshCw/> إعادة المحاولة</button></div>}
        <div className="owner-notifications__list">
          {loading && !items.length && <div className="owner-notifications__loading"><RefreshCw/><strong>جارٍ تحميل الإشعارات…</strong></div>}
          {!loading && !visible.length && <div className="owner-notifications__empty"><Bell/><strong>{filter === 'unread' ? 'تمت مراجعة كل إجراءات العملاء' : 'لا توجد إجراءات واردة بعد'}</strong><p>سيظهر هنا قبول أو رفض المواعيد والطلبات والمدفوعات الواردة من العميل.</p></div>}
          {groups.map(group => <section className="owner-notifications__group" key={group.label}><h3>{group.label}</h3>{group.items.map(item => { const Icon = itemIcon(item); return <article key={item.id} className={item.read_at ? 'is-read' : 'is-unread'}><button type="button" className="owner-notifications__item" onClick={() => openItem(item)}><i className="owner-notifications__avatar">{clientInitial(item.title)}</i><i className={`owner-notifications__type is-${item.severity || 'info'}`}><Icon/></i><span><strong>{item.title}</strong><small>{item.message}</small><time dateTime={item.created_at}>{timeLabel(item.created_at)}</time></span>{!item.read_at && <em aria-label="غير مقروء"/>}</button><button type="button" className="owner-notifications__dismiss" onClick={event => dismiss(event, item)} aria-label={`إخفاء ${item.title}`}><Trash2/></button></article>; })}</section>)}
          {filter === 'all' && nextCursor && <button type="button" className="owner-notifications__more" disabled={loadingOlder} onClick={() => load({ cursor: nextCursor, append: true })}><RefreshCw/>{loadingOlder ? 'جارٍ التحميل…' : 'تحميل إشعارات أقدم'}</button>}
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
