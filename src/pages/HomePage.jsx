import React, { Suspense, lazy } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import useScrollSpy from '../hooks/useScrollSpy';
import SEO from '../components/SEO';

// Lazy load below-the-fold components
const About = lazy(() => import('../components/About'));
const Services = lazy(() => import('../components/Services'));
const Portfolio = lazy(() => import('../components/Portfolio'));
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const Contact = lazy(() => import('../components/Contact'));
const Footer = lazy(() => import('../components/Footer'));
const OfferPopup = lazy(() => import('../components/OfferPopup'));

const sectionData = {
  home: { title: null, desc: null },
  about: { title: 'من نحن', desc: 'اكتشف خبرتنا الممتدة لـ 15 عاماً في الإنتاج الإعلامي والتسويق الرقمي وبناء العلامات التجارية.' },
  services: { title: 'خدماتنا', desc: 'نقدم خدمات التصوير الاحترافي، إنتاج الفيديو والبودكاست، إدارة السوشيال ميديا، والتصميم الإبداعي.' },
  portfolio: { title: 'معرض الأعمال', desc: 'شاهد سابقة أعمالنا في الإنتاج المرئي، تصميم الهويات البصرية، وحملات التسويق الرقمي.' },
  studio: { title: 'الاستوديو', desc: 'استوديوهاتنا المجهزة بأحدث التقنيات في أكتوبر، القاهرة الجديدة، وميدان لبنان لتنفيذ رؤيتك الإبداعية.' },
  contact: { title: 'تواصل معنا', desc: 'ابدأ مشروعك القادم مع فريق MT Agency. تواصل معنا الآن لتحويل أفكارك إلى واقع.' }
};

const HomePage = () => {
  const sections = ['home', 'about', 'services', 'portfolio', 'studio', 'contact'];
  const activeSection = useScrollSpy(sections);
  const currentSeo = sectionData[activeSection] || sectionData.home;

  return (
    <main className="app-container">
      <SEO 
        title={currentSeo.title} 
        description={currentSeo.desc} 
        url={activeSection !== 'home' ? `/#${activeSection}` : ''}
      />
      <Header />
      <Hero />
      <Suspense fallback={<div style={{ minHeight: '100px' }}></div>}>
        <About />
        <Services />
        <Portfolio />
        <StudioShowcase />
        <Contact />
        <Footer />
        <OfferPopup />
      </Suspense>
    </main>
  );
};

export default HomePage;
