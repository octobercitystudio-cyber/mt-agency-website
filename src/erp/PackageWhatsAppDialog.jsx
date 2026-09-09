import { useEffect, useState } from 'react';
import { Copy, MessageCircle, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { safeUiError } from '../lib/uiError';
import { buildPackageWhatsApp, whatsappPhone } from '../lib/packageWhatsApp';
import './PackageWhatsAppDialog.css';

export default function PackageWhatsAppDialog({ pkg, onClose }) {
  const dialogRef = useModalDialog(true, onClose);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError('');
      try {
        const results = await Promise.all([
          dataClient.request(`/client-packages/${pkg.id}/details`, { method: 'GET' }),
          dataClient.from('clients').select('id,name,phone1,points').eq('id', pkg.client_id).single(),
          dataClient.from('app_config').select('key,value').eq('key', 'points_redeem_threshold'),
        ]);
        const failed = results.find(result => result.error);
        if (failed) throw failed.error;
        if (!results[0].data?.package || !results[1].data) throw new Error('تعذر العثور على بيانات الباقة أو العميل.');
        if (cancelled) return;
        const config = Object.fromEntries((results[2].data || []).map(item => [item.key, item.value]));
        setMessage(buildPackageWhatsApp(results[0].data, results[1].data, config));
        setPhone(whatsappPhone(results[1].data.phone1));
      } catch (failure) {
        if (!cancelled) setError(safeUiError(failure, 'تعذر تجهيز رسالة الباقة. حاول مرة أخرى.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pkg.id, pkg.client_id, attempt]);

  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); setNotice('تم نسخ الرسالة.'); }
    catch { setNotice('تعذر النسخ تلقائيًا؛ يمكنك تحديد النص ونسخه يدويًا.'); }
  };

  return <div className="packages-modal" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="package-whatsapp-dialog" role="dialog" aria-modal="true" aria-labelledby="package-whatsapp-title" dir="rtl">
      <header><h3 id="package-whatsapp-title">إرسال تفاصيل الباقة</h3><button type="button" onClick={onClose} aria-label="إغلاق معاينة الرسالة"><X /></button></header>
      {loading ? <p role="status">جارٍ تحميل أحدث بيانات الباقة ونقاط العميل…</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></div> : <>
        <p>راجع الرسالة وعدّلها قبل فتح واتساب للعميل.</p>
        <label htmlFor="package-whatsapp-message">نص الرسالة</label>
        <textarea id="package-whatsapp-message" value={message} onChange={event => setMessage(event.target.value)} />
        {!phone && <p role="status">رقم العميل غير موجود أو غير صالح لواتساب. يمكنك نسخ الرسالة.</p>}
        <footer><button type="button" onClick={copyMessage} disabled={!message.trim()}><Copy size={18} /> نسخ النص</button>
          {phone && message.trim() && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> فتح واتساب للعميل</a>}
        </footer>
        <p role="status">{notice}</p>
      </>}
    </section>
  </div>;
}
