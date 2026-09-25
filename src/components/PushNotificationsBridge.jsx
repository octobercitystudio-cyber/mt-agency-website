import { useEffect, useRef, useState } from 'react';
import { dataClient } from '../dataClient';
import { useData } from '../store/DataContext';
import PushNotificationPrompt from './PushNotificationPrompt';
import { startAutomaticPushRegistration } from '../lib/autoPushRegistration';
import {
  dismissPushPrompt,
  loadPushConfiguration,
  pushEnvironmentSupported,
  pushPromptDismissed,
  registerPushNotifications,
  syncAppBadge,
  testPushDelivery,
  testLocalPushNotification,
} from '../lib/pushNotifications';

const friendlyError = error => {
  if (error?.message === 'push_permission_denied' || error?.code === 'denied') {
    return 'الإشعارات محظورة من إعدادات الجهاز. يمكنك السماح بها من إعدادات التطبيق.';
  }
  if (error?.code?.startsWith('push_') && error?.message && error.message !== error.code) return error.message;
  if (error?.message === 'push_permission_required') return 'اضغط تفعيل الإشعارات ثم وافق على طلب السماح من الهاتف.';
  if (error?.message === 'push_unsupported') return 'هذا الجهاز لا يدعم إشعارات التطبيق.';
  const code = String(error?.code || error?.message || 'unknown').replace(/[^a-zA-Z0-9_/-]/g, '').slice(0,80);
  return `تعذر إكمال اتصال الإشعارات. كود التشخيص: ${code}.`; 
};

export default function PushNotificationsBridge() {
  const { currentUser } = useData();
  const [configuration, setConfiguration] = useState(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const manualCheck = useRef(false);
  const [diagnostic, setDiagnostic] = useState('');
  const currentPrincipal = currentUser ? `${currentUser.role}:${currentUser.id}` : '';

  useEffect(() => {
    if (!currentPrincipal || currentPrincipal.startsWith('applicant:') || !pushEnvironmentSupported()) return undefined;
    return startAutomaticPushRegistration({
      loadConfiguration: async () => { const config = await loadPushConfiguration(dataClient); setConfiguration(config); return config; },
      register: (config, requestPermission, options) => {
        setConfiguration(config);
        return registerPushNotifications(dataClient, config, requestPermission, options);
      },
      onRegistered: () => { if (!manualCheck.current) { setStatus('success'); setVisible(false); } },
      onPermissionNeeded: permission => {
        if (currentPrincipal.startsWith('client:') || pushPromptDismissed()) return;
        setStatus(permission === 'denied' ? 'denied' : 'idle');
        setMessage(permission === 'denied' ? friendlyError({ code: 'denied' }) : 'اضغط تفعيل الإشعارات ووافق على طلب الهاتف لتصلك تنبيهات الإدارة والتطبيق مغلق.');
        setVisible(true);
      },
      onError: error => {
        // Some browsers defer the system prompt until ordinary interaction; retry then automatically.
        if (['push_permission_required', 'push_permission_denied'].includes(error?.message)) return;
        setStatus('error'); setMessage(friendlyError(error)); setVisible(true);
      },
    });
  }, [currentPrincipal]);

  useEffect(() => {
    if (!currentUser || currentUser.role === 'applicant') return undefined;
    const settings = async () => {
      manualCheck.current = true; setDiagnostic('');
      setVisible(true); setStatus('loading'); setMessage('جارٍ مراجعة إشعارات هذا الجهاز…');
      try {
        const config = await loadPushConfiguration(dataClient); setConfiguration(config);
        if (!config.enabled || !config.schema_ready) { setStatus('error'); setMessage(config.reason === 'unsupported' ? 'هذا المتصفح لا يدعم إشعارات الجهاز. استخدم التطبيق أو متصفحًا يدعمها.' : 'إشعارات الجهاز غير جاهزة على الخادم. التنبيهات داخل البرنامج مستمرة.'); return; }
        setStatus(Notification.permission === 'denied' ? 'denied' : 'idle');
        setMessage(Notification.permission === 'denied' ? friendlyError({ code: 'denied' }) : 'التسجيل يعمل تلقائيًا. يمكنك إرسال إشعار تجريبي للتأكد من وصول التنبيه والصوت.');
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
    manualCheck.current = true; setDiagnostic(''); setStatus('requesting');
    setMessage('اسمح للمتصفح أو التطبيق بعرض الإشعارات على هذا الجهاز.');
    try {
      await registerPushNotifications(dataClient, configuration, true);
      try {
        try { await testPushDelivery(dataClient); }
        catch (error) {
          if (error?.code !== 'push_token_expired') throw error;
          setMessage('جارٍ تجديد تسجيل الجهاز المنتهي وإعادة اختبار الإرسال…');
          await registerPushNotifications(dataClient, configuration, false, { renewToken: true });
          await testPushDelivery(dataClient);
        }
        setStatus('success');
        setMessage('تم تسجيل الجهاز وإرسال تجربة من الخادم. تأكد من وصول الإشعار وسماع صوته؛ نجاح الإرسال وحده لا يؤكد وصوله للهاتف.');
      } catch (error) {
        setStatus('error');
        setDiagnostic(`server: ${error?.code || 'unknown'}`);
        setMessage(`تم تسجيل الجهاز، لكن الإرسال من الخادم لم ينجح. ${friendlyError(error)}`);
      }
    } catch (error) {
      setStatus('error');
      setDiagnostic(`registration: ${error?.code || error?.message || 'unknown'}`);
      setMessage(friendlyError(error));
    }
  };

  const localTest = async () => {
    manualCheck.current = true; setStatus('requesting'); setDiagnostic('');
    try {
      await testLocalPushNotification(); setStatus('idle');
      setMessage('تم طلب عرض إشعار على الهاتف مباشرة. إذا لم يظهر أو لم يصدر صوتًا فراجع إعدادات الهاتف وChrome. إذا ظهر، اضغط «اختبار الإرسال من الخادم».');
      setDiagnostic('local_display_requested');
    } catch (error) { setStatus('error'); setMessage(friendlyError(error)); setDiagnostic(`local: ${error?.code || error?.message || 'unknown'}`); }
  };

  const dismiss = () => {
    manualCheck.current = false;
    if (status !== 'success') dismissPushPrompt();
    setVisible(false);
  };

  if (!currentUser || currentUser.role === 'applicant' || !visible) return null;
  return <PushNotificationPrompt staff={currentUser.role !== 'client'} status={status} message={message} diagnostic={diagnostic} onLocalTest={localTest} onEnable={enable} onDismiss={dismiss} />;
}
