import { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { STUDIO_CATEGORIES, STUDIO_GALLERIES } from '../data/studioGalleries';
import { VERIFIED_PORTFOLIO, VERIFIED_PORTFOLIO_CATEGORIES, withVerifiedPortfolioServiceLinks } from '../data/verifiedPortfolio';
import './DataContext.css';
import { unregisterPushNotifications } from '../lib/pushNotifications';

const OFFICIAL_CONTACT_EMAIL = 'info@multitaskagency.com';
const LOCAL_PREVIEW_SESSION_KEY = 'mt_agency_local_preview_session';
const staffRoles = ['owner', 'admin', 'operations', 'finance', 'staff'];
let dataClientPromise;
let demoClientPromise;
let publicDataClientPromise;
const getDataClient = () => {
  if (!dataClientPromise) dataClientPromise = import('../dataClient').then((module) => module.dataClient);
  return dataClientPromise;
};
const getDemoClient = () => {
  if (!demoClientPromise) demoClientPromise = import('../lib/demoDataClient');
  return demoClientPromise;
};
const getPublicDataClient = () => {
  if (!publicDataClientPromise) {
    publicDataClientPromise = import('../lib/hostingerClient').then(module => module.hostingerClient);
  }
  return publicDataClientPromise;
};

const isPublicSurface = () => !/^\/(?:login|change-password|reset-password|dashboard|erp(?:\/|$)|adminmt(?:\/|$))/.test(window.location.pathname);

const restoreLocalPreviewSession = () => {
  if (!import.meta.env.DEV) return null;
  try {
    const user = JSON.parse(sessionStorage.getItem(LOCAL_PREVIEW_SESSION_KEY) || 'null');
    if (!user?.is_local_preview || !user?.role) return null;
    return user;
  } catch {
    sessionStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
    return null;
  }
};

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
  portfolioCategories: VERIFIED_PORTFOLIO_CATEGORIES,
  // Keep verified company work visible if the remote configuration is missing.
  // Generic stock-image placeholders are deliberately excluded.
  portfolio: VERIFIED_PORTFOLIO,
  contact: {
    address: "مدينة 6 أكتوبر، الجيزة، مصر",
    addressEn: "6th of October City, Giza, Egypt",
    phone: "01114466646",
    phone2: "+201094084424",
    email: OFFICIAL_CONTACT_EMAIL,
    facebook: "#",
    instagram: "#",
    youtube: "#"
  },
  studioCategories: [
    { id: 'october', nameAr: 'استديو أكتوبر', nameEn: 'October Studio' },
    { id: 'lebanon', nameAr: 'استديو ميدان لبنان', nameEn: 'Lebanon Square Studio' },
    { id: 'newCairo', nameAr: 'استديو القاهرة الجديدة', nameEn: 'New Cairo Studio' }
  ],
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
  },
  offers: [
    { id: 1, title: 'خصم 20% على باقة 50 ساعة', discount: '20%', desc: 'احجز الآن واستفد من الخصم لفترة محدودة على باقة الـ 50 ساعة التصوير.', is_active: true }
  ],
  seo: {
    global: {
      siteName: "MT Agency",
      siteNameEn: "MT Agency",
      defaultImage: ""
    },
    home: {
      titleAr: "إم تي إيجنسي | نصنع التأثير",
      titleEn: "MT Agency | We Drive Impact",
      descAr: "إم تي إيجنسي متخصصة في الإنتاج الإعلامي، التسويق الرقمي، وصناعة محتوى مرئي يخطف الأنظار.",
      descEn: "MT Agency specializes in media production, digital marketing, and creating eye-catching visual content.",
      keywordsAr: "إنتاج إعلامي, تسويق رقمي, تصوير فيديو, مونتاج, بودكاست",
      keywordsEn: "media production, digital marketing, video shooting, editing, podcast",
    },
    about: { titleAr: "", titleEn: "", descAr: "", descEn: "", keywordsAr: "", keywordsEn: "" },
    services: { titleAr: "", titleEn: "", descAr: "", descEn: "", keywordsAr: "", keywordsEn: "" },
    portfolio: { titleAr: "", titleEn: "", descAr: "", descEn: "", keywordsAr: "", keywordsEn: "" },
    studio: { titleAr: "", titleEn: "", descAr: "", descEn: "", keywordsAr: "", keywordsEn: "" }
  }
};

// Keep the original company galleries available even before remote settings load.
defaultData.studioCategories = STUDIO_CATEGORIES;
defaultData.studio = STUDIO_GALLERIES;

const withOfficialContactEmail = (data) => ({
  ...data,
  portfolio: withVerifiedPortfolioServiceLinks(data?.portfolio || VERIFIED_PORTFOLIO),
  studioCategories: data?.studioCategories || STUDIO_CATEGORIES,
  studio: {
    ...STUDIO_GALLERIES,
    ...(data?.studio || {}),
  },
  contact: {
    ...(data?.contact || {}),
    email: OFFICIAL_CONTACT_EMAIL,
  },
  formSettings: {
    ...(data?.formSettings || {}),
    receivingEmail: OFFICIAL_CONTACT_EMAIL,
  },
});

const readCachedSiteData = () => {
  try {
    const cached = localStorage.getItem('mt_agency_data_v5');
    return withOfficialContactEmail(cached ? JSON.parse(cached) : defaultData);
  } catch {
    // A partially written legacy cache must never prevent the login screen
    // or the public website from rendering.
    localStorage.removeItem('mt_agency_data_v5');
    return withOfficialContactEmail(defaultData);
  }
};

const DataContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const [restoredPreview] = useState(restoreLocalPreviewSession);
  const [siteData, setSiteData] = useState(readCachedSiteData);
  const [isAdminAuth, setIsAdminAuth] = useState(restoredPreview?.role === 'owner' || restoredPreview?.role === 'admin');
  const [isErpAuth, setIsErpAuth] = useState(staffRoles.includes(restoredPreview?.role));
  const [isClientAuth, setIsClientAuth] = useState(restoredPreview?.role === 'client');
  const [currentUser, setCurrentUser] = useState(restoredPreview);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(Boolean(restoredPreview));
  const authRevisionRef = useRef(0);

  const applySession = useCallback((session) => {
    const user = session?.user || null;
    const role = user?.role;
    if (import.meta.env.DEV && user?.is_local_preview) sessionStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
    setIsClientAuth(role === 'client');
    setIsErpAuth(staffRoles.includes(role));
    setIsAdminAuth(role === 'owner' || role === 'admin');
  }, []);

  useEffect(() => {
    const loadData = async (dataClient) => {
      try {
        const client = dataClient || await getDataClient();
        const { data, error } = await client
          .from('app_config')
          .select('value')
          .eq('key', 'website_data')
          .maybeSingle();
          
        if (error) {
          console.error("Error loading site data:", error);
          setSiteData(defaultData);
        } else if (data && data.value) {
          let parsedData = data.value;
          if (typeof parsedData === 'string') {
            parsedData = JSON.parse(parsedData);
          }
          
          // 🚀 On-the-fly Image Optimization (Force WebP)
          if (parsedData.portfolio) {
            parsedData.portfolio.forEach(item => {
              if (item.imageUrl) {
                if (item.imageUrl.includes('unsplash.com') && !item.imageUrl.includes('fm=webp')) item.imageUrl += '&fm=webp';
                if (item.imageUrl === '/qpshoes.png') item.imageUrl = '/qpshoes_mockup.webp';
              }
            });
          }
          if (parsedData.studio) {
            Object.keys(parsedData.studio).forEach(cat => {
              parsedData.studio[cat].forEach(item => {
                if (item.url && item.url.includes('unsplash.com') && !item.url.includes('fm=webp')) item.url += '&fm=webp';
              });
            });
          }
          
          setSiteData(withOfficialContactEmail({ ...defaultData, ...parsedData }));
        } else {
          setSiteData(defaultData);
        }
      } catch (err) {
        console.error("Unexpected error loading data:", err);
        setSiteData(defaultData);
      } finally {
        setIsDataLoaded(true);
      }
    };
    
    let subscription;
    let disposed = false;

    const initializeAuthentication = async (authClient) => {
      const dataClient = authClient || await getDataClient();
      if (disposed) return;

      // Authentication is decided by the server role, never by localStorage.
      if (!restoredPreview) {
        const restoreRevision = authRevisionRef.current;
        dataClient.auth.getSession()
          .then(({ data: { session } }) => {
            // A login may finish while this initial request is still in flight.
            // Never let that older response clear the newly authenticated user.
            if (authRevisionRef.current === restoreRevision) {
              applySession(session);
            }
          })
          .finally(() => setIsAuthReady(true));
      }

      const authListener = dataClient.auth.onAuthStateChange((_event, session) => {
        applySession(session);
        setIsAuthReady(true);
      });
      subscription = authListener.data.subscription;
    };

    const initializeRemoteState = async () => {
      if (import.meta.env.DEV && restoredPreview) {
        const demoClient = await getDemoClient();
        const isCurrent = !restoredPreview.credential_managed || demoClient.isDemoCredentialSessionCurrent(restoredPreview);
        if (!isCurrent) {
          sessionStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
          applySession(null);
        } else if (restoredPreview.credential_managed) {
          demoClient.resumeDemoCredentialSession(restoredPreview);
        } else {
          demoClient.activateDemoMode(restoredPreview.role);
        }
      }
      await loadData();
      await initializeAuthentication();
    };

    if (isPublicSurface()) {
      // Fetch public website content through the lightweight Hostinger client.
      // It also exposes the small session API, so public pages never download
      // the ERP/demo data layer simply to decide which header link to show.
      getPublicDataClient().then(async publicClient => {
        await loadData(publicClient);
        await initializeAuthentication(publicClient);
      });
    } else {
      initializeRemoteState();
    }

    return () => {
      disposed = true;
      subscription?.unsubscribe();
    };
  }, [applySession, restoredPreview]);

  useEffect(() => {
    localStorage.setItem('mt_agency_data_v5', JSON.stringify(siteData));
  }, [siteData]);

  useEffect(() => {
    if (!import.meta.env.DEV || !currentUser?.credential_managed) return undefined;
    const validateCredentialSession = async () => {
      const demoClient = await getDemoClient();
      if (demoClient.isDemoCredentialSessionCurrent(currentUser)) return;
      sessionStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
      demoClient.deactivateDemoMode();
      applySession(null);
    };
    window.addEventListener('storage', validateCredentialSession);
    return () => window.removeEventListener('storage', validateCredentialSession);
  }, [applySession, currentUser]);

  const updateSection = async (sectionName, newData) => {
    const newSiteData = { ...siteData, [sectionName]: newData };
    setSiteData(newSiteData);
    
    try {
      const dataClient = await getDataClient();
      const { data, error: fetchErr } = await dataClient.from('app_config').select('key').eq('key', 'website_data').maybeSingle();
      if (fetchErr) {
        alert("خطأ في الاتصال بقاعدة البيانات: " + fetchErr.message);
        return false;
      }
      
      if (data) {
        const { error } = await dataClient.from('app_config').update({ value: JSON.stringify(newSiteData) }).eq('key', 'website_data');
        if (error) {
          alert("فشل الحفظ في قاعدة البيانات: " + error.message);
          return false;
        }
      } else {
        const { error } = await dataClient.from('app_config').insert([{ key: 'website_data', value: JSON.stringify(newSiteData) }]);
        if (error) {
          alert("فشل الحفظ في قاعدة البيانات: " + error.message);
          return false;
        }
      }
      return true;
    } catch (err) {
      alert("حدث خطأ غير متوقع: " + err.message);
      console.error("Error saving site data to Supabase:", err);
      return false;
    }
  };

  const updateMultipleSections = async (updates) => {
    const newSiteData = { ...siteData, ...updates };
    setSiteData(newSiteData);
    
    try {
      const dataClient = await getDataClient();
      const { data, error: fetchErr } = await dataClient.from('app_config').select('key').eq('key', 'website_data').maybeSingle();
      if (fetchErr) {
        alert("خطأ في الاتصال بقاعدة البيانات: " + fetchErr.message);
        return false;
      }
      
      if (data) {
        const { error } = await dataClient.from('app_config').update({ value: JSON.stringify(newSiteData) }).eq('key', 'website_data');
        if (error) {
          alert("فشل الحفظ في قاعدة البيانات: " + error.message);
          return false;
        }
      } else {
        const { error } = await dataClient.from('app_config').insert([{ key: 'website_data', value: JSON.stringify(newSiteData) }]);
        if (error) {
          alert("فشل الحفظ في قاعدة البيانات: " + error.message);
          return false;
        }
      }
      return true;
    } catch (err) {
      alert("حدث خطأ غير متوقع: " + err.message);
      console.error("Error saving site data to Supabase:", err);
      return false;
    }
  };

  const login = async (username, password) => {
    authRevisionRef.current += 1;
    const dataClient = await getDataClient();
    const { data, error } = await dataClient.auth.signInWithPassword({
      email: username,
      password: password
    });
    if (error) {
      throw error;
    }
    applySession(data.session);
    return data.user || true;
  };

  const logout = async () => {
    if (import.meta.env.DEV && currentUser?.is_local_preview) {
      authRevisionRef.current += 1;
      const demoClient = await getDemoClient();
      demoClient.deactivateDemoMode();
      sessionStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
      applySession(null);
      return;
    }
    authRevisionRef.current += 1;
    const dataClient = await getDataClient();
    await unregisterPushNotifications(dataClient).catch(() => undefined);
    await dataClient.auth.signOut();
  };

  const loginErp = async (username, password) => {
    authRevisionRef.current += 1;
    if (import.meta.env.DEV && username === 'local-owner' && password === 'local-preview') {
      const demoClient = await getDemoClient();
      demoClient.activateDemoMode('owner');
      const localOwner = {
        id: 'local-owner',
        full_name: 'مالك النظام (معاينة محلية)',
        email: 'owner@local.test',
        phone: '',
        role: 'owner',
        permissions: ['*'],
        is_local_preview: true,
      };
      sessionStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, JSON.stringify(localOwner));
      applySession({ user: localOwner });
      return localOwner;
    }

    if (import.meta.env.DEV && username === 'local-client' && password === 'local-preview') {
      const demoClient = await getDemoClient();
      demoClient.activateDemoMode('client');
      const localClient = {
        id: 'local-client',
        client_id: 'local-client-preview',
        full_name: 'سارة أحمد (معاينة محلية)',
        email: 'client@local.test',
        phone: '01000000000',
        role: 'client',
        permissions: ['client_portal'],
        is_local_preview: true,
      };
      sessionStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, JSON.stringify(localClient));
      applySession({ user: localClient });
      return localClient;
    }

    if (import.meta.env.DEV) {
      const demoClient = await getDemoClient();
      const temporaryClient = await demoClient.authenticateDemoClientCredential(username, password);
      if (temporaryClient) {
        sessionStorage.setItem(LOCAL_PREVIEW_SESSION_KEY, JSON.stringify(temporaryClient));
        applySession({ user: temporaryClient });
        return temporaryClient;
      }
    }

    const dataClient = await getDataClient();
    const { data, error } = await dataClient.auth.signInWithPassword({
      email: username,
      identifier: username,
      password: password
    });
    if (error) {
      throw error;
    }
    applySession(data.session);
    return data.user || true;
  };

  const logoutErp = async () => {
    if (import.meta.env.DEV && currentUser?.is_local_preview) {
      authRevisionRef.current += 1;
      const demoClient = await getDemoClient();
      demoClient.deactivateDemoMode();
      sessionStorage.removeItem(LOCAL_PREVIEW_SESSION_KEY);
      applySession(null);
      return;
    }
    authRevisionRef.current += 1;
    const dataClient = await getDataClient();
    await unregisterPushNotifications(dataClient).catch(() => undefined);
    await dataClient.auth.signOut();
  };

  if ((!isDataLoaded || !isAuthReady) && !isPublicSurface()) {
    return (
      <div
        className="data-loading"
        role="status"
        aria-live="polite"
        aria-label="جاري تحميل البيانات"
      >
        <img
          className="data-loading__logo"
          src="/logo.webp"
          alt=""
          aria-hidden="true"
        />
        <span className="data-loading__status-copy">جاري تحميل البيانات...</span>
      </div>
    );
  }

  return (
    <DataContext.Provider value={{ 
      siteData, 
      updateSection,
      updateMultipleSections,
      isAdminAuth, 
      isClientAuth,
      isAuthReady,
      currentUser,
      login, 
      logout,
      isErpAuth,
      loginErp,
      logoutErp
    }}>
      {children}
    </DataContext.Provider>
  );
};
