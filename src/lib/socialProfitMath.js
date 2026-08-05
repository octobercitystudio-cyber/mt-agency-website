export const socialAmountToCents = value => {
  const raw = String(value ?? '').trim();
  if (!/^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ''] = raw.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents >= 1 && cents <= 999999999999999 ? cents : null;
};

export const socialCentsToAmount = cents => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

export const summarizeSocialProfits = entries => {
  const monthly = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, youtube_cents: 0, facebook_cents: 0 }));
  let youtubeCents = 0; let facebookCents = 0; let activeCount = 0;
  entries.filter(entry => entry.status === 'active').forEach(entry => {
    const cents = socialAmountToCents(entry.amount) || 0;
    if (entry.platform === 'youtube') youtubeCents += cents; else facebookCents += cents;
    monthly[Number(entry.earning_month) - 1][`${entry.platform}_cents`] += cents;
    activeCount += 1;
  });
  return {
    summary: { total: socialCentsToAmount(youtubeCents + facebookCents), youtube: socialCentsToAmount(youtubeCents), facebook: socialCentsToAmount(facebookCents), active_count: activeCount },
    months: monthly.map(row => ({ month: row.month, youtube: socialCentsToAmount(row.youtube_cents), facebook: socialCentsToAmount(row.facebook_cents), total: socialCentsToAmount(row.youtube_cents + row.facebook_cents) })),
  };
};
