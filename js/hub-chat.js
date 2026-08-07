(() => {
  'use strict';

  const KEY = 'hubInternalChat_v1';

  const ROOMS = [
    { id: 'ops', title: 'غرفة العمليات', sub: 'قيادة · تنبيهات · قرارات' },
    { id: 'support', title: 'الدعم التشغيلي', sub: 'طلبات · أعطال · متابعة' },
    { id: 'branches', title: 'تنسيق الفروع', sub: 'شبكة الفروع العالمية' },
  ];

  const seed = () => ({
    active: 'ops',
    messages: {
      ops: [
        { who: 'them', text: 'مرحبًا بك في الدردشة الداخلية لهوب.' },
        { who: 'them', text: 'من هنا تنسّق الفرق والتنبيهات التشغيلية لحظيًا.' },
      ],
      support: [{ who: 'them', text: 'قناة الدعم جاهزة — اكتب طلبك.' }],
      branches: [{ who: 'them', text: 'غرفة تنسيق الفروع مفتوحة.' }],
    },
  });

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return seed();
      return { ...seed(), ...JSON.parse(raw) };
    } catch {
      return seed();
    }
  };

  const save = (state) => localStorage.setItem(KEY, JSON.stringify(state));

  const state = load();

  const roomsEl = document.getElementById('hub-chat-rooms');
  const messagesEl = document.getElementById('hub-chat-messages');
  const titleEl = document.getElementById('hub-chat-title');
  const form = document.getElementById('hub-chat-form');
  const input = document.getElementById('hub-chat-input');

  if (!roomsEl || !messagesEl || !form || !input) return;

  const renderRooms = () => {
    roomsEl.innerHTML = ROOMS.map(
      (r) => `<button type="button" class="hub-chat-room${state.active === r.id ? ' is-active' : ''}" data-room="${r.id}">
        <strong>${r.title}</strong>
        <span>${r.sub}</span>
      </button>`
    ).join('');
  };

  const renderMessages = () => {
    const room = ROOMS.find((r) => r.id === state.active) || ROOMS[0];
    if (titleEl) titleEl.textContent = room.title;
    const list = state.messages[state.active] || [];
    messagesEl.innerHTML = list
      .map((m) => `<div class="hub-chat-bubble ${m.who === 'me' ? 'me' : 'them'}">${m.text}</div>`)
      .join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  roomsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-room]');
    if (!btn) return;
    state.active = btn.dataset.room;
    save(state);
    renderRooms();
    renderMessages();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = (input.value || '').trim();
    if (!text) return;
    if (!state.messages[state.active]) state.messages[state.active] = [];
    state.messages[state.active].push({ who: 'me', text });
    state.messages[state.active].push({
      who: 'them',
      text: 'تم الاستلام — سيتم الرد من غرفة العمليات خلال لحظات.',
    });
    input.value = '';
    save(state);
    renderMessages();
  });

  renderRooms();
  renderMessages();
})();
