/* =============================================
   PACK PILOT — app.js
   Full app logic: auth, trips, packing list,
   preferences, past trips, weather simulation
   ============================================= */

/* ── STATE ── */
let state = {
  user: null,
  currentTrip: null,
  trips: [],       // upcoming
  pastTrips: [],   // completed
  preferences: {
    weatherSensitivity: [],
    activities: [],
    laundry: 'yes',
    alwaysPack: []
  },
  packingList: []
};

/* ── PERSISTENCE ── */
function saveState() {
  localStorage.setItem('packpilot_state', JSON.stringify(state));
}
function loadState() {
  const raw = localStorage.getItem('packpilot_state');
  if (raw) {
    try { state = JSON.parse(raw); } catch(e) {}
  }
}

/* ── BOOTSTRAP ── */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  if (state.user) {
    showDashboard();
  } else {
    navigateTo('auth');
  }
});

/* ── NAVIGATION ── */
function navigateTo(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${screen}`);
  if (el) el.classList.add('active');

  // Always start the new screen at the top instead of keeping the old scroll position
  window.scrollTo(0, 0);

  // Populate screens on visit
  if (screen === 'dashboard')    renderDashboard();
  if (screen === 'packing-list') renderPackingList();
  if (screen === 'trip-summary') renderSummary();
  if (screen === 'past-trips')   renderPastTrips();
  if (screen === 'preferences')  loadPreferences();
}

/* ── AUTH ── */
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pw    = document.getElementById('login-password').value;
  if (!email || !pw) { showToast('Please fill in all fields.', 'error'); return; }

  // Simple local user store
  const users = JSON.parse(localStorage.getItem('packpilot_users') || '[]');
  const found = users.find(u => u.email === email && u.password === pw);
  if (!found) { showToast('Invalid credentials. Try signing up!', 'error'); return; }

  state.user = found;
  // Restore user-specific data
  const userData = JSON.parse(localStorage.getItem(`pp_data_${email}`) || '{}');
  state.trips       = userData.trips       || [];
  state.pastTrips   = userData.pastTrips   || [];
  state.preferences = userData.preferences || state.preferences;
  saveState();
  showToast(`Welcome back, ${found.name}!`, 'success');
  showDashboard();
}

function doSignup() {
  const name  = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const pw    = document.getElementById('signup-password').value;
  const dob   = document.getElementById('signup-dob').value;
  if (!name || !email || !pw) { showToast('Please fill in all required fields.', 'error'); return; }

  const users = JSON.parse(localStorage.getItem('packpilot_users') || '[]');
  if (users.find(u => u.email === email)) { showToast('Account already exists. Please log in.', 'error'); return; }

  const user = { name, email, password: pw, dob };
  users.push(user);
  localStorage.setItem('packpilot_users', JSON.stringify(users));

  state.user = user;
  saveState();
  showToast(`Account created! Welcome, ${name} ✈`, 'success');
  showDashboard();
}

function doLogout() {
  persistUserData();
  state.user = null;
  state.currentTrip = null;
  saveState();
  navigateTo('auth');
  showToast('Logged out successfully.', 'info');
}

function persistUserData() {
  if (!state.user) return;
  localStorage.setItem(`pp_data_${state.user.email}`, JSON.stringify({
    trips:       state.trips,
    pastTrips:   state.pastTrips,
    preferences: state.preferences
  }));
}

/* ── DASHBOARD ── */
function showDashboard() {
  navigateTo('dashboard');
}

function renderDashboard() {
  if (state.user) {
    document.getElementById('user-greeting').textContent = `Hi, ${state.user.name.split(' ')[0]}`;
  }

  // Upcoming trips
  const upEl = document.getElementById('upcoming-list');
  if (state.trips.length === 0) {
    upEl.innerHTML = '<li class="empty-state">No upcoming trips yet.</li>';
  } else {
    upEl.innerHTML = state.trips.map((t, i) => `
      <li>
        <strong>${t.destination}</strong> — ${t.length} days
        <span class="trip-actions">
          <a onclick="viewTrip(${i})">View</a>
          <a onclick="deleteTrip(${i})">✕</a>
        </span>
      </li>`).join('');
  }

  // Past trips
  const ptEl = document.getElementById('past-list');
  if (state.pastTrips.length === 0) {
    ptEl.innerHTML = '<li class="empty-state">No past trips yet.</li>';
  } else {
    ptEl.innerHTML = state.pastTrips.slice(-3).reverse().map(t => `
      <li>
        <strong>${t.destination}</strong>
        <span class="trip-actions">
          <a onclick="reuseTrip('${t.destination}','${t.length}')">Reuse</a>
        </span>
      </li>`).join('');
  }
}

function viewTrip(idx) {
  state.currentTrip = idx;
  saveState();
  navigateTo('packing-list');
}

function deleteTrip(idx) {
  state.trips.splice(idx, 1);
  persistUserData();
  saveState();
  renderDashboard();
  showToast('Trip removed.', 'info');
}

function reuseTrip(dest, length) {
  document.getElementById('trip-destination').value = dest;
  document.getElementById('trip-length').value = length;
  navigateTo('trip-setup');
}

/* ── TRIP SETUP ── */
function createTrip() {
  const destination = document.getElementById('trip-destination').value.trim();
  const length      = parseInt(document.getElementById('trip-length').value);
  const startDate   = document.getElementById('trip-start').value;
  const endDate     = document.getElementById('trip-end').value;
  const suitcase    = document.querySelector('input[name="suitcase"]:checked')?.value || 'medium';
  const purposes    = [...document.querySelectorAll('input[name="purpose"]:checked')].map(c => c.value);

  if (!destination) { showToast('Please enter a destination.', 'error'); return; }
  if (!length || length < 1) { showToast('Please enter a valid trip length.', 'error'); return; }

  const weather = simulateWeather(destination);

  const trip = {
    id:          Date.now(),
    destination,
    length,
    startDate,
    endDate,
    suitcase,
    purposes,
    weather,
    packingList: generatePackingList(destination, length, suitcase, purposes, state.preferences, weather)
  };

  state.trips.push(trip);
  state.currentTrip = state.trips.length - 1;
  persistUserData();
  saveState();

  showToast(`Packing list ready for ${destination}! 🧳`, 'success');
  navigateTo('packing-list');
}

/* ── WEATHER SIMULATION ── */
function simulateWeather(dest) {
  const warm = ['japan','bali','thailand','india','mexico','hawaii','brazil','vietnam','spain','italy','greece','maldives','dubai','singapore','australia','bali','indonesia','philippines'];
  const cold = ['iceland','canada','norway','sweden','finland','alaska','switzerland','russia','antarctica','greenland'];
  const rainy = ['london','uk','ireland','seattle','portland','bergen','panama'];

  const d = dest.toLowerCase();
  let type = 'mild';
  if (warm.some(w => d.includes(w))) type = 'warm';
  else if (cold.some(c => d.includes(c))) type = 'cold';
  else if (rainy.some(r => d.includes(r))) type = 'rainy';

  const map = {
    warm:  { label: 'Warm & Sunny', desc: 'Pack light, breathable clothing', icon: '☀️', hasRain: false },
    cold:  { label: 'Cold weather expected', desc: 'Pack warm layers and a heavy coat', icon: '❄️', hasRain: false },
    rainy: { label: 'Rainy weather expected', desc: 'Bring an umbrella and waterproofs', icon: '🌧', hasRain: true  },
    mild:  { label: 'Mild, pleasant weather', desc: 'Pack layers for comfort', icon: '🌤', hasRain: false }
  };
  return { type, ...map[type] };
}

function showWeatherPreview() {
  const dest = document.getElementById('trip-destination').value.trim();
  if (!dest) return;
  const w = simulateWeather(dest);
  const prev = document.getElementById('weather-preview');
  document.getElementById('w-icon').textContent  = w.icon;
  document.getElementById('w-label').textContent = w.label;
  document.getElementById('w-desc').textContent  = w.desc;
  prev.style.display = 'flex';
}
document.getElementById('trip-destination')?.addEventListener('blur', showWeatherPreview);

/* ── PACKING LIST GENERATION ── */
function generatePackingList(dest, days, suitcase, purposes, prefs, weather) {
  const list = [];

  // Essentials
  list.push({ category: 'Essentials', icon: '🪪', items: [
    'Passport / ID',
    'Travel Insurance',
    'Flight Tickets',
    'Hotel Booking',
    'Local Currency / Cards',
    'Phone Charger',
    'Power Adapter'
  ]});

  // Toiletries
  list.push({ category: 'Toiletries', icon: '🧴', items: [
    'Toothbrush & Toothpaste',
    'Shampoo & Conditioner',
    'Body Wash',
    'Deodorant',
    'Sunscreen SPF50',
    'Moisturiser',
    'Razor & Shaving Cream'
  ]});

  // Clothing — scale with days & laundry
  const laundry = prefs.laundry === 'yes';
  const outfits = laundry ? Math.ceil(days / 2) : Math.min(days, 7);
  const clothing = [
    `T-Shirts (x${outfits})`,
    `Underwear (x${outfits + 1})`,
    `Socks (x${outfits + 1})`
  ];

  if (weather.type === 'cold') {
    clothing.push('Thermal Base Layer', 'Heavy Coat', 'Gloves & Scarf', `Jumpers / Hoodies (x${Math.ceil(outfits/2)})`);
  } else if (weather.type === 'warm') {
    clothing.push('Shorts', 'Sandals', 'Sunhat / Cap');
  } else if (weather.type === 'rainy') {
    clothing.push('Waterproof Jacket', 'Umbrella', 'Waterproof Shoes');
  } else {
    clothing.push('Light Jacket', 'Comfortable Shoes');
  }

  if (purposes.includes('beach')) clothing.push('Swimwear', 'Beach Towel', 'Flip Flops');
  if (purposes.includes('business')) clothing.push('Smart Shirt/Blouse', 'Dress Trousers / Blazer', 'Formal Shoes');
  if (purposes.includes('hiking')) clothing.push('Hiking Boots', 'Moisture-Wicking Shirt', 'Trekking Poles');

  list.push({ category: 'Clothing', icon: '👕', items: clothing });

  // Electronics
  list.push({ category: 'Electronics', icon: '💻', items: [
    'Phone + Charger',
    'Headphones',
    'Portable Battery Bank',
    'Camera',
    'Laptop / Tablet',
    'Laptop Charger'
  ]});

  // Health
  list.push({ category: 'Health & Safety', icon: '💊', items: [
    'Prescription Medication',
    'Paracetamol / Ibuprofen',
    'Plasters & First Aid',
    'Hand Sanitiser',
    'Insect Repellent',
    'Rehydration Sachets'
  ]});

  // Weather-specific
  if (weather.hasRain) {
    list.push({ category: 'Weather Extras', icon: '☔', items: [
      'Compact Umbrella',
      'Waterproof Bag Cover',
      'Rain Poncho'
    ]});
  }

  // Always pack items from preferences
  if (prefs.alwaysPack && prefs.alwaysPack.length > 0) {
    list.push({ category: 'Your Essentials', icon: '⭐', items: prefs.alwaysPack });
  }

  // Mark all unchecked initially
  return list.map(cat => ({
    ...cat,
    items: cat.items.map(name => ({ name, checked: false }))
  }));
}

/* ── RENDER PACKING LIST ── */
function renderPackingList() {
  if (state.currentTrip === null || !state.trips[state.currentTrip]) {
    document.getElementById('packing-categories').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No active trip. Create one first!</p>';
    return;
  }

  const trip = state.trips[state.currentTrip];
  document.getElementById('packing-trip-info').textContent =
    `✈ ${trip.destination}  •  ${trip.length} days  •  ${trip.weather.icon} ${trip.weather.label}  •  🧳 ${trip.suitcase}`;

  // Smart reminder
  const rem = document.getElementById('smart-reminder');
  if (trip.weather.hasRain) {
    document.getElementById('reminder-text').textContent =
      `${trip.weather.icon} Rain is expected — remember your umbrella and waterproofs!`;
    rem.style.display = 'flex';
  } else {
    rem.style.display = 'none';
  }

  updateProgress(trip);
  renderCategories(trip);
}

function renderCategories(trip) {
  const container = document.getElementById('packing-categories');
  container.innerHTML = '';

  trip.packingList.forEach((cat, ci) => {
    const div = document.createElement('div');
    div.className = 'pack-category';
    div.innerHTML = `<h4>${cat.icon} ${cat.category}</h4>` +
      cat.items.map((item, ii) => `
        <div class="pack-item${item.checked ? ' checked' : ''}" id="pi-${ci}-${ii}" onclick="toggleItem(${ci},${ii})">
          <input type="checkbox" ${item.checked ? 'checked' : ''} />
          <label>${item.name}</label>
        </div>`).join('');
    container.appendChild(div);
  });
}

function toggleItem(ci, ii) {
  const trip = state.trips[state.currentTrip];
  trip.packingList[ci].items[ii].checked = !trip.packingList[ci].items[ii].checked;
  persistUserData();
  saveState();

  const el = document.getElementById(`pi-${ci}-${ii}`);
  el.classList.toggle('checked');
  el.querySelector('input').checked = trip.packingList[ci].items[ii].checked;
  updateProgress(trip);
}

function updateProgress(trip) {
  const allItems = trip.packingList.flatMap(c => c.items);
  const checked  = allItems.filter(i => i.checked).length;
  const pct      = allItems.length ? Math.round((checked / allItems.length) * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('progress-pct').textContent  = `${pct}%`;
}

/* ── SUITCASE ESTIMATE ── */
function buildSuitcaseEstimate() {
  const trip = state.trips[state.currentTrip];
  if (!trip) return;

  const allItems  = trip.packingList.flatMap(c => c.items);
  const total     = allItems.length;
  const checked   = allItems.filter(i => i.checked).length;
  const unchecked = total - checked;
  const sizeCap   = { cabin: '≤7kg', medium: '10-15kg', large: '20kg+' };
  const used = trip.suitcase;

  document.getElementById('suitcase-summary').innerHTML = `
    <strong>Suitcase:</strong> ${used.charAt(0).toUpperCase() + used.slice(1)} (${sizeCap[used]})<br><br>
    <strong>Total items:</strong> ${total}<br>
    <strong>Packed:</strong> ${checked} ✓<br>
    <strong>Still to pack:</strong> ${unchecked}<br><br>
    ${checked === total
      ? '🎉 You\'re fully packed — bon voyage!'
      : `⚠️ You still have ${unchecked} item${unchecked > 1 ? 's' : ''} left to pack.`}
  `;
  document.getElementById('suitcase-modal').style.display = 'flex';
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

/* ── TRIP SUMMARY ── */
function renderSummary() {
  if (state.currentTrip === null || !state.trips[state.currentTrip]) return;
  const trip = state.trips[state.currentTrip];
  const allItems = trip.packingList.flatMap(c => c.items);
  const checked  = allItems.filter(i => i.checked).length;
  const pct      = allItems.length ? Math.round((checked / allItems.length) * 100) : 0;

  document.getElementById('s-dest').textContent     = trip.destination;
  document.getElementById('s-dur').textContent      = `${trip.length} days`;
  document.getElementById('s-weather').textContent  = `${trip.weather.icon} ${trip.weather.label}`;
  document.getElementById('s-suitcase').textContent = trip.suitcase.charAt(0).toUpperCase() + trip.suitcase.slice(1);
  document.getElementById('s-progress').textContent = `${pct}% (${checked}/${allItems.length} items)`;
}

function finishTrip() {
  const trip = state.trips[state.currentTrip];
  if (!trip) return;
  trip.completedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  state.pastTrips.push({ ...trip });
  state.trips.splice(state.currentTrip, 1);
  state.currentTrip = null;
  persistUserData();
  saveState();
  showToast(`${trip.destination} trip saved to history! 🏁`, 'success');
  navigateTo('dashboard');
}

/* ── PAST TRIPS ── */
function renderPastTrips() {
  const container = document.getElementById('past-trips-list');
  if (state.pastTrips.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No past trips yet.</p>';
    return;
  }
  container.innerHTML = [...state.pastTrips].reverse().map((t, i) => `
    <div class="past-trip-card">
      <div class="past-trip-info">
        <h4>${t.destination}</h4>
        <p>${t.length} days &nbsp;•&nbsp; ${t.weather.icon} ${t.weather.label} &nbsp;•&nbsp; Completed ${t.completedAt || ''}</p>
      </div>
      <div class="past-trip-actions">
        <button onclick="reuseTrip('${t.destination}','${t.length}')">↩ Reuse</button>
      </div>
    </div>`).join('');
}

function clearPastTrips() {
  if (!confirm('Clear all past trips?')) return;
  state.pastTrips = [];
  persistUserData();
  saveState();
  renderPastTrips();
  showToast('Past trips cleared.', 'info');
}

/* ── PREFERENCES ── */
function loadPreferences() {
  const p = state.preferences;
  document.getElementById('pref-hot').checked    = p.weatherSensitivity?.includes('hot');
  document.getElementById('pref-cold').checked   = p.weatherSensitivity?.includes('cold');
  document.getElementById('pref-both').checked   = p.weatherSensitivity?.includes('both');
  document.getElementById('pref-beach').checked    = p.activities?.includes('beach');
  document.getElementById('pref-travel').checked   = p.activities?.includes('travel');
  document.getElementById('pref-business').checked = p.activities?.includes('business');
  document.getElementById('pref-hiking').checked   = p.activities?.includes('hiking');
  document.querySelector(`input[name="laundry"][value="${p.laundry || 'yes'}"]`).checked = true;
  renderAlwaysPackList();
}

function savePreferences() {
  state.preferences = {
    weatherSensitivity: getCheckedValues(['pref-hot','pref-cold','pref-both'], ['hot','cold','both']),
    activities:         getCheckedValues(['pref-beach','pref-travel','pref-business','pref-hiking'], ['beach','travel','business','hiking']),
    laundry:            document.querySelector('input[name="laundry"]:checked')?.value || 'yes',
    alwaysPack:         state.preferences.alwaysPack || []
  };
  persistUserData();
  saveState();
  showToast('Preferences saved ✓', 'success');
}

function getCheckedValues(ids, vals) {
  return ids.filter((id, i) => document.getElementById(id)?.checked).map((_, i) => vals[i]);
}

function addAlwaysPack() {
  const input = document.getElementById('always-pack-input');
  const val   = input.value.trim();
  if (!val) return;
  if (!state.preferences.alwaysPack) state.preferences.alwaysPack = [];
  state.preferences.alwaysPack.push(val);
  input.value = '';
  persistUserData();
  saveState();
  renderAlwaysPackList();
}

function removeAlwaysPack(idx) {
  state.preferences.alwaysPack.splice(idx, 1);
  persistUserData();
  saveState();
  renderAlwaysPackList();
}

function renderAlwaysPackList() {
  const list = document.getElementById('always-pack-list');
  const items = state.preferences.alwaysPack || [];
  list.innerHTML = items.map((item, i) => `
    <li>${item} <button onclick="removeAlwaysPack(${i})">×</button></li>`).join('');
}

document.getElementById('always-pack-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') addAlwaysPack();
});

/* ── TOAST ── */
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3000);
}
