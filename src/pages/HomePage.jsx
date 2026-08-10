import { Suspense, lazy } from 'react';
import Hero from '../components/Hero';
import SEO from '../components/SEO';

const About = lazy(() => import('../components/About'));
const Services = lazy(() => import('../components/Services'));
const Portfolio = lazy(() => import('../components/Portfolio'));
const StudioShowcase = lazy(() => import('../components/StudioShowcase'));
const Contact = lazy(() => import('../components/Contact'));

export default function HomePage() {
  return <main id="main-content" className="public-home-page">
    <SEO url="/" section="home" />
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
