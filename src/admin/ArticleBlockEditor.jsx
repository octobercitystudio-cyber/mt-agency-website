import { useId, useState } from 'react';
import { Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';

export function ArticleField({ label, hint, children, ...inputProps }) {
  const id = useId();
  return <div className="aa-field"><label htmlFor={id}>{label}</label>{children ? children(id) : <input id={id} {...inputProps} />}{hint && <small>{hint}</small>}</div>;
}

const initialBlock = type => ({ type, ...(type === 'heading' ? { level: 2, text: '' } : type === 'list' ? { ordered: false, items: [''] } : type === 'table' ? { rows: [['', ''], ['', '']] } : type === 'image' ? { url: '', alt: '', caption: '' } : type === 'video' ? { url: '', caption: '' } : type === 'link' ? { url: '', text: '' } : { text: '' }) });

export default function ArticleBlockEditor({ blocks, onChange, locale, t, disabled, onUpload }) {
  const [kind, setKind] = useState('paragraph');
  const update = (index, patch) => onChange(blocks.map((b, i) => i === index ? { ...b, ...patch } : b));
  const move = (index, delta) => { const next = [...blocks]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); };
  return <section className="aa-block-editor" aria-label={t.content}>
    <div className="aa-section-heading"><div><h3>{t.content}</h3><p>{t.contentHint}</p></div><span>{blocks.length} {t.contentsCount}</span></div>
    {blocks.map((block, index) => <fieldset className="aa-block" key={index} disabled={disabled} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <legend>{index + 1}. {t[block.type]}</legend>
      <div className="aa-block-actions"><button type="button" title={t.up} aria-label={`${t.up}: ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" title={t.down} aria-label={`${t.down}: ${index + 1}`} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button type="button" title={t.remove} aria-label={`${t.remove}: ${index + 1}`} onClick={() => onChange(blocks.filter((_, i) => i !== index))}><Trash2 size={16} /></button></div>
      {['paragraph', 'heading', 'quote', 'link'].includes(block.type) && <ArticleField label={t.text}>{id => <textarea id={id} value={block.text || ''} rows={block.type === 'paragraph' ? 5 : 2} onChange={e => update(index, { text: e.target.value })} />}</ArticleField>}
      {block.type === 'heading' && <ArticleField label={t.level}>{id => <select id={id} value={block.level || 2} onChange={e => update(index, { level: Number(e.target.value) })}><option value="2">H2</option><option value="3">H3</option></select>}</ArticleField>}
      {block.type === 'list' && <><label className="aa-check"><input type="checkbox" checked={!!block.ordered} onChange={e => update(index, { ordered: e.target.checked })} />{t.ordered}</label><ArticleField label={t.items}>{id => <textarea id={id} rows={5} value={(block.items || []).join('\n')} onChange={e => update(index, { items: e.target.value.split('\n') })} />}</ArticleField></>}
      {['image', 'video', 'link'].includes(block.type) && <ArticleField label={t.url} type="text" dir="ltr" value={block.url || ''} onChange={e => update(index, { url: e.target.value })} />}
      {['image', 'video'].includes(block.type) && <><ArticleField label={t.upload} hint={t.mediaHint}>{id => <input id={id} type="file" accept={block.type === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'} onChange={async e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) { const media = await onUpload(file); if (media) update(index, { url: media.url, ...(block.type === 'image' ? { width: media.width, height: media.height } : {}) }); } }} />}</ArticleField>{block.type === 'image' && <><ArticleField label={t.alt} value={block.alt || ''} onChange={e => update(index, { alt: e.target.value })} />{block.url && <img className="aa-inline-image" src={block.url} alt={block.alt || ''} />}</>}<ArticleField label={t.caption}>{id => <textarea id={id} rows={2} value={block.caption || ''} onChange={e => update(index, { caption: e.target.value })} />}</ArticleField></>}
      {block.type === 'table' && <><p className="aa-hint">{t.firstRow}</p><div className="aa-table-editor"><table><tbody>{(block.rows || []).map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci}><input aria-label={`${ri + 1} / ${ci + 1}`} value={cell} onChange={e => update(index, { rows: block.rows.map((r, rIndex) => rIndex === ri ? r.map((v, cIndex) => cIndex === ci ? e.target.value : v) : r) })} /></td>)}</tr>)}</tbody></table></div><div className="aa-actions"><button type="button" disabled={block.rows.length >= 30} onClick={() => update(index, { rows: [...block.rows, Array(block.rows[0]?.length || 2).fill('')] })}>{t.addRow}</button><button type="button" disabled={(block.rows[0]?.length || 0) >= 8} onClick={() => update(index, { rows: block.rows.map(row => [...row, '']) })}>{t.addColumn}</button><button type="button" disabled={block.rows.length < 2} onClick={() => update(index, { rows: block.rows.slice(0, -1) })}>{t.removeRow}</button><button type="button" disabled={(block.rows[0]?.length || 0) < 2} onClick={() => update(index, { rows: block.rows.map(row => row.slice(0, -1)) })}>{t.removeColumn}</button></div></>}
    </fieldset>)}
    <div className="aa-block-add"><label htmlFor="aa-new-block">{t.add}</label><select id="aa-new-block" disabled={disabled} value={kind} onChange={e => setKind(e.target.value)}>{['paragraph', 'heading', 'list', 'image', 'video', 'table', 'quote', 'link'].map(type => <option value={type} key={type}>{t[type]}</option>)}</select><button type="button" disabled={disabled || blocks.length >= 150} onClick={() => onChange([...blocks, initialBlock(kind)])}><Plus size={17} />{t.add}</button></div>
  </section>;
}
