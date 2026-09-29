// Lembar · IndexedDB wrapper (tanpa dependensi)
const DB_NAME = 'lembar';
const DB_VERSION = 1;
export const STORES = ['notes', 'books', 'attachments', 'templates', 'settings'];

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database diblokir oleh tab lain'));
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then(r => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaksi dibatalkan'));
  }));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const db = {
  getAll(store) { return tx(store, 'readonly', s => reqP(s.getAll())); },
  get(store, id) { return tx(store, 'readonly', s => reqP(s.get(id))); },
  put(store, value) { return tx(store, 'readwrite', s => reqP(s.put(value))); },
  putMany(store, values) {
    return tx(store, 'readwrite', s => { for (const v of values) s.put(v); });
  },
  delete(store, id) { return tx(store, 'readwrite', s => reqP(s.delete(id))); },
  deleteMany(store, ids) { return tx(store, 'readwrite', s => { for (const id of ids) s.delete(id); }); },
  clear(store) { return tx(store, 'readwrite', s => reqP(s.clear())); },
};
