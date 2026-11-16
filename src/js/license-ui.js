// Màn hình khoá (nhập key) và bảng quản lý key. Việc kiểm tra nằm ở tiến trình chính (license.js).
(() => {
  const api = window.mapi && window.mapi.lic;
  if (!api) return;                                   // chạy ngoài app (trình duyệt): không khoá
  const call = async (channel, ...args) => { const res = await api.call(channel, ...args); if (res.error) throw new Error(res.error); return res.result; };
  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) node.append(c);
    return node;
  };
  const confirmDlg = o => window.M.ui.confirm(o.title, o.message, o.okText);

  // ---- màn hình khoá ----
  const REASONS = {
    nokey: 'Nhập key kích hoạt mà Mondiro gửi cho bạn để bắt đầu dùng app.',
    invalid: 'Key không đúng. Kiểm tra lại hoặc liên hệ Mondiro.',
    revoked: 'Key của máy này đã bị thu hồi. Liên hệ Mondiro nếu cần dùng tiếp.',
    offline: 'Không kết nối được để kiểm tra key. Hãy kiểm tra mạng rồi thử lại.',
    full: 'Key này đã dùng đủ số máy cho phép, không đăng nhập thêm máy này được. Liên hệ Mondiro để gỡ bớt máy cũ.'
  };
  let locked = true;
  const lockMsg = el('div', { class: 'lock-msg', text: 'Đang kiểm tra quyền sử dụng...' });
  const keyInput = el('input', { type: 'text', class: 'lock-input', placeholder: 'SPV-XXXX-XXXX-XXXX-XXXX', spellcheck: 'false', 'aria-label': 'Key kích hoạt' });
  const activateBtn = el('button', { class: 'btn primary', text: 'Kích hoạt' });
  const retryBtn = el('button', { class: 'btn', text: 'Thử lại' });
  const keyForm = el('div', { class: 'lock-form', hidden: '' }, [keyInput, activateBtn, retryBtn]);
  const lockOverlay = el('div', { id: 'lock-overlay' }, [
    el('div', { class: 'lock-card' }, [
      el('img', { class: 'lock-logo', src: 'icon.png', alt: '' }),
      el('div', { class: 'lock-brand' }, [el('span', { class: 'm', text: 'M' }), el('span', { class: 'a', text: ' Cocos Particle' })]),
      lockMsg, keyForm
    ]),
    el('div', { class: 'lock-credit', text: 'Created by Mondiro' }),
    el('div', { class: 'win-drag' })
  ]);
  document.body.append(lockOverlay);

  function applyStatus(status) {
    locked = !(status && status.ok);
    if (!locked) { lockOverlay.hidden = true; return; }
    lockOverlay.hidden = false; keyForm.hidden = false;
    lockMsg.textContent = status && status.reason === 'full' && status.max
      ? `Key này đã dùng đủ ${status.max} máy, không đăng nhập thêm máy này được. Liên hệ Mondiro để gỡ bớt máy cũ.`
      : REASONS[(status && status.reason) || 'nokey'] || REASONS.nokey;
    lockMsg.classList.toggle('error', !!status && status.reason !== 'nokey');
    setTimeout(() => keyInput.focus(), 0);
  }
  async function check() { try { applyStatus(await call('license-check')); } catch (e) { applyStatus({ ok: false, reason: 'offline' }); } }
  async function doActivate() {
    activateBtn.disabled = true; lockMsg.textContent = 'Đang kiểm tra key...'; lockMsg.classList.remove('error');
    try { applyStatus(await call('license-activate', keyInput.value)); } catch (e) { applyStatus({ ok: false, reason: 'offline' }); }
    activateBtn.disabled = false;
  }
  activateBtn.addEventListener('click', doActivate);
  keyInput.addEventListener('keydown', e => { if (e.key === 'Enter') doActivate(); });
  retryBtn.addEventListener('click', check);
  api.onStatus(applyStatus);

  // ---- bảng Admin ----
  const adminBody = el('div', { class: 'admin-body' });
  const adminMsg = el('div', { class: 'admin-msg' });
  const adminModal = el('div', { id: 'admin-modal', hidden: '' }, [
    el('div', { class: 'admin-card' }, [
      el('div', { class: 'admin-head' }, [el('div', { class: 'admin-title', text: 'Quản lý key' }), el('button', { class: 'mini', text: '✕', title: 'Đóng', onclick: () => { adminModal.hidden = true; } })]),
      adminMsg, adminBody
    ])
  ]);
  document.body.append(adminModal);
  const setMsg = (text, isError) => { adminMsg.textContent = text || ''; adminMsg.classList.toggle('error', !!isError); };
  const busy = async (fn, doneText) => {
    setMsg('Đang lưu...'); adminModal.classList.add('busy');
    try { await fn(); setMsg(doneText || ''); } catch (e) { setMsg(e.message, true); }
    adminModal.classList.remove('busy');
  };
  async function openAdmin() { adminModal.hidden = false; setMsg(''); if (await call('admin-status').catch(() => false)) renderList(); else renderLogin(); }

  function renderLogin() {
    const tokenInput = el('input', { type: 'password', class: 'lock-input', placeholder: 'github_pat_...' });
    const loginBtn = el('button', { class: 'btn primary', text: 'Đăng nhập Admin' });
    const login = () => busy(async () => { await call('admin-login', tokenInput.value); await check(); renderList(); });
    loginBtn.addEventListener('click', login);
    tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    adminBody.replaceChildren(
      el('p', { class: 'admin-hint', text: 'Dán token Admin (cùng token đang dùng cho Mondiro Spine Preview). Token được mã hóa và chỉ lưu trên máy này.' }),
      tokenInput, loginBtn);
    setTimeout(() => tokenInput.focus(), 0);
  }
  const maskKey = key => key.replace(/[A-Z0-9]{4}(?=-|$)/g, '••••');

  function keyRow(k) {
    const active = k.active !== false; let keyLine;
    if (k.key) {
      let shown = false; const keyText = el('code', { class: 'admin-key-text', text: maskKey(k.key) });
      const eyeBtn = el('button', { class: 'tbtn', text: 'Hiện', title: 'Ẩn/hiện key' });
      eyeBtn.addEventListener('click', () => { shown = !shown; keyText.textContent = shown ? k.key : maskKey(k.key); eyeBtn.textContent = shown ? 'Ẩn' : 'Hiện'; });
      keyLine = el('div', { class: 'admin-key-line' }, [keyText, eyeBtn, el('button', { class: 'tbtn', text: 'Copy', onclick: () => { api.copy(k.key); setMsg(`Đã copy key của ${k.name}.`); } })]);
    } else {
      keyLine = el('div', { class: 'admin-key-line' }, [
        el('span', { class: 'admin-key-missing', text: 'Key không lưu trên máy này' }),
        el('button', { class: 'tbtn', text: 'Đổi key', title: 'Tạo key mới cho người này, key cũ sẽ hết dùng được',
          onclick: () => confirmDlg({ title: `Tạo key mới cho "${k.name}"?`, message: 'Key cũ sẽ không dùng được nữa (ở cả Spine Preview), bạn cần gửi key mới cho họ.', okText: 'Tạo key mới' }).then(ok => ok && busy(async () => {
            const { key, keys } = await call('admin-regenerate', k.id); api.copy(key); showList(keys);
          }, `Đã tạo key mới cho ${k.name} và copy sẵn, gửi cho họ nhé.`)) })
      ]);
    }
    return el('div', { class: 'admin-row' + (active ? '' : ' revoked') }, [
      el('div', { class: 'admin-row-info' }, [
        el('div', { class: 'admin-row-name' }, [el('span', { text: k.name }), el('span', { class: 'admin-badge' + (active ? '' : ' off'), text: active ? 'Đang dùng' : 'Đã thu hồi' })]),
        el('div', { class: 'admin-row-meta', text: [k.created, k.note].filter(Boolean).join(' · ') }),
        keyLine, seatBlock(k)
      ]),
      el('button', { class: 'tbtn', text: active ? 'Thu hồi' : 'Mở lại',
        onclick: () => busy(async () => showList(await call('admin-set-active', k.id, !active)), active ? `Đã thu hồi key của ${k.name}. Máy đó sẽ bị khóa trong khoảng 15–20 phút.` : `Đã mở lại key của ${k.name}.`) }),
      el('button', { class: 'tbtn danger', text: 'Xóa',
        onclick: () => confirmDlg({ title: `Xóa hẳn key của "${k.name}"?`, message: 'Máy đó sẽ bị khóa ở cả hai app và key này không dùng lại được.', okText: 'Xóa key' })
          .then(ok => ok && busy(async () => showList(await call('admin-remove', k.id)), `Đã xóa key của ${k.name}.`)) })
    ]);
  }

  const openSeats = new Set();
  const fmtDate = t => t ? new Date(t).toLocaleDateString('vi-VN') : '';
  function seatBlock(k) {
    const max = Number(k.maxDevices) || 0, devs = k.devices, used = devs ? devs.length : null, full = max && used != null && used >= max;
    const label = devs == null ? (max ? `Tối đa ${max} máy` : 'Không giới hạn máy')
      : (max ? `Máy: ${Math.min(used, max)}/${max}` : `Máy: ${used} · không giới hạn`) + (max && used > max ? ` · ${used - max} máy bị chặn` : '');
    const toggleBtn = el('button', { class: 'tbtn', text: openSeats.has(k.id) ? 'Thu gọn' : 'Quản lý máy' });
    const head = el('div', { class: 'admin-seat-head' }, [el('span', { class: 'admin-seat-count' + (full ? ' full' : ''), text: label }), toggleBtn]);
    const box = el('div', { class: 'admin-seat-box' }); box.hidden = !openSeats.has(k.id);
    toggleBtn.addEventListener('click', () => { if (openSeats.has(k.id)) openSeats.delete(k.id); else openSeats.add(k.id); box.hidden = !openSeats.has(k.id); toggleBtn.textContent = box.hidden ? 'Quản lý máy' : 'Thu gọn'; });
    const maxInput = el('input', { type: 'number', min: '0', max: '99', class: 'lock-input admin-seat-max', value: String(max), title: '0 = không giới hạn' });
    const saveBtn = el('button', { class: 'tbtn', text: 'Lưu', onclick: () => busy(async () => showList(await call('admin-set-max', k.id, Number(maxInput.value) || 0)),
      (Number(maxInput.value) || 0) > 0 ? `Key của ${k.name} giờ dùng được tối đa ${Number(maxInput.value)} máy.` : `Key của ${k.name} không giới hạn số máy.`) });
    maxInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });
    box.append(el('div', { class: 'admin-seat-limit' }, [el('span', { text: 'Số máy tối đa' }), maxInput, saveBtn, el('span', { class: 'admin-hint', text: '0 = không giới hạn' })]));
    if (devs == null) box.append(el('div', { class: 'admin-hint', text: 'Chưa đếm được máy (không kết nối được).' }));
    else if (!devs.length) box.append(el('div', { class: 'admin-hint', text: 'Chưa có máy nào đăng nhập bằng key này.' }));
    else devs.forEach((d, i) => { const blocked = max && i >= max;
      box.append(el('div', { class: 'admin-seat-dev' + (blocked ? ' blocked' : '') }, [
        el('span', { class: 'admin-seat-name', text: d.name || d.id }),
        el('span', { class: 'admin-seat-date', text: (blocked ? 'Bị chặn · ' : '') + 'Lần cuối ' + fmtDate(d.seen) }),
        el('button', { class: 'tbtn danger', text: 'Gỡ', title: 'Gỡ máy này khỏi key để nhường chỗ cho máy khác',
          onclick: () => confirmDlg({ title: `Gỡ máy "${d.name || d.id}"?`, message: 'Máy này sẽ bị khóa nếu key đã đủ máy. Nếu còn chỗ, máy đó đăng nhập lại được.', okText: 'Gỡ máy' })
            .then(ok => ok && busy(async () => showList(await call('admin-remove-device', k.id, d.id)), `Đã gỡ máy ${d.name || ''}.`)) })
      ])); });
    return el('div', { class: 'admin-seat' }, [head, box]);
  }

  let listEl = null;
  function showList(keys) { if (listEl) listEl.replaceChildren(...(keys.length ? keys.map(keyRow) : [el('div', { class: 'admin-hint', text: 'Chưa có key nào.' })])); }
  async function renderList() {
    const nameInput = el('input', { type: 'text', class: 'lock-input', placeholder: 'Tên đồng nghiệp' });
    const noteInput = el('input', { type: 'text', class: 'lock-input', placeholder: 'Ghi chú (không bắt buộc)' });
    const maxInput = el('input', { type: 'number', min: '0', max: '99', value: '1', class: 'lock-input', title: 'Số máy được dùng key này (0 = không giới hạn)' });
    const addBtn = el('button', { class: 'btn primary', text: '+ Tạo key mới' });
    addBtn.addEventListener('click', () => { const name = nameInput.value.trim();
      busy(async () => { const { keys } = await call('admin-add', name, noteInput.value, Number(maxInput.value) || 0); nameInput.value = ''; noteInput.value = ''; maxInput.value = '1'; showList(keys); },
        `Đã tạo key cho ${name}. Bấm "Hiện" hoặc "Copy" ở dòng của họ để lấy key.`); });
    listEl = el('div', { class: 'admin-list' }, [el('div', { class: 'admin-hint', text: 'Đang tải danh sách...' })]);
    adminBody.replaceChildren(
      el('div', { class: 'admin-add' }, [nameInput, noteInput, el('label', { class: 'admin-add-max' }, [el('span', { text: 'Số máy' }), maxInput]), addBtn]),
      listEl,
      el('div', { class: 'admin-foot' }, [
        el('span', { class: 'admin-hint', text: 'Danh sách này dùng chung với Mondiro Spine Preview: 1 key mở được cả hai app. Tên và ghi chú hiển thị công khai, key thì không.' }),
        el('button', { class: 'tbtn', text: 'Đăng xuất Admin', onclick: async () => { await call('admin-logout').catch(() => {}); adminModal.hidden = true; check(); } })
      ]));
    try { showList(await call('admin-list')); } catch (e) { listEl.replaceChildren(el('div', { class: 'admin-msg error', text: e.message })); }
  }

  // phím tắt mở bảng Admin + chặn mọi phím tắt của app khi đang khoá hoặc đang mở bảng Admin
  window.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') { e.preventDefault(); e.stopPropagation(); return openAdmin(); }
    const inOwn = e.target.closest && e.target.closest('#lock-overlay,#admin-modal,.modal');
    if (!adminModal.hidden && e.key === 'Escape' && !document.querySelector('.modal')) { adminModal.hidden = true; e.stopPropagation(); return; }
    if ((locked || !adminModal.hidden) && !inOwn) { e.stopPropagation(); e.preventDefault(); }
  }, true);
  window.addEventListener('keyup', e => { if ((locked || !adminModal.hidden) && !(e.target.closest && e.target.closest('#lock-overlay,#admin-modal,.modal'))) e.stopPropagation(); }, true);

  check();
})();
