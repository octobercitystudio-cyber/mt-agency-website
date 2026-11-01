import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { useData } from '../store/DataContext';
import { Link } from 'react-router-dom';
import { localizePublicPath } from '../lib/publicRoutes';
import { getStudioFallback, STUDIO_CATEGORIES } from '../data/studioGalleries';
import useModalDialog from '../hooks/useModalDialog';
import './StudioShowcase.css';

function FullStudioImage({ image, onError, isEnglish }) {
  const [loading, setLoading] = useState(true);
  if (image.failed) return <p className="studio-lightbox__status" role="status">{isEnglish ? 'This photo could not be loaded. You can continue to the next photo.' : 'تعذر تحميل هذه الصورة. يمكنك الانتقال إلى الصورة التالية.'}</p>;
  return <>
    {loading && <span className="studio-lightbox__status" role="status">{isEnglish ? 'Loading photo…' : 'جارٍ تحميل الصورة…'}</span>}
    <img className="studio-lightbox__image" src={image.url} alt={image.alt} onLoad={() => setLoading(false)} onError={onError} decoding="async" />
  </>;
}

function StudioLightbox({ images, index, studioName, isEnglish, onStep, onClose, onImageError, returnFocusRef }) {
  const titleId = useId();
  const captionId = useId();
  const dialogRef = useModalDialog(true, onClose, { returnFocusRef, isolateBackground: true });
  const image = images[index];
  const PreviousIcon = isEnglish ? ChevronLeft : ChevronRight;
  const NextIcon = isEnglish ? ChevronRight : ChevronLeft;
  return createPortal(
    <div className="studio-lightbox-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="studio-lightbox" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={captionId} dir={isEnglish ? 'ltr' : 'rtl'} tabIndex={-1}
        onKeyDown={event => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          onStep(event.key === (isEnglish ? 'ArrowRight' : 'ArrowLeft') ? 1 : -1);
        }}>
        <header className="studio-lightbox__header">
          <h2 id={titleId}>{studioName}</h2>
          <button type="button" className="studio-lightbox__close" onClick={onClose} aria-label={isEnglish ? 'Close image viewer' : 'إغلاق عارض الصور'} data-dialog-initial><X aria-hidden="true"/></button>
        </header>
        <div className="studio-lightbox__media">
          <FullStudioImage key={`${index}-${image.url}-${image.failed}`} image={image} onError={() => onImageError(index)} isEnglish={isEnglish}/>
        </div>
        <footer className="studio-lightbox__footer">
          <div className="studio-lightbox__caption" aria-live="polite"><p id={captionId}>{image.alt}</p><span className="studio-lightbox__count">{isEnglish ? `Photo ${index + 1} of ${images.length}` : `صورة ${index + 1} من ${images.length}`}</span></div>
          <nav className="studio-lightbox__navigation" aria-label={isEnglish ? 'Browse studio photos' : 'تصفح صور الاستديو'}>
            <button type="button" onClick={() => onStep(-1)} disabled={images.length < 2} aria-label={isEnglish ? 'Previous photo' : 'الصورة السابقة'}><PreviousIcon aria-hidden="true"/></button>
            <button type="button" onClick={() => onStep(1)} disabled={images.length < 2} aria-label={isEnglish ? 'Next photo' : 'الصورة التالية'}><NextIcon aria-hidden="true"/></button>
            <a href={image.url} target="_blank" rel="noopener noreferrer" aria-label={isEnglish ? 'Open original photo in a new tab' : 'فتح الصورة الأصلية في تبويب جديد'} title={isEnglish ? 'Open original photo' : 'فتح الصورة الأصلية'}><ExternalLink aria-hidden="true"/></a>
          </nav>
        </footer>
      </section>
    </div>, document.body,
  );
}

function StudioGallery({ category, items, studioName, isEnglish }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [imageStates, setImageStates] = useState({});
  const returnFocusRef = useRef(null);
  const images = items.map((img, index) => {
    const fallback = getStudioFallback(category, index);
    const source = img.url || fallback;
    const key = `${img.id || index}-${source}`;
    return {
      key, fallback, url: imageStates[key]?.url || source, failed: Boolean(imageStates[key]?.failed),
      alt: (isEnglish ? img.altEn : img.alt) || img.alt || `${studioName} - ${isEnglish ? 'image' : 'صورة'} ${index + 1}`,
    };
  });
  const handleImageError = index => {
    const image = images[index];
    setImageStates(previous => ({ ...previous, [image.key]: image.fallback && image.url !== image.fallback ? { url: image.fallback, failed: false } : { url: image.url, failed: true } }));
  };
  return <>
    <p className="studio-gallery-hint">{isEnglish ? 'Select a photo to view it in full' : 'اضغط على الصورة لعرضها كاملة'}</p>
    <div className="showcase-grid">
      {images.map((image, index) => <a key={image.key} className="showcase-item" href={image.url} aria-label={`${isEnglish ? 'View full photo' : 'عرض الصورة كاملة'}: ${image.alt}`}
        onClick={event => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); returnFocusRef.current = event.currentTarget; setSelectedIndex(index);
        }}>
        {image.failed ? <span className="studio-image-unavailable">{isEnglish ? 'Photo unavailable' : 'الصورة غير متاحة'}</span> : <img src={image.url} alt={image.alt} loading="lazy" decoding="async" onError={() => handleImageError(index)}/>}
      </a>)}
    </div>
    {selectedIndex !== null && images[selectedIndex] && <StudioLightbox images={images} index={selectedIndex} studioName={studioName} isEnglish={isEnglish} returnFocusRef={returnFocusRef} onClose={() => setSelectedIndex(null)} onStep={step => setSelectedIndex(current => (current + step + images.length) % images.length)} onImageError={handleImageError}/>}
  </>;
}

const StudioShowcase = ({ selectedCategory, onCategoryChange, sectionId = 'studio', title, description, showExploreLink = true } = {}) => {
  const { t, i18n } = useTranslation();
  const { siteData } = useData();
  const [internalTab, setActiveTab] = useState('october');
  const activeTab = selectedCategory || internalTab;
  const isEnglish = i18n.language === 'en';
  const tabs = siteData.studioCategories || STUDIO_CATEGORIES;
  const studioData = siteData.studio || {};
  const studio = tabs.find(tab => tab.id === activeTab);
  const studioName = (isEnglish ? studio?.nameEn : studio?.nameAr) || (isEnglish ? 'Multi Task Agency Studio' : 'استديو Multi Task Agency');
  return (
    <section id={sectionId} className="showcase-section">
      <div className="container">
        <h2 className="section-title">{title || <>{t('studio.title1')} <span className="text-gradient">{t('studio.title2')}</span></>}</h2>
        {description && <p className="studio-gallery-hint">{description}</p>}
        <div className="studio-tabs">
          {tabs.map(tab => <button key={tab.id} type="button" className={`studio-tab-btn ${activeTab === tab.id ? 'active' : ''}`} aria-pressed={activeTab === tab.id} onClick={() => { setActiveTab(tab.id); onCategoryChange?.(tab.id); }}>{isEnglish ? tab.nameEn : tab.nameAr}</button>)}
        </div>
        <StudioGallery key={activeTab} category={activeTab} items={studioData[activeTab] || []} studioName={studioName} isEnglish={isEnglish}/>
        {showExploreLink && <Link className="public-preview-link" to={localizePublicPath('/studios', isEnglish ? 'en' : 'ar')}>{isEnglish ? 'Explore all studio locations' : 'استكشف كل الاستديوهات'}</Link>}
      </div>
    </section>
  );
};
export default StudioShowcase;
