import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Film, RefreshCw } from 'lucide-react';
import { dataClient } from '../dataClient';
import useChangeSync from '../hooks/useChangeSync';
import { postProductionSessionLabel } from '../lib/postProduction';

// This summary uses the same client-only endpoint and expiry rules as the full delivery page.
export default function ClientDashboardDeliveries({ onNavigate }) {
  const [state, setState] = useState({ jobs: [], loading: true, error: '', offset: 0 });
  const requestRef = useRef(0);
  const [clock, setClock] = useState(() => Date.now());
  const load = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: '' }));
    const requestId = ++requestRef.current;
    const requestedAt = Date.now();
    const { data, error } = await dataClient.request('/client/post-production', { method: 'GET' });
    if (requestId !== requestRef.current) return;
    const serverNow = new Date(data?.server_now || '').getTime();
    setState({ jobs: Array.isArray(data?.items) ? data.items : [], loading: false, error: error?.message || '', offset: Number.isFinite(serverNow) ? serverNow - requestedAt : 0 });
  }, []);
  // The client endpoint is intentionally fetched separately so deliveries never block the account overview.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); return () => { requestRef.current += 1; }; }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useChangeSync(useCallback(topics => { if (topics.some(topic => ['post_production', 'notifications'].includes(topic))) load(); }, [load]));
  const available = state.jobs.filter(job => (job.delivery_links || []).some(link => {
    const expires = new Date(link.available_until || '').getTime();
    return Number(link.is_active) === 1 && (!Number.isFinite(expires) || expires > clock + state.offset);
  }));
  return <section className="glance-deliveries" aria-label="آخر التسليمات">
    <span className="glance-delivery-icon"><Film aria-hidden="true" /></span>
    <div><h2>{state.loading ? 'جارٍ تحميل التسليمات' : state.error ? 'تعذر تحديث التسليمات' : available.length ? 'تسليمات جاهزة لك' : 'لا توجد تسليمات جاهزة حاليًا'}</h2><p>{state.loading ? 'نتحقق من الفيديوهات المتاحة لحسابك.' : state.error ? 'يمكنك إعادة المحاولة أو فتح صفحة التسليمات.' : available.length ? postProductionSessionLabel(available[0]) : 'سنخبرك عند توفر فيديوهات جديدة للتحميل.'}</p></div>
    {state.error ? <button type="button" className="glance-link" onClick={load}><RefreshCw /> إعادة المحاولة</button> : <button type="button" className="glance-link" onClick={() => onNavigate('videos', available.length ? { post_production_job_id: available[0].id } : {})}>{available.length ? 'عرض التسليمات' : 'كل التسليمات'}<ArrowLeft /></button>}
  </section>;
}
