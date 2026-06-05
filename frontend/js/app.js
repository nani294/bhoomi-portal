// js/app.js — Main application controller

const App = {
  currentPage: null,

  async init() {
    Auth.init();
    if (!Auth.isLoggedIn()) {
      this.showLanding();
      return;
    }
    this.showApp();
    await this.loadPage('dashboard');
  },

  showLanding() {
    Transitions.toLanding();
    setTimeout(() => {
      document.querySelectorAll('.s-num').forEach(el => {
        const target = parseInt(el.dataset.val);
        if (target) animateNumber(el, target);
      });
    }, 100);
  },

  showLogin() {
    Transitions.toLogin(() => { Login.init(); });
  },

  showApp() {
    Transitions.toApp(() => {
      this.buildSidebar();
      this.buildTopbar();
    });
  },

  buildSidebar() {
    const user = Auth.user;
    document.getElementById('sidebar-avatar').textContent = Auth.initials();
    document.getElementById('sidebar-name').textContent = user.fullName;
    document.getElementById('sidebar-role').textContent = Auth.roleLabel();

    const isOfficial = Auth.isOfficialRole();
    const isAdmin = Auth.hasRole('admin');
    const isSurveyor = Auth.hasRole('surveyor');
    const isTahsildar = Auth.hasRole('tahsildar', 'registrar');
    const isRevOfficer = Auth.hasRole('revenue_officer', 'verification_officer', 'revenue_staff');

    let navHTML = `
      <div class="nav-group">
        <div class="nav-group-label">Main</div>
        <button class="nav-item" data-page="dashboard"><i class="ti ti-layout-dashboard"></i> Dashboard</button>
        <button class="nav-item" data-page="search"><i class="ti ti-search"></i> Search Records</button>
        <button class="nav-item" data-page="map"><i class="ti ti-map-2"></i> GIS Map View</button>
      </div>`;

    // CITIZEN ONLY
    if (user.role === 'citizen') {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">My Services</div>
        <button class="nav-item" data-page="apply"><i class="ti ti-file-plus"></i> Apply / Upload</button>
        <button class="nav-item" data-page="track"><i class="ti ti-radar"></i> Track My Applications</button>
        <button class="nav-item" data-page="certificates"><i class="ti ti-certificate"></i> My Certificates</button>
      </div>`;
    }

    // SURVEYOR
    if (isSurveyor || isAdmin) {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Field Work</div>
        <button class="nav-item" data-page="applications"><i class="ti ti-inbox"></i> Survey Assignments <span class="nav-badge" id="badge-apps">0</span></button>
      </div>`;
    }

    // REVENUE OFFICER / VERIFICATION
    if (isRevOfficer || isAdmin) {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Verification</div>
        <button class="nav-item" data-page="applications"><i class="ti ti-inbox"></i> Verification Queue <span class="nav-badge" id="badge-apps">0</span></button>
        <button class="nav-item" data-page="verify"><i class="ti ti-shield-check"></i> Document Review</button>
        <button class="nav-item" data-page="mutations"><i class="ti ti-arrows-exchange"></i> Mutations</button>
      </div>`;
    }

    // TAHSILDAR
    if (isTahsildar || isAdmin) {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Approvals</div>
        <button class="nav-item" data-page="applications"><i class="ti ti-gavel"></i> Pending Approvals <span class="nav-badge" id="badge-apps">0</span></button>
      </div>`;
    }

    // OFFICIALS + ADMIN: Fraud Alerts
    if (isOfficial || isAdmin) {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Security</div>
        <button class="nav-item" data-page="fraud"><i class="ti ti-alert-triangle"></i> Fraud Alerts <span class="nav-badge" id="badge-fraud">0</span></button>
      </div>`;
    }

    // WORKLOAD
    if (isOfficial) {
       navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">My Workload</div>
        <button class="nav-item" data-page="applications" onclick="setTimeout(() => { document.getElementById('f-assigned').value = 'me'; Pages.applications.applyFilters(); }, 100)">
          <i class="ti ti-briefcase"></i> Assigned to Me <span class="nav-badge" id="badge-assigned">0</span>
        </button>
      </div>`;
    }

    // ADMIN ONLY
    if (isAdmin) {
      navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Admin System</div>
        <button class="nav-item" data-page="users"><i class="ti ti-users"></i> User Management</button>
        <button class="nav-item" data-page="reports"><i class="ti ti-chart-bar"></i> Reports & Analytics</button>
        <button class="nav-item" data-page="land-add"><i class="ti ti-map-pin-plus"></i> Add Land Record</button>
      </div>`;
    }

    navHTML += `
      <div class="nav-group">
        <div class="nav-group-label">Account</div>
        <button class="nav-item" data-page="notifications"><i class="ti ti-bell"></i> Notifications <span class="nav-badge" id="badge-notif">0</span></button>
        <button class="nav-item" data-page="audit"><i class="ti ti-clipboard-list"></i> Audit Logs</button>
        <button class="nav-item" data-page="profile"><i class="ti ti-user-circle"></i> My Profile</button>
      </div>`;

    document.getElementById('sidebar-nav').innerHTML = navHTML;

    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.loadPage(btn.dataset.page));
    });

    this.loadBadges();
  },

  buildTopbar() {
    document.getElementById('topbar-user-name').textContent = Auth.user?.fullName || 'User';
    const searchInput = document.getElementById('topbar-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          this.loadPage('search', { q: searchInput.value.trim() });
        }
      });
    }
  },

  async loadBadges() {
    try {
      const promises = [
        api.get('/applications/stats').catch(() => null),
        api.get('/notifications').catch(() => null)
      ];

      if (Auth.user && Auth.user._id) {
        promises.push(api.get(`/applications?assignedTo=${Auth.user._id}&limit=1`).catch(() => null));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [appStats, notifData, myApps] = await Promise.all(promises);
      
      if (appStats?.data) {
        const pending = appStats.data.submitted + appStats.data.under_review;
        const el = document.getElementById('badge-apps');
        if (el) el.textContent = pending > 0 ? pending : '';
        
        const fraudEl = document.getElementById('badge-fraud');
        if (fraudEl) fraudEl.textContent = appStats.data.flagged > 0 ? appStats.data.flagged : '';
      }

      if (myApps?.pagination) {
        const bAssigned = document.getElementById('badge-assigned');
        if (bAssigned) bAssigned.textContent = myApps.pagination.total > 0 ? myApps.pagination.total : '';
      }

      if (notifData) {
        this.notifDataCache = notifData.data || [];
        if (notifData.unreadCount > 0) {
          const el = document.getElementById('badge-notif');
          if (el) el.textContent = notifData.unreadCount;
          const dot = document.getElementById('topbar-notif-dot');
          if (dot) dot.classList.remove('hidden');
        } else {
          const el = document.getElementById('badge-notif');
          if (el) el.textContent = '';
          const dot = document.getElementById('topbar-notif-dot');
          if (dot) dot.classList.add('hidden');
        }
        this.renderNotifPanel();
      }
    } catch (e) {}
  },

  renderNotifPanel() {
    const list = document.getElementById('notif-panel-list');
    if (!list) return;
    const notifs = this.notifDataCache || [];
    if (notifs.length === 0) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3);font-size:12px;">No recent notifications.</div>`;
      return;
    }
    list.innerHTML = notifs.slice(0, 5).map(n => `
      <div class="notif-item ${n.isRead ? '' : 'unread'}">
        <div class="notif-icon" style="background:${n.isRead ? 'var(--surface-2)' : 'var(--gold-pale)'}; color:${n.isRead ? 'var(--text-3)' : 'var(--amber)'};">
          <i class="ti ti-${n.type === 'alert' ? 'alert-triangle' : 'bell'}"></i>
        </div>
        <div class="notif-body" onclick="App.markRead('${n._id}')">
          <h4>${n.title}</h4>
          <p>${n.message}</p>
        </div>
        ${!n.isRead ? `<button class="btn btn-outline btn-sm" style="padding:4px 8px;font-size:10px;" onclick="App.markRead('${n._id}')" title="Mark as read"><i class="ti ti-check"></i></button>` : ''}
      </div>
    `).join('');
  },

  async markAllRead() {
    try {
      await api.patch('/notifications/mark-read');
      await this.loadBadges();
      showToast('All notifications marked as read.', 'success');
    } catch (e) {}
  },

  async markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      await this.loadBadges();
    } catch (e) {}
  },

  async loadPage(pageId, params = {}) {
    this.currentPage = pageId;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll(`.nav-item[data-page="${pageId}"]`).forEach(n => n.classList.add('active'));

    const titles = {
      dashboard: 'Dashboard', search: 'Search Land Records', map: 'GIS Map View',
      apply: 'New Application', track: 'Track My Applications', certificates: 'My Certificates',
      'citizen-applications': 'Citizen Applications',
      applications: 'Applications Queue', verify: 'Document Verification',
      fraud: 'Fraud Detection', mutations: 'Mutation Records',
      users: 'User Management', reports: 'Reports & Analytics',
      'land-add': 'Add Land Record', notifications: 'Notifications',
      audit: 'Audit Logs', profile: 'My Profile',
      'survey-assignments': 'Survey Assignments',
      'verification-queue': 'Verification Queue',
      'pending-approvals': 'Pending Approvals',
      'fraud-alerts': 'Fraud Alerts',
      'document-review': 'Document Review'
    };
    const topbarTitle = document.getElementById('topbar-title');
    if (topbarTitle) topbarTitle.textContent = titles[pageId] || 'BhoomiSeva';

    const container = document.getElementById('page-container');
    container.classList.remove('animate-in');
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:3rem;"><div class="loading-spinner" style="width:32px;height:32px;border-width:3px;border-color:rgba(13,33,55,0.2);border-top-color:var(--navy);"></div></div>`;

    const pages = {
      dashboard: Pages.dashboard,
      search: Pages.search,
      map: Pages.map,
      apply: Pages.apply,
      track: Pages.track,
      certificates: Pages.certificates,
      'citizen-applications': Pages.citizenApplications,
      applications: Pages.applications,
      verify: Pages.verify,
      fraud: Pages.fraud,
      mutations: Pages.mutations,
      users: Pages.users,
      reports: Pages.reports,
      'land-add': Pages.landAdd,
      notifications: Pages.notifications,
      audit: Pages.audit,
      profile: Pages.profile,
      'survey-assignments': Pages.applications,
      'verification-queue': Pages.applications,
      'pending-approvals': Pages.applications,
      'fraud-alerts': Pages.fraud,
      'document-review': Pages.verify
    };

    if (pages[pageId]) {
      await pages[pageId].render(container, params);
      container.classList.add('animate-in');
    } else {
      container.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3);">Page not found</div>`;
    }
  },

  logout() {
    Auth.clear();
    showToast('Logged out successfully.', 'success');
    setTimeout(() => { this.showLogin(); }, 500);
  }
};

// ── LOGIN PAGE ──
const Login = {
  selectedRole: 'citizen',
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    const form = document.getElementById('login-form');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); this.doLogin(); });

    document.querySelectorAll('.role-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.selectedRole = tab.dataset.role;
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
      });
    });

    // Quick demo fill
    document.querySelectorAll('.demo-fill').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('login-email').value = btn.dataset.email;
        document.getElementById('login-password').value = btn.dataset.pass;
      });
    });
  },

  async doLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');

    if (!email || !password) { errEl.textContent = 'Please enter email and password.'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');

    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner"></span> Signing in…`;

    try {
      const res = await api.post('/auth/login', { email, password, portalRole: this.selectedRole });
      Auth.save(res.token, res.user);
      showToast(`Welcome back, ${res.user.fullName}!`, 'success');
      App.showApp();
      await App.loadPage('dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<i class="ti ti-login"></i> Sign In Securely`;
    }
  }
};

// ── BOOTSTRAP ──
document.addEventListener('DOMContentLoaded', () => {
  App.init();

  // Mobile sidebar toggle
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.getElementById('app-screen').addEventListener('click', e => {
      if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) sidebar.classList.remove('open');
    });
  }

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', () => App.logout());
  document.getElementById('topbar-notif-btn')?.addEventListener('click', () => App.loadPage('notifications'));
  document.getElementById('topbar-profile-btn')?.addEventListener('click', () => App.loadPage('profile'));
});
