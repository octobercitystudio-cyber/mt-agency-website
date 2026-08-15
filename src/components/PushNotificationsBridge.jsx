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
    if (!currentUser || !pushEnvironmentSupported()) {
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

  const enable = async () => {
    if (!configuration) return;
    setStatus('requesting');
    setMessage('سيطلب Android إذنك مرة واحدة لعرض الإشعارات.');
    try {
      await registerPushNotifications(dataClient, configuration, true);
      registrationRef.current = currentPrincipal;
      setStatus('success');
      setMessage('تم تفعيل إشعارات الحجوزات والمدفوعات والتحديثات بنجاح.');
    } catch (error) {
      setStatus('error');
      setMessage(friendlyError(error));
    }
  };

  const dismiss = () => {
    if (status !== 'success') dismissPushPrompt();
    setVisible(false);
  };

  if (!currentUser || !visible) return null;
  return <PushNotificationPrompt status={status} message={message} onEnable={enable} onDismiss={dismiss} />;
}
