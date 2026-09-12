import { useEffect, useState } from 'react';
import { CalendarDays, Copy, MessageCircle, X } from 'lucide-react';
import { dataClient } from '../dataClient';
import useModalDialog from '../hooks/useModalDialog';
import { safeUiError } from '../lib/uiError';
import { APPOINTMENTS_EMPTY_MESSAGE, buildPackageAppointmentsWhatsApp, buildPackageWhatsApp, whatsappPhone } from '../lib/packageWhatsApp';
import './PackageWhatsAppDialog.css';

export default function PackageWhatsAppDialog({ pkg, mode = 'summary', onClose }) {
  const appointmentsMode = mode === 'appointments';
  const dialogRef = useModalDialog(true, onClose);
  const [message, setMessage] = useState('');
  const [phone, setPhone] = useState('');
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(''); setNotice(''); setEmpty(false); setMessage(''); setPhone('');
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
        const nextMessage = appointmentsMode
          ? buildPackageAppointmentsWhatsApp(results[0].data, results[1].data)
          : buildPackageWhatsApp(results[0].data, results[1].data, config);
        setEmpty(appointmentsMode && !nextMessage);
        setMessage(nextMessage);
        setPhone(whatsappPhone(results[1].data.phone1));
      } catch (failure) {
        if (!cancelled) setError(safeUiError(failure, appointmentsMode ? 'تعذر تجهيز رسالة مواعيد التصوير. حاول مرة أخرى.' : 'تعذر تجهيز رسالة الباقة. حاول مرة أخرى.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pkg.id, pkg.client_id, appointmentsMode, attempt]);

  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); setNotice('تم نسخ الرسالة.'); }
    catch { setNotice('تعذر النسخ تلقائيًا؛ يمكنك تحديد النص ونسخه يدويًا.'); }
  };

  return <div className="packages-modal" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={`package-whatsapp-dialog${appointmentsMode ? ' is-appointments' : ''}`} data-mode={mode} role="dialog" aria-modal="true" aria-labelledby="package-whatsapp-title" aria-describedby={!loading && !error ? 'package-whatsapp-description' : undefined} dir="rtl">
      <header><div className="package-whatsapp-heading">{appointmentsMode && <CalendarDays aria-hidden="true"/>}<h3 id="package-whatsapp-title">{appointmentsMode ? 'إرسال مواعيد التصوير' : 'إرسال تفاصيل الباقة'}</h3></div><button type="button" onClick={onClose} aria-label="إغلاق معاينة الرسالة"><X /></button></header>
      {loading ? <p role="status">{appointmentsMode ? 'جارٍ تحميل مواعيد التصوير القادمة…' : 'جارٍ تحميل أحدث بيانات الباقة ونقاط العميل…'}</p> : error ? <div role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>إعادة المحاولة</button></div> : <>
        <p id="package-whatsapp-description">{appointmentsMode ? 'راجع مواعيد التصوير وعدّل الرسالة قبل فتح واتساب للعميل.' : 'راجع الرسالة وعدّلها قبل فتح واتساب للعميل.'}</p>
        {empty ? <div className="package-whatsapp-empty" role="status"><CalendarDays aria-hidden="true"/><strong>{APPOINTMENTS_EMPTY_MESSAGE}</strong><span>أضف موعدًا قادمًا إلى الباقة ثم أعد المحاولة.</span></div> : <><label htmlFor="package-whatsapp-message">{appointmentsMode ? 'رسالة مواعيد التصوير' : 'نص الرسالة'}</label>
        <textarea id="package-whatsapp-message" value={message} onChange={event => setMessage(event.target.value)} /></>}
        {!empty && !phone && <p className="package-whatsapp-phone-notice" role="status">رقم العميل غير موجود أو غير صالح لواتساب. يمكنك نسخ الرسالة يدويًا.</p>}
        <footer><button type="button" onClick={copyMessage} disabled={!message.trim()}><Copy size={18} /> نسخ النص</button>
          {phone && message.trim() && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> فتح واتساب للعميل</a>}
        </footer>
        <p role="status">{notice}</p>
      </>}
    </section>
  </div>;
}
