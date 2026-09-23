import { AlertCircle, BellRing, CheckCircle2, LoaderCircle } from 'lucide-react';
import './PushNotificationPrompt.css';

const pendingStatuses = new Set(['loading', 'pending', 'requesting', 'enabling']);
const successStatuses = new Set(['success', 'enabled', 'granted']);
const errorStatuses = new Set(['error', 'denied', 'failed']);

export default function PushNotificationPrompt({
  status = 'idle',
  message = '',
  onEnable,
  onDismiss,
}) {
  const normalizedStatus = String(status || 'idle').toLowerCase();
  const isPending = pendingStatuses.has(normalizedStatus);
  const isSuccess = successStatuses.has(normalizedStatus);
  const isError = errorStatuses.has(normalizedStatus);
  const feedbackTone = isError ? 'error' : isSuccess ? 'success' : 'info';
  const FeedbackIcon = isError ? AlertCircle : isSuccess ? CheckCircle2 : BellRing;

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
          <h2 id="push-notification-prompt-title">ابقَ على اطلاع</h2>
          <p>يبدأ تسجيل الإشعارات تلقائيًا لتصلك تحديثات حسابك بصوت، حتى عند إغلاق التطبيق أو قفل الشاشة. وافق على طلب السماح من النظام عند ظهوره.</p>
          <details><summary>إعدادات الصوت والأيقونة وشاشة القفل</summary><p>من إعدادات الهاتف ← التطبيقات ← MTA ← الإشعارات: اسمح بالإشعارات والصوت وشارات الأيقونة والعرض على شاشة القفل. على بعض الهواتف تظهر نقطة بدل الرقم. إذا تأخرت التنبيهات، راجع قيود البطارية والعمل بالخلفية. لا تصل التنبيهات أثناء إيقاف التطبيق إجباريًا، ولا يمكن تجاوز وضع الصامت أو عدم الإزعاج.</p></details>
        </div>

        <div className="push-notification-prompt__actions">
          <button
            type="button"
            className="push-notification-prompt__enable"
            onClick={onEnable}
            disabled={isPending || isSuccess}
          >
            {isPending ? <LoaderCircle className="push-notification-prompt__spinner" aria-hidden="true" /> : <BellRing aria-hidden="true" />}
            <span>{isPending ? 'جارٍ التفعيل…' : isSuccess ? 'تم التفعيل' : 'تفعيل الإشعارات'}</span>
          </button>
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
          <span>{message}</span>
        </div>
      </div>
    </aside>
  );
}
