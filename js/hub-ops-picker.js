/**
 * UI اختيار الأنظمة/الوحدات حسب حاجة العميل — يستخدم HubOpsCatalog
 */
(() => {
  'use strict';

  const esc = (v) =>
    String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const stateOf = (root) => {
    if (!root._opsPick) {
      root._opsPick = {
        mode: '',
        openSystemId: '',
        selected: {
          // systemId -> { full:bool, modules:Set }
        },
      };
    }
    return root._opsPick;
  };

  const getSelection = (root) => {
    const st = stateOf(root);
    const items = [];
    Object.entries(st.selected).forEach(([systemId, row]) => {
      if (row.full) {
        items.push({ kind: 'system', systemId, full: true });
        return;
      }
      [...(row.modules || [])].forEach((moduleId) => {
        const mod = window.HubOpsCatalog?.getModule?.(moduleId);
        items.push({
          kind: 'module',
          systemId,
          moduleId,
          standalone: mod?.canStandalone !== false,
          hideParent: !!mod?.hideParentDefault,
        });
      });
    });
    return {
      mode: st.mode || 'by_need',
      items,
    };
  };

  const countSelected = (root) => getSelection(root).items.length;

  const syncProxy = (root) => {
    const proxy = root.querySelector('[data-systems-required]');
    if (!proxy) return;
    const required = root.getAttribute('data-ops-required') !== '0';
    const n = countSelected(root);
    const hasMode = !!stateOf(root).mode;
    proxy.required = required;
    proxy.value = n && hasMode ? String(n) : '';
    if (!required) {
      proxy.setCustomValidity('');
      return;
    }
    if (!hasMode) {
      proxy.setCustomValidity('اختر طريقة تشغيل نايوش هوب');
      return;
    }
    proxy.setCustomValidity(n ? '' : 'اختر نظامًا أو وحدة تشغيلية واحدة على الأقل');
  };

  const ensureSystemRow = (st, systemId) => {
    if (!st.selected[systemId]) st.selected[systemId] = { full: false, modules: new Set() };
    return st.selected[systemId];
  };

  const render = (root) => {
    if (!root || !window.HubOpsCatalog) return;
    window.HubOpsCatalog.ensure();
    const st = stateOf(root);
    const systems = window.HubOpsCatalog.listSystems({ activeOnly: true, includeUmbrella: false });
    const hub = window.HubOpsCatalog.getSystem('HUB');

    const modeHtml = `
      <div class="ops-pick-mode" role="radiogroup" aria-label="كيف تريد تشغيل نايوش هوب؟">
        <h3 class="ops-pick-q">كيف تريد تشغيل نايوش هوب؟</h3>
        <label class="ops-pick-mode-card ${st.mode === 'hub_comprehensive' ? 'is-on' : ''}">
          <input type="radio" name="ops-mode-${esc(root.id || 'main')}" value="hub_comprehensive" ${
            st.mode === 'hub_comprehensive' ? 'checked' : ''
          } data-ops-mode />
          <span>
            <strong>تشغيل شمولي عبر نايوش هوب</strong>
            <small>${esc(hub?.description || 'تشغيل متكامل يجمع الأنظمة والوحدات التي يحتاجها العميل داخل تجربة موحدة.')}</small>
          </span>
        </label>
        <label class="ops-pick-mode-card ${st.mode === 'by_need' ? 'is-on' : ''}">
          <input type="radio" name="ops-mode-${esc(root.id || 'main')}" value="by_need" ${
            st.mode === 'by_need' ? 'checked' : ''
          } data-ops-mode />
          <span>
            <strong>اختيار أنظمة ووحدات حسب الحاجة</strong>
            <small>اختر فقط ما يحتاجه عملك — يمكن منح وحدة واحدة دون تفعيل النظام الأب كاملًا.</small>
          </span>
        </label>
      </div>`;

    const needsPanel = st.mode === 'hub_comprehensive' || st.mode === 'by_need';
    const title =
      st.mode === 'hub_comprehensive'
        ? 'حدّد الأنظمة والوحدات ضمن التشغيل الشمولي'
        : 'اختر احتياجات عملك';

    const cards = systems
      .map((sys) => {
        const row = st.selected[sys.id] || { full: false, modules: new Set() };
        const mods = window.HubOpsCatalog.listModules(sys.id, { activeOnly: true });
        const open = st.openSystemId === sys.id;
        const selectedCount = row.full ? mods.length : row.modules?.size || 0;
        const modulesHtml =
          open && mods.length
            ? `<div class="ops-pick-modules">
                <label class="ops-pick-mod">
                  <input type="checkbox" data-ops-full="${esc(sys.id)}" ${row.full ? 'checked' : ''} />
                  <span><strong>النظام الكامل</strong> — كل وحدات ${esc(sys.shortName || sys.code)}</span>
                </label>
                ${mods
                  .map((m) => {
                    const checked = row.full || row.modules?.has(m.id);
                    return `<label class="ops-pick-mod">
                      <input type="checkbox" data-ops-mod="${esc(m.id)}" data-ops-sys="${esc(sys.id)}" ${
                        checked ? 'checked' : ''
                      } ${row.full ? 'disabled' : ''} />
                      <span>
                        <strong>${esc(m.name)}</strong>
                        <small>${esc(m.description)}</small>
                        ${
                          m.canStandalone
                            ? '<em class="ops-tag">يمكن تشغيلها مستقلة</em>'
                            : ''
                        }
                        ${m.hideParentDefault ? '<em class="ops-tag is-hide">إخفاء اسم النظام الأب</em>' : ''}
                      </span>
                    </label>`;
                  })
                  .join('')}
              </div>`
            : open
              ? '<p class="ops-pick-empty-mod">لا وحدات معرفة بعد — يمكن منح النظام كاملًا من الإدارة.</p>'
              : '';

        return `<article class="ops-pick-card ${selectedCount ? 'is-selected' : ''}" data-ops-card="${esc(sys.id)}">
          <div class="ops-pick-card-head">
            <div class="ops-pick-card-title">
              <i class="fas ${esc(sys.icon || 'fa-cube')}"></i>
              <div>
                <strong>${esc(sys.name)}</strong>
                <small>${esc(sys.description)}</small>
              </div>
            </div>
            <div class="ops-pick-card-meta">
              ${selectedCount ? `<span class="ops-pick-count">${selectedCount} مختار</span>` : ''}
              <button type="button" class="ops-pick-toggle" data-ops-toggle="${esc(sys.id)}">
                ${open ? 'إخفاء الوحدات' : 'عرض الوحدات'}
              </button>
            </div>
          </div>
          ${modulesHtml}
        </article>`;
      })
      .join('');

    root.innerHTML = `
      ${modeHtml}
      ${
        needsPanel
          ? `<div class="ops-pick-needs">
              <h3 class="ops-pick-q">${esc(title)}</h3>
              <p class="ops-pick-lead">نايوش هوب هو المظلة. يمكنك اختيار نظام كامل أو وحدة واحدة فقط (مثل المخزون من ERP) دون منح باقي الوحدات.</p>
              <div class="ops-pick-grid">${cards}</div>
            </div>`
          : ''
      }
      <input type="text" tabindex="-1" aria-hidden="true" data-systems-required autocomplete="off" />
    `;

    root.querySelectorAll('[data-ops-mode]').forEach((el) => {
      el.addEventListener('change', () => {
        st.mode = el.value;
        render(root);
        root.dispatchEvent(new CustomEvent('ops-pick-change', { bubbles: true, detail: getSelection(root) }));
      });
    });

    root.querySelectorAll('[data-ops-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ops-toggle');
        st.openSystemId = st.openSystemId === id ? '' : id;
        render(root);
      });
    });

    root.querySelectorAll('[data-ops-full]').forEach((el) => {
      el.addEventListener('change', () => {
        const systemId = el.getAttribute('data-ops-full');
        const row = ensureSystemRow(st, systemId);
        row.full = el.checked;
        if (row.full) row.modules = new Set();
        render(root);
        root.dispatchEvent(new CustomEvent('ops-pick-change', { bubbles: true, detail: getSelection(root) }));
      });
    });

    root.querySelectorAll('[data-ops-mod]').forEach((el) => {
      el.addEventListener('change', () => {
        const systemId = el.getAttribute('data-ops-sys');
        const moduleId = el.getAttribute('data-ops-mod');
        const row = ensureSystemRow(st, systemId);
        if (!row.modules) row.modules = new Set();
        if (el.checked) row.modules.add(moduleId);
        else row.modules.delete(moduleId);
        row.full = false;
        render(root);
        root.dispatchEvent(new CustomEvent('ops-pick-change', { bubbles: true, detail: getSelection(root) }));
      });
    });

    syncProxy(root);
  };

  const mount = (root, { required = true } = {}) => {
    if (!root) return null;
    root.setAttribute('data-ops-required', required ? '1' : '0');
    render(root);
    return {
      getSelection: () => getSelection(root),
      getEntitlements: () => window.HubOpsCatalog.resolveEntitlements(getSelection(root)),
      refresh: () => render(root),
      validate: () => {
        syncProxy(root);
        const proxy = root.querySelector('[data-systems-required]');
        return !proxy || proxy.checkValidity();
      },
    };
  };

  window.HubOpsPicker = { mount, getSelection, render };
})();
