// js/api.js — Centralized API client

const API_BASE = 'https://bhoomi-portal.onrender.com/api';

const api = {
  _token: () => localStorage.getItem('bhoomi_token'),

  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = this._token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async _req(method, path, body = null) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') {
        throw new Error(`Cannot connect to server at ${API_BASE}. Ensure backend is running and CORS is allowed.`);
      }
      throw err;
    }
  },

  get: (path) => api._req('GET', path),
  post: (path, body) => api._req('POST', path, body),
  put: (path, body) => api._req('PUT', path, body),
  patch: (path, body) => api._req('PATCH', path, body),
  delete: (path) => api._req('DELETE', path),

  async upload(path, formData) {
    const headers = {};
    const t = this._token();
    if (t) headers['Authorization'] = `Bearer ${t}`;
    const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  }
};

// ── TOAST NOTIFICATIONS ──
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: 'ti-check', error: 'ti-x', warning: 'ti-alert-triangle', info: 'ti-info-circle' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}"></i> ${message}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ── AUTH HELPERS ──
const Auth = {
  user: null,

  init() {
    const stored = localStorage.getItem('bhoomi_user');
    if (stored) { try { this.user = JSON.parse(stored); } catch (e) {} }
    return this.user;
  },

  save(token, user) {
    localStorage.setItem('bhoomi_token', token);
    localStorage.setItem('bhoomi_user', JSON.stringify(user));
    this.user = user;
  },

  clear() {
    localStorage.removeItem('bhoomi_token');
    localStorage.removeItem('bhoomi_user');
    this.user = null;
  },

  isLoggedIn() { return !!localStorage.getItem('bhoomi_token'); },

  hasRole(...roles) { return this.user && roles.includes(this.user.role); },

  isOfficialRole() { return this.hasRole('verification_officer', 'revenue_staff', 'admin', 'revenue_officer', 'surveyor', 'tahsildar', 'registrar'); },

  canVerifyDocs() { return this.hasRole('admin', 'revenue_officer', 'revenue_staff', 'verification_officer'); },
  canConductSurvey() { return this.hasRole('admin', 'surveyor'); },
  canApproveFinal() { return this.hasRole('admin', 'tahsildar', 'registrar'); },

  initials() {
    if (!this.user) return 'GU';
    return this.user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  },

  roleLabel() {
    const map = { 
      citizen: 'Citizen', 
      revenue_officer: 'Revenue Officer',
      revenue_staff: 'Revenue Staff',
      verification_officer: 'Verification Officer', 
      surveyor: 'Surveyor',
      tahsildar: 'Tahsildar',
      registrar: 'Registrar',
      admin: 'Administrator' 
    };
    return map[this.user?.role] || 'User';
  }
};

// ── FORMAT HELPERS ──
function formatDate(d, opts = {}) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', ...opts });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function formatCurrency(n) {
  if (!n) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function statusBadge(status) {
  const map = {
    submitted: ['badge-info', 'ti-send', 'Submitted'],
    under_verification: ['badge-warning', 'ti-eye', 'Document Verification'],
    pending_documents: ['badge-warning', 'ti-file-alert', 'Docs Pending'],
    survey_assigned: ['badge-info', 'ti-map-pin', 'Survey Assigned'],
    field_inspection: ['badge-info', 'ti-walk', 'Field Inspection'],
    survey_completed: ['badge-success', 'ti-report', 'Survey Completed'],
    pending_tahsildar_approval: ['badge-warning', 'ti-user-check', 'Pending Approval'],
    approved: ['badge-success', 'ti-check', 'Approved'],
    rejected: ['badge-danger', 'ti-x', 'Rejected'],
    certificate_generated: ['badge-success', 'ti-certificate', 'Certificate Generated'],
    passbook_generated: ['badge-success', 'ti-notebook', 'Passbook Generated'],
    verified: ['badge-success', 'ti-shield-check', 'Verified'],
    pending: ['badge-warning', 'ti-clock', 'Pending'],
    active: ['badge-success', 'ti-check', 'Active'],
    disputed: ['badge-danger', 'ti-alert-triangle', 'Disputed'],
    encumbered: ['badge-danger', 'ti-lock', 'Encumbered'],
    under_mutation: ['badge-warning', 'ti-arrows-exchange', 'Under Mutation'],
    forged: ['badge-danger', 'ti-ban', 'Forgery Detected'],
    completed: ['badge-success', 'ti-check', 'Completed'],
    active_status: ['badge-success', 'ti-check', 'Active']
  };
  const [cls, icon, label] = map[status] || ['badge-navy', 'ti-minus', status.replace(/_/g, ' ')];
  return `<span class="badge ${cls}"><i class="ti ${icon}"></i> ${label}</span>`;
}

function appTypeLabel(type) {
  const map = {
    mutation: 'Mutation',
    land_verification: 'Ownership Verification',
    encumbrance_certificate: 'Encumbrance Certificate (EC)',
    new_pattadar_passbook: 'New Pattadar Passbook',
    duplicate_pattadar_passbook: 'Duplicate Pattadar Passbook',
    passbook_correction: 'Passbook Correction Request',
    possession_certificate: 'Possession Certificate',
    survey_boundary_verification: 'Survey & Boundary Verification',
    // Document Types
    aadhaarCard: 'Aadhaar Card',
    saleDeed: 'Registered Sale Deed',
    passbook: 'Pattadar Passbook',
    deathCertificate: 'Death Certificate',
    legalHeirCertificate: 'Legal Heir Certificate',
    ownershipDocument: 'Land Ownership Document',
    firCopy: 'FIR Copy',
    supportingDocument: 'Supporting Evidence'
  };
  return map[type] || type.replace(/_/g, ' ');
}

// ── MODAL HELPERS ──
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) { e.target.classList.remove('open'); document.body.style.overflow = ''; }
  if (e.target.classList.contains('modal-close') || e.target.closest('.modal-close')) {
    const modal = e.target.closest('.modal-overlay');
    if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
  }
});

// ── PAGINATION ──
function renderPagination(container, pagination, onPageChange) {
  if (!pagination || pagination.pages <= 1) { container.innerHTML = ''; return; }
  let html = `<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;margin-top:16px;">
    <span style="font-size:12px;color:var(--text-3);">${pagination.total} total</span>`;
  for (let i = 1; i <= pagination.pages; i++) {
    html += `<button onclick="${onPageChange}(${i})" class="btn btn-sm ${i === pagination.page ? 'btn-primary' : 'btn-outline'}" style="min-width:32px;padding:5px 10px;">${i}</button>`;
  }
  html += `</div>`;
  container.innerHTML = html;
}

// ── DEBOUNCE ──
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// ── NUMBER ANIMATIONS ──
function animateNumber(el, target, duration = 800) {
  const start = 0;
  const startTime = performance.now();
  const update = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const val = Math.floor(progress * target);
    el.textContent = val.toLocaleString('en-IN');
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target.toLocaleString('en-IN');
  };
  requestAnimationFrame(update);
}
