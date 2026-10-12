/**
 * Unified free-form branch + geolocation + map picker.
 * Map: Google Maps (optional keys) OR Leaflet + OpenStreetMap (default, no keys).
 * Geocode: server /api/hub/geo/reverse (Google or Nominatim).
 * window.HubGeoBranch.mount / collect / upgradeForm / mountAll
 */
(function () {
  'use strict';

  var mapsLoader = null;
  var leafletLoader = null;
  var configCache = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin',
      cache: 'no-store',
    });
    var j = await res.json().catch(function () {
      return {};
    });
    if (!res.ok) {
      var err = new Error(j.error || j.message || 'فشل الطلب');
      err.status = res.status;
      err.payload = j;
      throw err;
    }
    return j;
  }

  async function getConfig() {
    if (configCache) return configCache;
    try {
      configCache = await api('/api/hub/geo/config');
    } catch (e) {
      configCache = { mapsEnabled: false, browserMapsEnabled: false, geocodeEnabled: false, browserKey: '', note: e.message };
    }
    return configCache;
  }

  function loadGoogleMaps(key) {
    if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
    if (mapsLoader) return mapsLoader;
    if (!key) return Promise.reject(new Error('لا يوجد مفتاح خرائط متصفح'));
    mapsLoader = new Promise(function (resolve, reject) {
      var cb = '__hubGeoMapsReady_' + Date.now();
      window[cb] = function () {
        try {
          delete window[cb];
        } catch (e) {
          /* */
        }
        if (window.google && window.google.maps) resolve(window.google.maps);
        else reject(new Error('تعذّر تحميل Google Maps'));
      };
      var s = document.createElement('script');
      s.async = true;
      s.src =
        'https://maps.googleapis.com/maps/api/js?key=' +
        encodeURIComponent(key) +
        '&libraries=places&language=ar&callback=' +
        cb;
      s.onerror = function () {
        mapsLoader = null;
        reject(new Error('فشل تحميل سكربت Google Maps'));
      };
      document.head.appendChild(s);
    });
    return mapsLoader;
  }

  function loadLeaflet() {
    if (window.L && window.L.map) return Promise.resolve(window.L);
    if (leafletLoader) return leafletLoader;
    leafletLoader = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-hub-leaflet-css]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';
        link.setAttribute('data-hub-leaflet-css', '1');
        document.head.appendChild(link);
      }
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
      s.async = true;
      s.onload = function () {
        if (window.L && window.L.map) resolve(window.L);
        else reject(new Error('تعذّر تهيئة Leaflet'));
      };
      s.onerror = function () {
        leafletLoader = null;
        reject(new Error('فشل تحميل مكتبة الخريطة (Leaflet)'));
      };
      document.head.appendChild(s);
    });
    return leafletLoader;
  }

  function moveMarker(st, lat, lng, zoom) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (st.mapEngine === 'leaflet' && st.map && st.marker && window.L) {
      st.marker.setLatLng([lat, lng]);
      st.map.setView([lat, lng], zoom != null ? zoom : st.map.getZoom());
      return;
    }
    if (st.mapEngine === 'google' && st.map && st.marker && window.google) {
      var pos = { lat: lat, lng: lng };
      st.map.setCenter(pos);
      st.marker.setPosition(pos);
      if (zoom != null) st.map.setZoom(zoom);
    }
  }

  function stateOf(host) {
    return host._hubGeoState || (host._hubGeoState = {});
  }

  function setStatus(host, msg, kind) {
    var el = host.querySelector('[data-geo-status]');
    if (!el) return;
    el.textContent = msg || '';
    el.classList.remove('is-error', 'is-ok');
    if (kind === 'error') el.classList.add('is-error');
    if (kind === 'ok') el.classList.add('is-ok');
  }

  function readFields(host) {
    return {
      branchName: String(host.querySelector('[data-geo-branch]')?.value || '').trim(),
      country: String(host.querySelector('[data-geo-country]')?.value || '').trim(),
      city: String(host.querySelector('[data-geo-city]')?.value || '').trim(),
      address: String(host.querySelector('[data-geo-address]')?.value || '').trim(),
    };
  }

  function applyGeoResult(host, geo, source) {
    var st = stateOf(host);
    st.lat = geo.lat;
    st.lng = geo.lng;
    st.source = source || st.source || 'map';
    st.confirmed = false;
    if (geo.country && host.querySelector('[data-geo-country]')) host.querySelector('[data-geo-country]').value = geo.country;
    if (geo.city && host.querySelector('[data-geo-city]')) host.querySelector('[data-geo-city]').value = geo.city;
    if (geo.formattedAddress && host.querySelector('[data-geo-address]')) {
      host.querySelector('[data-geo-address]').value = geo.formattedAddress;
    }
    var branchEl = host.querySelector('[data-geo-branch]');
    if (branchEl && !branchEl.value && (geo.city || geo.country)) {
      branchEl.value = [geo.city, geo.country].filter(Boolean).join(' — ');
    }
    updatePreview(host);
    if (Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      moveMarker(st, geo.lat, geo.lng, 14);
    }
    syncHidden(host);
  }

  function updatePreview(host) {
    var st = stateOf(host);
    var box = host.querySelector('[data-geo-preview]');
    if (!box) return;
    var f = readFields(host);
    var has = f.country || f.city || f.address || (st.lat != null && st.lng != null);
    box.hidden = !has;
    box.innerHTML =
      '<div><strong>البلد:</strong> ' +
      esc(f.country || '—') +
      '</div>' +
      '<div><strong>المدينة:</strong> ' +
      esc(f.city || '—') +
      '</div>' +
      '<div><strong>العنوان التقريبي:</strong> ' +
      esc(f.address || '—') +
      '</div>' +
      (st.lat != null
        ? '<div dir="ltr"><strong>الإحداثيات:</strong> ' + esc(String(st.lat)) + ', ' + esc(String(st.lng)) + '</div>'
        : '') +
      (st.lat != null
        ? '<div class="hub-geo-earth"><a href="https://www.openstreetmap.org/?mlat=' +
          encodeURIComponent(st.lat) +
          '&mlon=' +
          encodeURIComponent(st.lng) +
          '#map=16/' +
          encodeURIComponent(st.lat) +
          '/' +
          encodeURIComponent(st.lng) +
          '" target="_blank" rel="noopener">عرض على OpenStreetMap</a></div>'
        : '');
  }

  function syncHidden(host) {
    var st = stateOf(host);
    var f = readFields(host);
    var set = function (name, val) {
      var el = host.querySelector('[data-geo-hidden="' + name + '"]');
      if (el) el.value = val == null ? '' : String(val);
    };
    set('branch', f.branchName);
    set('branchName', f.branchName);
    set('branchLabel', f.branchName);
    set('country', f.country);
    set('city', f.city);
    set('address', f.address);
    set('lat', st.lat != null ? st.lat : '');
    set('lng', st.lng != null ? st.lng : '');
    set('locationSource', st.source || 'manual');
    set('locationConfirmed', st.confirmed ? '1' : '');
    // Also mirror into form fields named country/branch if outside host siblings were removed
    var form = host.closest('form');
    if (form) {
      var branchField = form.querySelector('[name="branch"]:not([data-geo-hidden])');
      var countryField = form.querySelector('[name="country"]:not([data-geo-hidden])');
      if (branchField && branchField !== host.querySelector('[data-geo-branch]')) {
        if (branchField.tagName === 'SELECT') {
          // keep a synthetic option for free-text value
          var exists = [...branchField.options].some(function (o) {
            return o.value === f.branchName;
          });
          if (!exists && f.branchName) {
            var opt = document.createElement('option');
            opt.value = f.branchName;
            opt.textContent = f.branchName;
            branchField.appendChild(opt);
          }
          branchField.disabled = false;
          branchField.value = f.branchName;
        } else {
          branchField.value = f.branchName;
        }
      }
      if (countryField && countryField !== host.querySelector('[data-geo-country]')) {
        if (countryField.tagName === 'SELECT') {
          var existsC = [...countryField.options].some(function (o) {
            return o.value === f.country;
          });
          if (!existsC && f.country) {
            var optC = document.createElement('option');
            optC.value = f.country;
            optC.textContent = f.country;
            countryField.appendChild(optC);
          }
          countryField.disabled = false;
          countryField.value = f.country;
        } else {
          countryField.value = f.country;
        }
      }
    }
  }

  async function reverseViaServer(lat, lng) {
    return api('/api/hub/geo/reverse', { method: 'POST', body: { lat: lat, lng: lng } });
  }

  async function reverseViaBrowser(lat, lng) {
    if (!(window.google && google.maps && google.maps.Geocoder)) {
      throw new Error('Geocoder غير متاح');
    }
    var geocoder = new google.maps.Geocoder();
    return new Promise(function (resolve, reject) {
      geocoder.geocode({ location: { lat: lat, lng: lng }, language: 'ar' }, function (results, status) {
        if (status !== 'OK' || !results || !results[0]) {
          reject(new Error('تعذّر استخراج العنوان من الإحداثيات'));
          return;
        }
        var r = results[0];
        var comps = r.address_components || [];
        var find = function (type) {
          var c = comps.find(function (x) {
            return (x.types || []).indexOf(type) >= 0;
          });
          return c ? c.long_name : '';
        };
        resolve({
          ok: true,
          lat: lat,
          lng: lng,
          formattedAddress: r.formatted_address || '',
          country: find('country'),
          city: find('locality') || find('administrative_area_level_2') || find('administrative_area_level_1'),
        });
      });
    });
  }

  async function resolveCoords(host, lat, lng, source) {
    setStatus(host, 'جاري استخراج البلد والمدينة…');
    var geo;
    try {
      geo = await reverseViaServer(lat, lng);
    } catch (e1) {
      try {
        geo = await reverseViaBrowser(lat, lng);
      } catch (e2) {
        geo = { ok: true, lat: lat, lng: lng, formattedAddress: '', country: '', city: '' };
        setStatus(host, 'تم الحصول على الإحداثيات — أكمل اسم الفرع يدويًا (الخدمة الجغرافية غير متاحة)', 'error');
        applyGeoResult(host, geo, source);
        return geo;
      }
    }
    applyGeoResult(host, geo, source);
    setStatus(host, 'تم تحديد الموقع — راجع البيانات ثم اضغط تأكيد الموقع', 'ok');
    return geo;
  }

  async function ensureGoogleMap(host, mapEl, cfg) {
    var st = stateOf(host);
    await loadGoogleMaps(cfg.browserKey);
    var fb = mapEl.querySelector('.hub-geo-map-fallback');
    if (fb) fb.hidden = true;
    mapEl.classList.add('is-ready');
    var center = st.lat != null ? { lat: st.lat, lng: st.lng } : { lat: 24.7136, lng: 46.6753 };
    if (!st.map || st.mapEngine !== 'google') {
      mapEl.innerHTML = '';
      st.mapEngine = 'google';
      st.map = new google.maps.Map(mapEl, {
        center: center,
        zoom: st.lat != null ? 14 : 4,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      });
      st.marker = new google.maps.Marker({
        map: st.map,
        position: center,
        draggable: true,
      });
      st.map.addListener('click', function (ev) {
        if (!ev.latLng) return;
        st.marker.setPosition(ev.latLng);
        resolveCoords(host, ev.latLng.lat(), ev.latLng.lng(), 'map');
      });
      st.marker.addListener('dragend', function (ev) {
        if (!ev.latLng) return;
        resolveCoords(host, ev.latLng.lat(), ev.latLng.lng(), 'map');
      });
    }
    return st.map;
  }

  async function ensureLeafletMap(host, mapEl) {
    var st = stateOf(host);
    var L = await loadLeaflet();
    var fb = mapEl.querySelector('.hub-geo-map-fallback');
    if (fb) fb.hidden = true;
    mapEl.classList.add('is-ready');
    var lat = st.lat != null ? st.lat : 24.7136;
    var lng = st.lng != null ? st.lng : 46.6753;
    var zoom = st.lat != null ? 14 : 4;
    if (!st.map || st.mapEngine !== 'leaflet') {
      mapEl.innerHTML = '';
      st.mapEngine = 'leaflet';
      // Inner canvas so .hub-geo-map keeps layout height; Leaflet owns the child.
      var canvas = document.createElement('div');
      canvas.className = 'hub-geo-map-canvas';
      canvas.setAttribute('data-geo-map-canvas', '');
      mapEl.appendChild(canvas);
      st.map = L.map(canvas, { scrollWheelZoom: true, attributionControl: true }).setView([lat, lng], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }).addTo(st.map);
      st.marker = L.marker([lat, lng], { draggable: true }).addTo(st.map);
      st.map.on('click', function (ev) {
        if (!ev.latlng) return;
        st.marker.setLatLng(ev.latlng);
        resolveCoords(host, ev.latlng.lat, ev.latlng.lng, 'map');
      });
      st.marker.on('dragend', function () {
        var ll = st.marker.getLatLng();
        resolveCoords(host, ll.lat, ll.lng, 'map');
      });
      setTimeout(function () {
        try {
          st.map.invalidateSize();
        } catch (e) {
          /* */
        }
      }, 80);
    } else {
      setTimeout(function () {
        try {
          st.map.invalidateSize();
        } catch (e) {
          /* */
        }
      }, 80);
    }
    return st.map;
  }

  async function ensureMap(host) {
    var st = stateOf(host);
    var mapEl = host.querySelector('[data-geo-map]');
    if (!mapEl) return null;
    var cfg = await getConfig();
    try {
      if (cfg.browserKey && (cfg.provider === 'google' || cfg.googleAvailable)) {
        return await ensureGoogleMap(host, mapEl, cfg);
      }
      return await ensureLeafletMap(host, mapEl);
    } catch (e) {
      // Google failed → Leaflet fallback
      try {
        return await ensureLeafletMap(host, mapEl);
      } catch (e2) {
        mapEl.classList.remove('is-ready');
        var fb = mapEl.querySelector('.hub-geo-map-fallback');
        if (!fb) {
          fb = document.createElement('div');
          fb.className = 'hub-geo-map-fallback';
          mapEl.appendChild(fb);
        }
        fb.hidden = false;
        fb.innerHTML =
          '<strong>تعذّر تحميل الخريطة</strong><span>يمكنك كتابة اسم الفرع أو البلد يدويًا وإكمال النموذج.</span>';
        setStatus(host, e2.message || e.message || 'تعذّر تحميل الخريطة — أكمل يدويًا', 'error');
        return null;
      }
    }
  }

  function mount(host, options) {
    if (!host) return null;
    options = options || {};
    if (host.dataset.hubGeoMounted === '1') return host;
    var required = options.required !== false;
    var values = options.values || {};
    var title = options.title || 'حدد موقعك أو اكتب الفرع التابع لك';
    host.dataset.hubGeoMounted = '1';
    host.classList.add('hub-geo');
    host.innerHTML =
      '<div class="hub-geo-title">' +
      esc(title) +
      '</div>' +
      '<p class="hub-geo-lead">اكتب اسم الفرع التابع لك أو حدّد موقعك — بدون قوائم فروع جاهزة.</p>' +
      '<label>اسم الفرع أو البلد' +
      (required ? ' <span class="hub-req" aria-hidden="true">*</span>' : '') +
      '<input type="text" data-geo-branch name="' +
      esc(options.branchFieldName || 'branch') +
      '" placeholder="مثال: فرعي في عمّان / الأردن" autocomplete="organization" ' +
      (required ? 'required' : '') +
      ' value="' +
      esc(values.branchName || values.branch || values.branchLabel || '') +
      '" /></label>' +
      '<div class="hub-geo-actions">' +
      '<button type="button" class="hub-geo-btn hub-geo-btn-primary" data-geo-locate><i class="fas fa-location-crosshairs"></i> تحديد موقعي تلقائيًا</button>' +
      '<button type="button" class="hub-geo-btn" data-geo-pick-map><i class="fas fa-map"></i> اختيار الموقع على الخريطة</button>' +
      '<button type="button" class="hub-geo-btn" data-geo-confirm><i class="fas fa-check"></i> تأكيد الموقع</button>' +
      '</div>' +
      '<div class="hub-geo-map" data-geo-map><div class="hub-geo-map-fallback">جاري تجهيز الخريطة…</div></div>' +
      '<label>البلد<input type="text" data-geo-country name="country" placeholder="يُملأ من الموقع أو يدويًا" autocomplete="country-name" value="' +
      esc(values.country || '') +
      '" /></label>' +
      '<label>المدينة<input type="text" data-geo-city name="city" placeholder="اختياري" autocomplete="address-level2" value="' +
      esc(values.city || '') +
      '" /></label>' +
      '<label>العنوان التقريبي<textarea data-geo-address name="address" rows="2" placeholder="اختياري">' +
      esc(values.address || '') +
      '</textarea></label>' +
      '<div class="hub-geo-preview" data-geo-preview hidden></div>' +
      '<p class="hub-geo-status" data-geo-status role="status"></p>' +
      '<input type="hidden" data-geo-hidden="branch" name="branch" value="" />' +
      '<input type="hidden" data-geo-hidden="branchName" name="branchName" value="" />' +
      '<input type="hidden" data-geo-hidden="branchLabel" name="branchLabel" value="" />' +
      '<input type="hidden" data-geo-hidden="lat" name="lat" value="" />' +
      '<input type="hidden" data-geo-hidden="lng" name="lng" value="" />' +
      '<input type="hidden" data-geo-hidden="locationSource" name="locationSource" value="manual" />' +
      '<input type="hidden" data-geo-hidden="locationConfirmed" name="locationConfirmed" value="" />';

    // Avoid duplicate name=branch/country: remove the first visible ones' name conflict by clearing hidden duplicates if inputs already use name
    // Visible branch input uses name=branch; remove duplicate hidden branch
    var visibleBranch = host.querySelector('[data-geo-branch]');
    var hiddenBranch = host.querySelector('[data-geo-hidden="branch"]');
    if (visibleBranch && hiddenBranch) hiddenBranch.removeAttribute('name');
    var visibleCountry = host.querySelector('[data-geo-country]');
    // country is only on visible field

    var st = stateOf(host);
    if (values.lat != null) st.lat = Number(values.lat);
    if (values.lng != null) st.lng = Number(values.lng);
    st.source = values.locationSource || 'manual';
    st.confirmed = !!values.locationConfirmed;

    host.querySelector('[data-geo-branch]').addEventListener('input', function () {
      st.source = st.lat != null ? 'mixed' : 'manual';
      st.confirmed = false;
      syncHidden(host);
      updatePreview(host);
    });
    ['[data-geo-country]', '[data-geo-city]', '[data-geo-address]'].forEach(function (sel) {
      host.querySelector(sel)?.addEventListener('input', function () {
        st.confirmed = false;
        syncHidden(host);
        updatePreview(host);
      });
    });

    host.querySelector('[data-geo-locate]').addEventListener('click', async function () {
      if (!navigator.geolocation) {
        setStatus(host, 'المتصفح لا يدعم تحديد الموقع — اكتب اسم الفرع يدويًا', 'error');
        return;
      }
      setStatus(host, 'بانتظار إذن الموقع…');
      navigator.geolocation.getCurrentPosition(
        async function (pos) {
          try {
            await ensureMap(host);
            await resolveCoords(host, pos.coords.latitude, pos.coords.longitude, 'geolocation');
          } catch (e) {
            setStatus(host, e.message || 'تعذّر تحديد الموقع', 'error');
          }
        },
        function (err) {
          setStatus(
            host,
            'تم رفض إذن الموقع أو تعذّر الحصول عليه — اكتب اسم الفرع يدويًا وأكمل الطلب.' +
              (err && err.message ? ' (' + err.message + ')' : ''),
            'error'
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });

    host.querySelector('[data-geo-pick-map]').addEventListener('click', async function () {
      setStatus(host, 'جاري فتح الخريطة…');
      var map = await ensureMap(host);
      if (!map) {
        setStatus(host, 'الخريطة غير متاحة حاليًا — اكتب اسم الفرع يدويًا وأكمل الطلب', 'error');
        return;
      }
      setStatus(host, 'انقر على الخريطة أو اسحب العلامة لتحديد الموقع', 'ok');
      host.querySelector('[data-geo-map]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      var st = stateOf(host);
      if (st.mapEngine === 'leaflet' && st.map) {
        setTimeout(function () {
          try {
            st.map.invalidateSize();
          } catch (e) {
            /* */
          }
        }, 200);
      }
    });

    host.querySelector('[data-geo-confirm]').addEventListener('click', function () {
      var f = readFields(host);
      if (!f.branchName) {
        setStatus(host, 'اكتب اسم الفرع أو البلد قبل التأكيد', 'error');
        return;
      }
      st.confirmed = true;
      if (!st.source) st.source = st.lat != null ? 'map' : 'manual';
      syncHidden(host);
      updatePreview(host);
      setStatus(host, 'تم تأكيد الموقع — سيُحفظ مع إرسال النموذج', 'ok');
      host.dispatchEvent(new CustomEvent('hub-geo-confirmed', { bubbles: true, detail: collect(host) }));
    });

    syncHidden(host);
    updatePreview(host);
    getConfig().then(function (cfg) {
      var engine = cfg.provider === 'google' && cfg.browserKey ? 'Google Maps' : 'OpenStreetMap';
      setStatus(host, 'الخريطة جاهزة عبر ' + engine + ' — أو اكتب اسم الفرع يدويًا');
      ensureMap(host).catch(function () {});
    });
    return host;
  }

  function collect(host) {
    if (!host) return null;
    var st = stateOf(host);
    var f = readFields(host);
    syncHidden(host);
    return {
      branch: f.branchName,
      branchName: f.branchName,
      branchLabel: f.branchName,
      country: f.country,
      city: f.city,
      address: f.address,
      lat: st.lat != null ? st.lat : null,
      lng: st.lng != null ? st.lng : null,
      locationSource: st.source || 'manual',
      locationConfirmed: !!st.confirmed,
      locationUpdatedAt: new Date().toISOString(),
      earthUrl:
        st.lat != null && st.lng != null
          ? 'https://www.openstreetmap.org/?mlat=' + st.lat + '&mlon=' + st.lng + '#map=16/' + st.lat + '/' + st.lng
          : '',
    };
  }

  function validate(host, opts) {
    opts = opts || {};
    var data = collect(host);
    if (opts.required !== false && !data.branchName) {
      setStatus(host, 'اكتب اسم الفرع التابع لك أو حدّد موقعك', 'error');
      return { ok: false, error: 'اسم الفرع مطلوب', data: data };
    }
    return { ok: true, data: data };
  }

  /**
   * Replace legacy country/branch <select> pairs inside a form with HubGeoBranch.
   */
  function upgradeForm(form, options) {
    if (!form || form.dataset.hubGeoUpgraded === '1') return null;
    options = options || {};
    var branchSel = form.querySelector('select[name="branch"], #book-branch, #reg-branch, #hub-field-branch');
    var countrySel = form.querySelector('select[name="country"], #book-country, #reg-country');
    var host = form.querySelector('[data-hub-geo-branch]');
    if (!host && !branchSel && !countrySel) return null;

    var values = {
      branchName: '',
      country: '',
      city: '',
      address: '',
    };
    if (branchSel) {
      var bOpt = branchSel.selectedOptions && branchSel.selectedOptions[0];
      values.branchName = (bOpt && bOpt.textContent) || branchSel.value || '';
      // strip synthetic "فرع X — type" noise for free text seed when it's a catalog id
      if (/^br-/i.test(branchSel.value) && bOpt) values.branchName = String(bOpt.textContent || '').split('—')[0].trim();
    }
    if (countrySel) values.country = countrySel.value || '';

    if (!host) {
      host = document.createElement('div');
      host.setAttribute('data-hub-geo-branch', '');
      var anchor = countrySel || branchSel;
      if (anchor) {
        // remove labels tied to these fields
        var countryLabel = form.querySelector('label[for="' + (countrySel && countrySel.id) + '"]');
        var branchLabel = form.querySelector('label[for="' + (branchSel && branchSel.id) + '"]');
        if (countryLabel) countryLabel.remove();
        if (branchLabel) branchLabel.remove();
        form.querySelectorAll('[data-err-for="country"], [data-err-for="branch"]').forEach(function (e) {
          e.remove();
        });
        anchor.parentNode.insertBefore(host, anchor);
      } else {
        form.insertBefore(host, form.firstChild);
      }
    }

    if (countrySel) countrySel.remove();
    if (branchSel) branchSel.remove();

    // Also remove orphaned labels that only said الدولة/الفرع without for=
    form.querySelectorAll('label').forEach(function (lab) {
      var t = (lab.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(الدولة|الفرع|اسم الفرع)\b/.test(t) && !lab.querySelector('input,select,textarea') && !lab.htmlFor) {
        lab.remove();
      }
    });

    form.dataset.hubGeoUpgraded = '1';
    mount(host, Object.assign({ required: options.required !== false, values: values }, options));
    return host;
  }

  function mountAll(root) {
    root = root || document;
    root.querySelectorAll('[data-hub-geo-branch]').forEach(function (host) {
      if (host.dataset.hubGeoMounted === '1') return;
      mount(host, {
        required: host.getAttribute('data-required') !== 'false',
        title: host.getAttribute('data-title') || undefined,
      });
    });
    // Only auto-upgrade forms that still have legacy catalog selects (or opt-in flag).
    // Pages that already ship [data-hub-geo-branch] are handled by the mount loop above.
    root.querySelectorAll('form[data-hub-geo-upgrade], form[data-book-form], form[data-register-form], form[data-hub-register]').forEach(function (form) {
      if (form.querySelector('[data-hub-geo-branch]')) return;
      if (!form.querySelector('select[name="branch"], select[name="country"], #book-branch, #reg-branch')) return;
      var hq = form.closest('[data-hub-book="platform"]') && /from=hq/i.test(location.search);
      try {
        upgradeForm(form, { required: !hq && form.getAttribute('data-geo-required') !== 'false' });
      } catch (e) {
        console.warn('[HubGeoBranch] upgrade failed', e);
      }
    });
  }

  window.HubGeoBranch = {
    mount: mount,
    collect: collect,
    validate: validate,
    upgradeForm: upgradeForm,
    mountAll: mountAll,
    getConfig: getConfig,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      mountAll(document);
    });
  } else {
    mountAll(document);
  }
})();
