import { useCallback, useEffect, useState } from 'react';
import { dataClient } from '../dataClient';

const dismissedStorageKey = userId => `mt-agency:operational-alerts:dismissed:${Number(userId) || 'anonymous'}`;

const readDismissedAlerts = userId => {
  try {
    const value = JSON.parse(localStorage.getItem(dismissedStorageKey(userId)) || '[]');
    return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(-250) : []);
  } catch {
    return new Set();
  }
};

export default function useOperationalAlerts({ userId, role } = {}) {
  const [sourceAlerts, setSourceAlerts] = useState([]);
  const [, setDismissedVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const dismissed = readDismissedAlerts(userId);

  const fetchAlerts = useCallback(async () => {
    if (!role || role === 'client') {
      setSourceAlerts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: requestError } = await dataClient.request('/operational-alerts', { method: 'GET' });
    if (requestError) {
      console.error('Unable to load operational alerts:', requestError);
      setError('تعذر تحديث التنبيهات الآن. حاول مرة أخرى.');
    } else {
      setSourceAlerts(Array.isArray(data?.items) ? data.items : []);
      setError('');
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAlerts();
    const interval = window.setInterval(fetchAlerts, 300000);
    return () => window.clearInterval(interval);
  }, [fetchAlerts]);

  const dismissAlert = useCallback(alertId => {
    const next = readDismissedAlerts(userId);
    next.add(String(alertId));
    localStorage.setItem(dismissedStorageKey(userId), JSON.stringify([...next].slice(-250)));
    setDismissedVersion(version => version + 1);
  }, [userId]);

  const alerts = sourceAlerts.filter(alert => !dismissed.has(String(alert.id)));
  return { alerts, loading, error, fetchAlerts, dismissAlert };
}
