import { useEffect, useRef } from 'react';
import { dataProvider, supabase } from '../supabaseClient';

export default function useChangeSync(onChange, enabled = true) {
  const callbackRef = useRef(onChange);
  const cursorRef = useRef(0);
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  useEffect(() => { callbackRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!enabled || dataProvider !== 'hostinger' || typeof supabase.request !== 'function') return undefined;
    stoppedRef.current = false;

    const schedule = (delay) => {
      window.clearTimeout(timerRef.current);
      if (!stoppedRef.current) timerRef.current = window.setTimeout(poll, delay);
    };

    const poll = async () => {
      const { data, error } = await supabase.request(`/sync?cursor=${cursorRef.current}`, { method: 'GET' });
      if (stoppedRef.current) return;
      if (!error && data) {
        cursorRef.current = Number(data.cursor || cursorRef.current);
        if (data.topics?.length) callbackRef.current?.(data.topics, data);
        schedule(document.hidden ? 30000 : 5000);
      } else {
        schedule(document.hidden ? 45000 : 15000);
      }
    };

    const onVisibility = () => {
      if (!document.hidden) schedule(250);
    };

    document.addEventListener('visibilitychange', onVisibility);
    poll();
    return () => {
      stoppedRef.current = true;
      window.clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
