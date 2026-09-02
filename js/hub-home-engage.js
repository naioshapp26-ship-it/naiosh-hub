/**
 * بوابات التفاعل على الرئيسية — مسابقات · أخبار · بحث · تقييم · مجتمعات
 * محتوى هادف يُعرض في السيكشن ويُعاد استخدامه في صفحات البوابات.
 */
window.HubHomeEngage = (() => {
  'use strict';

  const COMPETITIONS = [
    {
      id: 'cmp-ideas',
      title: 'مسابقة الأفكار التشغيلية',
      blurb: 'قدّم فكرة قابلة للتنفيذ داخل فرع أو حاضنة خلال 7 أيام.',
      prize: 'ظهور في غرفة العمليات + 500 نقطة',
      deadline: '2026-09-15',
      href: 'competitions.html#cmp-ideas',
      status: 'مفتوحة',
    },
    {
      id: 'cmp-incubator',
      title: 'تحدي الحاضنات القطاعية',
      blurb: 'أنشئ مخرجًا مرتبطًا بحاضنتك: منتج · إعلان · مسار تدريب.',
      prize: 'ترشيح لمنصة سيادية',
      deadline: '2026-09-30',
      href: 'competitions.html#cmp-incubator',
      status: 'مفتوحة',
    },
    {
      id: 'cmp-knowledge',
      title: 'مسابقة المعرفة التشغيلية',
      blurb: 'أجب عن سيناريوهات الحوكمة والتشغيل — واربح مسار أكاديمية.',
      prize: 'قسيمة دورة معتمدة',
      deadline: '2026-10-10',
      href: 'competitions.html#cmp-knowledge',
      status: 'قريبًا',
    },
  ];

  const NEWS = [
    {
      id: 'news-search-list',
      title: 'مكتبة المحتوى: بحث وعرض قائمة',
      blurb: 'صار أسهل تلاقي المنشور لما تكثر العناصر — ابحث أو اعرض كقائمة.',
      date: '2026-08-16',
      tag: 'تحديث',
      href: 'search-content.html',
    },
    {
      id: 'news-inc-deeplink',
      title: 'البحث يفتح الحاضنة نفسها',
      blurb: 'الضغط على حاضنة من محرك البحث يمرّرك لبطاقتها ويفتح المعاينة.',
      date: '2026-08-16',
      tag: 'تشغيل',
      href: 'search.html',
    },
    {
      id: 'news-events',
      title: 'قمة القيادة التشغيلية',
      blurb: 'جلسة مباشرة للقادة حول سيادة التشغيل في هوب.',
      date: '2026-08-12',
      tag: 'فعالية',
      href: 'events.html',
    },
  ];

  const RESEARCH_TRACKS = [
    {
      id: 'rs-ops',
      title: 'بحوث التشغيل',
      blurb: 'نماذج تشغيل فرع / حاضنة / منصة قابلة للتكرار.',
      section: 'content',
    },
    {
      id: 'rs-gov',
      title: 'بحوث الحوكمة',
      blurb: 'أطر امتثال وجودة مربوطة بمؤشرات غرفة العمليات.',
      section: 'system',
    },
    {
      id: 'rs-learn',
      title: 'بحوث التعلم',
      blurb: 'مسارات تدريب وقياس أثر على الإنتاجية.',
      section: 'content',
    },
  ];

  const ASSESS_PATHS = [
    {
      id: 'as-side',
      title: 'تقييم فرصة دخل / مشروع',
      blurb: 'العمر · المهارات · الوقت · رأس المال → فرصة قابلة للاختبار.',
      href: 'side-projects.html#sp-client-intro',
      icon: 'fa-lightbulb',
    },
    {
      id: 'as-learn',
      title: 'تقييم المسار التعليمي',
      blurb: 'من دورة قصيرة إلى دبلوم — حسب خبرتك وهدفك.',
      href: 'courses.html',
      icon: 'fa-graduation-cap',
    },
    {
      id: 'as-inc',
      title: 'تقييم ملاءمة الحاضنة',
      blurb: 'اختر القطاع الأقرب لمهارتك وادخل البرنامج المناسب.',
      href: 'incubators.html',
      icon: 'fa-seedling',
    },
  ];

  const COMMUNITIES = [
    {
      id: 'cm-inc',
      title: 'مجتمع الحاضنات',
      blurb: 'تبادل قطاعي ثم مخرج تشغيلي داخل الحاضنة.',
      href: 'incubators.html',
      meta: () => `${window.HubIncubatorsData?.count || 100} حاضنة`,
      icon: 'fa-seedling',
    },
    {
      id: 'cm-plat',
      title: 'مجتمع المنصات',
      blurb: 'مشغّلو المنصات السيادية: تكامل وحوكمة ودعم.',
      href: 'platforms.html',
      meta: () => `${window.HubSovereignPlatforms?.count || 18} منصة`,
      icon: 'fa-layer-group',
    },
    {
      id: 'cm-know',
      title: 'مجتمع المعرفة',
      blurb: 'ندوات وأسئلة تشغيلية من مركز المعرفة للأكاديمية.',
      href: 'info-center.html',
      meta: () => 'معرفة · دورات',
      icon: 'fa-graduation-cap',
    },
  ];

  const countPendingResearch = () => {
    try {
      const list = JSON.parse(localStorage.getItem('hub-research-submissions') || '[]');
      if (!Array.isArray(list)) return 0;
      return list.filter((x) => x && x.status === 'pending').length;
    } catch {
      return 0;
    }
  };

  const PORTALS = [
    {
      id: 'competitions',
      label: 'مسابقات',
      href: 'competitions.html',
      icon: 'fa-trophy',
      tone: 'gold',
      lead: 'تنافس بنتيجة قابلة للتشغيل',
      feed: () => {
        const open = COMPETITIONS.filter((c) => c.status === 'مفتوحة');
        const first = open[0] || COMPETITIONS[0];
        return {
          kicker: `${open.length} مسابقة مفتوحة`,
          title: first.title,
          text: first.blurb,
          href: first.href,
        };
      },
    },
    {
      id: 'news',
      label: 'آخر الأخبار',
      href: 'news.html',
      icon: 'fa-newspaper',
      tone: 'ink',
      lead: 'تحديثات تنتهي بخطوة',
      feed: () => {
        const first = NEWS[0];
        const fromEvents = (window.HubMarketplaceData?.EVENTS || [])
          .filter((e) => e.status === 'قادمة')
          .slice(0, 1);
        const live = fromEvents[0];
        if (live) {
          return {
            kicker: 'قادم من استوديو الفعاليات',
            title: live.name,
            text: live.description,
            href: 'events.html',
          };
        }
        return {
          kicker: first.tag,
          title: first.title,
          text: first.blurb,
          href: first.href,
        };
      },
    },
    {
      id: 'research',
      label: 'انشر بحثك',
      href: 'publish-research.html',
      icon: 'fa-flask',
      tone: 'teal',
      lead: 'من الورقة إلى محتوى تشغيلي',
      feed: () => {
        const pending = countPendingResearch();
        const track = RESEARCH_TRACKS[0];
        return {
          kicker: pending ? `${pending} بحث محفوظ على هذا الجهاز` : `${RESEARCH_TRACKS.length} مسارات نشر`,
          title: track.title,
          text: track.blurb,
          href: 'publish-research.html#publish-form',
        };
      },
    },
    {
      id: 'assess',
      label: 'قيّم نفسك',
      href: 'self-assess.html',
      icon: 'fa-clipboard-check',
      tone: 'rose',
      lead: 'اعرف مستواك واختر خطوتك',
      feed: () => {
        const first = ASSESS_PATHS[0];
        return {
          kicker: `${ASSESS_PATHS.length} مسارات تقييم`,
          title: first.title,
          text: first.blurb,
          href: first.href,
        };
      },
    },
    {
      id: 'communities',
      label: 'المجتمعات',
      href: 'communities.html',
      icon: 'fa-people-group',
      tone: 'ember',
      lead: 'مجتمع يشغّل لا يناقش فقط',
      feed: () => {
        const first = COMMUNITIES[0];
        return {
          kicker: first.meta(),
          title: first.title,
          text: first.blurb,
          href: first.href,
        };
      },
    },
  ];

  const esc = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const renderHome = (root) => {
    if (!root) return;
    root.innerHTML = PORTALS.map((p, idx) => {
      const feed = p.feed();
      return `<a class="hub-engage-portal tone-${esc(p.tone)} ${idx === 0 ? 'is-featured' : ''}" href="${esc(p.href)}" data-engage="${esc(p.id)}" style="--engage-i:${idx}">
        <span class="hub-engage-portal-top">
          <span class="hub-engage-ico" aria-hidden="true"><i class="fas ${esc(p.icon)}"></i></span>
          <span class="hub-engage-label">${esc(p.label)}</span>
        </span>
        <strong class="hub-engage-lead">${esc(p.lead)}</strong>
        <span class="hub-engage-feed">
          <em>${esc(feed.kicker)}</em>
          <b>${esc(feed.title)}</b>
          <small>${esc(feed.text)}</small>
        </span>
        <span class="hub-engage-go">ادخل <i class="fas fa-arrow-left" aria-hidden="true"></i></span>
      </a>`;
    }).join('');
  };

  const listBlock = (items, mapFn) => items.map(mapFn).join('');

  return {
    COMPETITIONS,
    NEWS,
    RESEARCH_TRACKS,
    ASSESS_PATHS,
    COMMUNITIES,
    PORTALS,
    countPendingResearch,
    renderHome,
    listBlock,
    esc,
  };
})();

(() => {
  const mount = () => {
    const root = document.querySelector('[data-hub-engage-grid]');
    if (!root || !window.HubHomeEngage) return;
    window.HubHomeEngage.renderHome(root);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
