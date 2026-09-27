import defaults from '../../api/package_guide_defaults.json' with { type: 'json' };
export const CLIENT_PACKAGE_GUIDE_KEY = 'client_package_guide';
export const defaultPackageGuide = () => ({ revision: 0, updated_at: null, content: structuredClone(defaults) });
export function validatePackageGuideContent(content) {
  const fail = () => { throw Object.assign(new Error('راجع الحقول المطلوبة وأطوال النصوص في دليل الباقات.'), { code: 'invalid_package_guide', status: 422 }); };
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const text = (value, limit) => { if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > limit) fail(); return value.trim(); };
  if (!object(content) || Object.keys(content).length !== Object.keys(defaults).length || Object.keys(content).some(key => !(key in defaults))) fail();
  const result = {};
  for (const [key, value] of Object.entries(defaults)) if (typeof value === 'string') result[key] = text(content[key], key.endsWith('title') ? 140 : 2000);
  for (const [key, limit] of Object.entries({ included_features: 12, studio_features: 12, delivery_options: 8 })) {
    if (!Array.isArray(content[key]) || !content[key].length || content[key].length > limit) fail();
    result[key] = content[key].map(item => {
      if (key === 'included_features') return text(item, 200);
      const fields = key === 'studio_features' ? { title: 140, description: 2000 } : { title: 140, timeframe: 180, description: 2000 };
      if (!object(item) || Object.keys(item).length !== Object.keys(fields).length || Object.keys(item).some(field => !(field in fields))) fail();
      return Object.fromEntries(Object.entries(fields).map(([field, max]) => [field, text(item[field], max)]));
    });
  }
  const descriptions = content.package_descriptions;
  if (!(object(descriptions) || (Array.isArray(descriptions) && !descriptions.length)) || Object.keys(descriptions).length > 100) fail();
  result.package_descriptions = Object.fromEntries(Object.entries(descriptions).map(([id, value]) => { if (!/^[1-9]\d{0,9}$/.test(id)) fail(); return [id, text(value, 1500)]; }));
  return result;
}
