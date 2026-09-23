import { useEffect, useRef, useState } from 'react';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import PushNotificationPrompt from './PushNotificationPrompt';
import {
  dismissPushPrompt,
  hasStoredPushToken,
  loadPushConfiguration,
  pushEnvironmentSupported,
  pushPromptDismissed,
  registerPushNotifications,
  syncAppBadge,
} from '../lib/pushNotifications';

const friendlyError = error => {
  if (error?.message === 'push_permission_denied' || error?.code === 'denied') {
    return 'الإشعارات محظورة من إعدادات الجهاز. يمكنك السماح بها من إعدادات التطبيق.';
  }
  if (error?.message === 'push_unsupported') return 'هذا الجهاز لا يدعم إشعارات التطبيق.';
  return 'تعذر تفعيل الإشعارات الآن. حاول مرة أخرى بعد قليل.';
};

export default function PushNotificationsBridge() {
  const { currentUser } = useData();
  const [configuration, setConfiguration] = useState(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const currentPrincipal = currentUser ? `${currentUser.role}:${currentUser.id}` : '';
  const registrationRef = useRef('');

  useEffect(() => {
    let disposed = false;
    if (!currentUser || currentUser.role === 'applicant' || !pushEnvironmentSupported()) {
      registrationRef.current = '';
      return undefined;
    }
    loadPushConfiguration(dataClient).then(async config => {
      if (disposed || !config.enabled || !config.schema_ready) return setVisible(false);
      setConfiguration(config);
      if (Notification.permission === 'granted') {
        if (registrationRef.current !== currentPrincipal || !hasStoredPushToken()) {
          await registerPushNotifications(dataClient, config, false);
          registrationRef.current = currentPrincipal;
        }
        if (!disposed) setVisible(false);
        return;
      }
      if (!disposed) {
        setStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
        setMessage(Notification.permission === 'denied' ? friendlyError({ code: 'denied' }) : '');
        setVisible(Notification.permission === 'default' && !pushPromptDismissed());
      }
    }).catch(error => {
      if (disposed) return;
      console.warn('Push setup unavailable:', error);
      setVisible(false);
    });
    return () => { disposed = true; };
  }, [currentPrincipal, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'applicant') return undefined;
    const settings = async () => {
      setVisible(true); setStatus('loading'); setMessage('جارٍ مراجعة إشعارات هذا الجهاز…');
      try {
        const config = await loadPushConfiguration(dataClient); setConfiguration(config);
        if (!config.enabled || !config.schema_ready) { setStatus('error'); setMessage(config.reason === 'unsupported' ? 'هذا المتصفح لا يدعم إشعارات الجهاز. استخدم التطبيق أو متصفحًا يدعمها.' : 'إشعارات الجهاز غير جاهزة على الخادم. التنبيهات داخل البرنامج مستمرة.'); return; }
        setStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
        setMessage(Notification.permission === 'denied' ? friendlyError({ code: 'denied' }) : 'اضغط تفعيل الإشعارات لتسجيل هذا الجهاز وإظهار إشعار تجريبي.');
      } catch { setStatus('error'); setMessage('تعذر مراجعة الإشعارات. حاول مرة أخرى.'); }
    };
    window.addEventListener('mtPushSettings', settings);
    return () => window.removeEventListener('mtPushSettings', settings);
  }, [currentPrincipal, currentUser]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'applicant' || !('serviceWorker' in navigator)) return undefined;
    const receiveBadge = event => {
      if (event.data?.type === 'MT_PUSH_BADGE') { syncAppBadge(event.data.unread_count); window.dispatchEvent(new CustomEvent('mtPushChange', { detail: { topics: event.data.topics || ['notifications'], source: 'service-worker' } })); }
    };
    navigator.serviceWorker.addEventListener('message', receiveBadge);
    return () => navigator.serviceWorker.removeEventListener('message', receiveBadge);
  }, [currentUser]);

  const enable = async () => {
    if (!configuration?.enabled || !configuration?.schema_ready) { setStatus('error'); setMessage('إشعارات الجهاز غير متاحة حاليًا.'); return; }
    setStatus('requesting');
    setMessage('اسمح للمتصفح أو التطبيق بعرض الإشعارات على هذا الجهاز.');
    try {
      await registerPushNotifications(dataClient, configuration, true);
      registrationRef.current = currentPrincipal;
      setStatus('success');
      setMessage('تم التفعيل. إذا كان الإشعار بلا صوت، فعّل صوت إشعارات التطبيق وأوقف وضع عدم الإزعاج من إعدادات الجهاز.');
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('تم تفعيل إشعارات Multi Task Agency', { body: 'هذا إشعار تجريبي. ستصلك تحديثات الحسابات والباقات والمواعيد والمدفوعات.', icon: '/app-icon.svg', tag: 'mt-notification-test', silent: false, vibrate: [220, 100, 220], dir: 'rtl', lang: 'ar', data: { url: currentUser.role === 'owner' ? '/erp' : '/dashboard' } });
    } catch (error) {
      setStatus('error');
      setMessage(friendlyError(error));
    }
  };

  const dismiss = () => {
    if (status !== 'success') dismissPushPrompt();
    setVisible(false);
  };

  if (!currentUser || currentUser.role === 'applicant' || !visible) return null;
  return <PushNotificationPrompt status={status} message={message} onEnable={enable} onDismiss={dismiss} />;
}
