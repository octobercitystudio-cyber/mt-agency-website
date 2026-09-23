import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BellRing, Volume2, VolumeX, X } from 'lucide-react';
import { createOwnerAlertSound, createOwnerAlertTracker, playOwnerAlertOnce } from '../lib/ownerLiveAlerts';

const saved = key => { try { return localStorage.getItem(key) === 'on'; } catch { return false; } };
export function useOwnerLiveAlerts(userId) {
  const preference = `mt:owner-alert:sound:${userId}`;
  const sound = useMemo(() => createOwnerAlertSound(), [userId]);
  const tracker = useRef(createOwnerAlertTracker());
  const [enabled, setEnabled] = useState(() => saved(preference));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const enabledRef = useRef(enabled); enabledRef.current = enabled;
  const setPreference = value => { enabledRef.current = value; setEnabled(value); try { localStorage.setItem(preference, value ? 'on' : 'off'); } catch { /* preference is optional */ } };
  useEffect(() => {
    setEnabled(saved(preference)); setReady(false); setToast(null);
    const unlock = () => { if (enabledRef.current) void sound.unlock().then(() => setReady(true)).catch(() => setReady(false)); };
    const storage = event => { if (event.key === preference) setEnabled(saved(preference)); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock); window.addEventListener('storage', storage);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); window.removeEventListener('storage', storage); sound.close(); };
  }, [preference, sound]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 15000); return () => clearTimeout(timer); }, [toast]);
  const ingest = useCallback(items => {
    const fresh = tracker.current(userId, items);
    if (!fresh.length) return;
    setToast({ ...fresh[0], count: fresh.length });
    if (enabledRef.current) void playOwnerAlertOnce(userId, Number(fresh[0].id), () => sound.play()).catch(() => {});
  }, [userId, sound]);
  const enable = async () => {
    try { await sound.unlock(); setPreference(true); setReady(true); sound.play(); setMessage('الصوت مفعّل للتنبيهات الجديدة أثناء فتح البرنامج.'); }
    catch { setReady(false); setMessage('تعذر تشغيل الصوت. اسمح بصوت الموقع من إعدادات المتصفح ثم حاول مجددًا.'); }
  };
  return { ingest, toast, dismiss: () => setToast(null), enabled, ready, message, enable, mute: () => { setPreference(false); setMessage('تم كتم صوت البرنامج على هذا الجهاز.'); } };
}

export default function OwnerLiveAlerts({ alerts, onOpen, settings = false, onDeviceSettings }) {
  return <>
    {!settings && <button type="button" className="owner-notifications__sound" onClick={alerts.enabled && alerts.ready ? alerts.mute : alerts.enable} aria-label={alerts.enabled && alerts.ready ? 'كتم صوت التنبيهات' : 'تفعيل صوت التنبيهات'} title={alerts.enabled && alerts.ready ? 'الصوت مفعّل — اضغط للكتم' : 'اضغط لتفعيل وتجربة صوت التنبيهات'}>{alerts.enabled && alerts.ready ? <Volume2/> : <VolumeX/>}<span>{alerts.enabled && alerts.ready ? 'الصوت مفعّل' : 'تفعيل الصوت'}</span></button>}
    {settings && <div className="owner-notifications__settings"><strong>الصوت وإشعارات الجهاز</strong><p>تنبيه للحسابات والباقات والمواعيد والمدفوعات الجديدة.</p><div><button type="button" onClick={alerts.enable}><Volume2/> تجربة الصوت</button><button type="button" onClick={() => { onDeviceSettings?.(); window.dispatchEvent(new CustomEvent('mtPushSettings')); }}><BellRing/> تفعيل إشعارات الجهاز</button></div><small role="status">{alerts.message || 'على الموبايل، اسمح بالإشعارات وفعّل صوت التطبيق من إعدادات الجهاز.'}</small></div>}
    {!settings && alerts.toast && createPortal(<aside className="owner-notifications__toast" role="status" aria-live="polite" dir="rtl"><BellRing/><div><strong>{alerts.toast.title}</strong><p>{alerts.toast.message}</p>{alerts.toast.count > 1 && <small>وصلت {alerts.toast.count} إشعارات جديدة</small>}<button type="button" onClick={() => { const item = alerts.toast; alerts.dismiss(); onOpen(item); }}>فتح التفاصيل</button></div><button type="button" onClick={alerts.dismiss} aria-label="إغلاق التنبيه"><X/></button></aside>, document.body)}
  </>;
}
