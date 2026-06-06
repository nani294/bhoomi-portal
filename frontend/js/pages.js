// js/pages.js — All page renderers

const Pages = {};

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════
Pages.dashboard = {
  async render(container) {
    const user = Auth.user;
    const isOfficial = Auth.isOfficialRole();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>${greeting}, ${user.fullName.split(' ')[0]} 👋</h1>
          <p style="margin-top:4px;">${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })} · <span class="badge badge-navy">${Auth.roleLabel()}</span></p>
        </div>
        ${Auth.user.role === 'citizen' ? `<button class="btn btn-primary" onclick="App.loadPage('apply')"><i class="ti ti-plus"></i> New Application</button>` : ''}
      </div>
      <div class="stat-grid" id="stat-grid">
        ${[1,2,3,4].map(() => `
          <div class="sc-card sc-navy" style="border-top:3px solid var(--border)">
            <div class="sc-top">
              <div class="skeleton" style="height:46px;width:46px;border-radius:13px;"></div>
              <div class="skeleton" style="height:22px;width:80px;border-radius:20px;"></div>
            </div>
            <div class="skeleton" style="height:44px;width:56px;border-radius:8px;margin-bottom:8px;"></div>
            <div class="skeleton" style="height:11px;width:110px;border-radius:6px;margin-bottom:14px;"></div>
            <div class="skeleton" style="height:3px;border-radius:3px;"></div>
          </div>`).join('')}
      </div>
      <div class="left-wide" id="dash-content">
        <div class="card">
          <div class="card-header">
            <h3><i class="ti ti-list" style="color:var(--blue);margin-right:8px;"></i>Recent Applications</h3>
            <button class="btn btn-outline btn-sm" onclick="App.loadPage('${Auth.user.role === 'citizen' ? 'track' : 'citizen-applications'}')">View all</button>
          </div>
          <div class="card-body" style="padding:0;" id="dash-recent"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:24px;">
          <div class="card" id="dash-activity">
            <div class="card-header">
              <h3><i class="ti ti-activity" style="color:var(--teal);margin-right:8px;"></i>Live Activity</h3>
            </div>
            <div class="card-body" style="padding:8px 16px;" id="dash-activity-list"></div>
          </div>
          <div class="card">
            <div class="card-header">
              <h3><i class="ti ti-chart-bar" style="color:var(--gold);margin-right:8px;"></i>Weekly Overview</h3>
            </div>
            <div class="card-body" id="dash-chart"></div>
          </div>
        </div>
      </div>`;

    await this.loadStats(isOfficial);
    await this.loadRecent(Auth.user.role !== 'citizen');
    await this.renderActivity();
    this.renderWeekChart();
  },

  async loadStats(isOfficial) {
    const makeCard = (color, icon, value, label, sub, subIcon = 'ti-point', accent = false) => `
      <div class="sc-card sc-${color}${accent ? ' sc-accent' : ''}">
        <div class="sc-top">
          <div class="sc-icon-wrap sc-icon-${color}"><i class="ti ${icon}"></i></div>
          <div class="sc-pill sc-pill-${color}"><i class="ti ${subIcon}"></i>${sub}</div>
        </div>
        <div class="sc-value" data-val="${value}">0</div>
        <div class="sc-label">${label}</div>
        <div class="sc-bar"><div class="sc-bar-fill sc-bar-${color}" style="width:${Math.min(100, Math.max(8, value * 12))}%"></div></div>
      </div>`;

    try {
      const [appStats, landStats] = await Promise.all([
        api.get('/applications/stats'),
        api.get('/land/stats/overview')
      ]);
      const a = appStats.data, l = landStats.data;
      const grid = document.getElementById('stat-grid');
      const role = Auth.user.role;
      if (!grid) return;

      if (role === 'citizen') {
        grid.innerHTML =
          makeCard('navy', 'ti-file-text',    a.total,                       'My Applications',  'All time',           'ti-infinity') +
          makeCard('gold', 'ti-loader',       a.submitted + a.under_review,  'In Progress',      'Pending completion', 'ti-clock') +
          makeCard('teal', 'ti-circle-check', a.approved,                    'Approved',          'Completed',         'ti-trending-up') +
          makeCard('red',  'ti-certificate',  Math.max(0, a.approved),       'Certificates',     'Ready to download',  'ti-download');
      } else if (role === 'surveyor') {
        grid.innerHTML =
          makeCard('navy', 'ti-map-pin',        a.total,        'Total Assigned',      'Assigned to you',    'ti-user') +
          makeCard('gold', 'ti-walk',           a.under_review, 'Pending Inspection',  'Field visits due',   'ti-clock') +
          makeCard('teal', 'ti-report-analytics',a.approved,    'Surveys Completed',   'All time',           'ti-trending-up') +
          makeCard('red',  'ti-alert-triangle', a.flagged || 0, 'Disputed Boundaries', 'Needs review',       'ti-alert-triangle', true);
      } else if (role === 'tahsildar' || role === 'registrar') {
        grid.innerHTML =
          makeCard('navy', 'ti-file-stack',    a.total,        'Total Applications',  'In system',          'ti-database') +
          makeCard('gold', 'ti-user-check',    a.under_review, 'Pending Approval',    'Awaiting you',       'ti-clock', true) +
          makeCard('teal', 'ti-circle-check',  a.approved,     'Total Approved',      'Successfully done',  'ti-trending-up') +
          makeCard('red',  'ti-circle-x',      a.rejected,     'Total Rejected',      'Declined',           'ti-x');
      } else {
        // Revenue Officer / Admin
        const newToday = a.submitted || 0;
        const fraudActive = a.flagged || 0;
        grid.innerHTML =
          makeCard('navy', 'ti-file-text',      a.total,                      'Total Applications',  `${newToday} new today`,          'ti-trending-up') +
          makeCard('gold', 'ti-hourglass',      a.submitted + a.under_review, 'Pending Review',      'Requires action',                'ti-clock', (a.submitted + a.under_review) > 0) +
          makeCard('teal', 'ti-shield-check',   l.verified || 0,              'Verified Records',    `${l.total || 0} total records`,  'ti-database') +
          makeCard('red',  'ti-alert-triangle', fraudActive,                  'Fraud Alerts',        `${fraudActive} active`,          'ti-alert-triangle', fraudActive > 0);
      }

      grid.querySelectorAll('[data-val]').forEach(el => animateNumber(el, parseInt(el.dataset.val) || 0));
    } catch (err) {
      document.getElementById('stat-grid').innerHTML = `<div style="grid-column:span 4;text-align:center;padding:1rem;color:var(--text-3);">Could not load statistics. <small>${err.message}</small></div>`;
    }
  },

  async loadRecent(isOfficial) {
    try {
      const res = await api.get('/applications?limit=5');
      const apps = res.data;
      const el = document.getElementById('dash-recent');
      if (!el) return;
      if (!apps.length) {
        const isCitizen = Auth.user.role === 'citizen';
        el.innerHTML = isCitizen
          ? `<div style="padding:2rem;text-align:center;color:var(--text-3);">No applications yet. <button class="btn btn-primary btn-sm" onclick="App.loadPage('apply')" style="margin-left:8px;">Apply now</button></div>`
          : `<div style="padding:2rem;text-align:center;color:var(--text-3);">No citizen applications submitted yet.</div>`;
        return;
      }
      const isNotCitizen = Auth.user.role !== 'citizen';
      el.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>App ID</th><th>Applicant</th><th>Survey No.</th><th>Type</th><th>Status</th>${isNotCitizen ? '<th>Action</th>' : ''}</tr></thead>
        <tbody>${apps.map(a => `
          <tr>
            <td class="mono">${a.applicationId}</td>
            <td>${a.applicantName || a.applicant?.fullName || '—'}</td>
            <td class="mono">${a.surveyNumber || '—'}</td>
            <td><span class="badge badge-navy">${appTypeLabel(a.applicationType)}</span></td>
            <td>${statusBadge(a.status)}</td>
            ${isNotCitizen ? `<td><button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')"><i class="ti ti-eye"></i> View</button></td>` : ''}
          </tr>`).join('')}
        </tbody></table></div>`;
    } catch (err) {
      document.getElementById('dash-recent').innerHTML = `<div style="padding:1.5rem;color:var(--red);font-size:13px;">${err.message}</div>`;
    }
  },

  async renderActivity() {
    const el = document.getElementById('dash-activity-list');
    if (!el) return;
    try {
      const res = await api.get('/audit?limit=5');
      const logs = res.data;
      if (!logs || !logs.length) {
        el.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--text-3);font-size:13px;">
          <i class="ti ti-activity" style="font-size:28px;display:block;margin-bottom:8px;opacity:0.4;"></i>
          No activity yet
        </div>`;
        return;
      }
      const iconMap = {
        'Create User': { icon: 'ti-user-plus', cls: 'done' },
        'User Login': { icon: 'ti-login', cls: 'done' },
        'Create Application': { icon: 'ti-file-plus', cls: 'done' },
        'Update Application Status': { icon: 'ti-check', cls: 'done' },
        'Certificate Issued': { icon: 'ti-certificate', cls: 'done' },
        'Document Upload': { icon: 'ti-upload', cls: 'done' },
        'Flag Application': { icon: 'ti-alert-triangle', cls: 'active' },
        'Duplicate Record Flagged': { icon: 'ti-alert-triangle', cls: 'active' },
        'Application Rejected': { icon: 'ti-x', cls: 'rejected' },
        'Verify Land Record': { icon: 'ti-shield-check', cls: 'done' },
        'System Initialized': { icon: 'ti-settings', cls: 'done' }
      };
      el.innerHTML = logs.map(log => {
        const cfg = iconMap[log.action] || { icon: 'ti-activity', cls: 'done' };
        return `
        <div class="tl-item">
          <div class="tl-dot ${cfg.cls}"><i class="ti ${cfg.icon}"></i></div>
          <div class="tl-content">
            <h4 style="font-weight:500;">${log.action}</h4>
            <p>${log.userName || 'System'} · ${timeAgo(log.createdAt)}</p>
            ${log.details ? `<div class="tl-remark" style="font-size:11px;">${log.details}</div>` : ''}
          </div>
        </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text-3);font-size:12px;">Could not load activity</div>`;
    }
  },

  renderWeekChart() {
    const el = document.getElementById('dash-chart');
    if (!el) return;
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const today = new Date().getDay();
    const todayIdx = today === 0 ? 6 : today - 1;
    // Show empty chart when no data
    const vals = [0,0,0,0,0,0,0];
    vals[todayIdx] = 0;
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;color:var(--text-3);">Applications submitted this week</span>
        <span style="font-size:13px;font-weight:600;" id="week-total">0 total</span>
      </div>
      <div class="mini-chart" id="week-chart-bars">
        ${days.map((d,i) => `<div class="bar-col ${i===todayIdx?'active':''}" style="height:10%;opacity:0.15;" data-day="${i}"></div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        ${days.map((d,i) => `<span style="font-size:10px;color:${i===todayIdx?'var(--navy)':'var(--text-3)'};font-weight:${i===todayIdx?600:400};">${d}</span>`).join('')}
      </div>`;
    // Try to load real data
    api.get('/applications?limit=50').then(res => {
      const apps = res.data || [];
      const counts = [0,0,0,0,0,0,0];
      const now = new Date();
      apps.forEach(a => {
        const d = new Date(a.createdAt);
        const diff = Math.floor((now - d) / 86400000);
        if (diff < 7) {
          const idx = (todayIdx - diff + 7) % 7;
          counts[idx]++;
        }
      });
      const max = Math.max(...counts, 1);
      const total = counts.reduce((a,b)=>a+b,0);
      const totalEl = document.getElementById('week-total');
      if (totalEl) totalEl.textContent = total + ' total';
      const bars = document.querySelectorAll('#week-chart-bars .bar-col');
      bars.forEach((bar, i) => {
        const h = Math.max(Math.round(counts[i]/max*100), counts[i]>0?10:5);
        bar.style.height = h + '%';
        bar.style.opacity = i === todayIdx ? '1' : counts[i] > 0 ? '0.5' : '0.1';
      });
    }).catch(() => {});
  }
};

// ══════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════
Pages.search = {
  page: 1,
  lastQuery: {},

  async render(container, params = {}) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Search Land Records</h1><p>Find land records by survey number, owner name, registration ID, or location</p></div>
      </div>
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body">
          <div class="search-bar" style="margin-bottom:12px;">
            <input class="form-control" id="s-query" placeholder="Survey number, owner name, registration ID…" value="${params.q || ''}">
            <select class="form-control" id="s-district" style="flex:0 0 180px;" onchange="GeoData.setupDependentDropdown('s-district', 's-mandal')">
              <option value="">All Districts</option>
              ${GeoData.getDistrictOptions()}
            </select>
            <select class="form-control" id="s-mandal" style="flex:0 0 160px;" disabled>
              <option value="">All Mandals</option>
            </select>
            <select class="form-control" id="s-type" style="flex:0 0 140px;">
              <option value="">All Types</option>
              <option value="agricultural">Agricultural</option>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="industrial">Industrial</option>
            </select>
            <select class="form-control" id="s-vstatus" style="flex:0 0 140px;">
              <option value="">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
            </select>
            <button class="btn btn-primary" id="s-btn" onclick="Pages.search.doSearch(1)"><i class="ti ti-search"></i> Search</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <span style="font-size:12px;color:var(--text-3);">Search by:</span>
            <span class="badge badge-navy">Survey Number &nbsp;e.g. SY-001/1A</span>
            <span class="badge badge-navy">Owner Name</span>
            <span class="badge badge-navy">Registration ID &nbsp;e.g. REG-2026-00001</span>
          </div>
        </div>
      </div>
      <div id="s-results"></div>
      <div id="s-pagination"></div>`;

    document.getElementById('s-query').addEventListener('keydown', e => { if (e.key === 'Enter') this.doSearch(1); });
    if (params.q) { document.getElementById('s-query').value = params.q; await this.doSearch(1); }
  },

  quick(q) {
    document.getElementById('s-query').value = q;
    this.doSearch(1);
  },

  async doSearch(page = 1) {
    this.page = page;
    const query = document.getElementById('s-query').value.trim();
    const district = document.getElementById('s-district').value;
    const mandal = document.getElementById('s-mandal')?.value || "";
    const landType = document.getElementById('s-type').value;
    const verificationStatus = document.getElementById('s-vstatus').value;

    this.lastQuery = { query, district, mandal, landType, verificationStatus };
    const btn = document.getElementById('s-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="loading-spinner"></span>`; }

    const el = document.getElementById('s-results');
    el.innerHTML = `<div style="padding:2rem;text-align:center;"><div class="loading-spinner" style="width:28px;height:28px;border-width:3px;border-color:rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div>`;

    try {
      const params = new URLSearchParams({ page, limit: 5 });
      if (query) params.set('search', query);
      if (district) params.set('district', district);
      if (mandal) params.set('mandal', mandal);
      if (landType) params.set('landType', landType);
      if (verificationStatus) params.set('verificationStatus', verificationStatus);

      const res = await api.get(`/land?${params}`);
      this.renderResults(res.data, el);
      renderPagination(document.getElementById('s-pagination'), res.pagination, 'Pages.search.doSearch');
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i> ${err.message}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<i class="ti ti-search"></i> Search`; }
    }
  },

  renderResults(records, el) {
    if (!records.length) {
      el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3);"><i class="ti ti-search" style="font-size:40px;display:block;margin-bottom:12px;"></i><h3 style="margin-bottom:6px;">No records found</h3><p>Try different keywords or remove filters</p></div>`;
      return;
    }
    el.innerHTML = records.map(r => `
      <div class="record-card">
        <div class="record-card-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="mono" style="font-weight:700;color:var(--navy);">${r.surveyNumber}</span>
            ${statusBadge(r.verificationStatus)}
            <span class="badge badge-navy">${r.landType?.replace('_',' ')}</span>
            ${r.isFlagged ? `<span class="badge badge-danger"><i class="ti ti-flag"></i> Flagged</span>` : ''}
          </div>
          <span style="font-size:12px;color:var(--text-3);">Updated ${formatDate(r.updatedAt)}</span>
        </div>
        <div class="record-card-body">
          <div class="record-detail"><label>Owner</label><span>${r.currentOwner?.name || '—'}</span></div>
          <div class="record-detail"><label>Extent</label><span>${r.extent?.value} ${r.extent?.unit?.replace('_',' ')}</span></div>
          <div class="record-detail"><label>District</label><span>${r.district}</span></div>
          <div class="record-detail"><label>Mandal</label><span>${r.mandal}</span></div>
          <div class="record-detail"><label>Reg. No.</label><span class="mono">${r.registrationId || '—'}</span></div>
        </div>
        <div class="record-card-footer">
          <button class="btn btn-primary btn-sm" onclick="Pages.search.viewRecord('${r._id}')"><i class="ti ti-eye"></i> Full Details</button>
          <button class="btn btn-outline btn-sm" onclick="Pages.search.viewHistory('${r._id}', '${r.surveyNumber}')"><i class="ti ti-history"></i> Ownership History</button>
          ${r.gisData?.latitude && r.gisData?.longitude ? `
            <button class="btn btn-outline btn-sm" onclick="Pages.map.locateOnMap(${r.gisData.latitude}, ${r.gisData.longitude}, '${r._id}')">
              <i class="ti ti-map-pin"></i> View on Map
            </button>` : `
            <button class="btn btn-outline btn-sm" onclick="App.loadPage('map')" title="Coordinates not available">
              <i class="ti ti-map"></i> View Map
            </button>`}
          ${r.verificationStatus === 'verified' ? `<button class="btn btn-success btn-sm" style="margin-left:auto;" onclick="Pages.search.downloadCert('${r._id}')"><i class="ti ti-download"></i> Certificate</button>` : ''}
          ${Auth.isOfficialRole() && r.verificationStatus !== 'verified' ? `<button class="btn btn-gold btn-sm" style="margin-left:auto;" onclick="Pages.search.verifyRecord('${r._id}')"><i class="ti ti-shield-check"></i> Verify</button>` : ''}
        </div>
      </div>`).join('');
  },

  async viewRecord(id) {
    try {
      const res = await api.get(`/land/${id}`);
      const r = res.data;
      const html = `
        <div class="modal-overlay" id="record-modal">
          <div class="modal" style="max-width:700px;">
            <div class="modal-header">
              <h3><i class="ti ti-map-pin" style="margin-right:8px;"></i>Land Record — ${r.surveyNumber}</h3>
              <button class="modal-close"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
              <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
                ${statusBadge(r.verificationStatus)} ${statusBadge(r.status)} <span class="badge badge-navy">${r.landType?.replace(/_/g,' ')}</span>
              </div>
              <div class="form-grid" style="margin-bottom:16px;">
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Survey Number</strong><p class="mono" style="margin-top:3px;">${r.surveyNumber}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Registration ID</strong><p class="mono" style="margin-top:3px;">${r.registrationId || '—'}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Owner Name</strong><p style="margin-top:3px;">${r.currentOwner?.name}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Contact</strong><p style="margin-top:3px;">${r.currentOwner?.contact || '—'}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">District / Mandal</strong><p style="margin-top:3px;">${r.district}, ${r.mandal}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Village</strong><p style="margin-top:3px;">${r.village}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Extent</strong><p style="margin-top:3px;">${r.extent?.value} ${r.extent?.unit?.replace(/_/g,' ')}</p></div>
                <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;">Market Value</strong><p style="margin-top:3px;">${formatCurrency(r.marketValue)}</p></div>
              </div>
              ${r.boundaries ? `
              <div style="margin-bottom:14px;padding:12px;background:var(--surface);border-radius:8px;">
                <strong style="font-size:12px;font-weight:600;color:var(--text-2);">Boundaries</strong>
                <div class="form-grid" style="margin-top:8px;">
                  <div><label style="font-size:11px;color:var(--text-3);">North</label><p>${r.boundaries.north || '—'}</p></div>
                  <div><label style="font-size:11px;color:var(--text-3);">South</label><p>${r.boundaries.south || '—'}</p></div>
                  <div><label style="font-size:11px;color:var(--text-3);">East</label><p>${r.boundaries.east || '—'}</p></div>
                  <div><label style="font-size:11px;color:var(--text-3);">West</label><p>${r.boundaries.west || '—'}</p></div>
                </div>
              </div>` : ''}
              ${r.encumbrance?.isActive ? `<div class="alert alert-danger"><i class="ti ti-lock"></i><div><strong>Encumbrance Active:</strong> ${r.encumbrance.type} — ${r.encumbrance.details}</div></div>` : ''}
              ${r.isFlagged ? `<div class="alert alert-danger"><i class="ti ti-flag"></i><div><strong>Record Flagged:</strong> ${r.flagReason}</div></div>` : ''}
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="closeModal('record-modal')">Close</button>
              ${r.verificationStatus === 'verified' ? `<button class="btn btn-success" onclick="Pages.search.downloadCert('${r._id}')"><i class="ti ti-download"></i> Download Certificate</button>` : ''}
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      openModal('record-modal');
    } catch (err) { showToast(err.message, 'error'); }
  },

  async viewHistory(id, surveyNumber) {
    try {
      const res = await api.get(`/land/${id}/history`);
      const { currentOwner, history } = res.data;
      const allOwners = [
        { ownerName: currentOwner.name, fromDate: null, toDate: null, transferType: 'current', current: true },
        ...(history || []).sort((a, b) => new Date(b.fromDate) - new Date(a.fromDate))
      ];
      const html = `
        <div class="modal-overlay" id="history-modal">
          <div class="modal">
            <div class="modal-header"><h3><i class="ti ti-history" style="margin-right:8px;"></i>Ownership History — ${surveyNumber}</h3><button class="modal-close"><i class="ti ti-x"></i></button></div>
            <div class="modal-body">
              <div class="timeline">
                ${allOwners.map(o => `
                  <div class="tl-item">
                    <div class="tl-dot ${o.current ? 'active' : 'done'}"><i class="ti ti-user"></i></div>
                    <div class="tl-content">
                      <h4>${o.ownerName} ${o.current ? '<span class="badge badge-success" style="margin-left:6px;">Current Owner</span>' : ''}</h4>
                      <p>${o.current ? 'Present owner' : `${formatDate(o.fromDate)} — ${o.toDate ? formatDate(o.toDate) : 'Present'}`} · ${o.transferType?.replace(/_/g,' ')} ${o.registrationNumber ? `· <span class="mono">${o.registrationNumber}</span>` : ''}</p>
                      ${o.remarks ? `<div class="tl-remark">${o.remarks}</div>` : ''}
                    </div>
                  </div>`).join('')}
              </div>
            </div>
            <div class="modal-footer"><button class="btn btn-outline" onclick="closeModal('history-modal')">Close</button></div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      openModal('history-modal');
    } catch (err) { showToast(err.message, 'error'); }
  },

  async downloadCert(id) {
    try {
      showToast('Fetching certificate…', 'info');
      const res = await api.get(`/applications?landRecord=${id}&status=certificate_generated,passbook_generated&limit=1`);
      const apps = res.data;
      if (apps && apps.length > 0 && apps[0].certificateDetails?.pdfPath) {
        Pages.applications.downloadCertificate(apps[0]._id);
      } else {
        showToast('No generated certificate found for this record.', 'warning');
      }
    } catch (err) {
      showToast('Failed to fetch certificate: ' + err.message, 'error');
    }
  },

  async verifyRecord(id) {
    try {
      await api.patch(`/land/${id}/verify`, { verificationStatus: 'verified', remarks: 'Verified by officer' });
      showToast('Record verified successfully!', 'success');
      this.doSearch(this.page);
    } catch (err) { showToast(err.message, 'error'); }
  }
};

// ══════════════════════════════════════════
// MAP VIEW — Leaflet GIS Implementation
// ══════════════════════════════════════════
Pages.map = {
  map: null,
  markers: null,
  records: [],
  layers: {},

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>GIS Land Map</h1><p>Andhra Pradesh Interactive Parcel & Record Visualization</p></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn btn-outline btn-sm" onclick="Pages.map.resetMap()"><i class="ti ti-maximize"></i> Reset View</button>
          <button class="btn btn-outline btn-sm" onclick="Pages.map.loadRecords()"><i class="ti ti-refresh"></i> Refresh</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:12px 18px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input class="form-control" id="map-search" placeholder="Search Survey No / Owner / Reg ID…" style="flex:1;min-width:250px;padding:8px 12px;">
            <select class="form-control" id="map-district" style="width:160px;padding:8px 12px;" onchange="GeoData.setupDependentDropdown('map-district', 'map-mandal'); Pages.map.applyFilters()">
              <option value="">All Districts</option>
              ${GeoData.getDistrictOptions()}
            </select>
            <select class="form-control" id="map-mandal" style="width:160px;padding:8px 12px;" disabled onchange="Pages.map.applyFilters()">
              <option value="">All Mandals</option>
            </select>
            <select class="form-control" id="map-status" style="width:140px;padding:8px 12px;" onchange="Pages.map.applyFilters()">
              <option value="">All Status</option>
              <option value="verified">Verified</option>
              <option value="under_review">Under Review</option>
              <option value="disputed">Disputed</option>
            </select>
            <button class="btn btn-primary" onclick="Pages.map.applyFilters()"><i class="ti ti-filter"></i> Apply Filters</button>
          </div>
        </div>
      </div>

      <div class="two-col" style="grid-template-columns: 1fr 320px; gap: 16px;">
        <div class="card" style="height: 600px; position: relative;">
          <div id="leaflet-map" style="width:100%; height:100%; border-radius: var(--radius); z-index: 10;"></div>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="card" id="map-stats-card">
            <div class="card-header"><h3>Map Statistics</h3></div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="text-align:center;background:var(--teal-pale);border-radius:8px;padding:12px;"><div style="font-size:20px;font-weight:700;color:var(--teal);" id="map-cnt-verified">0</div><div style="font-size:10px;color:var(--teal);text-transform:uppercase;">Verified</div></div>
                <div style="text-align:center;background:var(--amber-pale);border-radius:8px;padding:12px;"><div style="font-size:20px;font-weight:700;color:var(--amber);" id="map-cnt-review">0</div><div style="font-size:10px;color:var(--amber);text-transform:uppercase;">In Review</div></div>
                <div style="text-align:center;background:var(--red-pale);border-radius:8px;padding:12px;"><div style="font-size:20px;font-weight:700;color:var(--red);" id="map-cnt-disputed">0</div><div style="font-size:10px;color:var(--red);text-transform:uppercase;">Disputed</div></div>
                <div style="text-align:center;background:var(--surface);border-radius:8px;padding:12px;"><div style="font-size:20px;font-weight:700;color:var(--navy);" id="map-cnt-total">0</div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;">Total Plots</div></div>
              </div>
            </div>
          </div>

          <div class="card" style="flex:1; overflow:hidden; display:flex; flex-direction:column; height: 100%;">
            <div class="card-header"><h3>Parcel Details</h3></div>
            <div class="card-body" id="parcel-details-panel" style="overflow-y:auto; padding:0; background: var(--surface);">
              <div style="padding:4rem 2rem;text-align:center;color:var(--text-3); display:flex; flex-direction:column; align-items:center;">
                <i class="ti ti-map-search" style="font-size:48px; opacity:0.3; margin-bottom:16px;"></i>
                <div style="font-size:14px; font-weight:600; color:var(--text-2);">No Parcel Selected</div>
                <div style="font-size:12px; margin-top:4px;">Click on a boundary polygon or marker on the map to view detailed land record information here.</div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    setTimeout(() => this.initMap(), 100);

    const searchInput = document.getElementById('map-search');
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') this.applyFilters(); });
  },

  initMap() {
    if (this.map) { this.map.remove(); }

    // Center of Andhra Pradesh
    const apCenter = [15.9129, 79.7400];
    this.map = L.map('leaflet-map', {
      center: apCenter,
      zoom: 7,
      scrollWheelZoom: true
    });

    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
    });

    this.layers = {
      "OpenStreetMap": osm,
      "Satellite View": satellite
    };

    L.control.layers(this.layers).addTo(this.map);
    L.control.scale().addTo(this.map);

    this.markers = L.markerClusterGroup();
    this.map.addLayer(this.markers);

    this.loadRecords();
  },

  async loadRecords() {
    try {
      const res = await api.get('/land?limit=500');
      this.records = res.data || [];
      this.plotRecords(this.records);
    } catch (err) {
      showToast('Failed to load land records: ' + err.message, 'error');
    }
  },

  applyFilters() {
    const q = document.getElementById('map-search').value.toLowerCase();
    const district = document.getElementById('map-district').value;
    const mandal = document.getElementById('map-mandal')?.value || "";
    const status = document.getElementById('map-status').value;

    const filtered = this.records.filter(r => {
      const matchesQ = !q || 
        r.surveyNumber.toLowerCase().includes(q) || 
        r.currentOwner?.name?.toLowerCase().includes(q) || 
        r.registrationId?.toLowerCase().includes(q);
      const matchesDist = !district || r.district === district;
      const matchesMandal = !mandal || r.mandal === mandal;
      const matchesStatus = !status || r.verificationStatus === status;
      return matchesQ && matchesDist && matchesMandal && matchesStatus;
    });

    this.plotRecords(filtered);
  },

  plotRecords(records) {
    this.markers.clearLayers();
    const invalidList = document.getElementById('invalid-records-list');
    const invalidArr = [];
    
    let stats = { verified: 0, review: 0, disputed: 0, total: 0 };

    records.forEach(r => {
      const lat = r.gisData?.latitude;
      const lng = r.gisData?.longitude;
      const geometry = r.gisData?.geometry;

      // Update Stats
      stats.total++;
      if (r.verificationStatus === 'verified') stats.verified++;
      else if (r.verificationStatus === 'under_review') stats.review++;
      else if (r.status === 'disputed') stats.disputed++;

      // Coordinate Validation
      const isValid = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

      if (!isValid && !geometry) {
        invalidArr.push(r);
        return;
      }

      const color = r.verificationStatus === 'verified' ? '#1d9e75' : 
                   r.verificationStatus === 'under_review' ? '#ef9f27' : '#e24b4a';

      // Popup Content
      const popupHtml = `
        <div class="map-popup" style="min-width:200px;">
          <div style="font-weight:700; color:var(--navy); border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:8px; display:flex; justify-content:space-between;">
            <span>${r.surveyNumber}</span>
            <span style="color:${color}; font-size:10px;">● ${r.verificationStatus.replace('_',' ')}</span>
          </div>
          <div style="font-size:11px; margin-bottom:4px;"><strong>Owner:</strong> ${r.currentOwner?.name}</div>
          <div style="font-size:11px; margin-bottom:4px;"><strong>Reg ID:</strong> <span class="mono">${r.registrationId || '—'}</span></div>
          <div style="font-size:11px; margin-bottom:4px;"><strong>Location:</strong> ${r.village}, ${r.mandal}</div>
          <div style="font-size:11px; margin-bottom:8px;"><strong>Extent:</strong> ${r.extent?.value} ${r.extent?.unit}</div>
          <button class="btn btn-primary btn-sm btn-block" onclick="Pages.search.viewRecord('${r._id}')" style="padding:4px;">View Full Record</button>
        </div>
      `;

      // Render Polygon if exists
      let layer;
      if (geometry && geometry.type === 'Polygon') {
        layer = L.geoJSON({
          type: "Feature",
          geometry: geometry,
          properties: r
        }, {
          style: { color: color, weight: 2, fillOpacity: 0.3 }
        });
      } else if (isValid) {
        // Render Marker
        layer = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: "#fff",
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8
        });
      }

      if (layer) {
        layer.recordId = r._id;
        layer.bindPopup(popupHtml);
        layer.on('click', () => Pages.map.showParcelDetails(r));
        this.markers.addLayer(layer);
      }
    });

    // Update UI Stats
    document.getElementById('map-cnt-verified').textContent = stats.verified;
    document.getElementById('map-cnt-review').textContent = stats.review;
    document.getElementById('map-cnt-disputed').textContent = stats.disputed;
    document.getElementById('map-cnt-total').textContent = stats.total;

    if (records.length > 0 && this.markers.getLayers().length > 0) {
      this.map.fitBounds(this.markers.getBounds(), { padding: [20, 20] });
    }
  },

  locateOnMap(lat, lng, id) {
    App.loadPage('map');
    // We need to wait for the map to initialize and load records
    setTimeout(() => {
      if (this.map && lat && lng) {
        this.map.setView([lat, lng], 16);
        // Find marker in cluster and open it
        this.markers.eachLayer(layer => {
          if (layer.recordId === id) {
             layer.openPopup();
             // Find record data
             const record = this.records.find(r => r._id === id);
             if (record) this.showParcelDetails(record);
          }
        });
      }
    }, 800);
  },

  showParcelDetails(r) {
    const panel = document.getElementById('parcel-details-panel');
    if (!panel) return;
    
    panel.innerHTML = `
      <div style="padding:24px; animation: fadeIn 0.3s ease;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px;">
          <div>
            <div style="font-size:11px; font-weight:600; color:var(--text-3); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Survey Number</div>
            <div style="font-size:24px; font-weight:700; color:var(--navy); font-family:var(--font-mono);">${r.surveyNumber}</div>
          </div>
          <span class="badge ${r.verificationStatus === 'verified' ? 'badge-success' : r.verificationStatus === 'under_review' ? 'badge-warning' : 'badge-danger'}">
            ${r.verificationStatus.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div style="background:var(--white); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-3); margin-bottom:4px; text-transform:uppercase; font-weight:600;">Registered Owner</div>
          <div style="font-size:16px; font-weight:600; color:var(--navy); display:flex; align-items:center; gap:8px;">
            <i class="ti ti-user" style="color:var(--text-3);"></i> ${r.currentOwner?.name || 'Unknown'}
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;">
          <div style="background:var(--white); border:1px solid var(--border); border-radius:12px; padding:12px 16px;">
            <div style="font-size:10px; color:var(--text-3); margin-bottom:2px; text-transform:uppercase; font-weight:600;">Land Extent</div>
            <div style="font-size:15px; font-weight:600; color:var(--text-1);">${r.extent?.value} ${r.extent?.unit}</div>
          </div>
          <div style="background:var(--white); border:1px solid var(--border); border-radius:12px; padding:12px 16px;">
            <div style="font-size:10px; color:var(--text-3); margin-bottom:2px; text-transform:uppercase; font-weight:600;">Registration ID</div>
            <div style="font-size:14px; font-weight:600; color:var(--text-1); font-family:var(--font-mono);">${r.registrationId || '—'}</div>
          </div>
        </div>

        <div style="margin-bottom:24px;">
          <div style="font-size:12px; font-weight:600; color:var(--text-2); margin-bottom:8px; border-bottom:1px solid var(--border); padding-bottom:4px;">Location Details</div>
          <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--border);">
            <span style="color:var(--text-3); font-size:13px;">Village</span>
            <span style="font-weight:500; font-size:13px;">${r.village || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--border);">
            <span style="color:var(--text-3); font-size:13px;">Mandal</span>
            <span style="font-weight:500; font-size:13px;">${r.mandal || '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;">
            <span style="color:var(--text-3); font-size:13px;">District</span>
            <span style="font-weight:500; font-size:13px;">${r.district || '—'}</span>
          </div>
        </div>

        <button class="btn btn-primary btn-block" onclick="Pages.search.viewRecord('${r._id}')"><i class="ti ti-file-text"></i> View Full Official Record</button>
      </div>
    `;
  },

  resetMap() {
    if (this.markers && this.markers.getLayers().length > 0) {
      this.map.fitBounds(this.markers.getBounds());
    } else {
      this.map.setView([15.9129, 79.7400], 7);
    }
  }
};


