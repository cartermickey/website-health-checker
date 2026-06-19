const store = new Map();

function create(url) {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  store.set(id, { id, url, status: 'pending', emit: null, queue: [] });
  return id;
}

function get(id) {
  return store.get(id);
}

module.exports = { create, get };
