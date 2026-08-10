import { useState } from 'react';
import { ExternalLink, Play } from 'lucide-react';

const getYouTubeId = url => {
  if (!url) return '';
  if (url.includes('youtube.com/embed/')) return url.split('embed/')[1]?.split('?')[0] || '';
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] || '';
  if (url.includes('youtube.com/shorts/')) return url.split('youtube.com/shorts/')[1]?.split('?')[0] || '';
  if (url.includes('youtube.com/watch')) {
    try { return new URL(url).searchParams.get('v') || ''; } catch { return ''; }
  }
  return '';
};

function LiteYouTube({ url, title }) {
  const [loaded, setLoaded] = useState(false);
  const videoId = getYouTubeId(url);
  if (!videoId) return null;
  if (loaded) return <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1`} title={title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />;
  return <button type="button" className="public-work-video" onClick={() => setLoaded(true)} aria-label={`${title} — YouTube`}>
    <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt={title} loading="lazy" decoding="async" />
    <span><Play aria-hidden="true" /></span>
  </button>;
}

export default function PublicPortfolioGrid({ items, categories = [], isEnglish, emptyTitle, emptyText }) {
  if (!items.length) return <div className="public-work-empty">
    <span aria-hidden="true">MT</span><h3>{emptyTitle}</h3><p>{emptyText}</p>
  </div>;
  return <div className="public-work-grid">
    {items.map((item, index) => {
      const title = (isEnglish ? item.titleEn : item.title) || item.title || item.titleEn || (isEnglish ? 'MT Agency project' : 'مشروع من MT Agency');
      const category = categories.find(entry => entry.id === item.category);
      const categoryLabel = category?.[isEnglish ? 'nameEn' : 'nameAr'] || item.category;
      const alt = (isEnglish ? item.altEn : item.alt) || `${title} — ${isEnglish ? 'MT Agency portfolio' : 'من أعمال MT Agency'}`;
      return <article className="public-work-item" key={item.id || `${item.category}-${index}`}>
        <div className="public-work-media">
          {item.embedUrl ? <LiteYouTube url={item.embedUrl} title={alt} /> : item.projectUrl ? <a href={item.projectUrl} target="_blank" rel="noopener noreferrer" aria-label={`${title} — ${isEnglish ? 'open project' : 'فتح المشروع'}`}><img src={item.imageUrl} alt={alt} loading="lazy" decoding="async" /><ExternalLink aria-hidden="true" /></a> : item.imageUrl ? <img src={item.imageUrl} alt={alt} loading="lazy" decoding="async" /> : null}
        </div>
        <div className="public-work-copy"><span>{categoryLabel}</span><h3>{title}</h3></div>
      </article>;
    })}
  </div>;
}
