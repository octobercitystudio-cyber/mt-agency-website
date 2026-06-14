import React from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import Services from '../components/Services';
import Portfolio from '../components/Portfolio';
import StudioShowcase from '../components/StudioShowcase';
import Contact from '../components/Contact';
import Footer from '../components/Footer';
import OfferPopup from '../components/OfferPopup';

const HomePage = () => {
  return (
    <main className="app-container">
      <Header />
      <Hero />
      <About />
      <Services />
      <Portfolio />
      <StudioShowcase />
      <Contact />
      <Footer />
      <OfferPopup />
    </main>
  );
};

export default HomePage;
