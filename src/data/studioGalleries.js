export const STUDIO_CATEGORIES = [
  { id: 'october', nameAr: 'استديو أكتوبر', nameEn: 'October Studio' },
  { id: 'lebanon', nameAr: 'استديو المهندسين', nameEn: 'Mohandessin Studio' },
  { id: 'newCairo', nameAr: 'استديو القاهرة الجديدة', nameEn: 'New Cairo Studio' },
];

export const STUDIO_GALLERIES = {
  october: [
    { id: 'october-01', url: '/studios/october/october-01.jpg', alt: 'تجهيزات استديو أكتوبر للتصوير', altEn: 'October Studio filming setup' },
    { id: 'october-02', url: '/studios/october/october-02.jpg', alt: 'مساحة التصوير في استديو أكتوبر', altEn: 'October Studio shooting space' },
    { id: 'october-03', url: '/studios/october/october-03.jpg', alt: 'ديكور استديو أكتوبر', altEn: 'October Studio set design' },
    { id: 'october-04', url: '/studios/october/october-04.jpg', alt: 'إضاءة استديو أكتوبر الاحترافية', altEn: 'October Studio professional lighting' },
    { id: 'october-05', url: '/studios/october/october-05.jpg', alt: 'ركن تصوير المحتوى في استديو أكتوبر', altEn: 'October Studio content creation set' },
    { id: 'october-06', url: '/studios/october/october-06.jpg', alt: 'منطقة العمل داخل استديو أكتوبر', altEn: 'October Studio production area' },
  ],
  lebanon: [
    { id: 'mohandessin-01', url: '/studios/mohandessin/mohandessin-01.jpg', alt: 'تجهيزات استديو المهندسين للتصوير', altEn: 'Mohandessin Studio filming setup' },
    { id: 'mohandessin-02', url: '/studios/mohandessin/mohandessin-02.jpg', alt: 'مساحة التصوير في استديو المهندسين', altEn: 'Mohandessin Studio shooting space' },
    { id: 'mohandessin-03', url: '/studios/mohandessin/mohandessin-03.jpg', alt: 'ديكور استديو المهندسين', altEn: 'Mohandessin Studio set design' },
    { id: 'mohandessin-04', url: '/studios/mohandessin/mohandessin-04.jpg', alt: 'إضاءة استديو المهندسين', altEn: 'Mohandessin Studio lighting setup' },
    { id: 'mohandessin-05', url: '/studios/mohandessin/mohandessin-05.jpg', alt: 'ركن تصوير المحتوى في استديو المهندسين', altEn: 'Mohandessin Studio content creation set' },
    { id: 'mohandessin-06', url: '/studios/mohandessin/mohandessin-06.jpg', alt: 'معدات استديو المهندسين', altEn: 'Mohandessin Studio production equipment' },
    { id: 'mohandessin-07', url: '/studios/mohandessin/mohandessin-07.jpg', alt: 'منطقة التصوير داخل استديو المهندسين', altEn: 'Mohandessin Studio filming area' },
    { id: 'mohandessin-08', url: '/studios/mohandessin/mohandessin-08.jpg', alt: 'خلفية تصوير في استديو المهندسين', altEn: 'Mohandessin Studio filming backdrop' },
    { id: 'mohandessin-09', url: '/studios/mohandessin/mohandessin-09.jpg', alt: 'المساحة الداخلية لاستديو المهندسين', altEn: 'Mohandessin Studio interior' },
  ],
  newCairo: [
    { id: 'new-cairo-01', url: '/studios/new-cairo/new-cairo-01.jpg', alt: 'تجهيزات استديو القاهرة الجديدة', altEn: 'New Cairo Studio filming setup' },
    { id: 'new-cairo-02', url: '/studios/new-cairo/new-cairo-02.jpg', alt: 'مساحة التصوير في استديو القاهرة الجديدة', altEn: 'New Cairo Studio shooting space' },
    { id: 'new-cairo-03', url: '/studios/new-cairo/new-cairo-03.jpg', alt: 'ديكور استديو القاهرة الجديدة', altEn: 'New Cairo Studio set design' },
    { id: 'new-cairo-04', url: '/studios/new-cairo/new-cairo-04.jpg', alt: 'إضاءة استديو القاهرة الجديدة', altEn: 'New Cairo Studio lighting setup' },
    { id: 'new-cairo-05', url: '/studios/new-cairo/new-cairo-05.jpg', alt: 'ركن تصوير المحتوى في استديو القاهرة الجديدة', altEn: 'New Cairo Studio content creation set' },
    { id: 'new-cairo-06', url: '/studios/new-cairo/new-cairo-06.jpg', alt: 'معدات استديو القاهرة الجديدة', altEn: 'New Cairo Studio production equipment' },
    { id: 'new-cairo-07', url: '/studios/new-cairo/new-cairo-07.jpg', alt: 'منطقة التصوير في استديو القاهرة الجديدة', altEn: 'New Cairo Studio filming area' },
    { id: 'new-cairo-08', url: '/studios/new-cairo/new-cairo-08.jpg', alt: 'المساحة الداخلية لاستديو القاهرة الجديدة', altEn: 'New Cairo Studio interior' },
  ],
};

export const getStudioFallback = (categoryId, index) => {
  const gallery = STUDIO_GALLERIES[categoryId];
  if (!gallery?.length) return '';
  return gallery[index % gallery.length].url;
};
