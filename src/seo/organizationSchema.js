import { getHeaderSocialLinks } from '../data/publicHeader.js';
import { normalizeCompanyPhone } from '../lib/companyContact.js';
import { organizationId, siteIdentity, publicPageDescriptions } from './siteIdentity.js';

export function organizationSchema(locale = 'ar', contact = {}) {
  return {
    '@type': ['Organization', 'ProfessionalService'],
    '@id': organizationId,
    name: siteIdentity.name,
    alternateName: siteIdentity.alternateName,
    url: siteIdentity.url,
    logo: { '@type': 'ImageObject', url: siteIdentity.logo, width: 600, height: 485 },
    image: siteIdentity.logo,
    description: publicPageDescriptions['/'][locale],
    email: siteIdentity.email,
    telephone: normalizeCompanyPhone(contact.phone) || siteIdentity.telephone,
    sameAs: getHeaderSocialLinks(contact).map(item => item.href),
    address: {
      '@type': 'PostalAddress',
      addressLocality: siteIdentity.address.locality,
      addressRegion: siteIdentity.address.region,
      addressCountry: siteIdentity.address.country,
    },
    areaServed: [{ '@type': 'City', name: '6th of October City' }, { '@type': 'AdministrativeArea', name: 'Giza' }, { '@type': 'Country', name: 'Egypt' }],
  };
}
