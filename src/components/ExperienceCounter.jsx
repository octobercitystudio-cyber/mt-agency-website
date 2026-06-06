import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './ExperienceCounter.css';

const ExperienceCounter = () => {
  const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
        }
      },
      { threshold: 0.5 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  useEffect(() => {
    if (hasAnimated) {
      let start = 0;
      const end = 15;
      const duration = 2000;
      const incrementTime = duration / end;

      const timer = setInterval(() => {
        start += 1;
        setCount(start);
        if (start === end) clearInterval(timer);
      }, incrementTime);

      return () => clearInterval(timer);
    }
  }, [hasAnimated]);

  return (
    <section className="counter-section" ref={counterRef}>
      <div className="container counter-wrapper">
        <div className="counter-number">
          {count}<span>+</span>
        </div>
        <div className="counter-text">
          <h2>{t('experience.title')}</h2>
          <p dir="auto">{t('experience.description')}</p>
        </div>
      </div>
    </section>
  );
};

export default ExperienceCounter;
