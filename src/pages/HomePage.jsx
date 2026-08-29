import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import Hero from '../components/Hero';
import SEO from '../components/SEO';

const About = lazy(() => import('../components/About'));
const Services = lazy(() => import('../components/Services'));
const Portfolio = lazy(() => import('../components/Portfolio'));
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const Contact = lazy(() => import('../components/Contact'));

export default function HomePage() {
  const { i18n } = useTranslation();
  const isEnglish = String(i18n.language).startsWith('en');
  return <main id="main-content" className="public-home-page">
    <SEO
      title={isEnglish ? 'Media Production, Digital Marketing & Technology in Giza' : 'إنتاج إعلامي وتسويق رقمي وتقنية في 6 أكتوبر'}
      description={isEnglish ? 'Multi Task Agency provides media production, content, digital marketing, web and software services from 6th of October City, Giza.' : 'Multi Task Agency تقدم خدمات الإنتاج الإعلامي وصناعة المحتوى والتسويق الرقمي وتصميم المواقع والبرمجيات من مدينة 6 أكتوبر، الجيزة.'}
      url="/"
      section="home"
    />
    <Hero />
    <Suspense fallback={<div style={{ minHeight: '200vh' }} aria-hidden="true" />}>
      <About />
      <Services />
      <Portfolio />
      <StudioShowcase />
      <Contact />
    </Suspense>
  </main>;
}
