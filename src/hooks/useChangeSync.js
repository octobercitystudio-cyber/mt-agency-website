import { useEffect, useRef } from 'react';
import { dataProvider, dataClient } from '../dataClient';

// One transport for the whole mounted application. Screens subscribe to topics
// without creating competing cursors or losing events between independent polls.
const subscribers = new Map();
let nextSubscriberId = 1;
let sharedCursor = 0;
let timer = null;
let polling = false;
let visibilityAttached = false;

const notifySubscribers = (topics, payload) => subscribers.forEach(callback => callback?.(topics, payload));
const schedule = delay => {
  window.clearTimeout(timer);
  timer = subscribers.size ? window.setTimeout(poll, delay) : null;
};

const poll = async () => {
  if (polling || !subscribers.size) return;
  polling = true;
  try {
    const allTopics = new Set(); const allEvents = []; let latestPayload = null; let pages = 0;
    do {
      const { data, error } = await dataClient.request(`/sync?cursor=${sharedCursor}`, { method: 'GET' });
      if (error || !data) throw error || new Error('sync_unavailable');
      latestPayload = data;
      const nextCursor = Number(data.cursor ?? sharedCursor);
      if (nextCursor < sharedCursor) throw new Error('sync_cursor_regressed');
      sharedCursor = nextCursor;
      (data.topics || []).forEach(topic => allTopics.add(topic));
      allEvents.push(...(data.events || []));
      pages += 1;
      if (!data.has_more || pages >= 20) break;
    } while (subscribers.size);
    if (allTopics.size) notifySubscribers([...allTopics], { ...latestPayload, events: allEvents, cursor: sharedCursor });
    schedule(document.hidden ? 30000 : 5000);
  } catch {
    schedule(document.hidden ? 45000 : 15000);
  } finally {
    polling = false;
  }
};

const onVisibility = () => { if (!document.hidden) schedule(250); };
const ensureTransport = () => {
  if (!visibilityAttached) { document.addEventListener('visibilitychange', onVisibility); visibilityAttached = true; }
  if (!polling && timer === null) poll();
};
const stopTransportIfIdle = () => {
  if (subscribers.size) return;
  window.clearTimeout(timer); timer = null;
  if (visibilityAttached) { document.removeEventListener('visibilitychange', onVisibility); visibilityAttached = false; }
};

export default function useChangeSync(onChange, enabled = true) {
  const callbackRef = useRef(onChange);
  useEffect(() => { callbackRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!enabled || dataProvider !== 'hostinger' || typeof dataClient.request !== 'function') return undefined;
    const id = nextSubscriberId++;
    subscribers.set(id, (topics, payload) => callbackRef.current?.(topics, payload));
    ensureTransport();
    return () => { subscribers.delete(id); stopTransportIfIdle(); };
  }, [enabled]);
}
