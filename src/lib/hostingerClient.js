const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const toError = (payload, fallback = 'تعذر الاتصال بالخادم.') => {
  const source = payload?.error || payload;
  const error = new Error(source?.message || fallback);
  error.code = source?.code || 'api_error';
  error.status = source?.status;
  return error;
};

const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) {
    const error = toError(payload);
    error.status = response.status;
    throw error;
  }
  return payload?.data;
};

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.method = 'GET';
    this.columns = '*';
    this.filters = [];
    this.orders = [];
    this.limitCount = 0;
    this.singleMode = '';
    this.payload = null;
    this.returning = false;
  }

  select(columns = '*') {
    this.columns = columns;
    if (this.method !== 'GET') this.returning = true;
    return this;
  }

  insert(rows) { this.method = 'POST'; this.payload = { rows: Array.isArray(rows) ? rows : [rows] }; return this; }
  update(values) { this.method = 'PATCH'; this.payload = { values }; return this; }
  delete() { this.method = 'DELETE'; return this; }
  eq(column, value) { return this.#filter(column, 'eq', value); }
  neq(column, value) { return this.#filter(column, 'neq', value); }
  gt(column, value) { return this.#filter(column, 'gt', value); }
  gte(column, value) { return this.#filter(column, 'gte', value); }
  lt(column, value) { return this.#filter(column, 'lt', value); }
  lte(column, value) { return this.#filter(column, 'lte', value); }
  like(column, value) { return this.#filter(column, 'like', value); }
  ilike(column, value) { return this.#filter(column, 'ilike', value); }
  in(column, value) { return this.#filter(column, 'in', value); }
  not(column, operator, value) { return this.#filter(column, operator === 'like' ? 'not_like' : 'neq', value); }
  order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
  limit(value) { this.limitCount = Number(value) || 0; return this; }
  single() { this.singleMode = 'required'; return this; }
  maybeSingle() { this.singleMode = 'optional'; return this; }

  // Kept for a short migration window. New code should use the authenticated user id.
  or(expression) {
    this.orExpression = expression;
    return this;
  }

  #filter(column, op, value) {
    this.filters.push({ column, op, value });
    return this;
  }

  async execute() {
    try {
      const params = new URLSearchParams();
      params.set('columns', this.columns);
      if (this.filters.length) params.set('filters', JSON.stringify(this.filters));
      if (this.orders.length) params.set('orders', JSON.stringify(this.orders));
      if (this.limitCount) params.set('limit', String(this.limitCount));
      if (this.singleMode) params.set('single', this.singleMode);
      if (this.orExpression) params.set('or', this.orExpression);
      const path = `/data/${encodeURIComponent(this.table)}?${params.toString()}`;
      const requestOptions = { method: this.method };
      if (this.payload) requestOptions.body = JSON.stringify(this.payload);
      const data = await apiRequest(path, requestOptions);
      return { data, error: null, count: Array.isArray(data) ? data.length : undefined };
    } catch (error) {
      return { data: null, error, count: 0 };
    }
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

const authListeners = new Set();
let cachedUser = null;

const notifyAuth = (event, session) => {
  authListeners.forEach((listener) => listener(event, session));
};

const auth = {
  async signInWithPassword({ email, password, identifier }) {
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier || email, password }),
      });
      cachedUser = data.user;
      const session = { ...data.session, user: data.user };
      notifyAuth('SIGNED_IN', session);
      return { data: { session, user: data.user }, error: null };
    } catch (error) {
      return { data: { session: null, user: null }, error };
    }
  },

  async getSession() {
    try {
      const data = await apiRequest('/auth/session');
      cachedUser = data.user;
      return { data: { session: data.session ? { ...data.session, user: data.user } : null }, error: null };
    } catch (error) {
      return { data: { session: null }, error };
    }
  },

  async getUser() {
    if (cachedUser) return { data: { user: cachedUser }, error: null };
    const result = await this.getSession();
    return { data: { user: result.data.session?.user || null }, error: result.error };
  },

  onAuthStateChange(callback) {
    authListeners.add(callback);
    return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
  },

  async signOut() {
    try {
      await apiRequest('/auth/logout', { method: 'POST', body: '{}' });
      cachedUser = null;
      notifyAuth('SIGNED_OUT', null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },

  async updateUser({ password, currentPassword }) {
    try {
      const data = await apiRequest('/auth/password', {
        method: 'PATCH',
        body: JSON.stringify({ password, current_password: currentPassword }),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
};
const noopChannel = {
  on() { return this; },
  subscribe() { return this; },
  unsubscribe() {},
};

export const hostingerClient = {
  from(table) { return new QueryBuilder(table); },
  auth,
  channel() { return { ...noopChannel }; },
  removeChannel() {},
  async rpc(name, args = {}) {
    try {
      const data = await apiRequest(`/rpc/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(args) });
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
  async request(path, options) {
    try { return { data: await apiRequest(path, options), error: null }; }
    catch (error) { return { data: null, error }; }
  },
};
