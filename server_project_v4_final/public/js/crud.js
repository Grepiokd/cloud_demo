// public/js/crud.js
// Global variables
let currentEditingId = null;

// When DOM ready
document.addEventListener('DOMContentLoaded', function() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const itemForm = document.getElementById('itemForm');
  if (itemForm) itemForm.addEventListener('submit', handleItemSubmit);

  // Load dashboard lists if on dashboard
  if (window.location.pathname.includes('dashboard.html')) initializeDashboard();

  // If display page, load items
  if (window.location.pathname.includes('display.html')) loadItemsForDisplay();

  // Load username into any page
  loadUsername();
});

// Helper: show messages
function showMessage(message, type='info') {
  const messageDiv = document.getElementById('message');
  if (!messageDiv) return;
  messageDiv.textContent = message;
  messageDiv.className = `message ${type}`;
  messageDiv.style.display = 'block';
  setTimeout(()=> { messageDiv.style.display = 'none'; }, 3000);
}

// AUTH
async function handleLogin(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = { username: fd.get('username'), password: fd.get('password') };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (res.ok) {
      showMessage('Login successful', 'success');
      setTimeout(()=> {
        if (json.role === 'admin') window.location.href = '/html/dashboard.html';
        else window.location.href = '/html/display.html';
      }, 700);
    } else {
      showMessage(json.error || 'Login failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Login failed', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = { username: fd.get('username'), password: fd.get('password') };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (res.ok) {
      showMessage('Registration successful', 'success');
      setTimeout(()=> window.location.href = '/html/login.html', 900);
    } else {
      showMessage(json.error || 'Register failed', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Register failed', 'error');
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/html/login.html';
  } catch (err) {
    console.error(err);
  }
}

async function loadUsername() {
  try {
    const res = await fetch('/api/current-user');
    if (!res.ok) return;
    const json = await res.json();
    const el = document.getElementById('username');
    if (el) el.textContent = json.username || 'Admin';
  } catch (err) { /* ignore */ }
}

// DASHBOARD
function initializeDashboard() {
  loadItems();
  loadUsers();
}

async function loadItems() {
  try {
    const res = await fetch('/api/items');
    const items = await res.json();
    displayItems(items);
  } catch (err) {
    console.error(err);
  }
}

function displayItems(items) {
  const itemsList = document.getElementById('itemsList');
  if (!itemsList) return;
  itemsList.innerHTML = '';
  if (!items || items.length === 0) {
    itemsList.innerHTML = '<p>No items found</p>';
    return;
  }

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'item-card';
    el.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <div style="width:120px;height:80px;background:#fff;border-radius:6px;overflow:hidden;display:flex;align-items:center;justify-content:center">
          <img src="${item.imageUrl || '/mnt/data/b2ff30bc-d420-49e8-94d7-5ee0e1a58a17.png'}" style="max-width:100%;max-height:100%" />
        </div>
        <div>
          <h4 style="margin:0 0 6px 0;">${escapeHtml(item.name)}</h4>
          <p style="margin:0 0 6px 0;color:var(--muted)">${escapeHtml(item.description || 'N/A')}</p>
          <p style="margin:0 0 6px 0;"><strong>Category:</strong> ${escapeHtml(item.category || 'N/A')}</p>
          <p style="margin:0 0 6px 0;"><strong>Price:</strong> $${Number(item.price || 0).toFixed(2)}</p>
          <p style="margin:0 0 6px 0;color:var(--muted)"><small>Created by: ${escapeHtml(item.createdBy || 'System')}</small></p>
        </div>
      </div>
      <div class="item-actions" style="margin-top:8px;">
        <button onclick="startEditItem('${item._id}')" class="btn">Edit</button>
        <button onclick="confirmDeleteItem('${item._id}')" class="btn ghost">Delete</button>
      </div>
    `;
    itemsList.appendChild(el);
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function startEditItem(id) {
  fetch(`/api/items?search=${encodeURIComponent('')}`) // not required but ensure items are loaded
  fetch(`/api/items`).then(r=>r.json()).then(items=>{
    const it = items.find(x => x._id === id);
    if (!it) return;
    currentEditingId = id;
    document.getElementById('itemName').value = it.name || '';
    document.getElementById('itemDescription').value = it.description || '';
    document.getElementById('itemCategory').value = it.category || '';
    document.getElementById('itemPrice').value = it.price || '';
    document.querySelector('#itemForm button').textContent = 'Update Item';
  });
}

// handle item create/update with image upload
async function handleItemSubmit(e) {
  e.preventDefault();
  const form = document.getElementById('itemForm');
  if (!form) return;

  const fd = new FormData();
  fd.append('name', document.getElementById('itemName').value);
  fd.append('description', document.getElementById('itemDescription').value);
  fd.append('category', document.getElementById('itemCategory').value);
  fd.append('price', document.getElementById('itemPrice').value || 0);

  const fileInput = document.getElementById('itemImage');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    fd.append('image', fileInput.files[0]);
  }

  try {
    let res;
    if (currentEditingId) {
      res = await fetch(`/api/items/${currentEditingId}`, {
        method: 'PUT',
        body: fd
      });
    } else {
      res = await fetch('/api/items', {
        method: 'POST',
        body: fd
      });
    }
    if (res.ok) {
      showMessage('Item saved', 'success');
      form.reset();
      currentEditingId = null;
      document.querySelector('#itemForm button').textContent = 'Add Item';
      loadItems();
    } else {
      const json = await res.json();
      showMessage(json.error || 'Failed to save item', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Failed to save item', 'error');
  }
}

// Confirm wrapper for deleting item (shows your specific prompt)
function confirmDeleteItem(id) {
  if (!id) return;
  if (confirm('提你 are you sure to delete this one?')) {
    deleteItem(id);
  }
}

async function deleteItem(id) {
  try {
    const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showMessage('Item deleted', 'success');
      loadItems();
    } else {
      const json = await res.json();
      showMessage(json.error || 'Failed to delete item', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Failed to delete item', 'error');
  }
}

// USERS
async function loadUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) {
      // if not admin, maybe unauthorized; just show nothing
      const txt = await res.text();
      console.warn('loadUsers failed', txt);
      return;
    }
    const users = await res.json();
    displayUsers(users);
  } catch (err) {
    console.error(err);
  }
}

function displayUsers(users) {
  const usersList = document.getElementById('usersList');
  if (!usersList) return;
  usersList.innerHTML = '';
  if (!users || users.length === 0) {
    usersList.innerHTML = '<p>No users found</p>';
    return;
  }

  users.forEach(user => {
    const el = document.createElement('div');
    el.className = 'user-card';
    el.style.display = 'flex';
    el.style.justifyContent = 'space-between';
    el.style.alignItems = 'center';
    el.style.padding = '8px';
    el.style.borderRadius = '6px';
    el.style.background = 'rgba(255,255,255,0.01)';
    el.style.marginBottom = '8px';

    el.innerHTML = `
      <div>
        <strong>${escapeHtml(user.username)}</strong><br/>
        <small style="color:var(--muted)">Role: ${escapeHtml(user.role)}</small>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <select id="role-${user._id}">
          <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
          <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
        </select>
        <button class="btn ghost" onclick="confirmDeleteUser('${user._id}')">Delete</button>
      </div>
    `;
    usersList.appendChild(el);

    // role change listener
    const sel = document.getElementById(`role-${user._id}`);
    sel.addEventListener('change', ()=> updateUserRole(user._id));
  });
}

function confirmDeleteUser(id) {
  if (!id) return;
  if (confirm('提你 are you sure to delete this one?')) {
    deleteUser(id);
  }
}

async function deleteUser(id) {
  try {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showMessage('User deleted', 'success');
      loadUsers();
    } else {
      const json = await res.json();
      showMessage(json.error || 'Failed to delete user', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Failed to delete user', 'error');
  }
}

async function updateUserRole(userId) {
  const sel = document.getElementById(`role-${userId}`);
  if (!sel) return;
  const newRole = sel.value;
  try {
    const res = await fetch(`/api/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const json = await res.json();
    if (res.ok) {
      showMessage('Role updated', 'success');
      loadUsers();
    } else {
      showMessage(json.error || 'Failed to update role', 'error');
    }
  } catch (err) {
    console.error(err);
    showMessage('Failed to update role', 'error');
  }
}

// DISPLAY PAGE: show items with images
async function loadItemsForDisplay() {
  try {
    const res = await fetch('/api/items');
    const items = await res.json();
    const container = document.getElementById('itemsListDisplay') || document.getElementById('itemsTableBody');
    if (!container) return;
    container.innerHTML = '';

    if (!items || items.length === 0) {
      container.innerHTML = '<p style="color:var(--muted)">No items found.</p>';
      return;
    }

    // If table present, fill table rows
    if (document.getElementById('itemsTableBody')) {
      const tbody = document.getElementById('itemsTableBody');
      tbody.innerHTML = '';
      items.forEach(it => {
        const tr = document.createElement('tr');
        const imgTd = `<td><img src="${it.imageUrl || '/mnt/data/b2ff30bc-d420-49e8-94d7-5ee0e1a58a17.png'}" style="height:60px;object-fit:contain"></td>`;
        tr.innerHTML = `<td>${escapeHtml(it.name||'')}</td><td>${escapeHtml(it.description||'N/A')}</td><td>${escapeHtml(it.category||'N/A')}</td><td>$${Number(it.price||0).toFixed(2)}</td><td>${escapeHtml(it.createdBy||'System')}</td>`;
        tbody.appendChild(tr);
      });
      return;
    }

    // Otherwise show grid style
    items.forEach(it => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'row';
      card.style.gap = '12px';
      card.style.alignItems = 'center';
      card.style.padding = '12px';
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.borderRadius = '8px';
      card.style.marginBottom = '14px';

      const imgBox = document.createElement('div');
      imgBox.style.width = '160px';
      imgBox.style.height = '100px';
      imgBox.style.background = '#fff';
      imgBox.style.borderRadius = '6px';
      imgBox.style.display = 'flex';
      imgBox.style.alignItems = 'center';
      imgBox.style.justifyContent = 'center';
      const img = document.createElement('img');
      img.src = it.imageUrl || '/mnt/data/b2ff30bc-d420-49e8-94d7-5ee0e1a58a17.png';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      imgBox.appendChild(img);

      const meta = document.createElement('div');
      meta.innerHTML = `<strong>${escapeHtml(it.name)}</strong><br/><small style="color:var(--muted)">${escapeHtml(it.category)} · $${Number(it.price||0).toFixed(2)}</small>`;

      card.appendChild(imgBox);
      card.appendChild(meta);
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
  }
}

// SEARCH functions (re-use endpoints)
function clearSearch() {
  const sname = document.getElementById('searchName');
  const scat = document.getElementById('searchCategory');
  const minP = document.getElementById('minPrice');
  const maxP = document.getElementById('maxPrice');
  if (sname) sname.value = '';
  if (scat) scat.value = '';
  if (minP) minP.value = '';
  if (maxP) maxP.value = '';
  loadItems();
}

async function searchItems() {
  const name = document.getElementById('searchName') ? document.getElementById('searchName').value : '';
  const category = document.getElementById('searchCategory') ? document.getElementById('searchCategory').value : '';
  const minPrice = document.getElementById('minPrice') ? document.getElementById('minPrice').value : '';
  const maxPrice = document.getElementById('maxPrice') ? document.getElementById('maxPrice').value : '';
  let q = '/api/items?';
  const params = [];
  if (name) params.push('name=' + encodeURIComponent(name));
  if (category) params.push('category=' + encodeURIComponent(category));
  if (minPrice) params.push('minPrice=' + encodeURIComponent(minPrice));
  if (maxPrice) params.push('maxPrice=' + encodeURIComponent(maxPrice));
  q += params.join('&');
  try {
    const res = await fetch(q);
    const items = await res.json();
    displayItems(items);
  } catch (err) {
    console.error(err);
  }
}

// Search users (client-side)
async function searchUsers() {
  const q = document.getElementById('searchUser') ? document.getElementById('searchUser').value.toLowerCase() : '';
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return;
    const users = await res.json();
    const filtered = users.filter(u => (u.username || '').toLowerCase().includes(q));
    displayUsers(filtered);
  } catch (err) { console.error(err); }
}
