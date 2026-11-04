import { articleVideo, safeArticleLink } from '../lib/articlesApi';

export default function ArticleContent({ blocks = [], locale = 'ar' }) {
  return <div className="article-prose">{blocks.map((block, index) => {
    const key = `${index}-${block.type}`;
    if (block.type === 'heading') {
      const Heading = Number(block.level) === 3 ? 'h3' : 'h2';
      return <Heading key={key} id={`section-${index + 1}`} tabIndex={-1}>{block.text}</Heading>;
    }
    if (block.type === 'paragraph') return <p key={key}>{block.text}</p>;
    if (block.type === 'quote') return <blockquote key={key}><p>{block.text}</p></blockquote>;
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul';
      return <List key={key}>{(block.items || []).map((text, itemIndex) => <li key={itemIndex}>{text}</li>)}</List>;
    }
    if (block.type === 'image' && safeArticleLink(block.url)) return <figure key={key}><img src={block.url} alt={block.alt || ''} width={Number(block.width) || 1200} height={Number(block.height) || 675} loading="lazy" decoding="async"/>{block.caption && <figcaption>{block.caption}</figcaption>}</figure>;
    if (block.type === 'video') {
      const video = articleVideo(block.url);
      if (!video) return null;
      return <figure key={key} className="article-video">{video.type === 'youtube' ? <iframe src={video.src} title={block.caption || (locale === 'en' ? 'Article video' : 'فيديو المقال')} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/> : <video src={video.src} controls preload="none" playsInline aria-label={block.caption || (locale === 'en' ? 'Article video' : 'فيديو المقال')}/>}<figcaption>{block.caption}</figcaption></figure>;
    }
    if (block.type === 'table' && block.rows?.length) return <div key={key} className="article-table-scroll" role="region" tabIndex={0} aria-label={locale === 'en' ? 'Article table, scroll horizontally if needed' : 'جدول المقال، يمكن التمرير أفقيًا عند الحاجة'}><table><thead><tr>{block.rows[0].map((cell, cellIndex) => <th key={cellIndex} scope="col">{cell}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
    if (block.type === 'link') {
      const href = safeArticleLink(block.url);
      return href ? <p key={key}><a href={href} rel={href.startsWith('https:') ? 'noopener noreferrer' : undefined}>{block.text || href}</a></p> : null;
    }
    return null;
  })}</div>;
}
