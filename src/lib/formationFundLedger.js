export const filterFormationFundEntries = (entries = [], { entryType = 'contribution', status = 'all', founderId = 'all' } = {}) => entries.filter(entry => {
  if (entry.entry_type !== entryType) return false;
  if (status !== 'all' && entry.status !== status) return false;
  if (founderId === 'all') return true;

  const selectedFounder = Number(founderId);
  if (entryType === 'contribution') return Number(entry.founder_id) === selectedFounder;
  return entry.allocations?.some(row => Number(row.founder_id) === selectedFounder) || false;
});
