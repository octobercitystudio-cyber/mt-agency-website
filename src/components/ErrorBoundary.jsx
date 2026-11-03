import React from 'react';
import { initialPublicPrerender, recoverPublicPrerender, restorePrerenderMetadata } from '../seo/publicPrerender';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, publicPage: null };
  }

  static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.recovery = new AbortController();
    const saved = initialPublicPrerender();
    if (saved) this.setState({ publicPage: saved });
    else recoverPublicPrerender(window.location.pathname, this.recovery.signal)
      .then(publicPage => { if (publicPage && !this.recovery.signal.aborted) this.setState({ publicPage }); })
      .catch(() => { /* Keep the neutral recovery screen if the network is unavailable. */ });
  }

  componentDidUpdate() {
    if (this.state.publicPage) {
      restorePrerenderMetadata(this.state.publicPage);
      this.restoreFrame = window.requestAnimationFrame(() => restorePrerenderMetadata(this.state.publicPage));
    }
  }

  componentWillUnmount() {
    this.recovery?.abort();
    window.cancelAnimationFrame(this.restoreFrame);
  }

  render() {
    if (this.state.hasError) {
      if (this.state.publicPage) {
        const isEnglish = this.state.publicPage.lang === 'en';
        return <>
          <div data-nosnippet="true" role="status" style={{ padding: '12px 20px', background: '#fbf4e7', color: '#28190f', textAlign: 'center' }}>
            {isEnglish ? 'You can browse this page. Reload to use all interactive features. ' : 'يمكنك تصفح الصفحة. أعد تحميلها لاستخدام جميع الخيارات التفاعلية. '}
            <a href={window.location.href}>{isEnglish ? 'Reload page' : 'إعادة تحميل الصفحة'}</a>
          </div>
          <div dangerouslySetInnerHTML={{ __html: this.state.publicPage.html }} />
        </>;
      }
      // You can render any custom fallback UI
      return (
        <div data-nosnippet="true" style={{ padding: '2rem', textAlign: 'center', color: '#fff', background: '#28190f', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <p style={{ color: '#f0cd8a', fontSize: '1.5rem', fontWeight: 700 }}>Multi Task Agency</p>
          <p>تعذر تحميل الصفحة الآن. أعد المحاولة.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: '1rem', padding: '0.5rem 1.5rem', background: '#eac06b', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            تحديث الصفحة
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
