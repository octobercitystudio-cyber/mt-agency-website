// A baseline snapshot is silent. Only newly received, unread items trigger an alert.
export function createOwnerAlertTracker() {
  let principal = null;
  let latest = null;
  return (userId, items) => {
    if (principal !== userId) { principal = userId; latest = null; }
    const valid = items.filter(item => Number.isSafeInteger(Number(item.id)) && Number(item.id) > 0);
    const next = Math.max(latest ?? 0, ...valid.map(item => Number(item.id)));
    const fresh = latest === null ? [] : valid.filter(item => Number(item.id) > latest && !item.read_at && !item.dismissed_at);
    latest = next;
    return fresh.sort((a, b) => Number(b.id) - Number(a.id));
  };
}

export function createOwnerAlertSound(environment = globalThis) {
  let context;
  return {
    async unlock() {
      const Constructor = environment.AudioContext || environment.webkitAudioContext;
      if (!Constructor) throw new Error('audio_unsupported');
      context ??= new Constructor();
      if (context.state === 'suspended') await context.resume();
      if (context.state !== 'running') throw new Error('audio_blocked');
    },
    play() {
      if (context?.state !== 'running') return false;
      // Two clear, short ascending chimes with a smooth envelope, without external assets.
      for (const [offset, frequency] of [[0, 740], [.24, 988], [.65, 740], [.89, 988]]) {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const at = context.currentTime + offset;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.24, at + .025); gain.gain.exponentialRampToValueAtTime(.001, at + .3);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(at); oscillator.stop(at + .32);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      }
      return true;
    },
    close() { void context?.close().catch(() => {}); context = undefined; },
  };
}

export async function playOwnerAlertOnce(userId, notificationId, play, environment = globalThis) {
  const key = `mt:owner-alert:last-sound:${userId}`;
  const claim = () => {
    try { if (Number(environment.localStorage.getItem(key) || 0) >= notificationId) return false; } catch { /* storage unavailable */ }
    if (!play()) return false;
    try { environment.localStorage.setItem(key, String(notificationId)); } catch { /* playback still works */ }
    return true;
  };
  return environment.navigator?.locks?.request ? environment.navigator.locks.request(key, claim) : claim();
}
