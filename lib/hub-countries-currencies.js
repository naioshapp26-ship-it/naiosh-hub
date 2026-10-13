/**
 * ISO countries + currencies for package FX display (searchable).
 * Mapping is for display suggestion only — not a payment acceptance list.
 */
'use strict';

/** @type {{ code: string, nameAr: string, nameEn: string, currency: string }[]} */
const COUNTRIES = [
  { code: 'SA', nameAr: 'السعودية', nameEn: 'Saudi Arabia', currency: 'SAR' },
  { code: 'AE', nameAr: 'الإمارات', nameEn: 'United Arab Emirates', currency: 'AED' },
  { code: 'EG', nameAr: 'مصر', nameEn: 'Egypt', currency: 'EGP' },
  { code: 'JO', nameAr: 'الأردن', nameEn: 'Jordan', currency: 'JOD' },
  { code: 'KW', nameAr: 'الكويت', nameEn: 'Kuwait', currency: 'KWD' },
  { code: 'BH', nameAr: 'البحرين', nameEn: 'Bahrain', currency: 'BHD' },
  { code: 'QA', nameAr: 'قطر', nameEn: 'Qatar', currency: 'QAR' },
  { code: 'OM', nameAr: 'عُمان', nameEn: 'Oman', currency: 'OMR' },
  { code: 'IQ', nameAr: 'العراق', nameEn: 'Iraq', currency: 'IQD' },
  { code: 'YE', nameAr: 'اليمن', nameEn: 'Yemen', currency: 'YER' },
  { code: 'PS', nameAr: 'فلسطين', nameEn: 'Palestine', currency: 'ILS' },
  { code: 'LB', nameAr: 'لبنان', nameEn: 'Lebanon', currency: 'LBP' },
  { code: 'SY', nameAr: 'سوريا', nameEn: 'Syria', currency: 'SYP' },
  { code: 'MA', nameAr: 'المغرب', nameEn: 'Morocco', currency: 'MAD' },
  { code: 'DZ', nameAr: 'الجزائر', nameEn: 'Algeria', currency: 'DZD' },
  { code: 'TN', nameAr: 'تونس', nameEn: 'Tunisia', currency: 'TND' },
  { code: 'LY', nameAr: 'ليبيا', nameEn: 'Libya', currency: 'LYD' },
  { code: 'SD', nameAr: 'السودان', nameEn: 'Sudan', currency: 'SDG' },
  { code: 'MR', nameAr: 'موريتانيا', nameEn: 'Mauritania', currency: 'MRU' },
  { code: 'SO', nameAr: 'الصومال', nameEn: 'Somalia', currency: 'SOS' },
  { code: 'DJ', nameAr: 'جيبوتي', nameEn: 'Djibouti', currency: 'DJF' },
  { code: 'KM', nameAr: 'جزر القمر', nameEn: 'Comoros', currency: 'KMF' },
  { code: 'US', nameAr: 'الولايات المتحدة', nameEn: 'United States', currency: 'USD' },
  { code: 'GB', nameAr: 'المملكة المتحدة', nameEn: 'United Kingdom', currency: 'GBP' },
  { code: 'EU', nameAr: 'الاتحاد الأوروبي', nameEn: 'Eurozone', currency: 'EUR' },
  { code: 'DE', nameAr: 'ألمانيا', nameEn: 'Germany', currency: 'EUR' },
  { code: 'FR', nameAr: 'فرنسا', nameEn: 'France', currency: 'EUR' },
  { code: 'IT', nameAr: 'إيطاليا', nameEn: 'Italy', currency: 'EUR' },
  { code: 'ES', nameAr: 'إسبانيا', nameEn: 'Spain', currency: 'EUR' },
  { code: 'NL', nameAr: 'هولندا', nameEn: 'Netherlands', currency: 'EUR' },
  { code: 'BE', nameAr: 'بلجيكا', nameEn: 'Belgium', currency: 'EUR' },
  { code: 'CH', nameAr: 'سويسرا', nameEn: 'Switzerland', currency: 'CHF' },
  { code: 'SE', nameAr: 'السويد', nameEn: 'Sweden', currency: 'SEK' },
  { code: 'NO', nameAr: 'النرويج', nameEn: 'Norway', currency: 'NOK' },
  { code: 'DK', nameAr: 'الدنمارك', nameEn: 'Denmark', currency: 'DKK' },
  { code: 'TR', nameAr: 'تركيا', nameEn: 'Turkey', currency: 'TRY' },
  { code: 'IR', nameAr: 'إيران', nameEn: 'Iran', currency: 'IRR' },
  { code: 'PK', nameAr: 'باكستان', nameEn: 'Pakistan', currency: 'PKR' },
  { code: 'IN', nameAr: 'الهند', nameEn: 'India', currency: 'INR' },
  { code: 'BD', nameAr: 'بنغلاديش', nameEn: 'Bangladesh', currency: 'BDT' },
  { code: 'ID', nameAr: 'إندونيسيا', nameEn: 'Indonesia', currency: 'IDR' },
  { code: 'MY', nameAr: 'ماليزيا', nameEn: 'Malaysia', currency: 'MYR' },
  { code: 'SG', nameAr: 'سنغافورة', nameEn: 'Singapore', currency: 'SGD' },
  { code: 'CN', nameAr: 'الصين', nameEn: 'China', currency: 'CNY' },
  { code: 'JP', nameAr: 'اليابان', nameEn: 'Japan', currency: 'JPY' },
  { code: 'KR', nameAr: 'كوريا الجنوبية', nameEn: 'South Korea', currency: 'KRW' },
  { code: 'AU', nameAr: 'أستراليا', nameEn: 'Australia', currency: 'AUD' },
  { code: 'NZ', nameAr: 'نيوزيلندا', nameEn: 'New Zealand', currency: 'NZD' },
  { code: 'CA', nameAr: 'كندا', nameEn: 'Canada', currency: 'CAD' },
  { code: 'BR', nameAr: 'البرازيل', nameEn: 'Brazil', currency: 'BRL' },
  { code: 'MX', nameAr: 'المكسيك', nameEn: 'Mexico', currency: 'MXN' },
  { code: 'AR', nameAr: 'الأرجنتين', nameEn: 'Argentina', currency: 'ARS' },
  { code: 'CL', nameAr: 'تشيلي', nameEn: 'Chile', currency: 'CLP' },
  { code: 'CO', nameAr: 'كولومبيا', nameEn: 'Colombia', currency: 'COP' },
  { code: 'ZA', nameAr: 'جنوب أفريقيا', nameEn: 'South Africa', currency: 'ZAR' },
  { code: 'NG', nameAr: 'نيجيريا', nameEn: 'Nigeria', currency: 'NGN' },
  { code: 'KE', nameAr: 'كينيا', nameEn: 'Kenya', currency: 'KES' },
  { code: 'GH', nameAr: 'غانا', nameEn: 'Ghana', currency: 'GHS' },
  { code: 'RU', nameAr: 'روسيا', nameEn: 'Russia', currency: 'RUB' },
  { code: 'UA', nameAr: 'أوكرانيا', nameEn: 'Ukraine', currency: 'UAH' },
  { code: 'PL', nameAr: 'بولندا', nameEn: 'Poland', currency: 'PLN' },
  { code: 'CZ', nameAr: 'التشيك', nameEn: 'Czechia', currency: 'CZK' },
  { code: 'HU', nameAr: 'هنغاريا', nameEn: 'Hungary', currency: 'HUF' },
  { code: 'RO', nameAr: 'رومانيا', nameEn: 'Romania', currency: 'RON' },
  { code: 'GR', nameAr: 'اليونان', nameEn: 'Greece', currency: 'EUR' },
  { code: 'PT', nameAr: 'البرتغال', nameEn: 'Portugal', currency: 'EUR' },
  { code: 'IE', nameAr: 'أيرلندا', nameEn: 'Ireland', currency: 'EUR' },
  { code: 'AT', nameAr: 'النمسا', nameEn: 'Austria', currency: 'EUR' },
  { code: 'FI', nameAr: 'فنلندا', nameEn: 'Finland', currency: 'EUR' },
  { code: 'IL', nameAr: 'إسرائيل', nameEn: 'Israel', currency: 'ILS' },
  { code: 'HK', nameAr: 'هونغ كونغ', nameEn: 'Hong Kong', currency: 'HKD' },
  { code: 'TW', nameAr: 'تايوان', nameEn: 'Taiwan', currency: 'TWD' },
  { code: 'TH', nameAr: 'تايلاند', nameEn: 'Thailand', currency: 'THB' },
  { code: 'VN', nameAr: 'فيتنام', nameEn: 'Vietnam', currency: 'VND' },
  { code: 'PH', nameAr: 'الفلبين', nameEn: 'Philippines', currency: 'PHP' },
];

const CURRENCY_META = {
  USD: { nameAr: 'دولار أمريكي', nameEn: 'US Dollar', symbol: '$' },
  EUR: { nameAr: 'يورو', nameEn: 'Euro', symbol: '€' },
  GBP: { nameAr: 'جنيه إسترليني', nameEn: 'British Pound', symbol: '£' },
  SAR: { nameAr: 'ريال سعودي', nameEn: 'Saudi Riyal', symbol: 'ر.س' },
  AED: { nameAr: 'درهم إماراتي', nameEn: 'UAE Dirham', symbol: 'د.إ' },
  EGP: { nameAr: 'جنيه مصري', nameEn: 'Egyptian Pound', symbol: 'ج.م' },
  JOD: { nameAr: 'دينار أردني', nameEn: 'Jordanian Dinar', symbol: 'د.أ' },
  KWD: { nameAr: 'دينار كويتي', nameEn: 'Kuwaiti Dinar', symbol: 'د.ك' },
  BHD: { nameAr: 'دينار بحريني', nameEn: 'Bahraini Dinar', symbol: 'د.ب' },
  QAR: { nameAr: 'ريال قطري', nameEn: 'Qatari Riyal', symbol: 'ر.ق' },
  OMR: { nameAr: 'ريال عماني', nameEn: 'Omani Rial', symbol: 'ر.ع' },
  IQD: { nameAr: 'دينار عراقي', nameEn: 'Iraqi Dinar', symbol: 'د.ع' },
  MAD: { nameAr: 'درهم مغربي', nameEn: 'Moroccan Dirham', symbol: 'د.م' },
  TND: { nameAr: 'دينار تونسي', nameEn: 'Tunisian Dinar', symbol: 'د.ت' },
  DZD: { nameAr: 'دينار جزائري', nameEn: 'Algerian Dinar', symbol: 'د.ج' },
  TRY: { nameAr: 'ليرة تركية', nameEn: 'Turkish Lira', symbol: '₺' },
  INR: { nameAr: 'روبية هندية', nameEn: 'Indian Rupee', symbol: '₹' },
  PKR: { nameAr: 'روبية باكستانية', nameEn: 'Pakistani Rupee', symbol: '₨' },
  CNY: { nameAr: 'يوان صيني', nameEn: 'Chinese Yuan', symbol: '¥' },
  JPY: { nameAr: 'ين ياباني', nameEn: 'Japanese Yen', symbol: '¥' },
  CAD: { nameAr: 'دولار كندي', nameEn: 'Canadian Dollar', symbol: 'C$' },
  AUD: { nameAr: 'دولار أسترالي', nameEn: 'Australian Dollar', symbol: 'A$' },
  CHF: { nameAr: 'فرنك سويسري', nameEn: 'Swiss Franc', symbol: 'CHF' },
  SEK: { nameAr: 'كرونة سويدية', nameEn: 'Swedish Krona', symbol: 'kr' },
  NOK: { nameAr: 'كرونة نرويجية', nameEn: 'Norwegian Krone', symbol: 'kr' },
  DKK: { nameAr: 'كرونة دنماركية', nameEn: 'Danish Krone', symbol: 'kr' },
  ZAR: { nameAr: 'راند جنوب أفريقي', nameEn: 'South African Rand', symbol: 'R' },
  BRL: { nameAr: 'ريال برازيلي', nameEn: 'Brazilian Real', symbol: 'R$' },
  MXN: { nameAr: 'بيزو مكسيكي', nameEn: 'Mexican Peso', symbol: 'MX$' },
  SGD: { nameAr: 'دولار سنغافوري', nameEn: 'Singapore Dollar', symbol: 'S$' },
  MYR: { nameAr: 'رينغيت ماليزي', nameEn: 'Malaysian Ringgit', symbol: 'RM' },
  IDR: { nameAr: 'روبية إندونيسية', nameEn: 'Indonesian Rupiah', symbol: 'Rp' },
  THB: { nameAr: 'باهت تايلاندي', nameEn: 'Thai Baht', symbol: '฿' },
  VND: { nameAr: 'دونغ فيتنامي', nameEn: 'Vietnamese Dong', symbol: '₫' },
  KRW: { nameAr: 'وون كوري', nameEn: 'South Korean Won', symbol: '₩' },
  HKD: { nameAr: 'دولار هونغ كونغ', nameEn: 'Hong Kong Dollar', symbol: 'HK$' },
  TWD: { nameAr: 'دولار تايواني', nameEn: 'New Taiwan Dollar', symbol: 'NT$' },
  PHP: { nameAr: 'بيزو فلبيني', nameEn: 'Philippine Peso', symbol: '₱' },
  RUB: { nameAr: 'روبل روسي', nameEn: 'Russian Ruble', symbol: '₽' },
  UAH: { nameAr: 'هريفنيا أوكرانية', nameEn: 'Ukrainian Hryvnia', symbol: '₴' },
  PLN: { nameAr: 'زلوتي بولندي', nameEn: 'Polish Zloty', symbol: 'zł' },
  CZK: { nameAr: 'كرونة تشيكية', nameEn: 'Czech Koruna', symbol: 'Kč' },
  HUF: { nameAr: 'فورنت مجري', nameEn: 'Hungarian Forint', symbol: 'Ft' },
  RON: { nameAr: 'ليو روماني', nameEn: 'Romanian Leu', symbol: 'lei' },
  ILS: { nameAr: 'شيكل', nameEn: 'Israeli Shekel', symbol: '₪' },
  NGN: { nameAr: 'نايرا نيجيرية', nameEn: 'Nigerian Naira', symbol: '₦' },
  KES: { nameAr: 'شلن كيني', nameEn: 'Kenyan Shilling', symbol: 'KSh' },
  GHS: { nameAr: 'سيدي غاني', nameEn: 'Ghanaian Cedi', symbol: 'GH₵' },
  ARS: { nameAr: 'بيزو أرجنتيني', nameEn: 'Argentine Peso', symbol: 'AR$' },
  CLP: { nameAr: 'بيزو تشيلي', nameEn: 'Chilean Peso', symbol: 'CL$' },
  COP: { nameAr: 'بيزو كولومبي', nameEn: 'Colombian Peso', symbol: 'CO$' },
  NZD: { nameAr: 'دولار نيوزيلندي', nameEn: 'New Zealand Dollar', symbol: 'NZ$' },
  LBP: { nameAr: 'ليرة لبنانية', nameEn: 'Lebanese Pound', symbol: 'ل.ل' },
  SYP: { nameAr: 'ليرة سورية', nameEn: 'Syrian Pound', symbol: 'ل.س' },
  YER: { nameAr: 'ريال يمني', nameEn: 'Yemeni Rial', symbol: '﷼' },
  SDG: { nameAr: 'جنيه سوداني', nameEn: 'Sudanese Pound', symbol: 'ج.س' },
  LYD: { nameAr: 'دينار ليبي', nameEn: 'Libyan Dinar', symbol: 'د.ل' },
  MRU: { nameAr: 'أوقية موريتانية', nameEn: 'Mauritanian Ouguiya', symbol: 'UM' },
  SOS: { nameAr: 'شلن صومالي', nameEn: 'Somali Shilling', symbol: 'Sh' },
  DJF: { nameAr: 'فرنك جيبوتي', nameEn: 'Djiboutian Franc', symbol: 'Fdj' },
  KMF: { nameAr: 'فرنك قمري', nameEn: 'Comorian Franc', symbol: 'CF' },
  BDT: { nameAr: 'تاكا بنغلاديشي', nameEn: 'Bangladeshi Taka', symbol: '৳' },
  IRR: { nameAr: 'ريال إيراني', nameEn: 'Iranian Rial', symbol: '﷼' },
};

function listCountries() {
  return COUNTRIES.slice();
}

function listCurrencies() {
  const set = new Map();
  for (const c of COUNTRIES) {
    const code = c.currency;
    if (!set.has(code)) {
      const meta = CURRENCY_META[code] || { nameAr: code, nameEn: code, symbol: code };
      set.set(code, { code, ...meta });
    }
  }
  if (!set.has('USD')) set.set('USD', { code: 'USD', ...CURRENCY_META.USD });
  return [...set.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function suggestFromCountryText(countryText) {
  const q = String(countryText || '').trim().toLowerCase();
  if (!q) return { countryCode: null, currency: 'USD' };
  const hit =
    COUNTRIES.find((c) => c.code.toLowerCase() === q) ||
    COUNTRIES.find((c) => c.nameAr.includes(countryText.trim()) || c.nameEn.toLowerCase().includes(q));
  if (!hit) return { countryCode: null, currency: 'USD' };
  return { countryCode: hit.code, currency: hit.currency };
}

function searchCountriesCurrencies(query) {
  const q = String(query || '').trim().toLowerCase();
  const countries = listCountries();
  const currencies = listCurrencies();
  if (!q) return { countries, currencies };
  return {
    countries: countries.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.nameAr.includes(query.trim()) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q)
    ),
    currencies: currencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        (c.nameAr && c.nameAr.includes(query.trim())) ||
        (c.nameEn && c.nameEn.toLowerCase().includes(q))
    ),
  };
}

module.exports = {
  COUNTRIES,
  CURRENCY_META,
  listCountries,
  listCurrencies,
  suggestFromCountryText,
  searchCountriesCurrencies,
};
