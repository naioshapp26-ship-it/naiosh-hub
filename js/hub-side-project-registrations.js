/**
 * سجل طلبات تسجيل المشاريع الجانبية — يستقبله فريق هوب للمتابعة والتواصل
 */
(() => {
  'use strict';

  const KEY = 'naiosh_side_project_registrations_v1';
  const STATUSES = ['جديد', 'قيد المتابعة', 'تم التواصل', 'مقبول', 'مرفوض', 'مغلق'];

  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };

  const save = (list) => {
    const next = (Array.isArray(list) ? list : []).slice(0, 200);
    localStorage.setItem(KEY, JSON.stringify(next));
    try {
      window.dispatchEvent(new CustomEvent('hub-sp-registrations-changed'));
    } catch (_) {}
    return next;
  };

  const normalizeContact = (payload = {}) => {
    const phone = String(payload.phone || '').trim();
    const email = String(payload.email || '').trim();
    if (!phone && !email) return { ok: false, error: 'أضف رقم جوال أو بريداً إلكترونياً للتواصل' };
    return { ok: true, phone, email };
  };

  const create = (payload = {}) => {
    const contact = normalizeContact(payload);
    if (!contact.ok) return { ok: false, error: contact.error };
    const ownerName = String(payload.ownerName || '').trim();
    const projectName = String(payload.projectName || '').trim();
    if (!ownerName) return { ok: false, error: 'اسم صاحب المشروع مطلوب' };
    if (!projectName) return { ok: false, error: 'اسم المشروع مطلوب' };

    const record = {
      id: payload.id || `reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      projectId: String(payload.projectId || ''),
      projectName,
      ownerName,
      phone: contact.phone,
      email: contact.email,
      preferredContact: payload.preferredContact || (contact.phone ? 'جوال' : 'إيميل'),
      country: String(payload.country || '').trim(),
      education: String(payload.education || '').trim(),
      experienceYears: Number(payload.experienceYears || 0),
      experience1: String(payload.experience1 || '').trim(),
      experience2: String(payload.experience2 || '').trim(),
      experience3: String(payload.experience3 || '').trim(),
      fileDoc: payload.fileDoc || null,
      fileImage: payload.fileImage || null,
      fileVideo: payload.fileVideo || null,
      currentWork: String(payload.currentWork || '').trim(),
      commercialOrNotes: String(payload.commercialOrNotes || '').trim(),
      status: 'جديد',
      adminNotes: [],
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const list = read().filter((x) => x.id !== record.id);
    list.unshift(record);
    save(list);

    try {
      window.HubStore?.pushNotification?.({
        source: 'SIDE-PROJECTS',
        sourceName: 'المشاريع الجانبية',
        title: 'طلب تسجيل مشروع جديد',
        body: `${record.ownerName} · ${record.projectName} · ${record.phone || record.email}`,
        level: 'info',
        category: 'side-projects',
        link: 'dashboard.html#side-project-regs',
        meta: { registrationId: record.id },
      });
    } catch (_) {}

    return { ok: true, record };
  };

  const get = (id) => read().find((x) => String(x.id) === String(id)) || null;

  const setStatus = (id, status, note = '') => {
    if (!STATUSES.includes(status)) return null;
    const list = read();
    const idx = list.findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return null;
    const item = { ...list[idx] };
    item.status = status;
    item.updatedAt = new Date().toISOString();
    if (note && String(note).trim()) {
      item.adminNotes = [
        ...(item.adminNotes || []),
        { at: item.updatedAt, status, note: String(note).trim() },
      ];
    } else {
      item.adminNotes = [
        ...(item.adminNotes || []),
        { at: item.updatedAt, status, note: `تغيير الحالة إلى ${status}` },
      ];
    }
    list[idx] = item;
    save(list);
    return item;
  };

  const addNote = (id, note) => {
    const text = String(note || '').trim();
    if (!text) return null;
    const list = read();
    const idx = list.findIndex((x) => String(x.id) === String(id));
    if (idx < 0) return null;
    const item = { ...list[idx] };
    item.updatedAt = new Date().toISOString();
    item.adminNotes = [...(item.adminNotes || []), { at: item.updatedAt, status: item.status, note: text }];
    list[idx] = item;
    save(list);
    return item;
  };

  const remove = (id) => save(read().filter((x) => String(x.id) !== String(id)));

  const counts = () => {
    const list = read();
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    list.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    return { total: list.length, byStatus, newCount: byStatus['جديد'] || 0 };
  };

  const escHtml = (v = '') =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const fileLabel = (f, fallback = '—') => {
    if (!f || !f.name) return fallback;
    const size = f.size != null ? ` (${Math.round(Number(f.size) / 1024)} KB)` : '';
    return `${f.name}${size}`;
  };

  const detailsHtml = (r) => {
    if (!r) return '<p>الطلب غير موجود.</p>';
    const phone = String(r.phone || '').replace(/\s+/g, '');
    const wa = phone ? `https://wa.me/${phone.replace(/[^\d+]/g, '').replace(/^0/, '966')}` : '';
    const rows = [
      ['اسم المشروع', r.projectName],
      ['اسم صاحب المشروع', r.ownerName],
      ['رقم الجوال', r.phone],
      ['البريد الإلكتروني', r.email],
      ['وسيلة التواصل المفضّلة', r.preferredContact],
      ['الدولة', r.country],
      ['المستوى العلمي', r.education],
      ['سنوات الخبرة', r.experienceYears],
      ['مجال الخبرة 1', r.experience1],
      ['مجال الخبرة 2', r.experience2 || '—'],
      ['مجال الخبرة 3', r.experience3 || '—'],
      ['رفع ملف', fileLabel(r.fileDoc)],
      ['رفع صورة', fileLabel(r.fileImage)],
      ['رفع فيديو', fileLabel(r.fileVideo)],
      ['هل لديك عمل حالي؟', r.currentWork || '—'],
      ['سجل تجاري / معلومات أخرى', r.commercialOrNotes || '—'],
      ['حالة الطلب', r.status || 'جديد'],
      ['تاريخ التسجيل', r.createdAt ? new Date(r.createdAt).toLocaleString('en-US') : '—'],
    ];
    const notes = (r.adminNotes || [])
      .slice()
      .reverse()
      .map(
        (n) =>
          `<li><strong>${escHtml(n.status || r.status)}</strong> — ${escHtml(n.note || '')} <small>${escHtml(
            n.at ? new Date(n.at).toLocaleString('en-US') : ''
          )}</small></li>`
      )
      .join('');

    return `
      <div class="sp-reg-details">
        <div class="sp-reg-details-contact">
          ${r.phone ? `<a class="btn btn-primary" href="tel:${escHtml(phone)}"><i class="fas fa-phone"></i> اتصال</a>` : ''}
          ${wa ? `<a class="btn btn-secondary" href="${escHtml(wa)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> واتساب</a>` : ''}
          ${r.email ? `<a class="btn btn-secondary" href="mailto:${escHtml(r.email)}"><i class="fas fa-envelope"></i> إيميل</a>` : ''}
        </div>
        <dl class="sp-reg-details-grid">
          ${rows
            .map(
              ([label, value]) =>
                `<div><dt>${escHtml(label)}</dt><dd>${escHtml(value == null || value === '' ? '—' : value)}</dd></div>`
            )
            .join('')}
        </dl>
        <div class="sp-reg-details-notes">
          <h4>ملاحظات متابعة الفريق</h4>
          ${notes ? `<ul>${notes}</ul>` : '<p>لا ملاحظات بعد.</p>'}
        </div>
      </div>`;
  };

  const ensureDetailsModal = () => {
    let modal = document.getElementById('sp-reg-details-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'sp-reg-details-modal';
    modal.className = 'sp-reg-details-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="sp-reg-details-modal__backdrop" data-sp-details-close aria-hidden="true"></div>
      <div class="sp-reg-details-modal__panel" role="dialog" aria-modal="true" aria-labelledby="sp-reg-details-title">
        <header class="sp-reg-details-modal__head">
          <div>
            <p class="sp-reg-details-kicker"><i class="fas fa-file-lines"></i> تفاصيل طلب التسجيل</p>
            <h2 id="sp-reg-details-title">تفاصيل الطلب</h2>
          </div>
          <button type="button" class="sp-reg-details-close" data-sp-details-close aria-label="إغلاق"><i class="fas fa-xmark"></i></button>
        </header>
        <div class="sp-reg-details-modal__body" id="sp-reg-details-body"></div>
        <footer class="sp-reg-details-modal__foot">
          <button type="button" class="btn btn-secondary" data-sp-details-close>إغلاق</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target.closest('[data-sp-details-close]')) closeDetails(modal);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.hidden) closeDetails(modal);
    });
    return modal;
  };

  const closeDetails = (modal) => {
    const el = modal || document.getElementById('sp-reg-details-modal');
    if (!el) return;
    el.hidden = true;
    document.body.classList.remove('sp-reg-details-open');
  };

  const openDetails = (id) => {
    const record = get(id);
    const modal = ensureDetailsModal();
    const title = modal.querySelector('#sp-reg-details-title');
    const body = modal.querySelector('#sp-reg-details-body');
    if (title) title.textContent = record?.projectName || 'تفاصيل الطلب';
    if (body) body.innerHTML = detailsHtml(record);
    modal.hidden = false;
    document.body.classList.add('sp-reg-details-open');
    return record;
  };

  window.HubSideProjectRegistrations = {
    KEY,
    STATUSES,
    read,
    create,
    get,
    setStatus,
    addNote,
    remove,
    counts,
    detailsHtml,
    openDetails,
    closeDetails,
  };
})();
