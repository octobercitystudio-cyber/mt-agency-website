import { staffPath } from '../lib/staffRoutes';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CalendarClock, CheckCheck, CircleDollarSign, FileCheck2, Inbox, RefreshCw, Trash2, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { formatDateTime12 } from '../lib/businessFormat';
import { markNotificationsReadThrough, notificationBoundary, unreadNotifications } from '../lib/notificationReadBoundary';
import { reconcileDeviceNotifications } from '../lib/notificationDeviceSync';
import './OwnerNotifications.css';
import useChangeSync from '../hooks/useChangeSync';
import OwnerLiveAlerts from './OwnerLiveAlerts';
import useOwnerLiveAlerts from './useOwnerLiveAlerts';

const safeItems = value => Array.isArray(value) ? value.filter(item => item && Number(item.id) > 0 && item.title && item.message) : [];
const routes = { requests: staffPath('/requests'), bookings: staffPath('/bookings'), offers: staffPath('/offers'), finance: staffPath('/finance'), packages: staffPath('/packages'), projects: staffPath('/projects'), clients: staffPath('/clients'), 'post-production': staffPath('/post-production') };
const destination = item => item.entity_type === 'promotion_subscriptions' ? staffPath('/requests?tab=promotions') : routes[item.action_tab] || staffPath('');
const itemIcon = item => item.action_tab === 'finance' ? CircleDollarSign : item.action_tab === 'offers' ? FileCheck2 : item.action_tab === 'requests' ? Inbox : CalendarClock;
const clientInitial = title => String(title).split('—').at(-1)?.trim()?.charAt(0) || 'ع';
const dateBucket = value => {
  const date = new Date(value); const now = new Date();
  if (Number.isNaN(date.getTime())) return 'الأقدم';
  const delta = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(date.getFullYear(), date.getMonth(), date.getDate())) / 86400000);
  return delta <= 0 ? 'اليوم' : delta === 1 ? 'أمس' : 'الأقدم';
};
const timeLabel = value => formatDateTime12(value, '');

export default function OwnerNotifications({ userId, onNavigate }) {
  const alerts = useOwnerLiveAlerts(userId);
  const { ingest } = alerts;
  const requestSequence = useRef(0);
  const principalRef = useRef(userId);
  const bellRef = useRef(null);
  const [open, setOpen] = useState(false); const [filter, setFilter] = useState('unread'); const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0); const [loading, setLoading] = useState(true); const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState(null); const [error, setError] = useState(''); const [announcement, setAnnouncement] = useState('');
  const close = useCallback(() => setOpen(false), []); const dialogRef = useModalDialog(open, close, { returnFocusRef: bellRef, isolateBackground: true });
  useEffect(() => { principalRef.current = userId; return () => { principalRef.current = null; }; }, [userId]);

  const load = useCallback(async ({ quiet = false, cursor = null, append = false, status = filter, clearTests = false } = {}) => {
    const sequence = ++requestSequence.current; const principal = userId;
    if (append) setLoadingOlder(true); else if (!quiet) setLoading(true); setError('');
    const cursorQuery = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const { data, error: requestError } = await dataClient.request(`/app-notifications?channel=client-actions&status=${status}&limit=30${cursorQuery}`, { method: 'GET' });
    if (principalRef.current !== principal || sequence !== requestSequence.current) return;
    if (requestError) {
      setError('تعذر تحديث إشعارات العملاء الآن.'); setLoading(false); setLoadingOlder(false); return;
    }
    const received = safeItems(data?.items);
    if (!append && !cursor) ingest(received);
    setItems(current => append ? [...current, ...received.filter(item => !current.some(existing => Number(existing.id) === Number(item.id)))] : received);
    setUnreadCount(Number(data?.unread_count ?? unreadNotifications(received))); setNextCursor(data?.next_cursor || null); setLoading(false); setLoadingOlder(false);
    void reconcileDeviceNotifications(dataClient, { staff: true, clearTests, isCurrent: () => principalRef.current === principal && sequence === requestSequence.current });
  }, [userId, ingest, filter]);

  useChangeSync(useCallback(topics => { if (topics.includes('notifications')) void load({ quiet: true }); }, [load]));

  // Remote notification state must refresh when the signed-in owner changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load, userId]);
  useEffect(() => {
    const refresh = () => load({ quiet: true }); const timer = window.setInterval(refresh, 60000);
    const pushRefresh = event => { if ((event.detail?.topics || []).includes('notifications')) refresh(); };
    window.addEventListener('erpRequestsUpdated', refresh); window.addEventListener('demoDataChanged', refresh); window.addEventListener('mtPushChange', pushRefresh);
    return () => { window.clearInterval(timer); window.removeEventListener('erpRequestsUpdated', refresh); window.removeEventListener('demoDataChanged', refresh); window.removeEventListener('mtPushChange', pushRefresh); };
  }, [load]);

  const updateItem = (id, update) => setItems(current => current.map(item => Number(item.id) === Number(id) ? { ...item, ...update } : item));
  const openCenter = () => {
    setFilter('unread'); setOpen(true); setAnnouncement('الإشعارات غير المقروءة');
    void load({ quiet: true, status: 'unread', clearTests: true });
  };
  const markRead = async item => {
    if (!item.read_at) {
      updateItem(item.id, { read_at: new Date().toISOString() }); setUnreadCount(count => Math.max(0, count - 1));
      await dataClient.request(`/app-notifications/${item.id}/read`, { method: 'POST', body: '{}' });
    }
    // Re-fetch committed state before cancelling a phone alert; failed writes
    // must not discard an unread notification or leave an optimistic badge.
    await load({ quiet: true, clearTests: true });
  };
  const openItem = async item => { await markRead(item); close(); onNavigate(destination(item)); };
  const dismiss = async (event, item) => { event.stopPropagation(); setItems(current => current.filter(row => Number(row.id) !== Number(item.id))); if (!item.read_at) setUnreadCount(count => Math.max(0, count - 1)); await dataClient.request(`/app-notifications/${item.id}/dismiss`, { method: 'POST', body: '{}' }); await load({ quiet: true, clearTests: true }); };
  const readAll = async () => {
    const boundary = notificationBoundary(items); if (!boundary) return;
    const { error: requestError } = await dataClient.request('/app-notifications/read-all', { method: 'POST', body: JSON.stringify({ up_to_id: boundary, channel: 'client-actions' }) });
    if (requestError) { setError('تعذر حفظ حالة القراءة. حاول مرة أخرى.'); return; }
    setItems(current => markNotificationsReadThrough(current, boundary));
    void load({ quiet: true, clearTests: true });
  };

  const visible = useMemo(() => filter === 'unread' ? items.filter(item => !item.read_at) : items, [filter, items]);
  const groups = useMemo(() => ['اليوم', 'أمس', 'الأقدم'].map(label => ({ label, items: visible.filter(item => dateBucket(item.created_at) === label) })).filter(group => group.items.length), [visible]);

  return <div className="owner-notifications">
    <button ref={bellRef} type="button" className={`owner-notifications__bell ${unreadCount ? 'has-unread' : ''}`} aria-label={unreadCount ? `إجراءات العملاء، ${unreadCount} غير مقروء` : 'إجراءات العملاء، لا توجد إشعارات غير مقروءة'} aria-expanded={open} aria-controls="owner-notification-center" onClick={() => open ? close() : openCenter()}>
      <Bell aria-hidden="true"/><span>إجراءات العملاء</span>{unreadCount > 0 && <b aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</b>}
    </button>
    <OwnerLiveAlerts alerts={alerts} onOpen={openItem}/>
    <span className="owner-notifications__sr" aria-live="polite">{announcement}</span>
    {open && createPortal(<div className="owner-notifications__backdrop staff-pearl-portal" onMouseDown={event => event.target === event.currentTarget && close()}>
      <section ref={dialogRef} id="owner-notification-center" className="owner-notifications__panel" role="dialog" aria-modal="true" aria-labelledby="owner-notifications-title">
        <header><div><span>مركز إجراءات العميل</span><h2 id="owner-notifications-title">الإشعارات الواردة</h2></div><button data-dialog-initial type="button" onClick={close} aria-label="إغلاق الإشعارات"><X/></button></header>
        <div className="owner-notifications__toolbar"><div role="tablist" aria-label="تصفية الإشعارات"><button type="button" role="tab" aria-selected={filter === 'unread'} onClick={() => setFilter('unread')}>غير المقروء</button><button type="button" role="tab" aria-selected={filter === 'all'} onClick={() => setFilter('all')}>الكل</button></div><button type="button" onClick={readAll} disabled={!unreadCount}><CheckCheck/> قراءة الكل</button></div>
        {error && <div className="owner-notifications__error" role="status"><span>{error}</span><button type="button" onClick={() => load()}><RefreshCw/> إعادة المحاولة</button></div>}
        <div className="owner-notifications__list">
          {loading && !items.length && <div className="owner-notifications__loading"><RefreshCw/><strong>جارٍ تحميل الإشعارات…</strong></div>}
          {!loading && !visible.length && <div className="owner-notifications__empty"><Bell/><strong>{filter === 'unread' ? 'تمت مراجعة كل إجراءات العملاء' : 'لا توجد إجراءات واردة بعد'}</strong><p>ستظهر هنا الحسابات الجديدة واشتراكات الباقات وتغييرات المواعيد والإلغاء والمدفوعات.</p></div>}
          {groups.map(group => <section className="owner-notifications__group" key={group.label}><h3>{group.label}</h3>{group.items.map(item => { const Icon = itemIcon(item); return <article key={item.id} className={item.read_at ? 'is-read' : 'is-unread'}><button type="button" className="owner-notifications__item" onClick={() => openItem(item)}><i className="owner-notifications__avatar">{clientInitial(item.title)}</i><i className={`owner-notifications__type is-${item.severity || 'info'}`}><Icon/></i><span><strong>{item.title}</strong><small>{item.message}</small><time dateTime={item.created_at}>{timeLabel(item.created_at)}</time></span>{!item.read_at && <em aria-label="غير مقروء"/>}</button><button type="button" className="owner-notifications__dismiss" onClick={event => dismiss(event, item)} aria-label={`إخفاء ${item.title}`}><Trash2/></button></article>; })}</section>)}
          {nextCursor && <button type="button" className="owner-notifications__more" disabled={loadingOlder} onClick={() => load({ cursor: nextCursor, append: true })}><RefreshCw/>{loadingOlder ? 'جارٍ التحميل…' : 'تحميل إشعارات أقدم'}</button>}
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
