import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { dataClient } from '../dataClient';
import { safeUiError } from '../lib/uiError';
import useChangeSync from '../hooks/useChangeSync';
import PackageGuideView from '../components/PackageGuideView';

export default function ClientPackageGuide({ onSubscribe }) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setState(previous => ({ ...previous, loading: true, error: '' }));
    try {
      const result = await dataClient.request('/package-guide');
      if (request !== sequence.current) return;
      if (result.error || !result.data?.content) throw result.error || new Error('تعذر تحميل الدليل.');
      setState({ data: result.data, loading: false, error: '' });
    } catch (error) {
      if (request === sequence.current) setState(previous => ({ ...previous, loading: false, error: safeUiError(error, 'تعذر تحميل دليل الباقات. أعد المحاولة.') }));
    }
  }, []);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);
  useChangeSync(topics => { if (topics.some(topic => ['services', 'post_production', 'settings'].includes(topic))) void load(); });
  return <section className="package-guide-page" aria-label="دليل الباقات والتصوير" aria-busy={state.loading}>
    {state.loading && <p className="package-guide-notice" role="status">جارٍ تحميل أحدث تفاصيل الباقات…</p>}
    {state.error && <div className="package-guide-notice package-guide-notice--error" role="alert"><p>{state.error}</p><button type="button" onClick={load}><RefreshCw aria-hidden="true"/> إعادة المحاولة</button></div>}
    {state.data && <PackageGuideView data={state.data} onSubscribe={onSubscribe}/>}
  </section>;
}
