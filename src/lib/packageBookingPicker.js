import { isSellablePackageTemplate } from './clientPackageDraft.js';

const arabicCollator = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

const text = value => String(value ?? '').trim();
const stableNameSort = (left, right) => arabicCollator.compare(text(left?.name), text(right?.name)) || arabicCollator.compare(text(left?.id), text(right?.id));

export const normalizeArabicSearch = value => text(value)
  .normalize('NFKD')
  .replace(/\p{M}/gu, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ؤ/g, 'و')
  .replace(/ئ/g, 'ي')
  .replace(/ة/g, 'ه')
  .toLocaleLowerCase('ar');

export const sortClientsByArabicName = clients => [...(clients || [])].sort(stableNameSort);

export const filterClientsByName = (clients, query, selectedId = '') => {
  const needle = normalizeArabicSearch(query);
  return sortClientsByArabicName(clients).filter(client => (
    !needle
    || normalizeArabicSearch(client?.name).includes(needle)
    || String(client?.id) === String(selectedId)
  ));
};

export const mergeCreatedClient = (clients, createdClient) => {
  if (!createdClient?.id) return sortClientsByArabicName(clients);
  const existing = (clients || []).find(client => String(client.id) === String(createdClient.id));
  const merged = { ...(existing || {}), ...createdClient };
  return sortClientsByArabicName([...(clients || []).filter(client => String(client.id) !== String(createdClient.id)), merged]);
};

const fixedGroups = [
  { key: 'hour', label: 'التصوير بالساعة', aliases: ['تصوير بالساعة', 'التصوير بالساعة'] },
  { key: 'day', label: 'الباقات اليومية', aliases: ['باقة يومية', 'الباقة اليومية', 'الباقات اليومية'] },
  { key: 'month', label: 'الباقات الشهرية', aliases: ['باقة شهرية', 'الباقة الشهرية', 'الباقات الشهرية'] },
  { key: 'reel', label: 'باقات الريلز', aliases: ['باقة ريلز', 'باقة الريلز', 'باقات الريلز'] },
];

const aliasToGroup = new Map(fixedGroups.flatMap(group => group.aliases.map(alias => [normalizeArabicSearch(alias), group.key])));

const serviceGroupKey = service => {
  const category = text(service?.category);
  const alias = aliasToGroup.get(normalizeArabicSearch(category));
  if (alias) return alias;
  const unit = text(service?.billing_unit).toLowerCase();
  if (!category) {
    if (unit === 'reel') return 'reel';
    if (unit === 'day') return 'day';
    if (unit === 'month') return 'month';
    if (unit === 'hour') return 'hour';
  }
  return `custom:${category || 'غير مصنف'}`;
};

export const buildPackageServiceGroups = services => {
  const buckets = new Map();
  (services || []).filter(isSellablePackageTemplate).forEach(service => {
    const key = serviceGroupKey(service);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(service);
  });

  const groups = fixedGroups
    .map(group => ({ key: group.key, label: group.label, services: (buckets.get(group.key) || []).sort(stableNameSort) }))
    .filter(group => group.services.length);

  const customGroups = [...buckets.entries()]
    .filter(([key]) => key.startsWith('custom:'))
    .map(([key, rows]) => ({ key, label: key.slice('custom:'.length), services: rows.sort(stableNameSort) }))
    .sort((left, right) => arabicCollator.compare(left.label, right.label));

  return [...groups, ...customGroups];
};
