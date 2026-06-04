import React from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import About from '../components/About';
import ExperienceCounter from '../components/ExperienceCounter';
import Services from '../components/Services';
import Portfolio from '../components/Portfolio';
import StudioShowcase from '../components/StudioShowcase';
import Contact from '../components/Contact';

const HomePage = () => {
  return (
    <main className="app-container">
      <Header />
      <Hero />
      <About />
      <ExperienceCounter />
      <Services />
      <Portfolio />
      <StudioShowcase />
      <Contact />
    </main>
  );
};

export default HomePage;
