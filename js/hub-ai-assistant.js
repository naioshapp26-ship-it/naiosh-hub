/**
 * وكيل الذكاء الاصطناعي — بنفس تجربة نايوش فيت:
 * زر روبوت عائم · بوابة دخول/ضيف · دردشة توجيه العميل داخل هوب.
 */
(() => {
  'use strict';

  if (window.__hubAiAssistantMounted) return;

  const LOGIN_HREF = 'login.html';
  const ASSET_PREFIX = (() => {
    const path = (window.location.pathname || '').replace(/\\/g, '/');
    return path.includes('/systems/') ? '../' : '';
  })();

  const KNOWLEDGE = [
    {
      keys: ['متجر', 'شراء', 'باقة', 'سعر', 'store', 'اشتر'],
      reply:
        'للشراء من متجر المبيعات: افتح «المتجر» من القائمة، اختر المنتج أو الخدمة، ثم «اشترِ الآن» أو أضف للسلة. الأسعار بالدولار بصيغة مثل 400$. بعد الشراء تُفعَّل الصلاحية ويمكنك دخول النظام المرتبط.',
      links: [{ href: 'store.html', label: 'فتح متجر المبيعات' }],
    },
    {
      keys: ['غرفة', 'عمليات', 'dashboard', 'لوحة'],
      reply:
        'غرفة العمليات هي لوحة السيادة التشغيلية. سجّل الدخول ثم اضغط «غرفة العمليات» لمتابعة المنتجات والمتجر والإعلانات والفروع والمؤشرات.',
      links: [{ href: 'dashboard.html', label: 'فتح غرفة العمليات' }],
    },
    {
      keys: ['تسجيل', 'دخول', 'login', 'حساب'],
      reply:
        'للردود الشخصية وغرف العمليات تحتاج تسجيل دخول. من زر «إنشاء حساب / تسجيل الدخول» أعلى الصفحة، أو من زر «تسجيل الدخول للمتابعة» داخل هذه النافذة.',
      links: [{ href: 'login.html', label: 'صفحة تسجيل الدخول' }],
    },
    {
      keys: ['فرع', 'فروع', 'branch'],
      reply:
        'صفحة الفروع تعرض شبكة نايوش حول العالم. ابحث بالدولة أو صفِّ حسب النوع (مكتب خاص · حاضنة · مسرعة)، ثم اعرض التفاصيل أو احجز زيارة.',
      links: [{ href: 'branches.html', label: 'عرض الفروع' }],
    },
    {
      keys: ['حاضن', 'incubator'],
      reply:
        'الحاضنات القطاعية تربط المشاريع بالمنصات والمكاتب. افتح «الحاضنات» لاستكشاف القطاع المناسب لمشروعك.',
      links: [{ href: 'incubators.html', label: 'فتح الحاضنات' }],
    },
    {
      keys: ['منصة', 'منصات', 'platform'],
      reply:
        'المنصات السيادية (18 منصة) تشغّل هوب. من صفحة المنصات أو غرفة العمليات يمكنك معرفة دور كل منصة وكودها.',
      links: [{ href: 'platforms.html', label: 'كتالوج المنصات' }],
    },
    {
      keys: ['دورة', 'دورات', 'دبلوم', 'أكاديم', 'تعلم', 'course'],
      reply:
        'للتعلم: افتح «الدورات» أو «الدبلومات»، راجع المستوى والمدة، ثم سجّل عبر المتجر. بعد التفعيل ادخل أكاديمية نايوش من زر الموقع الجاهز.',
      links: [
        { href: 'courses.html', label: 'الدورات' },
        { href: 'diplomas.html', label: 'الدبلومات' },
      ],
    },
    {
      keys: ['إعلان', 'اعلان', 'ads', 'تسويق'],
      reply:
        'استوديو الإعلانات يتيح نشر عروض المنتجات والمنصات. اختر المستوى التشغيلي، أضف العنوان والسعر بالدولار، ثم انشر أو أدر من غرفة العمليات.',
      links: [{ href: 'ads.html', label: 'استوديو الإعلانات' }],
    },
    {
      keys: ['مشروع', 'جانبي', 'فرصة', 'side'],
      reply:
        'محرك المشاريع الجانبية يساعدك تختار فرصة مناسبة لرأس مالك ومهاراتك. املأ بياناتك، راجع المخاطر، ثم سجّل المشروع للفريق أو اختبره على نطاق صغير.',
      links: [{ href: 'side-projects.html', label: 'المشاريع الجانبية' }],
    },
    {
      keys: ['نظام', 'أنظمة', 'apps', 'erp', 'فيت', 'fit'],
      reply:
        'من «الأنظمة» أو معرض المواقع الجاهزة افتح النظام المطلوب (ERP · FIT · Academy…). الاشتراك من المتجر يفعّل صلاحية الدخول، ثم زر «ادخل الموقع».',
      links: [{ href: 'apps.html', label: 'سجل الأنظمة' }],
    },
    {
      keys: ['سلة', 'cart', 'طلب'],
      reply:
        'السلة تجمع المنتجات قبل إتمام الشراء. أضف من المتجر ثم راجع الإجمالي بالدولار من صفحة السلة.',
      links: [{ href: 'cart.html', label: 'فتح السلة' }],
    },
    {
      keys: ['نقاط', 'رصيد', 'محفظة', 'شحن'],
      reply:
        'الرصيد بالنقاط يظهر في الهيرو/المحفظة. يمكنك الشحن من نافذة «إشحن رصيد» أو متابعة الخزينة من غرفة العمليات. بعض المنتجات تُشترى بالنقاط أو بالدولار.',
      links: [{ href: 'membership.html', label: 'العضوية والرصيد' }],
    },
    {
      keys: ['دعم', 'مساعدة', 'مشكلة', 'استفسار', 'ticket'],
      reply:
        'أنا وكيل توجيه داخل نايوش هوب: أرشدك للمتجر والأنظمة والفروع والحاضنات وغرفة العمليات. للدعم التشغيلي افتح صفحة الدعم أو سجّل الدخول لردود مرتبطة بملفك.',
      links: [{ href: 'support.html', label: 'مركز الدعم' }],
    },
  ];

  const DEFAULT_REPLY =
    'مرحباً بك في نايوش هوب 360. يمكنني توجيهك إلى: المتجر · الأنظمة · الدورات · الفروع · الحاضنات · الإعلانات · المشاريع الجانبية · غرفة العمليات. اكتب ماذا تريد بالضبط.';

  const resolveHref = (href) => {
    if (!href || /^https?:/i.test(href)) return href;
    return ASSET_PREFIX + href.replace(/^\.\//, '');
  };

  const localReply = (message) => {
    const q = String(message || '').toLowerCase();
    const hit = KNOWLEDGE.find((row) => row.keys.some((k) => q.includes(String(k).toLowerCase())));
    if (!hit) {
      return { response: DEFAULT_REPLY, links: [{ href: 'index.html', label: 'الصفحة الرئيسية' }, { href: 'store.html', label: 'المتجر' }] };
    }
    return { response: hit.reply, links: hit.links || [] };
  };

  const formatLinks = (links) => {
    if (!links?.length) return '';
    return (
      '\n\n' +
      links
        .map((l) => `→ ${l.label}: ${resolveHref(l.href)}`)
        .join('\n')
    );
  };

  const askServer = async (message) => {
    try {
      const res = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          language: 'ar',
          path: window.location.pathname,
          guest: !(window.HubAuth && window.HubAuth.isLoggedIn && window.HubAuth.isLoggedIn()),
        }),
      });
      if (!res.ok) throw new Error('api');
      const data = await res.json();
      if (!data?.response) throw new Error('empty');
      return data.response;
    } catch (_) {
      const local = localReply(message);
      return local.response + formatLinks(local.links);
    }
  };

  const ensureCss = () => {
    if (document.querySelector('link[data-hub-ai-css]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${ASSET_PREFIX}css/hub-ai-assistant.css?v=1`;
    link.setAttribute('data-hub-ai-css', '1');
    document.head.appendChild(link);
  };

  const timeLabel = (date) =>
    date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  const init = () => {
    try {
    if (window.__hubAiAssistantMounted || document.querySelector('[data-ai-assistant-widget]')) return;
    window.__hubAiAssistantMounted = true;
    ensureCss();

    const loggedIn = !!(window.HubAuth && window.HubAuth.isLoggedIn && window.HubAuth.isLoggedIn());
    let open = false;
    let guest = loggedIn;
    let busy = false;
    const messages = [];

    const root = document.createElement('div');
    root.setAttribute('data-ai-assistant-root', '1');
    root.innerHTML = `
      <div class="hub-ai-panel" data-ai-assistant-widget hidden>
        <button type="button" class="hub-ai-close" data-ai-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        <div class="hub-ai-body">
          <div class="hub-ai-card is-active" data-ai-gate>
            <div class="hub-ai-head">
              <h3 class="hub-ai-head-title"><i class="fas fa-robot"></i> وكيل الذكاء الاصطناعي</h3>
              <p class="hub-ai-head-lead">يمكنك تسجيل الدخول للحصول على ردود شخصية، أو المتابعة كضيف للدردشة العامة.</p>
            </div>
            <div class="hub-ai-gate">
              <div>
                <div class="hub-ai-welcome">مرحباً! اختر بين تسجيل الدخول للحصول على نصائح مخصصة لملفك، أو المتابعة كضيف لبدء دردشة سريعة الآن.</div>
                <span class="hub-ai-chip">متاح من أي صفحة عامة</span>
              </div>
              <div class="hub-ai-actions">
                <a class="hub-ai-btn hub-ai-btn-primary" href="${resolveHref(LOGIN_HREF)}"><i class="fas fa-right-to-bracket"></i> تسجيل الدخول للمتابعة</a>
                <button type="button" class="hub-ai-btn hub-ai-btn-guest" data-ai-guest><i class="fas fa-user"></i> المتابعة كضيف</button>
              </div>
            </div>
          </div>
          <div class="hub-ai-card" data-ai-chat>
            <div class="hub-ai-head">
              <h3 class="hub-ai-head-title"><i class="fas fa-robot"></i> وكيل الذكاء الاصطناعي</h3>
              <p class="hub-ai-head-lead" data-ai-mode-lead>أنت في وضع الضيف — احصل على إرشادات عامة داخل نايوش هوب.</p>
              <span class="hub-ai-chip" data-ai-mode-chip>وضع الضيف: إجابات عامة</span>
            </div>
            <div class="hub-ai-chat">
              <div class="hub-ai-messages" data-ai-messages></div>
              <div class="hub-ai-composer">
                <input type="text" data-ai-input placeholder="اطرح سؤالك..." autocomplete="off" />
                <button type="button" data-ai-send aria-label="إرسال"><i class="fas fa-paper-plane"></i></button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button type="button" class="hub-ai-fab" data-ai-assistant-trigger aria-label="وكيل الذكاء الاصطناعي" title="وكيل الذكاء الاصطناعي">
        <i class="fas fa-robot"></i>
      </button>
    `;
    document.body.appendChild(root);

    const panel = root.querySelector('[data-ai-assistant-widget]');
    const gate = root.querySelector('[data-ai-gate]');
    const chat = root.querySelector('[data-ai-chat]');
    const messagesEl = root.querySelector('[data-ai-messages]');
    const input = root.querySelector('[data-ai-input]');
    const sendBtn = root.querySelector('[data-ai-send]');
    const modeLead = root.querySelector('[data-ai-mode-lead]');
    const modeChip = root.querySelector('[data-ai-mode-chip]');

    const setOpen = (next) => {
      open = next;
      panel.hidden = !open;
      panel.classList.toggle('is-open', open);
      if (open && loggedIn) enterChat(false);
      if (open && !loggedIn && !guest) {
        gate.classList.add('is-active');
        chat.classList.remove('is-active');
      }
    };

    const enterChat = (asGuest) => {
      guest = asGuest || loggedIn;
      gate.classList.remove('is-active');
      chat.classList.add('is-active');
      if (loggedIn && !asGuest) {
        modeLead.textContent = 'اسأل عن المسارات أو المنتجات أو غرفة العمليات — وأوجّهك خطوة بخطوة.';
        modeChip.textContent = 'مدعوم بجلسة الدخول داخل هوب';
      } else {
        modeLead.textContent = 'أنت في وضع الضيف — احصل على إرشادات عامة داخل نايوش هوب.';
        modeChip.textContent = 'وضع الضيف: إجابات عامة';
      }
      renderMessages();
      input.focus();
    };

    const renderMessages = () => {
      if (!messages.length) {
        messagesEl.innerHTML = `
          <div class="hub-ai-empty">
            <i class="fas fa-robot"></i>
            <strong>مرحباً! كيف يمكنني مساعدتك اليوم؟</strong>
            <p>اسألني عن المتجر، الأنظمة، الدورات، الفروع، الحاضنات، أو غرفة العمليات داخل نايوش هوب.</p>
          </div>`;
        return;
      }
      messagesEl.innerHTML = messages
        .map(
          (m) => `
        <div class="hub-ai-row ${m.role === 'user' ? 'is-user' : ''}">
          <span class="hub-ai-avatar"><i class="fas ${m.role === 'user' ? 'fa-user' : 'fa-robot'}"></i></span>
          <div class="hub-ai-bubble">
            <p></p>
            <time>${timeLabel(m.at)}</time>
          </div>
        </div>`
        )
        .join('');
      Array.from(messagesEl.querySelectorAll('.hub-ai-bubble p')).forEach((p, i) => {
        p.textContent = messages[i].content;
      });
      if (busy) {
        messagesEl.insertAdjacentHTML(
          'beforeend',
          `<div class="hub-ai-row"><span class="hub-ai-avatar"><i class="fas fa-robot"></i></span>
            <div class="hub-ai-bubble"><div class="hub-ai-thinking"><i class="fas fa-spinner fa-spin"></i> جاري التفكير...</div></div></div>`
        );
      }
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const send = async () => {
      const text = (input.value || '').trim();
      if (!text || busy || (!guest && !loggedIn)) return;
      messages.push({ role: 'user', content: text, at: new Date() });
      input.value = '';
      busy = true;
      sendBtn.disabled = true;
      renderMessages();
      const reply = await askServer(text);
      messages.push({ role: 'assistant', content: reply, at: new Date() });
      busy = false;
      sendBtn.disabled = false;
      renderMessages();
    };

    root.querySelector('[data-ai-assistant-trigger]').addEventListener('click', () => setOpen(!open));
    root.querySelector('[data-ai-close]').addEventListener('click', () => setOpen(false));
    root.querySelector('[data-ai-guest]').addEventListener('click', () => enterChat(true));
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    if (loggedIn) {
      // Skip gate when already authenticated — same idea as Fit personalized mode
      enterChat(false);
      setOpen(false);
    }
    } catch (err) {
      console.error('[Hub AI Assistant] init failed', err);
      window.__hubAiAssistantMounted = false;
    }
  };

  const boot = () => init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
  window.addEventListener('load', () => {
    if (!document.querySelector('[data-ai-assistant-root]')) boot();
  });
})();
