/* ============================================
   UserVault — Frontend Application Logic
   ============================================ */

const API_BASE = '/api/users';

// ── State ──
let state = {
  currentPage: 'home',
  token: localStorage.getItem('uv_token') || null,
  user: JSON.parse(localStorage.getItem('uv_user') || 'null'),
  users: [],
  pagination: { total: 0, page: 1, limit: 10, pages: 0 },
  searchQuery: '',
  roleFilter: '',
  editingUserId: null,
  deletingUserId: null,
};

// ── Initialization ──
document.addEventListener('DOMContentLoaded', () => {
  // Determine initial page from URL
  const path = window.location.pathname.replace('/', '') || 'home';
  if (state.token && state.user) {
    navigate(path === 'home' || path === 'login' || path === 'register' ? 'dashboard' : path);
  } else {
    navigate(['dashboard'].includes(path) ? 'home' : path);
  }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const path = window.location.pathname.replace('/', '') || 'home';
  showPage(path);
});

// ── Navigation ──
function navigate(page) {
  if (page === 'dashboard' && !state.token) {
    showToast('Please sign in to access the dashboard.', 'error');
    page = 'login';
  }

  state.currentPage = page;
  const urlPath = page === 'home' ? '/' : `/${page}`;
  history.pushState({ page }, '', urlPath);
  showPage(page);
}

function showPage(page) {
  // Hide all pages
  document.querySelectorAll('.page-view').forEach((p) => {
    p.classList.remove('active');
  });

  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.add('active');
  }

  // Update nav
  updateNavbar();

  // Load dashboard data
  if (page === 'dashboard' && state.token) {
    loadDashboard();
  }
}

function updateNavbar() {
  const navLinks = document.getElementById('navLinks');

  if (state.token && state.user) {
    navLinks.innerHTML = `
      <button class="nav-link ${state.currentPage === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">Dashboard</button>
      <div class="nav-user-badge" onclick="handleLogout()">
        <div class="nav-user-avatar">${getInitials(state.user.firstName, state.user.lastName)}</div>
        <span class="nav-user-name">Logout</span>
      </div>
    `;
  } else {
    navLinks.innerHTML = `
      <button class="nav-link ${state.currentPage === 'home' ? 'active' : ''}" onclick="navigate('home')">Home</button>
      <button class="nav-link ${state.currentPage === 'login' ? 'active' : ''}" onclick="navigate('login')">Sign In</button>
      <button class="nav-link nav-link-cta" onclick="navigate('register')">Get Started</button>
    `;
  }
}

// ── Auth Handlers ──
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('registerBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Creating...';

  try {
    const body = {
      firstName: document.getElementById('regFirstName').value.trim(),
      lastName: document.getElementById('regLastName').value.trim(),
      email: document.getElementById('regEmail').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
      password: document.getElementById('regPassword').value,
    };

    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.success) {
      state.token = data.token;
      state.user = data.data;
      localStorage.setItem('uv_token', data.token);
      localStorage.setItem('uv_user', JSON.stringify(data.data));
      showToast('Account created successfully! Welcome to UserVault.', 'success');
      document.getElementById('registerForm').reset();
      navigate('dashboard');
    } else {
      showToast(data.message || 'Registration failed.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Signing in...';

  try {
    const body = {
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value,
    };

    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.success) {
      state.token = data.token;
      state.user = data.data;
      localStorage.setItem('uv_token', data.token);
      localStorage.setItem('uv_user', JSON.stringify(data.data));
      showToast(`Welcome back, ${data.data.firstName}!`, 'success');
      document.getElementById('loginForm').reset();
      navigate('dashboard');
    } else {
      showToast(data.message || 'Login failed.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
  }
}

function handleLogout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('uv_token');
  localStorage.removeItem('uv_user');
  showToast('You have been signed out.', 'info');
  navigate('home');
}

// ── Dashboard ──
async function loadDashboard() {
  await Promise.all([loadStats(), loadUsers()]);
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();

    if (data.success) {
      animateCounter('statTotal', data.data.totalUsers);
      animateCounter('statActive', data.data.activeUsers);
      animateCounter('statNew', data.data.newUsersThisMonth);
      animateCounter('statInactive', data.data.inactiveUsers);
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = generateSkeletonRows(5);

  try {
    const params = new URLSearchParams({
      page: state.pagination.page,
      limit: state.pagination.limit,
    });
    if (state.searchQuery) params.append('search', state.searchQuery);
    if (state.roleFilter) params.append('role', state.roleFilter);

    const res = await fetch(`${API_BASE}?${params}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (res.status === 401) {
      handleLogout();
      showToast('Session expired. Please sign in again.', 'error');
      return;
    }

    const data = await res.json();

    if (data.success) {
      state.users = data.data;
      state.pagination = data.pagination;
      renderUsers();
      renderPagination();
    }
  } catch (err) {
    console.error('Failed to load users:', err);
    tbody.innerHTML = '';
    showToast('Failed to load users.', 'error');
  }
}

function renderUsers() {
  const tbody = document.getElementById('usersTableBody');
  const emptyState = document.getElementById('emptyState');

  if (state.users.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  tbody.innerHTML = state.users
    .map((user, i) => {
      const initials = getInitials(user.firstName, user.lastName);
      const avatarClass = `avatar-${(i % 5) + 1}`;
      const roleBadge = `badge-${user.role}`;
      const joinDate = new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      return `
        <tr>
          <td>
            <div class="user-cell">
              <div class="user-avatar ${avatarClass}">${initials}</div>
              <div class="user-info">
                <span class="user-name">${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}</span>
                <span class="user-email">${escapeHtml(user.email)}</span>
              </div>
            </div>
          </td>
          <td><span class="badge ${roleBadge}">${user.role}</span></td>
          <td>
            <span class="status-dot ${user.isActive ? 'active' : 'inactive'}"></span>
            ${user.isActive ? 'Active' : 'Inactive'}
          </td>
          <td>${user.phone ? escapeHtml(user.phone) : '—'}</td>
          <td>${joinDate}</td>
          <td>
            <div class="table-actions">
              <button class="action-btn edit" title="Edit User" onclick="openEditModal('${user._id}')">✏️</button>
              <button class="action-btn delete" title="Delete User" onclick="openDeleteModal('${user._id}', '${escapeHtml(user.firstName)} ${escapeHtml(user.lastName)}')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderPagination() {
  const info = document.getElementById('paginationInfo');
  const controls = document.getElementById('paginationControls');
  const { total, page, limit, pages } = state.pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  info.textContent = total > 0 ? `Showing ${start}–${end} of ${total} users` : 'No users found';

  let btns = '';
  btns += `<button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>`;

  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || (i >= page - 1 && i <= page + 1)) {
      btns += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === page - 2 || i === page + 2) {
      btns += `<button class="page-btn" disabled>…</button>`;
    }
  }

  btns += `<button class="page-btn" onclick="goToPage(${page + 1})" ${page >= pages ? 'disabled' : ''}>›</button>`;
  controls.innerHTML = btns;
}

function goToPage(page) {
  if (page < 1 || page > state.pagination.pages) return;
  state.pagination.page = page;
  loadUsers();
}

// ── Search & Filter ──
let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.searchQuery = document.getElementById('searchInput').value.trim();
    state.pagination.page = 1;
    loadUsers();
  }, 350);
}

function filterRole(role) {
  state.roleFilter = role;
  state.pagination.page = 1;

  // Update chips
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.role === role);
  });

  loadUsers();
}

// ── Create / Edit Modal ──
function openCreateModal() {
  state.editingUserId = null;
  document.getElementById('modalTitle').textContent = 'Add New User';
  document.getElementById('modalSubmitBtn').textContent = 'Create User';
  document.getElementById('modalPasswordGroup').style.display = 'block';
  document.getElementById('modalPassword').required = true;
  document.getElementById('userForm').reset();
  document.getElementById('modalStatus').value = 'true';
  document.getElementById('userModal').classList.add('active');
}

function openEditModal(userId) {
  const user = state.users.find((u) => u._id === userId);
  if (!user) return;

  state.editingUserId = userId;
  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('modalSubmitBtn').textContent = 'Save Changes';
  document.getElementById('modalPasswordGroup').style.display = 'none';
  document.getElementById('modalPassword').required = false;

  document.getElementById('modalFirstName').value = user.firstName;
  document.getElementById('modalLastName').value = user.lastName;
  document.getElementById('modalEmail').value = user.email;
  document.getElementById('modalPhone').value = user.phone || '';
  document.getElementById('modalRole').value = user.role;
  document.getElementById('modalStatus').value = String(user.isActive);

  document.getElementById('userModal').classList.add('active');
}

function closeModal() {
  document.getElementById('userModal').classList.remove('active');
  state.editingUserId = null;
}

async function handleUserFormSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('modalSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>';

  const body = {
    firstName: document.getElementById('modalFirstName').value.trim(),
    lastName: document.getElementById('modalLastName').value.trim(),
    email: document.getElementById('modalEmail').value.trim(),
    phone: document.getElementById('modalPhone').value.trim(),
    role: document.getElementById('modalRole').value,
    isActive: document.getElementById('modalStatus').value === 'true',
  };

  try {
    let res;
    if (state.editingUserId) {
      // Update
      res = await fetch(`${API_BASE}/${state.editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify(body),
      });
    } else {
      // Create
      body.password = document.getElementById('modalPassword').value;
      res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    }

    const data = await res.json();

    if (data.success) {
      showToast(
        state.editingUserId ? 'User updated successfully.' : 'User created successfully.',
        'success'
      );
      closeModal();
      loadDashboard();
    } else {
      showToast(data.message || data.errors?.join(', ') || 'Operation failed.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = state.editingUserId ? 'Save Changes' : 'Create User';
  }
}

// ── Delete Modal ──
function openDeleteModal(userId, userName) {
  state.deletingUserId = userId;
  document.getElementById('deleteUserName').textContent = `Are you sure you want to delete "${userName}"? This action cannot be undone.`;
  document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('active');
  state.deletingUserId = null;
}

async function confirmDelete() {
  if (!state.deletingUserId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>';

  try {
    const res = await fetch(`${API_BASE}/${state.deletingUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` },
    });

    const data = await res.json();

    if (data.success) {
      showToast('User deleted successfully.', 'success');
      closeDeleteModal();
      loadDashboard();
    } else {
      showToast(data.message || 'Delete failed.', 'error');
    }
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Delete User';
  }
}

// ── Toast Notifications ──
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-dismiss" onclick="dismissToast(this)">&times;</button>
  `;
  container.appendChild(toast);

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function dismissToast(btn) {
  const toast = btn.closest('.toast');
  toast.classList.add('toast-exit');
  setTimeout(() => toast.remove(), 300);
}

// ── Utilities ──
function getInitials(firstName, lastName) {
  return `${(firstName || '?')[0]}${(lastName || '?')[0]}`.toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  const duration = 600;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

function generateSkeletonRows(count) {
  let rows = '';
  for (let i = 0; i < count; i++) {
    rows += `
      <tr>
        <td><div class="user-cell"><div class="skeleton" style="width:38px;height:38px;border-radius:50%"></div><div><div class="skeleton" style="width:120px;height:14px;margin-bottom:6px"></div><div class="skeleton" style="width:160px;height:12px"></div></div></div></td>
        <td><div class="skeleton" style="width:60px;height:24px;border-radius:99px"></div></td>
        <td><div class="skeleton" style="width:70px;height:14px"></div></td>
        <td><div class="skeleton" style="width:100px;height:14px"></div></td>
        <td><div class="skeleton" style="width:80px;height:14px"></div></td>
        <td><div class="skeleton" style="width:60px;height:14px"></div></td>
      </tr>
    `;
  }
  return rows;
}
