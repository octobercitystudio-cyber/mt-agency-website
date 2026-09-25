import { createPortal } from 'react-dom';
import { BellRing, Volume2, VolumeX, X } from 'lucide-react';

export default function OwnerLiveAlerts({ alerts, onOpen, settings = false, onDeviceSettings }) {
  return <>
    {!settings && <button type="button" className="owner-notifications__sound" onClick={alerts.enabled ? alerts.mute : alerts.enable} aria-label={alerts.enabled ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'} title={alerts.enabled ? 'صوت داخل التطبيق — اضغط للكتم' : 'اضغط لتفعيل وتجربة صوت التنبيهات'}>{alerts.enabled ? <Volume2/> : <VolumeX/>}<span>{alerts.enabled ? 'صوت داخل التطبيق' : 'تفعيل الصوت'}</span></button>}
    {settings && <div className="owner-notifications__settings"><strong>الصوت وإشعارات الجهاز</strong><p>صوت الصفحة يعمل أثناء فتحها. للتنبيه والتطبيق مغلق أو الشاشة مقفولة، استخدم إعدادات إشعارات الجهاز واختبر الإرسال من الخادم.</p><div><button type="button" onClick={alerts.enable}><Volume2/> تجربة الصوت داخل التطبيق</button><button type="button" onClick={() => { onDeviceSettings?.(); window.dispatchEvent(new CustomEvent('mtPushSettings')); }}><BellRing/> إعدادات إشعارات الجهاز</button></div><small role="status">{alerts.message || 'على الموبايل، اسمح بالإشعارات وفعّل صوت التطبيق من إعدادات الجهاز.'}</small></div>}
    {!settings && alerts.toast && createPortal(<aside className="owner-notifications__toast" role="status" aria-live="polite" dir="rtl"><BellRing/><div><strong>{alerts.toast.title}</strong><p>{alerts.toast.message}</p>{alerts.toast.count > 1 && <small>وصلت {alerts.toast.count} إشعارات جديدة</small>}<button type="button" onClick={() => { const item = alerts.toast; alerts.dismiss(); onOpen(item); }}>فتح التفاصيل</button></div><button type="button" onClick={alerts.dismiss} aria-label="إغلاق التنبيه"><X/></button></aside>, document.body)}
  </>;
}
