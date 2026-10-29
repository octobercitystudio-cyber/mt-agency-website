import { ArrowLeft, ArrowRight, MapPin, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useData } from '../store/DataContext';
import { goldHeroCopy } from '../data/goldHero';
import ServicePhotoCarousel from './ServicePhotoCarousel';
import './Hero.css';

export default function Hero() {
  const { i18n } = useTranslation();
  const { siteData } = useData();
  const isEnglish = String(i18n.language).startsWith('en');
  const copy = goldHeroCopy[isEnglish ? 'en' : 'ar'];
  const heroData = siteData.hero || {};
  const savedTitle = isEnglish ? heroData.title1En : heroData.title1;
  const hasCustomHeadline = savedTitle && !['We Craft Your Vision,', 'Content production,', 'نصنع رؤيتك،', 'تصوير وإنتاج محتوى،'].includes(savedTitle);
  const title1 = hasCustomHeadline ? savedTitle : copy.title1;
  const title2 = hasCustomHeadline ? (isEnglish ? heroData.title2En : heroData.title2) : copy.title2;
  const subtitle = hasCustomHeadline ? ((isEnglish ? heroData.subtitleEn : heroData.subtitle) || copy.subtitle) : copy.subtitle;
  const DirectionArrow = isEnglish ? ArrowRight : ArrowLeft;

  return <section id="home" className="hero-section gold-hero">
    <div className="gold-hero__decoration" aria-hidden="true"><i/><i/><i/></div>
    <div className="container gold-hero__intro">
      <h1 className="gold-hero__title">{title1}{' '}<span className="gold-hero__highlight">{title2}</span></h1>
      <p className="gold-hero__subtitle">{subtitle}</p>
      <p className="gold-hero__location"><MapPin aria-hidden="true"/>{copy.location}</p>
      <div className="gold-hero__actions">
        <a href="#contact" className="btn-primary">{copy.primary}<DirectionArrow aria-hidden="true"/></a>
        <a href="#portfolio" className="btn-secondary">{copy.secondary}<Play aria-hidden="true"/></a>
      </div>
    </div>
    <ServicePhotoCarousel isEnglish={isEnglish}/>
  </section>;
}
