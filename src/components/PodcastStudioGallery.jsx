import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StudioGallery } from './StudioShowcase';
import { podcastStudioGalleryCopy, podcastStudioPhotos } from '../data/podcastStudioGallery';
import { localizePublicPath } from '../lib/publicRoutes';

export default function PodcastStudioGallery({ sectionId = 'podcast-studios', showExploreLink = false }) {
  const { i18n } = useTranslation();
  const isEnglish = String(i18n.language).startsWith('en');
  const locale = isEnglish ? 'en' : 'ar';
  const copy = podcastStudioGalleryCopy[locale];
  return <section id={sectionId} className="showcase-section"><div className="container">
    <h2 className="section-title">{copy.title}</h2>
    <p className="studio-gallery-hint">{copy.intro}</p>
    <StudioGallery items={podcastStudioPhotos} studioName={copy.title} isEnglish={isEnglish}/>
    {showExploreLink && <Link className="public-preview-link" to={localizePublicPath('/services/podcast-production', locale)}>{isEnglish ? 'Explore podcast filming and booking' : 'استكشف تصوير البودكاست وتفاصيل الحجز'}</Link>}
  </div></section>;
}
