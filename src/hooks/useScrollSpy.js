import { useState, useEffect } from 'react';

const useScrollSpy = (sectionIds) => {
  const [activeSection, setActiveSection] = useState(sectionIds[0]);

  useEffect(() => {
    const handleScroll = () => {
      let currentSection = sectionIds[0];
      
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Check if the top of the element is in the upper half of the screen
          if (rect.top <= window.innerHeight / 2 && rect.bottom >= 0) {
            currentSection = id;
          }
        }
      }
      
      setActiveSection(currentSection);
      
      // Optionally update the URL hash silently (without jumping)
      if (currentSection !== sectionIds[0]) {
        if (window.location.hash !== `#${currentSection}`) {
          window.history.replaceState(null, '', `#${currentSection}`);
        }
      } else {
        if (window.location.hash !== '') {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Trigger once on mount
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [sectionIds]);

  return activeSection;
};

export default useScrollSpy;
