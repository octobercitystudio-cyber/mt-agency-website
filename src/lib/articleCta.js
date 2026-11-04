import { safeArticleLink } from './articlesApi';

export function articleCtaCopy(service, locale = 'ar') {
  const en = locale === 'en';
  if (service === 'social-media-management') return {
    question: en ? 'Want to strengthen your digital presence and create more sales opportunities?' : 'هل تريد تعزيز حضور شركتك الرقمي وزيادة فرص البيع؟',
    contactLabel: en ? 'Discuss your digital presence' : 'ناقش حضورك الرقمي معنا',
    serviceLabel: en ? 'Social media management' : 'خدمة إدارة السوشيال ميديا',
  };
  if (service === 'commercial-video-production') return {
    question: en ? 'Want an ad that reflects the quality of your company or product?' : 'هل تريد إعلانًا يعكس جودة شركتك أو منتجك؟',
    contactLabel: en ? 'Discuss your ad idea' : 'ناقش فكرة إعلانك معنا',
    serviceLabel: en ? 'Advertising video production' : 'خدمة تصوير الإعلانات',
  };
  return {
    question: en ? 'Ready to start your project?' : 'جاهز نبدأ مشروعك؟',
    contactLabel: en ? 'Discuss your project' : 'ناقش مشروعك معنا',
    serviceLabel: en ? 'Explore the related service' : 'تعرّف على الخدمة',
  };
}

function ctaDestination(block, locale) {
  if (block?.type !== 'link') return null;
  const href = safeArticleLink(block.url);
  if (!href) return null;
  const url = new URL(href, 'https://multitaskagency.com');
  if (url.origin !== 'https://multitaskagency.com' || url.username || url.password) return null;
  if (url.pathname === `/${locale}/contact/` || url.pathname === `/${locale}/contact`) return { kind: 'contact', href };
  const service = url.pathname.match(new RegExp(`^/${locale}/services/([a-z0-9-]+)/?$`))?.[1];
  return service ? { kind: 'service', service, href } : null;
}

// Only the final pair of service/contact links is a call to action. Earlier
// reference links and the article's original heading anchors remain untouched.
export function articleClosingCta(blocks = [], locale = 'ar') {
  const end = blocks.findLastIndex(block => block.type === 'link');
  if (end < 1 || blocks.slice(end + 1).some(block => block.type !== 'paragraph')) return null;
  const pair = [ctaDestination(blocks[end - 1], locale), ctaDestination(blocks[end], locale)];
  const contact = pair.find(link => link?.kind === 'contact');
  const service = pair.find(link => link?.kind === 'service');
  if (!contact || !service) return null;
  return { start: end - 1, end, contactHref: contact.href, serviceHref: service.href, service: service.service };
}
