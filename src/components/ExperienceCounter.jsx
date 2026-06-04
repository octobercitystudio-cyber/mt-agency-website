import React, { useState, useEffect, useRef } from 'react';
import './ExperienceCounter.css';

const ExperienceCounter = () => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAnimated) {
          let start = 0;
          const end = 15;
          const duration = 2000;
          const increment = end / (duration / 16);
          
          const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
              setCount(end);
              setHasAnimated(true);
              clearInterval(timer);
            } else {
              setCount(Math.ceil(start));
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => {
      if (counterRef.current) {
        observer.unobserve(counterRef.current);
      }
    };
  }, [hasAnimated]);

  return (
    <section className="counter-section" ref={counterRef}>
      <div className="container">
        <div className="counter-wrapper glass-panel">
          <div className="counter-number">
            +<span className="number">{count}</span>
          </div>
          <div className="counter-text">
            عاماً من الريادة الرقمية
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExperienceCounter;
