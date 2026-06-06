import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English Translations
const resources = {
  en: {
    translation: {
      header: {
        home: "Home",
        about: "About Us",
        services: "Services",
        portfolio: "Portfolio",
        studio: "Studio",
        contact: "Contact Us",
        getQuote: "Get a Quote",
        lang: "عربي"
      },
      hero: {
        title1: "We Craft Your Vision,",
        title2: "We Drive Impact.",
        subtitle: "Behind every great content, 15 years of experience.",
        discover: "Discover Our Work",
        contact: "Start Your Project",
        fallbackLogoTitle: "MT"
      },
      about: {
        title1: "About",
        title2: "Us",
        p1: "Since 2011, <strong>MT Agency</strong> has been a pioneer in the digital content industry. We are your partners in crafting impact and success. With over 15 years of visual production experience, we specialize in transforming visions into tangible digital realities that touch audiences and achieve goals.",
        p2: "We offer a comprehensive suite of services that includes professional photography, visual production, event coverage, world-class podcast production, and innovative AI solutions, in addition to web design and comprehensive digital presence management.",
        p3: "Our mission is to be the driving force behind every great content, with a futuristic vision that keeps pace with the latest technologies and the highest quality standards.",
        stats: {
          years: "Years Experience",
          projects: "Successful Projects",
          experts: "Experts & Creators"
        }
      },
      experience: {
        title: "Years of Visual Production Experience",
        description: "Since 2011, MT Agency has been a pioneer in the digital content industry."
      },
      services: {
        title1: "Our",
        title2: "Services",
        items: [
          {
            title: "Professional Photography",
            desc: "Documenting your moments with the highest quality."
          },
          {
            title: "Event Coverage",
            desc: "Conveying the event with stunning details."
          },
          {
            title: "Podcast Production",
            desc: "Audio and visual production with global standards."
          },
          {
            title: "AI Video",
            desc: "Innovating the future with the latest technologies."
          },
          {
            title: "Creative Design",
            desc: "Transforming ideas into masterpieces."
          },
          {
            title: "Social Media Management",
            desc: "Building your digital presence and increasing your impact."
          },
          {
            title: "Web Development",
            desc: "Futuristic websites reflecting your identity."
          }
        ]
      },
      portfolio: {
        title1: "Our",
        title2: "Portfolio",
        categories: {
          all: "All",
          video: "Video",
          design: "Design",
          reels: "Reels",
          podcast: "Podcast",
          web: "Web"
        },
        items: [
          { title: "Commercial Ad", category: "video" },
          { title: "Visual Identity", category: "design" },
          { title: "Social Media Campaign", category: "reels" },
          { title: "Podcast Episode", category: "podcast" },
          { title: "Event Coverage", category: "video" },
          { title: "Website", category: "design" }
        ]
      },
      studio: {
        title1: "Professional",
        title2: "Studios",
        description: "Our studios are equipped with the latest cameras, lighting, and audio gear to ensure your content is produced at the highest professional standard.",
        features: {
          f1: "4K Cinema Cameras",
          f2: "Professional Audio Engineering",
          f3: "Chroma & Virtual Sets",
          f4: "Full Post-Production Suite"
        },
        tabs: {
          october: "October Studio",
          lebanon: "Lebanon Square Studio",
          newCairo: "New Cairo Studio"
        }
      },
      contact: {
        title1: "Contact",
        title2: "Us",
        description: "We are here to turn your ideas into reality. Let's talk about your next project.",
        addressTitle: "Address: 6th of October City, Giza, Egypt",
        phoneTitle: "Phone: 01114466646 (+20)",
        form: {
          name: "Your Name",
          email: "Email Address",
          message: "Your Message...",
          submit: "Send Message"
        }
      }
    }
  },
  // Arabic Translations
  ar: {
    translation: {
      header: {
        home: "الرئيسية",
        about: "من نحن",
        services: "خدماتنا",
        portfolio: "أعمالنا",
        studio: "استوديو",
        contact: "تواصل معنا",
        getQuote: "الحصول على عرض سعر",
        lang: "EN"
      },
      hero: {
        title1: "نصنع رؤيتك،",
        title2: "ونقود التأثير.",
        subtitle: "خلف كل محتوى عظيم، 15 عاماً من الخبرة.",
        discover: "اكتشف أعمالنا",
        contact: "ابدأ مشروعك",
        fallbackLogoTitle: "MT"
      },
      about: {
        title1: "من",
        title2: "نحن",
        p1: "منذ عام 2011، وتعتبر <strong>MT Agency</strong> رائدة في صناعة المحتوى الرقمي. نحن شركاؤك في صناعة التأثير والنجاح، وعلى مدار أكثر من 15 عاماً من الخبرة في الإنتاج المرئي، تخصصنا في تحويل الرؤى والأفكار إلى واقع رقمي ملموس يلامس الجمهور ويحقق الأهداف.",
        p2: "نقدم مجموعة متكاملة من الخدمات التي تشمل التصوير الاحترافي، الإنتاج المرئي، تغطية الفعاليات، إنتاج البودكاست بمعايير عالمية، وحلول الذكاء الاصطناعي المبتكرة، بالإضافة إلى تصميم المواقع وإدارة التواجد الرقمي بشكل شامل.",
        p3: "مهمتنا هي أن نكون القوة الدافعة خلف كل محتوى عظيم، برؤية مستقبلية تواكب أحدث التقنيات وأعلى معايير الجودة.",
        stats: {
          years: "سنوات خبرة",
          projects: "مشروع ناجح",
          experts: "خبير ومبدع"
        }
      },
      experience: {
        title: "عاماً من الخبرة في الإنتاج المرئي",
        description: "منذ عام 2011، وتعتبر MT Agency رائدة في صناعة المحتوى الرقمي."
      },
      services: {
        title1: "خدماتنا",
        title2: "المتكاملة",
        items: [
          {
            title: "التصوير الاحترافي",
            desc: "نوثق لحظاتك بأعلى جودة"
          },
          {
            title: "تغطية الفعاليات",
            desc: "ننقل الحدث بتفاصيله المبهرة"
          },
          {
            title: "البودكاست",
            desc: "إنتاج صوتي ومرئي بمقاييس عالمية"
          },
          {
            title: "فيديو الذكاء الاصطناعي",
            desc: "نبتكر المستقبل بأحدث التقنيات"
          },
          {
            title: "التصميم الإبداعي",
            desc: "نحول الأفكار إلى تحف فنية"
          },
          {
            title: "إدارة السوشيال ميديا",
            desc: "نبني تواجدك الرقمي ونزيد تأثيرك"
          },
          {
            title: "تطوير الويب",
            desc: "مواقع مستقبلية تعكس هويتك"
          }
        ]
      },
      portfolio: {
        title1: "معرض",
        title2: "الأعمال",
        categories: {
          all: "الكل",
          video: "فيديو",
          design: "تصميم",
          reels: "ريلز",
          podcast: "بودكاست",
          web: "ويب"
        },
        items: [
          { title: "إعلان تجاري", category: "video" },
          { title: "هوية بصرية", category: "design" },
          { title: "حملة سوشيال ميديا", category: "reels" },
          { title: "حلقة بودكاست", category: "podcast" },
          { title: "تغطية فعالية", category: "video" },
          { title: "موقع إلكتروني", category: "design" }
        ]
      },
      studio: {
        title1: "استوديوهات",
        title2: "احترافية",
        description: "نمتلك استوديوهات مجهزة بأحدث كاميرات التصوير، معدات الإضاءة، وهندسة الصوت لضمان خروج محتواك بأعلى جودة احترافية.",
        features: {
          f1: "كاميرات سينمائية 4K",
          f2: "هندسة صوتية احترافية",
          f3: "مساحات كروما للخدع البصرية",
          f4: "وحدة مونتاج متكاملة"
        },
        tabs: {
          october: "استديو أكتوبر",
          lebanon: "استديو ميدان لبنان",
          newCairo: "استديو القاهرة الجديدة"
        }
      },
      contact: {
        title1: "تواصل",
        title2: "معنا",
        description: "نحن هنا لتحويل أفكارك إلى واقع. دعنا نتحدث عن مشروعك القادم.",
        addressTitle: "العنوان: مدينة 6 أكتوبر، الجيزة، مصر",
        phoneTitle: "هاتف: 01114466646 (+20)",
        form: {
          name: "الاسم الكريم",
          email: "البريد الإلكتروني",
          message: "رسالتك...",
          submit: "إرسال الرسالة"
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar", // Default language is Arabic
    fallbackLng: "en",
    interpolation: {
      escapeValue: false // React already safes from xss
    }
  });

export default i18n;
