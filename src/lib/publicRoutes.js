export const PUBLIC_LOCALES = ['ar', 'en'];

export const publicLocaleFromPath = pathname => {
  const match = String(pathname || '/').match(/^\/(ar|en)(?:\/|$)/i);
  return match ? match[1].toLowerCase() : 'ar';
};

export const stripPublicLocale = pathname => {
  const stripped = String(pathname || '/').replace(/^\/(?:ar|en)(?=\/|$)/i, '');
  return stripped || '/';
};

export const localizePublicPath = (value = '/', language = 'ar') => {
  const locale = String(language).startsWith('en') ? 'en' : 'ar';
  const raw = String(value || '/');
  if (/^(?:https?:|mailto:|tel:|#)/i.test(raw)) return raw;

  const hashIndex = raw.indexOf('#');
  const hash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const queryIndex = withoutHash.indexOf('?');
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const cleanPath = stripPublicLocale(pathname.startsWith('/') ? pathname : `/${pathname}`);
  const localized = cleanPath === '/' ? `/${locale}/` : `/${locale}${cleanPath.replace(/\/+$/, '')}/`;
  return `${localized}${query}${hash}`;
};

export const alternatePublicPath = (location, targetLanguage, articleTranslations = {}) => {
  const pathname = stripPublicLocale(location?.pathname || '/');
  // Article slugs can differ between languages, and a translation may be a
  // private draft. Never invent a sibling URL from the current article slug.
  if (/^\/articles\/[^/]+\/?$/.test(pathname)) {
    const translation = articleTranslations[targetLanguage];
    return typeof translation === 'string' && translation.startsWith(`/${targetLanguage}/articles/`)
      ? translation
      : `/${targetLanguage}/articles/?translation=unavailable`;
  }
  if (/^\/articles\/?$/.test(pathname)) return `/${targetLanguage}/articles/`;
  return localizePublicPath(`${pathname}${location?.search || ''}${location?.hash || ''}`, targetLanguage);
};
