import { getHeaderSocialLinks } from '../data/publicHeader';
import './BrandSocialLinks.css';

export function BrandSocialIcon({ platform }) {
  const paths = {
    facebook: <path d="M14 21v-8h3l.5-4H14V7c0-1.2.3-2 2-2h2V1.5a24 24 0 0 0-3-.2c-3 0-5 1.8-5 5.2V9H7v4h3v8z"/>,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="17.5" cy="6.5" r="1.2"/></>,
    linkedin: <><circle cx="4.5" cy="4.5" r="2"/><path d="M3 8h3v13H3zm6 0h3v1.8c1-1.4 2.2-2.1 4-2.1 3.1 0 5 1.8 5 5.5V21h-3.5v-7.1c0-2-.7-3.1-2.3-3.1-1.8 0-2.7 1.2-2.7 3.5V21H9z"/></>,
    youtube: <><path d="M21.5 6.5c-.3-1-1.1-1.8-2.1-2C17.6 4 12 4 12 4s-5.6 0-7.4.5c-1 .2-1.8 1-2.1 2C2 8.3 2 12 2 12s0 3.7.5 5.5c.3 1 1.1 1.8 2.1 2C6.4 20 12 20 12 20s5.6 0 7.4-.5c1-.2 1.8-1 2.1-2 .5-1.8.5-5.5.5-5.5s0-3.7-.5-5.5z" fill="none" stroke="currentColor" strokeWidth="1.7"/><path d="m10 8 6 4-6 4z"/></>,
    tiktok: <path d="M15 2h3c.2 2.1 1.4 3.6 4 4v3a9 9 0 0 1-4-1.2V16a6 6 0 1 1-6-6v3a3 3 0 1 0 3 3z"/>,
    x: <path d="M3 3h5.1l4.8 6.4L18.5 3H21l-7 8.2L22 21h-5.1l-5.5-7.2L5.2 21H2.7l7.4-8.8zm3.4 1.8L17.8 19.2h1.8L8.2 4.8z"/>,
  };
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{paths[platform]}</svg>;
}

export default function BrandSocialLinks({ contact = {}, isEnglish = false, dark = false }) {
  return <div className={`brand-social${dark ? ' brand-social--dark' : ''}`}>
    <p className="brand-social__title">{isEnglish ? 'Follow us' : 'تابعنا على'}</p>
    <nav className="brand-social__links" aria-label={isEnglish ? 'Company social media accounts' : 'حسابات الشركة على السوشيال ميديا'}>
      {getHeaderSocialLinks(contact).map(item => <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" aria-label={item.label} title={item.label}><BrandSocialIcon platform={item.key}/></a>)}
    </nav>
  </div>;
}
