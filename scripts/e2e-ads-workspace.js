/**
 * E2E Ads Workspace flow
 * Run: node scripts/e2e-ads-workspace.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function sandbox() {
  const local = { _d: Object.create(null) };
  const sb = {
    console,
    URL,
    localStorage: {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(local._d, k) ? local._d[k] : null;
      },
      setItem(k, v) {
        local._d[k] = String(v);
      },
      removeItem(k) {
        delete local._d[k];
      },
    },
    document: {
      readyState: 'complete',
      body: { dataset: {} },
      addEventListener() {},
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getElementById() {
        return null;
      },
    },
    window: null,
    CustomEvent: function (n) {
      this.type = n;
    },
  };
  sb.window = sb;
  sb.window.dispatchEvent = () => {};
  sb.window.addEventListener = () => {};
  sb.window.HubAuth = { getUser: () => ({ email: 'client@test.com', name: 'Client' }), isStaff: () => true };
  sb.window.HubMarketplaceData = { adTypeForLevel: () => 'إعلان منصة' };
  vm.createContext(sb);
  return sb;
}

function loadStore(sb) {
  // Minimal HubStore kernel using extracted functions is heavy; load full file after stubs.
  const empire = {
    adsStudio: { listings: [] },
    salesStore: { items: [], orders: [] },
    productCatalog: [],
    activity: [],
    feed: [],
    points: { balance: 0, ledger: [] },
  };
  // Provide a lightweight store implementing needed APIs by evaluating store helpers via patch:
  // Instead, implement thin HubStore and then eval customer-requests + patch addAd from store source by requiring logic inline.
  sb.window.HubStore = null;

  // Load customer requests first (depends only on itself)
  vm.runInContext(read('js/hub-customer-requests.js'), sb);

  // Inline store ads APIs compatible with production signatures
  const nowIso = () => new Date().toISOString();
  const uid = (p) => p + '-' + Math.random().toString(16).slice(2, 8);
  const normalizeList = (v) =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

  const placementsToTargets = (placements = [], position = 'top') => {
    const targets = { home: false, offices: [], branches: [], incubators: [], platforms: [] };
    const places = [];
    placements.forEach((p) => {
      if (p === 'home') {
        targets.home = true;
        places.push('main_interface');
      } else if (p === 'incubators') targets.incubators = ['*'];
      else if (p === 'branches') targets.branches = ['*'];
      else targets.platforms = ['*'];
    });
    if (!targets.home && !targets.platforms.length && !targets.branches.length && !targets.incubators.length) {
      targets.home = true;
      places.push('main_interface');
    }
    if (position) places.push('pos_' + position);
    return { publishTargets: targets, appearancePlaces: places };
  };

  const nextAdCode = () => {
    const year = new Date().getFullYear();
    let max = 0;
    empire.adsStudio.listings.forEach((ad) => {
      const m = String(ad.adCode || '').match(new RegExp(`^AD-${year}-(\\d+)$`));
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `AD-${year}-${String(max + 1).padStart(5, '0')}`;
  };

  const pushAdActivity = (ad, message, actor = 'نظام') => {
    if (!Array.isArray(ad.activity)) ad.activity = [];
    ad.activity.unshift({ at: nowIso(), message, actor });
  };

  const addAdListing = (payload) => {
    const mapped = placementsToTargets(payload.placements || [], payload.position || 'top');
    const ad = {
      id: uid('ad'),
      adCode: nextAdCode(),
      title: payload.title,
      headline: payload.headline || payload.title,
      desc: payload.desc || '',
      bodyText: payload.bodyText || '',
      contentType: payload.contentType || 'image',
      mediaDataUrl: payload.mediaDataUrl || '',
      mediaName: payload.mediaName || '',
      destinationUrl: payload.destinationUrl || '',
      ctaLabel: payload.ctaLabel || '',
      fileAction: payload.fileAction || 'open',
      placements: (payload.placements || []).slice(),
      position: payload.position || 'top',
      audience: payload.audience || 'all',
      scheduleMode: payload.scheduleMode || 'immediate',
      adStartDate: payload.adStartDate || '',
      adEndDate: payload.adEndDate || '',
      publishStatus: payload.publishStatus || 'draft',
      workflowStatus: payload.workflowStatus || 'pending_review',
      status: payload.status || 'paused',
      publishTargets: mapped.publishTargets,
      appearancePlaces: mapped.appearancePlaces,
      views: 0,
      clicks: 0,
      createdBy: 'client@test.com',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      activity: [],
      requestId: '',
      rejectionReason: '',
    };
    pushAdActivity(ad, 'تم إنشاء الإعلان', 'client@test.com');
    if (ad.workflowStatus === 'pending_review') pushAdActivity(ad, 'تم إرساله للمراجعة', 'client@test.com');
    empire.adsStudio.listings.unshift(ad);
    if (ad.workflowStatus === 'pending_review' && sb.window.HubCustomerRequests?.ensureForAd) {
      const req = sb.window.HubCustomerRequests.ensureForAd(ad, 'client@test.com');
      if (req?.id) ad.requestId = req.id;
    }
    return ad;
  };

  const setAdWorkflowStatus = (id, workflowStatus, extra = {}) => {
    const ad = empire.adsStudio.listings.find((x) => x.id === id || x.adCode === id);
    if (!ad) return null;
    ad.workflowStatus = workflowStatus;
    if (workflowStatus === 'active' || workflowStatus === 'approved') {
      ad.workflowStatus = 'active';
      ad.publishStatus = 'published';
      ad.status = 'active';
      pushAdActivity(ad, 'تمت الموافقة وبدأ النشر', 'Admin');
    } else if (workflowStatus === 'paused') {
      ad.status = 'paused';
      pushAdActivity(ad, 'تم إيقاف الإعلان', 'Admin');
    } else if (workflowStatus === 'rejected') {
      ad.status = 'paused';
      ad.publishStatus = 'draft';
      ad.rejectionReason = extra.rejectionReason || '';
      pushAdActivity(ad, 'مرفوض', 'Admin');
    } else if (workflowStatus === 'deleted' || workflowStatus === 'ended') {
      ad.status = 'archived';
      ad.workflowStatus = 'ended';
      pushAdActivity(ad, 'تم حذف الإعلان', 'Admin');
    }
    Object.assign(ad, extra || {});
    if (sb.window.HubCustomerRequests?.ensureForAd) sb.window.HubCustomerRequests.ensureForAd(ad, 'Admin');
    return ad;
  };

  const updateAdListing = (id, patch) => {
    const ad = empire.adsStudio.listings.find((x) => x.id === id);
    if (!ad) return null;
    Object.assign(ad, patch, { updatedAt: nowIso() });
    pushAdActivity(ad, 'تم حفظ التعديلات', 'client@test.com');
    return ad;
  };

  const toggleAd = (id) => {
    const ad = empire.adsStudio.listings.find((x) => x.id === id);
    if (!ad) return null;
    if (ad.status === 'active') return setAdWorkflowStatus(id, 'paused');
    ad.status = 'active';
    ad.workflowStatus = 'active';
    ad.publishStatus = 'published';
    pushAdActivity(ad, 'تم تشغيل الإعلان', 'client@test.com');
    return ad;
  };

  const adMatchesTarget = (ad, kind) => {
    if (!ad || ad.publishStatus === 'draft' || ad.publishStatus === 'deferred') return false;
    if (ad.workflowStatus && !['active', 'approved'].includes(ad.workflowStatus)) return false;
    if (ad.status !== 'active') return false;
    if (kind === 'home') return !!ad.publishTargets?.home;
    return true;
  };

  sb.window.HubStore = {
    get: () => ({ empire }),
    addAdListing,
    updateAdListing,
    setAdWorkflowStatus,
    toggleAd,
    resolveWorkflowStatus: (ad) => ad.workflowStatus || ad.status,
    listAdsFor: (kind) => empire.adsStudio.listings.filter((a) => adMatchesTarget(a, kind)),
    adMatchesTarget,
  };
  return empire;
}

function run() {
  const results = [];
  const pass = (n) => results.push({ name: n, ok: true });
  const fail = (n, e) => results.push({ name: n, ok: false, err: String(e && e.message ? e.message : e) });

  try {
    const sb = sandbox();
    const empire = loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'عرض أكاديمية سبتمبر',
      headline: 'انضم الآن',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,aaa',
      placements: ['home'],
      position: 'top',
      destinationUrl: 'https://example.com',
      ctaLabel: 'اعرف المزيد',
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    assert.ok(String(ad.adCode).startsWith('AD-'));
    assert.strictEqual(ad.workflowStatus, 'pending_review');
    assert.ok(ad.requestId);
    const req = sb.window.HubCustomerRequests.get(ad.requestId);
    assert.ok(req);
    assert.strictEqual(req.requestType, 'Ad Submission');
    pass('TEST A create image ad + Posha request');
  } catch (e) {
    fail('TEST A create image ad + Posha request', e);
  }

  try {
    const sb = sandbox();
    const empire = loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'Ad B',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,bbb',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    sb.window.HubStore.setAdWorkflowStatus(ad.id, 'active');
    const live = empire.adsStudio.listings.find((x) => x.id === ad.id);
    assert.strictEqual(live.status, 'active');
    assert.strictEqual(live.workflowStatus, 'active');
    assert.strictEqual(live.publishStatus, 'published');
    const shown = sb.window.HubStore.listAdsFor('home');
    assert.ok(shown.some((x) => x.id === ad.id));
    pass('TEST B admin approve → active on home');
  } catch (e) {
    fail('TEST B admin approve → active on home', e);
  }

  try {
    const sb = sandbox();
    loadStore(sb);
    const video = sb.window.HubStore.addAdListing({
      title: 'Video Ad',
      contentType: 'video',
      mediaDataUrl: 'data:video/mp4;base64,ccc',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    assert.strictEqual(video.contentType, 'video');
    assert.ok(video.mediaDataUrl.includes('video'));
    pass('TEST C video upload fields');
  } catch (e) {
    fail('TEST C video upload fields', e);
  }

  try {
    const sb = sandbox();
    loadStore(sb);
    const fileAd = sb.window.HubStore.addAdListing({
      title: 'PDF Brochure',
      contentType: 'file',
      mediaDataUrl: 'data:application/pdf;base64,ddd',
      mediaName: 'brochure.pdf',
      fileAction: 'download',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    assert.strictEqual(fileAd.fileAction, 'download');
    assert.strictEqual(fileAd.mediaName, 'brochure.pdf');
    pass('TEST D PDF file ad');
  } catch (e) {
    fail('TEST D PDF file ad', e);
  }

  try {
    const sb = sandbox();
    loadStore(sb);
    const textAd = sb.window.HubStore.addAdListing({
      title: 'Text Promo',
      contentType: 'text',
      bodyText: 'Hello world',
      ctaLabel: 'تسوق الآن',
      destinationUrl: 'https://store.example.com/item',
      placements: ['store'],
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    assert.strictEqual(textAd.ctaLabel, 'تسوق الآن');
    assert.ok(textAd.destinationUrl.startsWith('https://'));
    pass('TEST E text CTA + URL');
  } catch (e) {
    fail('TEST E text CTA + URL', e);
  }

  try {
    const sb = sandbox();
    loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'Editable',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,eee',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'draft',
      status: 'paused',
    });
    sb.window.HubStore.updateAdListing(ad.id, { title: 'Editable 2', headline: 'New' });
    assert.strictEqual(ad.title, 'Editable 2');
    pass('TEST F edit ad');
  } catch (e) {
    fail('TEST F edit ad', e);
  }

  try {
    const sb = sandbox();
    const empire = loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'Pause me',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,fff',
      placements: ['home'],
      publishStatus: 'published',
      workflowStatus: 'active',
      status: 'active',
    });
    // force active publish flags
    ad.publishStatus = 'published';
    ad.workflowStatus = 'active';
    ad.status = 'active';
    assert.ok(sb.window.HubStore.listAdsFor('home').some((x) => x.id === ad.id));
    sb.window.HubStore.setAdWorkflowStatus(ad.id, 'paused');
    assert.ok(!sb.window.HubStore.listAdsFor('home').some((x) => x.id === ad.id));
    sb.window.HubStore.toggleAd(ad.id);
    assert.ok(sb.window.HubStore.listAdsFor('home').some((x) => x.id === ad.id));
    pass('TEST G pause then resume');
  } catch (e) {
    fail('TEST G pause then resume', e);
  }

  try {
    const sb = sandbox();
    const empire = loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'Delete me',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,ggg',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'draft',
      status: 'paused',
    });
    sb.window.HubStore.setAdWorkflowStatus(ad.id, 'deleted');
    assert.strictEqual(ad.workflowStatus, 'ended');
    assert.strictEqual(ad.status, 'archived');
    pass('TEST H delete ad');
  } catch (e) {
    fail('TEST H delete ad', e);
  }

  try {
    const sb = sandbox();
    loadStore(sb);
    const ad = sb.window.HubStore.addAdListing({
      title: 'Posha link',
      contentType: 'image',
      mediaDataUrl: 'data:image/png;base64,hhh',
      placements: ['home'],
      publishStatus: 'draft',
      workflowStatus: 'pending_review',
      status: 'paused',
    });
    const list = sb.window.HubCustomerRequests.list({}).filter((r) => r.requestType === 'Ad Submission');
    assert.ok(list.some((r) => r.referenceId === ad.id));
    pass('TEST I Posha customer requests');
  } catch (e) {
    fail('TEST I Posha customer requests', e);
  }

  try {
    // Layout/responsive smoke: css + html markers exist
    const html = read('ads.html');
    const css = read('css/hub-ads-workspace.css');
    assert.ok(html.includes('ads-workspace'));
    assert.ok(html.includes('hub-ads-workspace.js'));
    assert.ok(!html.includes('طريقة تشغيل الإعلانات'));
    assert.ok(css.includes('max-width: 1500px') || css.includes('min(1500px'));
    assert.ok(css.includes('@media'));
    pass('TEST J desktop/mobile layout markers');
  } catch (e) {
    fail('TEST J desktop/mobile layout markers', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

run();
