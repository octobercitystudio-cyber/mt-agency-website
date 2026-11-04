import { ArrowLeft, ArrowRight } from 'lucide-react';
import { articleCtaCopy } from '../lib/articleCta';

export default function ArticleCta({ locale = 'ar', service, contactHref = `/${locale}/contact/`, serviceHref }) {
  const en = locale === 'en';
  const copy = articleCtaCopy(service, locale);
  const Arrow = en ? ArrowRight : ArrowLeft;
  const relatedHref = serviceHref || (service ? `/${locale}/services/${encodeURIComponent(service)}/` : '');
  return <aside className="article-ending-cta" aria-label={copy.question}>
    <span className="article-ending-cta__eyebrow">{en ? 'LET’S TALK ABOUT YOUR PROJECT' : 'خلّينا نتكلم عن مشروعك'}</span>
    <h2>{copy.question}</h2>
    <div className="article-ending-cta__actions">
      <a className="article-ending-cta__button article-ending-cta__button--primary" href={contactHref}>{copy.contactLabel}<Arrow size={19} aria-hidden="true"/></a>
      {relatedHref && <a className="article-ending-cta__button article-ending-cta__button--secondary" href={relatedHref}>{copy.serviceLabel}<Arrow size={19} aria-hidden="true"/></a>}
    </div>
  </aside>;
}
