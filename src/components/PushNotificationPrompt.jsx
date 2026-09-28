import { AlertCircle, BellRing, CheckCircle2, LoaderCircle } from 'lucide-react';
import './PushNotificationPrompt.css';

const pendingStatuses = new Set(['loading', 'pending', 'requesting', 'enabling']);
const successStatuses = new Set(['success', 'enabled', 'granted']);
const errorStatuses = new Set(['error', 'denied', 'failed']);

export default function PushNotificationPrompt({
  status = 'idle',
  staff = false,
  message = '',
  diagnostic = '',
  retrySeconds = 0,
  onLocalTest,
  onEnable,
  onDismiss,
}) {
  const normalizedStatus = String(status || 'idle').toLowerCase();
  const isPending = pendingStatuses.has(normalizedStatus);
  const isSuccess = successStatuses.has(normalizedStatus);
  const isError = errorStatuses.has(normalizedStatus);
  const feedbackTone = isError ? 'error' : isSuccess ? 'success' : 'info';
  const FeedbackIcon = isError ? AlertCircle : isSuccess ? CheckCircle2 : BellRing;
  const androidStaff = staff && typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  return (
    <aside
      className={`push-notification-prompt is-${feedbackTone}`}
      dir="rtl"
      aria-labelledby="push-notification-prompt-title"
    >
      <div className="push-notification-prompt__mark" aria-hidden="true">
        <BellRing />
        <span />
      </div>

      <div className="push-notification-prompt__content">
        <div className="push-notification-prompt__copy">
          <h2 id="push-notification-prompt-title">{staff ? 'إشعارات الإدارة على موبايلك' : 'ابقَ على اطلاع'}</h2>
          <p>تسجيل الجهاز تلقائي. وصول التنبيه والصوت والشاشة مقفولة يحتاج السماح بالإشعارات والعمل في الخلفية من الهاتف.</p>
          {androidStaff && <a className="push-notification-prompt__settings" href="intent://notification-settings#Intent;scheme=mta-team;package=com.multitaskagency.staff;S.browser_fallback_url=https%3A%2F%2Fmultitaskagency.com%2Fdownloads%2FMTA-Team-1.0.2.apk;end">ضبط إشعارات الموبايل</a>}
          <details><summary>إعدادات الصوت والأيقونة وشاشة القفل</summary>
            <p>من إعدادات الهاتف ← التطبيقات ← {staff ? 'MTA Team' : 'MTA'} ← الإشعارات: اسمح بالصوت وشاشة القفل والإشعارات العائمة وشارات الأيقونة. يظهر شعار الشركة في الإشعار؛ شكله الصغير في الشريط العلوي أحادي اللون. الشارة قد تكون رقمًا أو نقطة حسب واجهة الهاتف.</p>
            {staff && <>
              <p><strong>شاومي:</strong> فعّل التشغيل التلقائي في الخلفية، واختر «بدون قيود» في بطارية التطبيق.</p>
              <p><strong>أوبو:</strong> اسمح بالنشاط في الخلفية من استخدام البطارية، وفعّل التشغيل التلقائي إذا كان متاحًا.</p>
              <p>راجع نفس القيود للمتصفح المستخدم داخل التطبيق، غالبًا Chrome. بعد ضبط الإعدادات جرّب إشعار الخادم، ثم اقفل الشاشة وتحقق من وصول طلب جديد من عميل.</p>
              <p><a href="/downloads/MTA-Team-1.0.2.apk" download>تحديث MTA Team إلى 1.0.2</a>. لو تطبيق العملاء مثبت على نفس الجهاز، <a href="/downloads/MTA-1.0.6.apk" download>حدّث MTA أيضًا</a> لمنع تداخل توجيه الإشعارات. ثبّت التحديث فوق النسخة الحالية.</p>
              <p>يمكن فتح حالة الإشعارات وإعدادات الهاتف بالضغط المطول على أيقونة MTA Team ثم «إعدادات الإشعارات».</p>
            </>}
            <p>لا يستطيع التطبيق تجاوز الإيقاف الإجباري أو منع الإشعارات أو وضع عدم الإزعاج. تختلف أسماء الإعدادات حسب إصدار الهاتف.</p>
          </details>
        </div>

        <div className="push-notification-prompt__actions">
          <button
            type="button"
            className="push-notification-prompt__enable"
            onClick={onEnable}
            disabled={isPending || retrySeconds > 0}
          >
            {isPending ? <LoaderCircle className="push-notification-prompt__spinner" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
            <span>{isPending ? 'جارٍ التفعيل…' : retrySeconds > 0 ? `إعادة التجربة بعد ${retrySeconds} ث` : 'اختبار الإرسال من الخادم'}</span>
          </button>
          {onLocalTest && <button type="button" className="push-notification-prompt__dismiss" onClick={onLocalTest} disabled={isPending}>تجربة إشعار الهاتف فقط</button>}
          <button
            type="button"
            className="push-notification-prompt__dismiss"
            onClick={onDismiss}
            disabled={isPending}
          >
            {isSuccess ? 'إغلاق' : 'ليس الآن'}
          </button>
        </div>

        <div
          className={`push-notification-prompt__status is-${feedbackTone}${message ? ' has-message' : ''}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message && <FeedbackIcon aria-hidden="true" />}
          <span>{message}{diagnostic && <small style={{display: 'block'}} dir="ltr">{diagnostic}</small>}</span>
        </div>
      </div>
    </aside>
  );
}
