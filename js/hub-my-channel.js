/**
 * واجهة قناتي — قناة فيديو خاصة + روابط سوشيال/يوتيوب
 */
(() => {
  'use strict';

  const root = document.querySelector('[data-my-channel]');
  if (!root) return;

  const mount = root.querySelector('[data-channel-root]');
  const meta = root.querySelector('[data-channel-meta]');
  const emailInput = root.querySelector('[data-channel-email]');
  const titleInput = root.querySelector('[data-channel-title]');
  const socialInput = root.querySelector('[data-channel-social]');
  const youtubeInput = root.querySelector('[data-channel-youtube]');
  const videoTitle = root.querySelector('[data-video-title]');
  const videoUrl = root.querySelector('[data-video-url]');
  const videoNote = root.querySelector('[data-video-note]');

  const esc = (s) =>
    String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const normEmail = (v) => String(v || '').trim().toLowerCase();
  const userEmail = () => normEmail(window.HubAuth?.getUser?.()?.email);

  const renderChannel = (channel) => {
    if (!mount) return;
    const videos = Array.isArray(channel.videos) ? channel.videos : [];
    mount.innerHTML = `<article class="hub-mine-card">
      <h3>${esc(channel.title || 'قناتي')} <span class="hub-mine-status is-active">قناة المستخدم</span></h3>
      <p>الإيميل: <strong dir="ltr">${esc(channel.email)}</strong></p>
      ${
        channel.youtubeUrl
          ? `<p><i class="fab fa-youtube"></i> يوتيوب: <a href="${esc(channel.youtubeUrl)}" target="_blank" rel="noopener" dir="ltr">${esc(channel.youtubeUrl)}</a></p>`
          : '<p>لم يُربط يوتيوب بعد.</p>'
      }
      ${
        channel.socialUrl
          ? `<p><i class="fas fa-share-nodes"></i> سوشيال: <a href="${esc(channel.socialUrl)}" target="_blank" rel="noopener" dir="ltr">${esc(channel.socialUrl)}</a></p>`
          : '<p>لم يُربط حساب اجتماعي بعد.</p>'
      }
    </article>
    <div class="hub-mine-grid" style="margin-top:16px">
      ${
        videos.length
          ? videos
              .map(
                (v) => `<article class="hub-mine-card">
            <h3><i class="fas fa-video"></i> ${esc(v.title)}</h3>
            <p><a href="${esc(v.url)}" target="_blank" rel="noopener" dir="ltr">${esc(v.url)}</a></p>
            ${v.note ? `<p>${esc(v.note)}</p>` : ''}
          </article>`
              )
              .join('')
          : '<div class="hub-mine-empty"><p>لا فيديوهات بعد — أضيفي رابط فيديو أدناه.</p></div>'
      }
    </div>`;
    if (meta) meta.textContent = `قناتك الخاصة · ${channel.email} · ${videos.length} فيديو`;
    if (titleInput) titleInput.value = channel.title || '';
    if (socialInput) socialInput.value = channel.socialUrl || '';
    if (youtubeInput) youtubeInput.value = channel.youtubeUrl || '';
  };

  const showForEmail = (emailRaw) => {
    const email = normEmail(emailRaw);
    if (!email) {
      if (meta) meta.textContent = 'أدخلي إيميلك لفتح قناتك الخاصة';
      return;
    }
    if (emailInput && emailInput.value.trim().toLowerCase() !== email) emailInput.value = email;
    const channel = window.HubClientChannels?.getOrCreate?.(email, titleInput?.value || 'قناتي');
    if (!channel) return;
    renderChannel(channel);
  };

  const saveLinks = () => {
    const email = normEmail(emailInput?.value);
    const res = window.HubClientChannels?.updateLinks?.(email, {
      title: titleInput?.value,
      socialUrl: socialInput?.value,
      youtubeUrl: youtubeInput?.value,
    });
    if (!res?.ok) {
      if (meta) meta.textContent = res?.error || 'تعذر الحفظ';
      return;
    }
    renderChannel(res.channel);
  };

  const addVideo = () => {
    const email = normEmail(emailInput?.value);
    const res = window.HubClientChannels?.addVideo?.(email, {
      title: videoTitle?.value,
      url: videoUrl?.value,
      note: videoNote?.value,
    });
    if (!res?.ok) {
      if (meta) meta.textContent = res?.error || 'تعذر إضافة الفيديو';
      return;
    }
    if (videoTitle) videoTitle.value = '';
    if (videoUrl) videoUrl.value = '';
    if (videoNote) videoNote.value = '';
    renderChannel(res.channel);
  };

  root.querySelector('[data-channel-lookup]')?.addEventListener('click', () => showForEmail(emailInput?.value));
  root.querySelector('[data-channel-save]')?.addEventListener('click', saveLinks);
  root.querySelector('[data-channel-add-video]')?.addEventListener('click', addVideo);
  emailInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showForEmail(emailInput.value);
    }
  });

  const boot = () => {
    const preset =
      userEmail() ||
      normEmail(new URLSearchParams(window.location.search).get('email')) ||
      window.HubClientChannels?.rememberedEmail?.() ||
      '';
    if (emailInput && preset) emailInput.value = preset;
    if (preset) showForEmail(preset);
    else if (meta) meta.textContent = 'أدخلي إيميلك لفتح قناتك الخاصة';
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
