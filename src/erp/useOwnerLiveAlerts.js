import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createOwnerAlertSound, createOwnerAlertTracker, playOwnerAlertOnce } from '../lib/ownerLiveAlerts';

const saved = key => { try { return localStorage.getItem(key) !== 'off'; } catch { return true; } };
export default function useOwnerLiveAlerts(userId) {
  const preference = `mt:owner-alert:sound:${userId}`;
  const sound = useMemo(() => createOwnerAlertSound(), []);
  const tracker = useRef(createOwnerAlertTracker());
  const [enabled, setEnabled] = useState(() => saved(preference));
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [toast, setToast] = useState(null);
  const enabledRef = useRef(enabled);
  const setPreference = value => { enabledRef.current = value; setEnabled(value); try { localStorage.setItem(preference, value ? 'on' : 'off'); } catch { /* preference is optional */ } };
  useEffect(() => {
    enabledRef.current = saved(preference); setEnabled(enabledRef.current); setReady(false); setToast(null);
    const unlock = () => { if (enabledRef.current) void sound.unlock().then(() => setReady(true)).catch(() => setReady(false)); };
    const storage = event => { if (event.key === preference) { enabledRef.current = saved(preference); setEnabled(enabledRef.current); unlock(); } };
    unlock();
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
