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

export const alternatePublicPath = (location, targetLanguage) => {
  const pathname = stripPublicLocale(location?.pathname || '/');
  return localizePublicPath(`${pathname}${location?.search || ''}${location?.hash || ''}`, targetLanguage);
};
