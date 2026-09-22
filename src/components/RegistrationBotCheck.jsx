import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import 'altcha/external';
import 'altcha/i18n/ar';
import 'altcha/altcha.css';
import Pbkdf2Worker from 'altcha/workers/pbkdf2?worker';
import { dataClient } from '../dataClient';
import './RegistrationBotCheck.css';

window.$altcha.algorithms.set('PBKDF2/SHA-256', () => new Pbkdf2Worker());

export default function RegistrationBotCheck({ onPayload }) {
  const widgetRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    const widget = widgetRef.current;
    let cancelled = false;
    let loadTimer;
    let onLoad;
    const clearProof = () => onPayload('');
    const expired = () => {
      if (cancelled) return;
      clearProof(); setStatus('error');
      setError('انتهت صلاحية التحقق. أعد التحقق للمتابعة.');
    };
    const verified = event => {
      if (cancelled) return;
      const proof = event.detail?.payload;
      if (typeof proof === 'string' && proof) { onPayload(proof); setStatus('verified'); setError(''); }
    };
    const stateChanged = event => {
      if (cancelled) return;
      const state = event.detail?.state;
      if (state !== 'verified') clearProof();
      if (state === 'verifying') { setStatus('verifying'); setError(''); }
      if (state === 'expired') expired();
      if (state === 'error') { setStatus('error'); setError('تعذر إكمال التحقق. حاول مرة أخرى.'); }
    };
    widget.addEventListener('verified', verified);
    widget.addEventListener('expired', expired);
    widget.addEventListener('statechange', stateChanged);
    const initialize = async () => {
      try {
        await customElements.whenDefined('altcha-widget');
        if (cancelled) return;
        if (typeof widget.configure !== 'function') {
          await new Promise((resolve, reject) => {
            onLoad = resolve;
            widget.addEventListener('load', onLoad, { once: true });
            loadTimer = window.setTimeout(() => reject(new Error('widget_unavailable')), 8000);
          });
        }
        clearTimeout(loadTimer);
        if (cancelled) return;
        const result = await dataClient.request('/registration/bot-challenge');
        if (cancelled) return;
        if (result.error || !result.data?.parameters || !result.data?.signature) throw result.error || new Error('challenge_unavailable');
        await widget.configure({ challenge: result.data, language: 'ar', auto: 'off', workers: 2, hideLogo: true, hideFooter: true, humanInteractionSignature: false });
        if (!cancelled) setStatus('ready');
      } catch (failure) {
        if (cancelled) return;
        clearProof(); setStatus('error');
        setError(failure?.status === 429 || failure?.code === 'registration_rate_limited' ? 'محاولات التحقق كثيرة حاليًا. انتظر قليلًا ثم أعد المحاولة.' : 'تعذر تحميل التحقق. تأكد من الاتصال ثم أعد المحاولة.');
      }
    };
    void initialize();
    return () => {
      cancelled = true; clearTimeout(loadTimer);
      if (onLoad) widget.removeEventListener('load', onLoad);
      widget.removeEventListener('verified', verified);
      widget.removeEventListener('expired', expired);
      widget.removeEventListener('statechange', stateChanged);
    };
  }, [attempt, onPayload]);

  const retry = () => { onPayload(''); setError(''); setStatus('loading'); setAttempt(value => value + 1); };
  return <section className="registration-bot-check" aria-labelledby="registration-bot-title" aria-busy={status === 'loading' || status === 'verifying'}>
    <div className="registration-bot-title"><ShieldCheck aria-hidden="true"/><div><h3 id="registration-bot-title">تحقق بسيط لحماية حسابك</h3><p>اضغط على مربع التحقق للمتابعة.</p></div></div>
    <div className="registration-bot-widget" hidden={status === 'loading' || status === 'error'}><altcha-widget key={attempt} ref={widgetRef} language="ar" auto="off" name="altcha" dir="rtl" /></div>
    {status === 'loading' && <p className="registration-bot-loading" role="status"><LoaderCircle aria-hidden="true"/> جارٍ تجهيز التحقق…</p>}
    {error && <div className="registration-bot-error"><p role="alert">{error}</p><button type="button" onClick={retry}><RefreshCw aria-hidden="true"/> إعادة التحقق</button></div>}
  </section>;
}