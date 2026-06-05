import React, { createContext, useState, useEffect, useContext } from 'react';

// Default data (matches current static state)
const defaultData = {
  hero: {
    title1: "نصنع رؤيتك،", title1En: "We Craft Your Vision,",
    title2: "ونقود التأثير.", title2En: "We Drive Impact.",
    subtitle: "خلف كل محتوى عظيم، 15 عاماً من الخبرة.", subtitleEn: "Behind every great content, 15 years of experience."
  },
  about: {
    yearsOfExperience: "15",
    successfulProjects: "+500",
    expertsCount: "40",
    p1: "في MT Agency، نحن أكثر من مجرد وكالة رقمية؛ نحن شركاؤك في صناعة التأثير والنجاح. على مدار أكثر من 15 عاماً من الخبرة، تخصصنا في تحويل الرؤى والأفكار إلى واقع رقمي ملموس يلامس الجمهور ويحقق الأهداف.",
    p1En: "At MT Agency, we are more than just a digital agency; we are your partners in crafting impact and success. With over 15 years of experience, we specialize in transforming visions and ideas into tangible digital realities that touch audiences and achieve goals."
  },
  services: [
    { title: "التصوير الاحترافي", titleEn: "Professional Photography", desc: "نوثق لحظاتك بأعلى جودة", descEn: "Documenting your moments with the highest quality.", icon: "📸" },
    { title: "تغطية الفعاليات", titleEn: "Event Coverage", desc: "ننقل الحدث بتفاصيله المبهرة", descEn: "Conveying the event with stunning details.", icon: "🎪" },
    { title: "البودكاست", titleEn: "Podcast Production", desc: "إنتاج صوتي ومرئي بمقاييس عالمية", descEn: "Audio and visual production with global standards.", icon: "🎙️" },
    { title: "فيديو الذكاء الاصطناعي", titleEn: "AI Video", desc: "نبتكر المستقبل بأحدث التقنيات", descEn: "Innovating the future with the latest technologies.", icon: "🤖" },
    { title: "التصميم الإبداعي", titleEn: "Creative Design", desc: "نحول الأفكار إلى تحف فنية", descEn: "Transforming ideas into masterpieces.", icon: "🎨" },
    { title: "إدارة السوشيال ميديا", titleEn: "Social Media Management", desc: "نبني تواجدك الرقمي ونزيد تأثيرك", descEn: "Building your digital presence and increasing your impact.", icon: "📱" },
    { title: "تطوير الويب", titleEn: "Web Development", desc: "مواقع مستقبلية تعكس هويتك", descEn: "Futuristic websites reflecting your identity.", icon: "💻" }
  ],
  portfolio: [
    { id: 1, embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', title: 'إعلان تجاري', titleEn: 'Commercial Ad', category: 'video' },
    { id: 2, imageUrl: 'https://images.unsplash.com/photo-1600132806370-bf17e65e942f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', title: 'هوية بصرية', titleEn: 'Visual Identity', category: 'design' },
    { id: 3, embedUrl: 'https://www.youtube.com/embed/jNQXAC9IVRw', title: 'حملة سوشيال ميديا', titleEn: 'Social Media Campaign', category: 'reels' },
    { id: 4, imageUrl: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', title: 'حلقة بودكاست', titleEn: 'Podcast Episode', category: 'podcast' },
    { id: 5, embedUrl: 'https://www.youtube.com/embed/9bZkp7q19f0', title: 'تغطية فعالية', titleEn: 'Event Coverage', category: 'video' },
    { id: 6, imageUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', title: 'موقع إلكتروني', titleEn: 'Website', category: 'design' }
  ],
  contact: {
    address: "مدينة 6 أكتوبر، الجيزة، مصر",
    addressEn: "6th of October City, Giza, Egypt",
    phone: "01114466646",
    phone2: "+201094084424",
    email: "info@mt-agency.com",
    facebook: "#",
    instagram: "#",
    youtube: "#"
  },
  studio: {
    october: [
      { id: 1, url: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'October Studio setup' },
      { id: 2, url: 'https://images.unsplash.com/photo-1516280440502-a2283be36f86?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Camera gear' },
      { id: 3, url: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Audio equipment' },
      { id: 4, url: 'https://images.unsplash.com/photo-1533280842240-547df9d94269?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Lighting' }
    ],
    lebanon: [
      { id: 5, url: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Lebanon Studio mic' },
      { id: 6, url: 'https://images.unsplash.com/photo-1559535332-db9971090158?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Camera lens' },
      { id: 7, url: 'https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Editing suite' },
      { id: 8, url: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Podcast setup' }
    ],
    newCairo: [
      { id: 9, url: 'https://images.unsplash.com/photo-1520697830682-8b43bd5e0ff1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'New Cairo lighting' },
      { id: 10, url: 'https://images.unsplash.com/photo-1527380992061-b126c88cbb41?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Green screen' },
      { id: 11, url: 'https://images.unsplash.com/photo-1493225457124-a312e947f9c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Dark studio' },
      { id: 12, url: 'https://images.unsplash.com/photo-1530635439971-b65fa367c330?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', alt: 'Audio mixing' }
    ]
  }
};

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [siteData, setSiteData] = useState(() => {
    const saved = localStorage.getItem('mt_agency_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...defaultData, ...parsed };
      } catch (e) {
        return defaultData;
      }
    }
    return defaultData;
  });

  const [isAdminAuth, setIsAdminAuth] = useState(() => {
    return localStorage.getItem('mt_admin_auth') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('mt_agency_data', JSON.stringify(siteData));
  }, [siteData]);

  const updateSection = (sectionName, newData) => {
    setSiteData(prev => ({ ...prev, [sectionName]: newData }));
  };

  const login = (username, password) => {
    // Simple mock auth for demonstration
    if (username === 'admin' && password === 'admin123') {
      setIsAdminAuth(true);
      localStorage.setItem('mt_admin_auth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdminAuth(false);
    localStorage.removeItem('mt_admin_auth');
  };

  return (
    <DataContext.Provider value={{ 
      siteData, 
      updateSection, 
      isAdminAuth, 
      login, 
      logout 
    }}>
      {children}
    </DataContext.Provider>
  );
};
