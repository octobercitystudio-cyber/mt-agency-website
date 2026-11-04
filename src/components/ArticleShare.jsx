import { useState } from 'react';
import { Check, Link2 } from 'lucide-react';
import { BrandSocialIcon } from './BrandSocialLinks';

function WhatsAppIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0C5.4 0 0 5.4 0 12c0 2.1.5 4.1 1.6 6L0 24l6.2-1.6a12 12 0 0 0 5.8 1.5h.1c6.6 0 12-5.4 12-12 0-3.2-1.3-6.2-3.6-8.4ZM12.1 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A10 10 0 1 1 12.1 22Zm5.5-7.5c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-.9 1.2-.4.2-.7.1a8.2 8.2 0 0 1-2.5-1.6 9.4 9.4 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.2 3.4 5.2 4.7.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2.1-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.4Z"/></svg>;
}

export default function ArticleShare({ title, url, locale = 'ar' }) {
  const en = locale === 'en';
  const [copyState, setCopyState] = useState('');
  const links = [
    { key: 'facebook', name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { key: 'whatsapp', name: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}` },
    { key: 'linkedin', name: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { key: 'x', name: 'X', href: `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}` },
  ];
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  };
  return <section className="article-share" aria-label={en ? 'Share this article' : 'شارك المقال'}>
    <div className="article-share__heading">
      <h2>{en ? 'Share this article' : 'شارك المقال'}</h2>
      <button className="article-share__copy" type="button" onClick={copyLink}>{copyState === 'copied' ? <Check size={17} aria-hidden="true"/> : <Link2 size={17} aria-hidden="true"/>}{copyState === 'copied' ? (en ? 'Copied' : 'تم النسخ') : (en ? 'Copy link' : 'نسخ الرابط')}</button>
    </div>
    <div className="article-share__platforms">
      {links.map(link => <a key={link.key} className="article-share__platform" href={link.href} target="_blank" rel="noopener noreferrer" aria-label={en ? `Share on ${link.name} (opens in a new tab)` : `مشاركة عبر ${link.name} (يفتح في نافذة جديدة)`}>
        {link.key === 'whatsapp' ? <WhatsAppIcon/> : <BrandSocialIcon platform={link.key}/>}<span dir="ltr">{link.name}</span>
      </a>)}
    </div>
    <span className="article-share__status" role="status">{copyState === 'copied' ? (en ? 'Article link copied.' : 'تم نسخ رابط المقال.') : copyState === 'failed' ? (en ? 'Copy the page address from your browser.' : 'يمكنك نسخ عنوان الصفحة من المتصفح.') : ''}</span>
  </section>;
}
