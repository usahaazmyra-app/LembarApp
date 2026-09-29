// Lembar · membuat catatan baru per jenis
import * as store from '../store.js';
import { builtinTemplates, cloneBlocks } from './templates.js';
import { compressImage } from './image.js';
import { fmtDay, t } from '../i18n.js';
import { promptText, snack } from '../ui.js';
import { noteTitle } from '../components.js';

const tb = () => ({ id: store.uid(), t: 'text', html: '' });

export async function createNoteOfType(type, query = {}) {
  const bookId = query.book && store.book(query.book) ? query.book : null;
  if (query.tpl) return createFromTemplate(query.tpl, bookId);
  switch (type) {
    case 'checklist':
      return store.createNote({ type, bookId, blocks: [{ id: store.uid(), t: 'check', items: [{ id: store.uid(), text: '', done: false }] }] });
    case 'sketch':
      return store.createNote({ type, bookId, blocks: [{ id: store.uid(), t: 'sketch', att: null, strokes: [] }] });
    case 'voice':
      return store.createNote({ type, bookId, blocks: [tb()] });
    case 'journal': {
      const key = query.date || store.dayKey();
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y, m - 1, d, 12);
      const tpl = builtinTemplates().find(x => x.id === 'journal');
      return store.createNote({
        type: 'journal', journalDate: key, title: fmtDay(date), mood: null,
        bookId: store.book('jurnal') ? 'jurnal' : bookId, blocks: tpl.blocks(),
        createdAt: key === store.dayKey() ? Date.now() : date.getTime(),
      });
    }
    default:
      return store.createNote({ type: 'text', bookId, blocks: [tb()] });
  }
}

export async function createFromTemplate(id, bookId = null) {
  const b = builtinTemplates().find(x => x.id === id);
  if (b) {
    if (b.type === 'journal') return createNoteOfType('journal', {});
    return store.createNote({ type: b.type, bookId, title: '', blocks: b.blocks() });
  }
  const c = store.templates().find(x => x.id === id);
  if (c) return store.createNote({ type: c.type || 'text', bookId: bookId || c.bookId || null, title: c.title || '', blocks: cloneBlocks(c.blocks) });
  return createNoteOfType('text', { book: bookId });
}

export async function imageBlocks(files, { scan = false } = {}) {
  const blocks = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const { blob, w, h, original } = await compressImage(f, { scan });
    const att = await store.putAttachment(blob);
    blocks.push({ id: store.uid(), t: 'image', att, w, h, size: blob.size, original });
  }
  return blocks;
}

export async function createPhotoNote(files, query = {}) {
  const bookId = query.book && store.book(query.book) ? query.book : null;
  const blocks = await imageBlocks(files, { scan: !!query.scan });
  return store.createNote({ type: 'photo', bookId, blocks: [...blocks, tb()] });
}

// Simpan catatan sebagai template buatan sendiri. Mengembalikan template, atau null jika batal.
export async function saveNoteAsTemplate(note) {
  const name = await promptText({ title: t('Simpan sebagai template'), value: noteTitle(note), placeholder: t('Nama template') });
  if (!name) return null;
  const blocks = JSON.parse(JSON.stringify(note.blocks.filter(b => !b.att)));
  blocks.forEach(b => { if (b.items) b.items.forEach(i => { i.done = false; }); });
  if (!blocks.length) blocks.push(tb());
  const tp = await store.saveTemplate({ name, desc: t('Template buatanmu'), type: note.type === 'journal' ? 'text' : note.type, color: note.color || 'k8', blocks, title: '' });
  snack(t('Template “{n}” tersimpan', { n: name }));
  return tp;
}
