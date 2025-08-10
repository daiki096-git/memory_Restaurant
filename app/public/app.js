const state = {
  map: null,
  markers: new Map(), // id -> google.maps.Marker
  csrfToken: null,
  config: null,
};

function toast(message, ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = message;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, ms);
}

function openModal(html) {
  const modal = document.getElementById('modal');
  const body = document.getElementById('modalBody');
  body.innerHTML = '';
  body.insertAdjacentHTML('afterbegin', html);
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

document.getElementById('modalClose').addEventListener('click', closeModal);

async function fetchConfig() {
  const res = await fetch('/api/config', { credentials: 'same-origin' });
  const data = await res.json();
  state.csrfToken = data.csrfToken;
  state.config = data;
  return data;
}

function loadGoogleMaps(apiKey) {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Mapsの読み込みに失敗しました'));
    document.head.appendChild(script);
  });
}

async function initMap() {
  const config = await fetchConfig();
  if (!config.googleMapsApiKey) {
    toast('Google Maps APIキーが設定されていません (.env を設定してください)');
    return;
  }
  await loadGoogleMaps(config.googleMapsApiKey);

  const defaultCenter = { lat: 35.681236, lng: 139.767125 }; // Tokyo Station
  let center = defaultCenter;
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation?.getCurrentPosition((p) => res(p), (e) => rej(e), { timeout: 3000 }));
    center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {}

  state.map = new google.maps.Map(document.getElementById('map'), {
    center,
    zoom: 14,
  });

  state.map.addListener('click', (e) => {
    showCreateForm(e.latLng.lat(), e.latLng.lng());
  });

  document.getElementById('searchBtn').addEventListener('click', () => doSearch());
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  await refreshMarkers();
}

async function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  await refreshMarkers(q);
}

async function refreshMarkers(q = '') {
  const url = q ? `/api/restaurants?q=${encodeURIComponent(q)}` : '/api/restaurants';
  const res = await fetch(url);
  const data = await res.json();
  const restaurants = data.restaurants || [];

  // Remove old markers
  for (const [id, marker] of state.markers) {
    marker.setMap(null);
  }
  state.markers.clear();

  for (const r of restaurants) {
    addMarker(r);
  }
}

function addMarker(r) {
  const marker = new google.maps.Marker({
    position: { lat: r.latitude, lng: r.longitude },
    map: state.map,
    title: r.name,
  });
  marker.addListener('click', () => showRestaurantDetail(r.id));
  state.markers.set(r.id, marker);
}

function showCreateForm(lat, lng) {
  const maxSizeMb = Math.round((state.config?.maxFileSizeBytes || 8 * 1024 * 1024) / (1024 * 1024));
  const html = `
    <h2>レストランを登録</h2>
    <form id="createForm">
      <div class="form-row">
        <label>名前</label>
        <input type="text" name="name" required maxlength="255" placeholder="レストラン名" />
      </div>
      <div class="form-row">
        <label>感想</label>
        <textarea name="comment" rows="4" maxlength="5000" placeholder="感想やメモ"></textarea>
      </div>
      <div class="form-row">
        <label>写真 (複数可, 最大 ${maxSizeMb}MB/枚)</label>
        <input type="file" name="photos" accept="image/*" multiple />
        <div id="photoPreview" class="photo-grid"></div>
      </div>
      <input type="hidden" name="latitude" value="${lat}" />
      <input type="hidden" name="longitude" value="${lng}" />
      <div class="actions">
        <button type="button" class="button secondary" id="cancelBtn">キャンセル</button>
        <button type="submit" class="button" id="submitBtn">登録</button>
      </div>
    </form>
  `;
  openModal(html);

  const form = document.getElementById('createForm');
  const cancelBtn = document.getElementById('cancelBtn');
  const photoInput = form.elements.namedItem('photos');
  const preview = document.getElementById('photoPreview');

  photoInput.addEventListener('change', () => {
    preview.innerHTML = '';
    const files = Array.from(photoInput.files || []);
    for (const f of files) {
      const url = URL.createObjectURL(f);
      const img = document.createElement('img');
      img.src = url;
      preview.appendChild(img);
    }
  });

  cancelBtn.addEventListener('click', closeModal);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    try {
      const formData = new FormData(form);
      const name = formData.get('name').toString().trim();
      const comment = formData.get('comment').toString();
      const latitude = parseFloat(formData.get('latitude'));
      const longitude = parseFloat(formData.get('longitude'));
      const files = Array.from(photoInput.files || []);
      let photoUrls = [];
      if (files.length) {
        photoUrls = await uploadPhotos(files);
      }
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': state.csrfToken },
        body: JSON.stringify({ name, comment, latitude, longitude, photoUrls }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '登録に失敗しました');
      toast('登録しました');
      closeModal();
      await refreshMarkers();
    } catch (e) {
      console.error(e);
      toast(e.message || 'エラーが発生しました');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function uploadPhotos(files) {
  const descriptors = files.map((f) => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size }));
  const presignRes = await fetch('/api/s3/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': state.csrfToken },
    body: JSON.stringify({ files: descriptors }),
  });
  if (!presignRes.ok) throw new Error((await presignRes.json()).error || 'アップロード準備に失敗しました');
  const { uploads } = await presignRes.json();
  const results = [];
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    const fd = new FormData();
    Object.entries(u.fields).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', files[i]);
    const r = await fetch(u.url, { method: 'POST', body: fd });
    if (!(r.status === 204 || r.status === 201)) {
      throw new Error('S3 へのアップロードに失敗しました');
    }
    results.push(u.finalUrl);
  }
  return results;
}

async function showRestaurantDetail(id) {
  const res = await fetch(`/api/restaurants/${id}`);
  if (!res.ok) { toast('読み込みに失敗しました'); return; }
  const { restaurant } = await res.json();
  const photosHtml = (restaurant.photos || []).map(p => `<img src="${encodeURI(p.photoUrl)}" alt="photo" />`).join('');
  const html = `
    <h2>${escapeHtml(restaurant.name)}</h2>
    <p>${escapeHtml(restaurant.comment || '')}</p>
    <div class="photo-grid">${photosHtml}</div>
    <div class="actions" style="margin-top: 12px;">
      <button class="button secondary" id="closeBtn">閉じる</button>
      <button class="button" id="deleteBtn">削除</button>
    </div>
  `;
  openModal(html);
  document.getElementById('closeBtn').addEventListener('click', closeModal);
  document.getElementById('deleteBtn').addEventListener('click', async () => {
    if (!confirm('このピンを削除しますか？')) return;
    const r = await fetch(`/api/restaurants/${id}`, { method: 'DELETE', headers: { 'x-csrf-token': state.csrfToken } });
    if (!r.ok) { toast('削除に失敗しました'); return; }
    toast('削除しました');
    closeModal();
    await refreshMarkers();
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

initMap().catch((e) => {
  console.error(e);
  toast(e.message || '初期化に失敗しました');
});