import { useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useData } from '../store/DataContext';
import { loadGoogleIdentity } from '../lib/googleIdentity';

export default function GoogleSignIn({ disabled, onResult, onBusy, onError }) {
  const { getGoogleConfig, createGoogleChallenge, loginGoogle } = useData();
  const host = useRef(null);
  const callbacks = useRef({ onResult, onBusy, onError, disabled });
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { callbacks.current = { onResult, onBusy, onError, disabled }; }, [onResult, onBusy, onError, disabled]);

  useEffect(() => {
    let active = true;
    let consumed = false;
    let expires;
    let resize;
    const container = host.current;
    const prepare = async () => {
      try {
        const config = await getGoogleConfig();
        if (!active) return;
        if (!config?.enabled || !config.client_id) { setState('unavailable'); return; }
        const identity = await loadGoogleIdentity();
        if (!active) return;
        const challenge = await createGoogleChallenge();
        if (!active) return;
        if (!/^[a-f0-9]{64}$/.test(challenge?.challenge_id || '') || !/^[a-f0-9]{64}$/.test(challenge?.nonce || '') || !(challenge.expires_in > 0)) throw new Error('Invalid challenge');
        const expiresAt = Date.now() + Number(challenge.expires_in) * 1000;
        identity.initialize({
          client_id: config.client_id,
          nonce: challenge.nonce,
          auto_select: false,
          ux_mode: 'popup',
          callback: async response => {
            if (!active || consumed || callbacks.current.disabled) return;
            if (!response?.credential || Date.now() >= expiresAt) {
              setState('failed');
              callbacks.current.onError('انتهت محاولة Google. أعد المحاولة.');
              return;
            }
            consumed = true;
            clearTimeout(expires);
            setState('signing');
            callbacks.current.onBusy(true);
            try {
              const result = await loginGoogle({ credential: response.credential, challenge_id: challenge.challenge_id });
              if (active) callbacks.current.onResult(result);
            } catch {
              if (active) {
                setState('failed');
                callbacks.current.onError('تعذر إكمال الدخول عبر Google. أعد المحاولة أو استخدم رقم الموبايل.');
              }
            } finally {
              if (active) callbacks.current.onBusy(false);
            }
          },
        });
        let renderedWidth = 0;
        const render = () => {
          if (!active || consumed || !container) return;
          const width = Math.min(400, Math.floor(container.getBoundingClientRect().width));
          if (!width || width === renderedWidth) return;
          renderedWidth = width;
          container.replaceChildren();
          identity.renderButton(container, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', locale: 'ar', width });
        };
        render();
        resize = new ResizeObserver(render);
        resize.observe(container);
        expires = setTimeout(() => { if (active && !consumed) { setState('loading'); setAttempt(value => value + 1); } }, Math.max(1000, Number(challenge.expires_in) * 1000 - 1000));
        setState('ready');
      } catch {
        if (active) setState('failed');
      }
    };
    void prepare();
    return () => { active = false; clearTimeout(expires); resize?.disconnect(); container?.replaceChildren(); };
  }, [attempt, getGoogleConfig, createGoogleChallenge, loginGoogle]);

  return <div className="unified-google" aria-label="الدخول عبر Google" aria-busy={state === 'loading' || state === 'signing'}>
    <div className="unified-login-divider"><span>أو</span></div>
    <div ref={host} className="unified-google-host" hidden={state !== 'ready'} inert={disabled || state !== 'ready' ? true : undefined} />
    {(state === 'loading' || state === 'signing') && <p className="unified-google-status" role="status"><LoaderCircle className="unified-login-spinner" aria-hidden="true" />{state === 'signing' ? 'جارٍ تأكيد الدخول…' : 'جارٍ تجهيز Google…'}</p>}
    {state === 'unavailable' && <p className="unified-google-status">الدخول عبر Google غير متاح حاليًا</p>}
    {state === 'failed' && <div className="unified-google-retry"><p>الدخول عبر Google غير متاح الآن.</p><button type="button" className="unified-text-button" disabled={disabled} onClick={() => { setState('loading'); setAttempt(value => value + 1); }}>إعادة المحاولة</button></div>}
  </div>;
}
