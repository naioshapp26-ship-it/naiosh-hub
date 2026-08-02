/**
 * فروع نايوش هوب — منسوخة من جدول branches في NaioshERP
 * (naiosh-law لا يحتوي بيانات فروع؛ المصدر ERP)
 */
window.HubBranchesData = (() => {
  const svg = (inner) =>
    `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E${inner}%3C/svg%3E`;

  const FLAG = {
    hq: svg("%3Crect width='120' height='120' fill='%238b1e1e'/%3E%3Ctext x='60' y='70' text-anchor='middle' fill='%23fff' font-size='28' font-family='Arial'%3EHQ%3C/text%3E"),
    iq: svg("%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E%3Ccircle cx='42' cy='60' r='5' fill='%2300742f'/%3E%3Ccircle cx='60' cy='60' r='5' fill='%2300742f'/%3E%3Ccircle cx='78' cy='60' r='5' fill='%2300742f'/%3E"),
    eg: svg("%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E"),
    jo: svg("%3Crect width='120' height='40' y='0' fill='%23000000'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23007839'/%3E%3Cpolygon points='0,0 54,60 0,120' fill='%23ce1126'/%3E"),
    sa: svg("%3Crect width='120' height='120' fill='%23006c35'/%3E%3Crect x='24' y='72' width='72' height='8' rx='4' fill='%23ffffff'/%3E"),
    gb: svg("%3Crect width='120' height='120' fill='%23012169'/%3E%3Cpath d='M0,0 L120,120 M120,0 L0,120' stroke='%23fff' stroke-width='20'/%3E%3Cpath d='M0,0 L120,120 M120,0 L0,120' stroke='%23c8102e' stroke-width='10'/%3E%3Cpath d='M60,0 V120 M0,60 H120' stroke='%23fff' stroke-width='28'/%3E%3Cpath d='M60,0 V120 M0,60 H120' stroke='%23c8102e' stroke-width='14'/%3E"),
    dz: svg("%3Crect width='60' height='120' fill='%23006633'/%3E%3Crect x='60' width='60' height='120' fill='%23ffffff'/%3E%3Ccircle cx='60' cy='60' r='18' fill='%23d21034'/%3E%3Ccircle cx='66' cy='60' r='14' fill='%23ffffff'/%3E"),
    se: svg("%3Crect width='120' height='120' fill='%23006aa7'/%3E%3Crect x='36' width='20' height='120' fill='%23fecc00'/%3E%3Crect y='50' width='120' height='20' fill='%23fecc00'/%3E"),
    my: svg("%3Crect width='120' height='120' fill='%23fff'/%3E%3Crect width='120' height='10' fill='%23cc0001'/%3E%3Crect y='20' width='120' height='10' fill='%23cc0001'/%3E%3Crect y='40' width='120' height='10' fill='%23cc0001'/%3E%3Crect y='60' width='120' height='10' fill='%23cc0001'/%3E%3Crect y='80' width='120' height='10' fill='%23cc0001'/%3E%3Crect y='100' width='120' height='10' fill='%23cc0001'/%3E%3Crect width='60' height='60' fill='%230102d2'/%3E"),
    qa: svg("%3Crect width='120' height='120' fill='%238d1b3d'/%3E%3Cpath d='M0,0 L36,10 L0,20 L36,30 L0,40 L36,50 L0,60 L36,70 L0,80 L36,90 L0,100 L36,110 L0,120 Z' fill='%23ffffff'/%3E"),
    tn: svg("%3Crect width='120' height='120' fill='%23e70013'/%3E%3Ccircle cx='60' cy='60' r='28' fill='%23ffffff'/%3E%3Ccircle cx='60' cy='60' r='20' fill='%23e70013'/%3E%3Ccircle cx='68' cy='60' r='16' fill='%23ffffff'/%3E"),
    ma: svg("%3Crect width='120' height='120' fill='%23c1272d'/%3E%3Cpolygon points='60,28 66,50 90,50 70,64 78,88 60,74 42,88 50,64 30,50 54,50' fill='%23006233'/%3E"),
    ly: svg("%3Crect width='120' height='40' y='0' fill='%23e70013'/%3E%3Crect width='120' height='40' y='40' fill='%23000000'/%3E%3Crect width='120' height='40' y='80' fill='%23239600'/%3E%3Ccircle cx='60' cy='60' r='10' fill='%23ffffff'/%3E"),
    bh: svg("%3Crect width='120' height='120' fill='%23ce1126'/%3E%3Cpath d='M0,0 L40,10 L0,20 L40,30 L0,40 L40,50 L0,60 L40,70 L0,80 L40,90 L0,100 L40,110 L0,120 Z' fill='%23ffffff'/%3E"),
    ye: svg("%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E"),
    sd: svg("%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E%3Cpolygon points='0,0 50,60 0,120' fill='%23007839'/%3E"),
    ps: svg("%3Crect width='120' height='40' y='0' fill='%23000000'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23007839'/%3E%3Cpolygon points='0,0 50,60 0,120' fill='%23ce1126'/%3E"),
    tr: svg("%3Crect width='120' height='120' fill='%23e30a17'/%3E%3Ccircle cx='52' cy='60' r='22' fill='%23ffffff'/%3E%3Ccircle cx='58' cy='60' r='18' fill='%23e30a17'/%3E"),
    om: svg("%3Crect width='36' height='120' fill='%23c8102e'/%3E%3Crect x='36' width='84' height='40' fill='%23ffffff'/%3E%3Crect x='36' y='40' width='84' height='40' fill='%23c8102e'/%3E%3Crect x='36' y='80' width='84' height='40' fill='%2300843d'/%3E"),
    de: svg("%3Crect width='120' height='40' y='0' fill='%23000000'/%3E%3Crect width='120' height='40' y='40' fill='%23dd0000'/%3E%3Crect width='120' height='40' y='80' fill='%23ffce00'/%3E"),
    kw: svg("%3Crect width='120' height='40' y='0' fill='%2300773f'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23ce1126'/%3E%3Cpolygon points='0,0 44,60 0,120' fill='%23000000'/%3E"),
    sy: svg("%3Crect width='120' height='40' y='0' fill='%23ce1126'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23000000'/%3E%3Ccircle cx='45' cy='60' r='6' fill='%2300742f'/%3E%3Ccircle cx='75' cy='60' r='6' fill='%2300742f'/%3E"),
    ae: svg("%3Crect width='30' height='120' fill='%23ff0000'/%3E%3Crect x='30' width='90' height='40' fill='%23007a3d'/%3E%3Crect x='30' y='40' width='90' height='40' fill='%23ffffff'/%3E%3Crect x='30' y='80' width='90' height='40' fill='%23000000'/%3E"),
    us: svg("%3Crect width='120' height='120' fill='%23b22234'/%3E%3Crect y='10' width='120' height='10' fill='%23fff'/%3E%3Crect y='30' width='120' height='10' fill='%23fff'/%3E%3Crect y='50' width='120' height='10' fill='%23fff'/%3E%3Crect y='70' width='120' height='10' fill='%23fff'/%3E%3Crect y='90' width='120' height='10' fill='%23fff'/%3E%3Crect width='50' height='60' fill='%233c3b6e'/%3E"),
    ca: svg("%3Crect width='120' height='120' fill='%23fff'/%3E%3Crect width='30' height='120' fill='%23ff0000'/%3E%3Crect x='90' width='30' height='120' fill='%23ff0000'/%3E%3Cpolygon points='60,28 68,52 94,52 72,68 80,94 60,78 40,94 48,68 26,52 52,52' fill='%23ff0000'/%3E"),
    lb: svg("%3Crect width='120' height='40' y='0' fill='%23ed1c24'/%3E%3Crect width='120' height='40' y='40' fill='%23ffffff'/%3E%3Crect width='120' height='40' y='80' fill='%23ed1c24'/%3E%3Cpolygon points='60,44 70,72 50,72' fill='%2300a651'/%3E"),
  };

  const H = {
    std: 'من 9:00 صباحًا إلى 6:00 مساءً',
    early: 'من 8:30 صباحًا إلى 5:30 مساءً',
    late: 'من 9:00 صباحًا إلى 7:00 مساءً',
    gulf: 'من 10:00 صباحًا إلى 7:00 مساءً',
    short: 'من 8:00 صباحًا إلى 5:00 مساءً',
  };

  const T = {
    office: 'مكاتب خاصة',
    incubator: 'حاضنة أعمال',
    accelerator: 'مسرعة أعمال',
    hq: 'المقر الرئيسي',
  };

  /** نفس صفوف ERP (بدون فرع تجريبي والصف الفارغ) */
  const BRANCHES = [
    { id: 'br-hq', nameAr: 'المقر الرئيسي', nameEn: 'Head Office', code: 'HQ', type: T.hq, hours: H.std, flag: FLAG.hq, flagAlt: 'المقر الرئيسي', status: 'active', erpCode: 'BR-001' },
    { id: 'br-iq', nameAr: 'العراق', nameEn: 'Iraq', code: 'IQ', type: T.incubator, hours: H.early, flag: FLAG.iq, flagAlt: 'علم العراق', status: 'active', erpCode: 'BR-002' },
    { id: 'br-eg', nameAr: 'مصر', nameEn: 'Egypt', code: 'EG', type: T.office, hours: H.std, flag: FLAG.eg, flagAlt: 'علم مصر', status: 'active', erpCode: 'BR-003' },
    { id: 'br-jo', nameAr: 'الأردن', nameEn: 'Jordan', code: 'JO', type: T.office, hours: H.short, flag: FLAG.jo, flagAlt: 'علم الأردن', status: 'active', erpCode: 'BR-004' },
    { id: 'br-sa', nameAr: 'السعودية', nameEn: 'Saudi Arabia', code: 'SA', type: T.office, hours: H.late, flag: FLAG.sa, flagAlt: 'علم السعودية', status: 'active', erpCode: 'BR-005' },
    { id: 'br-gb', nameAr: 'إنجلترا', nameEn: 'England', code: 'GB', type: T.accelerator, hours: H.std, flag: FLAG.gb, flagAlt: 'علم إنجلترا', status: 'active', erpCode: 'BR-006' },
    { id: 'br-dz', nameAr: 'الجزائر', nameEn: 'Algeria', code: 'DZ', type: T.office, hours: H.std, flag: FLAG.dz, flagAlt: 'علم الجزائر', status: 'active', erpCode: 'BR-007' },
    { id: 'br-se', nameAr: 'السويد', nameEn: 'Sweden', code: 'SE', type: T.incubator, hours: H.std, flag: FLAG.se, flagAlt: 'علم السويد', status: 'active', erpCode: 'BR-009' },
    { id: 'br-my', nameAr: 'ماليزيا', nameEn: 'Malaysia', code: 'MY', type: T.accelerator, hours: H.std, flag: FLAG.my, flagAlt: 'علم ماليزيا', status: 'active', erpCode: 'BR-010' },
    { id: 'br-qa', nameAr: 'قطر', nameEn: 'Qatar', code: 'QA', type: T.office, hours: H.gulf, flag: FLAG.qa, flagAlt: 'علم قطر', status: 'active', erpCode: 'BR-011' },
    { id: 'br-tn', nameAr: 'تونس', nameEn: 'Tunisia', code: 'TN', type: T.office, hours: H.std, flag: FLAG.tn, flagAlt: 'علم تونس', status: 'active', erpCode: 'BR-012' },
    { id: 'br-ma', nameAr: 'المغرب', nameEn: 'Morocco', code: 'MA', type: T.incubator, hours: H.std, flag: FLAG.ma, flagAlt: 'علم المغرب', status: 'active', erpCode: 'BR-013' },
    { id: 'br-ly', nameAr: 'ليبيا', nameEn: 'Libya', code: 'LY', type: T.office, hours: H.early, flag: FLAG.ly, flagAlt: 'علم ليبيا', status: 'active', erpCode: 'BR-014' },
    { id: 'br-bh', nameAr: 'البحرين', nameEn: 'Bahrain', code: 'BH', type: T.office, hours: H.gulf, flag: FLAG.bh, flagAlt: 'علم البحرين', status: 'active', erpCode: 'BR-015' },
    { id: 'br-ye', nameAr: 'اليمن', nameEn: 'Yemen', code: 'YE', type: T.office, hours: H.std, flag: FLAG.ye, flagAlt: 'علم اليمن', status: 'active', erpCode: 'BR-016' },
    { id: 'br-sd', nameAr: 'السودان', nameEn: 'Sudan', code: 'SD', type: T.incubator, hours: H.early, flag: FLAG.sd, flagAlt: 'علم السودان', status: 'active', erpCode: 'BR-017' },
    { id: 'br-ps', nameAr: 'فلسطين', nameEn: 'Palestine', code: 'PS', type: T.office, hours: H.short, flag: FLAG.ps, flagAlt: 'علم فلسطين', status: 'active', erpCode: 'BR-018' },
    { id: 'br-tr', nameAr: 'تركيا', nameEn: 'Turkey', code: 'TR', type: T.incubator, hours: H.std, flag: FLAG.tr, flagAlt: 'علم تركيا', status: 'active', erpCode: 'BR-019' },
    { id: 'br-om', nameAr: 'عُمان', nameEn: 'Oman', code: 'OM', type: T.office, hours: H.gulf, flag: FLAG.om, flagAlt: 'علم عُمان', status: 'active', erpCode: 'BR-020' },
    { id: 'br-de', nameAr: 'ألمانيا', nameEn: 'Germany', code: 'DE', type: T.accelerator, hours: H.std, flag: FLAG.de, flagAlt: 'علم ألمانيا', status: 'active', erpCode: 'BR-021' },
    { id: 'br-kw', nameAr: 'الكويت', nameEn: 'Kuwait', code: 'KW', type: T.office, hours: H.gulf, flag: FLAG.kw, flagAlt: 'علم الكويت', status: 'active', erpCode: 'BR-022' },
    { id: 'br-sy', nameAr: 'سوريا', nameEn: 'Syria', code: 'SY', type: T.office, hours: H.std, flag: FLAG.sy, flagAlt: 'علم سوريا', status: 'active', erpCode: 'BR-023' },
    { id: 'br-ae', nameAr: 'الإمارات', nameEn: 'Emirates', code: 'AE', type: T.accelerator, hours: H.gulf, flag: FLAG.ae, flagAlt: 'علم الإمارات', status: 'active', erpCode: 'BR-024' },
    { id: 'br-us', nameAr: 'أمريكا', nameEn: 'America', code: 'US', type: T.accelerator, hours: H.std, flag: FLAG.us, flagAlt: 'علم أمريكا', status: 'active', erpCode: 'BR-025' },
    { id: 'br-ca', nameAr: 'كندا', nameEn: 'Canada', code: 'CA', type: T.incubator, hours: H.std, flag: FLAG.ca, flagAlt: 'علم كندا', status: 'active', erpCode: 'BR-026' },
    { id: 'br-lb', nameAr: 'لبنان', nameEn: 'Lebanon', code: 'LB', type: T.office, hours: H.std, flag: FLAG.lb, flagAlt: 'علم لبنان', status: 'active', erpCode: 'BR-027' },
  ];

  const TYPES = [T.hq, T.office, T.incubator, T.accelerator];

  const COUNTRIES = BRANCHES.filter((b) => b.code !== 'HQ').map((b) => ({
    code: b.code,
    nameAr: b.nameAr,
    nameEn: b.nameEn,
    branches: 1,
    status: 'active',
  }));

  return { BRANCHES, TYPES, FLAG, COUNTRIES };
})();
