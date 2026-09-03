/**
 * قناتي — قناة المستخدم الخاصة: رفع فيديو + ربط يوتيوب/سوشيال
 */
(() => {
  'use strict';

  const KEY = 'naiosh_client_channels_v1';
  const EMAIL_KEY = 'naiosh_client_channel_email';

  const blank = () => ({ version: 1, channels: [], updatedAt: new Date().toISOString() });
  const uid = (p = 'ch') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const normEmail = (v) => String(v || '').trim().toLowerCase();

  const read = () => {
    try {
      return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    } catch {
      return blank();
    }
  };

  const save = (state) => {
    state.updatedAt = new Date().toISOString();
    state.channels = Array.isArray(state.channels) ? state.channels : [];
    localStorage.setItem(KEY, JSON.stringify(state));
    return state;
  };

  const rememberEmail = (email) => {
    const key = normEmail(email);
    if (!key) return;
    try {
      localStorage.setItem(EMAIL_KEY, key);
    } catch {
      /* ignore */
    }
  };

  const rememberedEmail = () => {
    try {
      return normEmail(localStorage.getItem(EMAIL_KEY) || '');
    } catch {
      return '';
    }
  };

  const getOrCreate = (email, title) => {
    const key = normEmail(email);
    if (!key) return null;
    const state = read();
    let channel = (state.channels || []).find((c) => normEmail(c.email) === key);
    if (!channel) {
      channel = {
        id: uid(),
        email: key,
        title: String(title || 'قناتي').trim() || 'قناتي',
        socialUrl: '',
        youtubeUrl: '',
        videos: [],
        updatedAt: new Date().toISOString(),
      };
      state.channels.unshift(channel);
      save(state);
    }
    rememberEmail(key);
    return channel;
  };

  const listForEmail = (email) => {
    const key = normEmail(email);
    if (!key) return [];
    return (read().channels || []).filter((c) => normEmail(c.email) === key);
  };

  const updateLinks = (email, { socialUrl, youtubeUrl, title } = {}) => {
    const channel = getOrCreate(email, title);
    if (!channel) return { ok: false, error: 'الإيميل مطلوب' };
    const state = read();
    const idx = state.channels.findIndex((c) => c.id === channel.id);
    if (idx < 0) return { ok: false, error: 'القناة غير موجودة' };
    if (title != null) state.channels[idx].title = String(title || 'قناتي').trim() || 'قناتي';
    if (socialUrl != null) state.channels[idx].socialUrl = String(socialUrl || '').trim();
    if (youtubeUrl != null) state.channels[idx].youtubeUrl = String(youtubeUrl || '').trim();
    state.channels[idx].updatedAt = new Date().toISOString();
    save(state);
    return { ok: true, channel: state.channels[idx] };
  };

  const addVideo = (email, video = {}) => {
    const channel = getOrCreate(email);
    if (!channel) return { ok: false, error: 'الإيميل مطلوب' };
    const title = String(video.title || '').trim();
    const url = String(video.url || '').trim();
    if (!title || !url) return { ok: false, error: 'عنوان الفيديو والرابط مطلوبان' };
    const state = read();
    const idx = state.channels.findIndex((c) => c.id === channel.id);
    if (idx < 0) return { ok: false, error: 'القناة غير موجودة' };
    const row = {
      id: uid('vid'),
      title,
      url,
      note: String(video.note || '').trim(),
      at: new Date().toISOString(),
    };
    state.channels[idx].videos = [row].concat(state.channels[idx].videos || []).slice(0, 40);
    state.channels[idx].updatedAt = new Date().toISOString();
    save(state);
    return { ok: true, video: row, channel: state.channels[idx] };
  };

  window.HubClientChannels = {
    KEY,
    listForEmail,
    getOrCreate,
    updateLinks,
    addVideo,
    rememberEmail,
    rememberedEmail,
  };
})();
