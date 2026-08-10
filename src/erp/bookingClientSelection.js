export const resolveCreatedBookingClient = (refreshedClients, savedClient) => (
  (refreshedClients || []).find(item => String(item.id) === String(savedClient?.id)) || savedClient || null
);

export const applyBookingClientToDraft = (draft, client) => ({
  ...draft,
  client_id: client?.id || '',
  client_name: client?.name || '',
  color: client?.color || '#4318ff',
});

export const bookingClientIndicatorStyle = clientColor => ({ background: clientColor || '#4318ff' });
