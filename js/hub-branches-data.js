/**
 * فروع نايوش هوب — نفس بيانات صفحة فروع ERP (newhome/branches)
 */
window.HubBranchesData = (() => {
  const FLAG = {
    eg: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E%3C/svg%3E",
    iq: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E%3Ccircle cx='42' cy='60' r='5' fill='%2300742f'/%3E%3Ccircle cx='60' cy='60' r='5' fill='%2300742f'/%3E%3Ccircle cx='78' cy='60' r='5' fill='%2300742f'/%3E%3C/svg%3E",
    sa: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23006c35'/%3E%3Crect x='24' y='72' width='72' height='8' rx='4' fill='%23ffffff'/%3E%3C/svg%3E",
    ae: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='30' height='120' fill='%23ff0000'/%3E%3Crect x='30' width='90' height='40' fill='%23007a3d'/%3E%3Crect x='30' y='40' width='90' height='40' fill='%23ffffff'/%3E%3Crect x='30' y='80' width='90' height='40' fill='%23000000'/%3E%3C/svg%3E",
    tr: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' fill='%23e30a17'/%3E%3Ccircle cx='52' cy='60' r='22' fill='%23ffffff'/%3E%3Ccircle cx='58' cy='60' r='18' fill='%23e30a17'/%3E%3C/svg%3E",
    jo: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='40' y='0' fill='%23000000'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23007839'/%3E%3Cpolygon points='0,0 54,60 0,120' fill='%23ce1126'/%3E%3C/svg%3E",
  };

  const BRANCHES = [
    {
      id: 'br-eg',
      nameAr: 'مصر',
      nameEn: 'Egypt',
      code: 'EG',
      type: 'مكاتب خاصة',
      hours: 'من 9:00 صباحًا إلى 6:00 مساءً',
      flag: FLAG.eg,
      flagAlt: 'علم مصر',
      status: 'active',
    },
    {
      id: 'br-iq',
      nameAr: 'العراق',
      nameEn: 'Iraq',
      code: 'IQ',
      type: 'حاضنة أعمال',
      hours: 'من 8:30 صباحًا إلى 5:30 مساءً',
      flag: FLAG.iq,
      flagAlt: 'علم العراق',
      status: 'active',
    },
    {
      id: 'br-sa',
      nameAr: 'السعودية',
      nameEn: 'Saudi Arabia',
      code: 'SA',
      type: 'مكاتب خاصة',
      hours: 'من 9:00 صباحًا إلى 7:00 مساءً',
      flag: FLAG.sa,
      flagAlt: 'علم السعودية',
      status: 'active',
    },
    {
      id: 'br-ae',
      nameAr: 'الإمارات',
      nameEn: 'UAE',
      code: 'AE',
      type: 'مسرعة أعمال',
      hours: 'من 10:00 صباحًا إلى 7:00 مساءً',
      flag: FLAG.ae,
      flagAlt: 'علم الإمارات',
      status: 'active',
    },
    {
      id: 'br-tr',
      nameAr: 'تركيا',
      nameEn: 'Turkey',
      code: 'TR',
      type: 'حاضنة أعمال',
      hours: 'من 9:00 صباحًا إلى 6:00 مساءً',
      flag: FLAG.tr,
      flagAlt: 'علم تركيا',
      status: 'active',
    },
    {
      id: 'br-jo',
      nameAr: 'الأردن',
      nameEn: 'Jordan',
      code: 'JO',
      type: 'مكاتب خاصة',
      hours: 'من 8:00 صباحًا إلى 5:00 مساءً',
      flag: FLAG.jo,
      flagAlt: 'علم الأردن',
      status: 'active',
    },
  ];

  const TYPES = ['مكاتب خاصة', 'حاضنة أعمال', 'مسرعة أعمال'];

  return { BRANCHES, TYPES, FLAG };
})();
