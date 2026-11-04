import { SITE_URL } from './siteIdentity.js';

// The recording venue is distinct from the provider's headquarters.
// Only the district and city confirmed by the company are represented.
export function serviceLocationSchema(slug, locale = 'ar') {
  if (slug !== 'podcast-production') return {};
  const en = locale === 'en';
  return {
    areaServed: [
      { '@type': 'Place', name: en ? 'Fifth Settlement' : 'التجمع الخامس' },
      { '@type': 'City', name: en ? 'New Cairo' : 'القاهرة الجديدة' },
    ],
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceLocation: {
        '@type': 'Place',
        '@id': `${SITE_URL}/#podcast-studio-fifth-settlement`,
        name: en ? 'Podcast and content studio in Fifth Settlement' : 'استديو البودكاست والمحتوى في التجمع الخامس',
        address: {
          '@type': 'PostalAddress',
          addressLocality: en ? 'Fifth Settlement, New Cairo' : 'التجمع الخامس، القاهرة الجديدة',
          addressRegion: en ? 'Cairo Governorate' : 'محافظة القاهرة',
          addressCountry: 'EG',
        },
      },
    },
  };
}
