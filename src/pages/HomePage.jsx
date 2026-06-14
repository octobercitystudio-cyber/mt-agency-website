import React, { Suspense, lazy } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';

// Lazy load below-the-fold components
const About = lazy(() => import('../components/About'));
const Services = lazy(() => import('../components/Services'));
const Portfolio = lazy(() => import('../components/Portfolio'));
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const Contact = lazy(() => import('../components/Contact'));
const Footer = lazy(() => import('../components/Footer'));
const OfferPopup = lazy(() => import('../components/OfferPopup'));

const HomePage = () => {
  return (
    <main className="app-container">
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
