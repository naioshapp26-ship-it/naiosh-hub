/**
 * بوابات التفاعل — مصدر بيانات مشترك للصفحة الموحدة وصفحات البوابات.
 * الصفحة الموحدة: hub-interaction.html
 */
window.HubHomeEngage = (() => {
  'use strict';

  const COMPETITIONS = [
    {
      id: 'cmp-ideas',
      title: 'مسابقة الأفكار التشغيلية',
      blurb: 'قدّم فكرة قابلة للتنفيذ داخل فرع أو حاضنة خلال 7 أيام.',
      type: 'أفكار تشغيلية',
      prize: 'ظهور في غرفة العمليات + 500 نقطة',
      startDate: '2026-08-01',
      endDate: '2026-09-15',
      deadline: '2026-09-15',
      organizer: 'غرفة عمليات نايوش',
      rules: 'فكرة واحدة لكل مشارك · خطة تنفيذ مختصرة · ربط بفرع أو حاضنة.',
      href: 'competitions.html#cmp-ideas',
      status: 'مفتوحة',
    },
    {
      id: 'cmp-incubator',
      title: 'تحدي الحاضنات القطاعية',
      blurb: 'أنشئ مخرجًا مرتبطًا بحاضنتك: منتج · إعلان · مسار تدريب.',
      type: 'تحدي قطاعي',
      prize: 'ترشيح لمنصة سيادية',
      startDate: '2026-08-15',
      endDate: '2026-09-30',
      deadline: '2026-09-30',
      organizer: 'إدارة الحاضنات',
      rules: 'المخرج يجب أن يكون قابلاً للتشغيل داخل الحاضنة خلال أسبوعين.',
      href: 'competitions.html#cmp-incubator',
      status: 'مفتوحة',
    },
    {
      id: 'cmp-knowledge',
      title: 'مسابقة المعرفة التشغيلية',
      blurb: 'أجب عن سيناريوهات الحوكمة والتشغيل — واربح مسار أكاديمية.',
      type: 'معرفة وحوكمة',
      prize: 'قسيمة دورة معتمدة',
      startDate: '2026-09-20',
      endDate: '2026-10-10',
      deadline: '2026-10-10',
      organizer: 'مركز المعرفة',
      rules: 'اختبار سيناريوهات متعدد المراحل · يُعلن عن الفتح قريبًا.',
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
      type: 'حاضنات',
      meta: () => `${window.HubIncubatorsData?.count || 100} حاضنة`,
      icon: 'fa-seedling',
    },
    {
      id: 'cm-plat',
      title: 'مجتمع المنصات',
      blurb: 'مشغّلو المنصات السيادية: تكامل وحوكمة ودعم.',
      href: 'platforms.html',
      type: 'منصات',
      meta: () => `${window.HubSovereignPlatforms?.count || 18} منصة`,
      icon: 'fa-layer-group',
    },
    {
      id: 'cm-know',
      title: 'مجتمع المعرفة',
      blurb: 'ندوات وأسئلة تشغيلية من مركز المعرفة للأكاديمية.',
      href: 'info-center.html',
      type: 'معرفة',
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

  const fmtDate = (d) => {
    if (!d) return '—';
    return String(d).replace(/[٠-٩]/g, (ch) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(ch)]);
  };

  const isOpenStatus = (status) => status === 'مفتوحة';
  const badgeClass = (status) => {
    if (status === 'مفتوحة') return 'is-open';
    if (status === 'منتهية' || status === 'مغلقة') return 'is-closed';
    return 'is-soon';
  };

  const emptyState = (msg) =>
    `<div class="hub-interaction-empty"><i class="fas fa-inbox" aria-hidden="true"></i>${esc(msg)}</div>`;

  const renderCompetitions = (root) => {
    if (!root) return;
    if (!COMPETITIONS.length) {
      root.innerHTML = emptyState('لا توجد مسابقات متاحة حاليًا.');
      return;
    }
    root.innerHTML = COMPETITIONS.map((c) => {
      const open = isOpenStatus(c.status);
      const loggedIn = !!window.HubAuth?.isLoggedIn?.();
      const joinHref = open ? (loggedIn ? c.href : `login.html?next=${encodeURIComponent(c.href)}`) : '';
      const joinLabel = open
        ? loggedIn
          ? 'شارك الآن'
          : 'سجّل الدخول للمشاركة'
        : c.status === 'قريبًا'
          ? 'قريبًا'
          : 'انتهت المشاركة';
      return `<article class="hub-interaction-card" id="${esc(c.id)}">
        <div class="hub-interaction-card__top">
          <span class="hub-interaction-card__ico"><i class="fas fa-trophy" aria-hidden="true"></i></span>
          <span class="hub-interaction-badge ${badgeClass(c.status)}">${esc(c.status)}</span>
        </div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.blurb)}</p>
        <div class="hub-interaction-meta">
          <span>النوع: ${esc(c.type || 'مسابقة')}</span>
          <span>البداية: ${esc(fmtDate(c.startDate))}</span>
          <span>النهاية: ${esc(fmtDate(c.endDate || c.deadline))}</span>
          ${c.organizer ? `<span>المنظّم: ${esc(c.organizer)}</span>` : ''}
          ${c.prize ? `<span>الجائزة: ${esc(c.prize)}</span>` : ''}
        </div>
        ${c.rules ? `<p><strong>شروط المشاركة:</strong> ${esc(c.rules)}</p>` : ''}
        <div class="hub-interaction-actions">
          <a class="btn btn-secondary" href="${esc(c.href)}"><i class="fas fa-eye"></i> عرض التفاصيل</a>
          ${
            open
              ? `<a class="btn btn-primary" href="${esc(joinHref)}"><i class="fas fa-flag-checkered"></i> ${esc(joinLabel)}</a>`
              : `<button type="button" class="btn btn-secondary is-disabled" disabled>${esc(joinLabel)}</button>`
          }
        </div>
      </article>`;
    }).join('');
  };

  const newsItems = () => {
    const events = (window.HubMarketplaceData?.EVENTS || [])
      .filter((e) => e.status === 'قادمة')
      .map((e) => ({
        tag: 'فعالية قادمة',
        title: e.name,
        blurb: e.description,
        date: e.date,
        href: 'events.html',
      }));
    return [...events, ...NEWS];
  };

  const renderNews = (root) => {
    if (!root) return;
    const items = newsItems();
    if (!items.length) {
      root.innerHTML = emptyState('لا توجد أخبار معروضة حاليًا.');
      return;
    }
    root.innerHTML = items
      .map(
        (n) => `<a class="hub-interaction-card" href="${esc(n.href)}">
          <div class="hub-interaction-card__top">
            <span class="hub-interaction-card__ico"><i class="fas fa-newspaper" aria-hidden="true"></i></span>
            <span class="hub-interaction-badge">${esc(n.tag || 'خبر')}</span>
          </div>
          <h3>${esc(n.title)}</h3>
          <p>${esc(n.blurb)}</p>
          <div class="hub-interaction-meta">
            <span>النشر: ${esc(fmtDate(n.date))}</span>
          </div>
          <div class="hub-interaction-actions">
            <span class="btn btn-primary"><i class="fas fa-book-open"></i> قراءة الخبر</span>
          </div>
        </a>`
      )
      .join('');
  };

  const renderResearch = (root) => {
    if (!root) return;
    const pending = countPendingResearch();
    root.innerHTML =
      RESEARCH_TRACKS.map(
        (t) => `<article class="hub-interaction-card">
          <div class="hub-interaction-card__top">
            <span class="hub-interaction-card__ico"><i class="fas fa-flask" aria-hidden="true"></i></span>
            <span class="hub-interaction-badge">مسار نشر</span>
          </div>
          <h3>${esc(t.title)}</h3>
          <p>${esc(t.blurb)}</p>
          <div class="hub-interaction-actions">
            <a class="btn btn-primary" href="publish-research.html#publish-form"><i class="fas fa-paper-plane"></i> ابدأ النشر</a>
            <a class="btn btn-secondary" href="publish-research.html"><i class="fas fa-arrow-left"></i> صفحة النشر</a>
          </div>
        </article>`
      ).join('') +
      (pending
        ? `<p class="hub-interaction-note">لديك ${pending.toLocaleString('en-US')} بحثًا محفوظًا على هذا الجهاز بانتظار الإرسال.</p>`
        : '');
  };

  const renderAssess = (root) => {
    if (!root) return;
    if (!ASSESS_PATHS.length) {
      root.innerHTML = emptyState('لا توجد مسارات تقييم متاحة حاليًا.');
      return;
    }
    root.innerHTML = ASSESS_PATHS.map(
      (a) => `<a class="hub-interaction-card" href="${esc(a.href)}">
        <div class="hub-interaction-card__top">
          <span class="hub-interaction-card__ico"><i class="fas ${esc(a.icon)}" aria-hidden="true"></i></span>
          <span class="hub-interaction-badge">مسار تقييم</span>
        </div>
        <h3>${esc(a.title)}</h3>
        <p>${esc(a.blurb)}</p>
        <div class="hub-interaction-actions">
          <span class="btn btn-primary"><i class="fas fa-play"></i> ابدأ التقييم</span>
        </div>
      </a>`
    ).join('');
  };

  const renderCommunities = (root) => {
    if (!root) return;
    if (!COMMUNITIES.length) {
      root.innerHTML = emptyState('لا توجد مجتمعات معروضة حاليًا.');
      return;
    }
    root.innerHTML = COMMUNITIES.map(
      (c) => `<a class="hub-interaction-card" href="${esc(c.href)}">
        <div class="hub-interaction-card__top">
          <span class="hub-interaction-card__ico"><i class="fas ${esc(c.icon)}" aria-hidden="true"></i></span>
          <span class="hub-interaction-badge">${esc(c.type || 'مجتمع')}</span>
        </div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.blurb)}</p>
        <div class="hub-interaction-meta">
          <span>${esc(typeof c.meta === 'function' ? c.meta() : c.meta || '')}</span>
        </div>
        <div class="hub-interaction-actions">
          <span class="btn btn-primary"><i class="fas fa-right-to-bracket"></i> دخول المجتمع</span>
        </div>
      </a>`
    ).join('');
  };

  const renderInteractionPage = (root = document) => {
    renderCompetitions(root.querySelector('[data-hi-competitions]'));
    renderNews(root.querySelector('[data-hi-news]'));
    renderResearch(root.querySelector('[data-hi-research]'));
    renderAssess(root.querySelector('[data-hi-assess]'));
    renderCommunities(root.querySelector('[data-hi-communities]'));

    const nav = root.querySelector('[data-hi-nav]');
    if (nav) {
      const links = [...nav.querySelectorAll('a[href^="#"]')];
      const mark = () => {
        const y = window.scrollY + 160;
        let current = links[0];
        links.forEach((a) => {
          const id = a.getAttribute('href')?.slice(1);
          const el = id ? document.getElementById(id) : null;
          if (el && el.offsetTop <= y) current = a;
        });
        links.forEach((a) => a.classList.toggle('is-active', a === current));
      };
      window.addEventListener('scroll', mark, { passive: true });
      mark();
    }
  };

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
    newsItems,
    renderHome,
    renderInteractionPage,
    listBlock,
    esc,
  };
})();

(() => {
  const mount = () => {
    if (document.querySelector('[data-hub-interaction-page]')) {
      window.HubHomeEngage?.renderInteractionPage?.(document);
      return;
    }
    const root = document.querySelector('[data-hub-engage-grid]');
    if (!root || !window.HubHomeEngage) return;
    window.HubHomeEngage.renderHome(root);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
