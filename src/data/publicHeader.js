export const officialHeaderSocialLinks = {
  facebook: 'https://www.facebook.com/multitaskagencyeg',
  instagram: 'https://www.instagram.com/multitaskagencyeg/',
  linkedin: 'https://www.linkedin.com/company/multitaskagencyeg',
  tiktok: 'https://www.tiktok.com/@multitaskagencyeg',
  x: 'https://x.com/multitaskagency',
};

export const headerSocialPlatforms = [
  { key: 'facebook', label: 'Facebook' }, { key: 'instagram', label: 'Instagram' },
  { key: 'linkedin', label: 'LinkedIn' }, { key: 'tiktok', label: 'TikTok' },
  { key: 'x', label: 'X', alternate: 'twitter' }, { key: 'youtube', label: 'YouTube' },
];

export function getHeaderSocialLinks(contact = {}) {
  return headerSocialPlatforms.flatMap(platform => {
    const candidates = [contact[platform.key], contact[platform.alternate], officialHeaderSocialLinks[platform.key]];
    for (const value of candidates) {
      try {
        const url = new URL(String(value || '').trim());
        if (['https:', 'http:'].includes(url.protocol)) return [{ ...platform, href: url.href }];
      } catch { /* Empty and placeholder values are not social links. */ }
    }
    return [];
  });
}
