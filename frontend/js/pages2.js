// ══════════════════════════════════════════
// APPLY / UPLOAD
// ══════════════════════════════════════════
Pages.apply = {
  currentType: 'mutation',
  uploadedDocs: {}, // { key: {id, name, path} }

  applicationTypes: [
    { id: 'mutation', label: 'Mutation', desc: 'Ownership transfer in revenue records', icon: 'ti-arrows-exchange' },
    { id: 'land_verification', label: 'Land Verification Certificate', desc: 'Official ownership verification', icon: 'ti-certificate' },
    { id: 'encumbrance_certificate', label: 'Encumbrance Certificate (EC)', desc: 'Check for liabilities/loans', icon: 'ti-file-search' },
    { id: 'new_pattadar_passbook', label: 'New Pattadar Passbook', desc: 'Apply for fresh passbook', icon: 'ti-notebook' },
    { id: 'duplicate_pattadar_passbook', label: 'Duplicate Pattadar Passbook', desc: 'In case of loss or damage', icon: 'ti-copy' },
    { id: 'passbook_correction', label: 'Passbook Correction Request', desc: 'Correct errors in passbook', icon: 'ti-edit' },
    { id: 'possession_certificate', label: 'Possession Certificate', desc: 'Proof of actual possession', icon: 'ti-home' },
    { id: 'survey_boundary_verification', label: 'Survey & Boundary Verification', desc: 'Resolve boundary disputes', icon: 'ti-map-2' }
  ],

  async render(container) {
    this.uploadedDocs = {};
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Submit Application</h1><p>Andhra Pradesh Land Administration Services</p></div>
      </div>
      
      <div class="left-wide" style="grid-template-columns: 320px 1fr; gap: 32px;">
        <div>
          <div class="card" style="margin-bottom:16px; position: sticky; top: 100px;">
            <div class="card-header"><h3>Select Service</h3></div>
            <div class="card-body" style="padding: 12px;">
              <div style="display:flex;flex-direction:column;gap:8px;" id="app-type-list">
                ${this.applicationTypes.map(t => `
                  <label class="app-type-option ${t.id === this.currentType ? 'active' : ''}" data-type="${t.id}" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:12px;cursor:pointer;transition:all var(--trans);">
                    <input type="radio" name="appType" value="${t.id}" ${t.id === this.currentType ? 'checked' : ''} style="display:none;">
                    <div class="type-icon" style="width:40px;height:40px;background:var(--surface);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--navy);flex-shrink:0;">
                      <i class="ti ${t.icon}" style="font-size:20px;"></i>
                    </div>
                    <div style="flex:1; min-width:0;">
                      <div style="font-size:13px;font-weight:700;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.label}</div>
                      <div style="font-size:11px;color:var(--text-3);line-height:1.3;">${t.desc}</div>
                    </div>
                  </label>`).join('')}
              </div>
            </div>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:24px;">
          <div class="card">
            <div class="card-header"><h3 id="form-title">Application Details</h3></div>
            <div class="card-body">
              <form id="apply-form">
                <div id="dynamic-fields" class="form-grid">
                  <!-- Fields injected here -->
                </div>
              </form>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Required Documents</h3></div>
            <div class="card-body">
              <div id="document-upload-sections" style="display:flex; flex-direction:column; gap:20px;">
                <!-- Individual upload controls injected here -->
              </div>
            </div>
          </div>

          <div class="alert alert-info">
            <i class="ti ti-info-circle" style="font-size:24px;"></i>
            <div><strong>Note:</strong> All fields marked with * are mandatory. Each document must be uploaded individually for verification using our AI processing engine.</div>
          </div>

          <button class="btn btn-primary btn-block btn-lg" id="submit-app-btn" onclick="Pages.apply.submitApplication()" style="height:60px; font-size:18px;">
            <i class="ti ti-send"></i> Submit Application
          </button>
        </div>
      </div>`;

    this.bindEvents();
    this.renderFields(this.currentType);
  },

  bindEvents() {
    document.querySelectorAll('.app-type-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const type = opt.dataset.type;
        if (this.currentType === type) return;
        
        this.currentType = type;
        this.uploadedDocs = {};
        
        document.querySelectorAll('.app-type-option').forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
        opt.querySelector('input').checked = true;
        this.renderFields(type);
      });
    });
  },

  renderFields(type) {
    const container = document.getElementById('dynamic-fields');
    const title = document.getElementById('form-title');
    const typeObj = this.applicationTypes.find(t => t.id === type);
    title.textContent = `Application Details: ${typeObj.label}`;

    let html = `
      <div class="form-group">
        <label class="form-label">Applicant Name *</label>
        <input class="form-control" id="f-name" value="${Auth.user.fullName}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Aadhaar Number *</label>
        <input class="form-control" id="f-aadhaar" placeholder="12-digit Aadhaar" maxlength="12" oninput="this.value=this.value.replace(/\\D/g,'')">
      </div>
      <div class="form-group">
        <label class="form-label">Mobile Number *</label>
        <input class="form-control" id="f-mobile" value="${Auth.user.phone}" maxlength="10" readonly>
      </div>
      <div class="form-group">
        <label class="form-label">Survey Number *</label>
        <input class="form-control" id="f-survey" placeholder="e.g. 441/2A" required>
      </div>
      <div class="form-group">
        <label class="form-label">District *</label>
        <select class="form-control" id="f-district" required onchange="GeoData.setupDependentDropdown('f-district', 'f-mandal')">
          <option value="">Select District</option>
          ${GeoData.getDistrictOptions(Auth.user.district)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Mandal *</label>
        <select class="form-control" id="f-mandal" required disabled>
          ${GeoData.getMandalOptions(Auth.user.district, Auth.user.mandal)}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Village *</label>
        <input class="form-control" id="f-village" placeholder="Enter village" required>
      </div>
      <div class="form-group">
        <label class="form-label">Extent *</label>
        <input class="form-control" id="f-extent" placeholder="e.g. 2.50 Acres" required>
      </div>
    `;

    if (type === 'mutation') {
      html += `
        <div class="form-group">
          <label class="form-label">Sub-Division Number</label>
          <input class="form-control" id="f-subdiv" placeholder="e.g. 1B">
        </div>
        <div class="form-group">
          <label class="form-label">Transfer Type *</label>
          <select class="form-control" id="f-m-type" required onchange="Pages.apply.renderDocSections()">
            <option value="sale">Sale</option>
            <option value="gift">Gift</option>
            <option value="inheritance">Inheritance</option>
            <option value="partition">Partition</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Previous Owner Name *</label>
          <input class="form-control" id="f-m-prev" placeholder="As per records" required>
        </div>
        <div class="form-group">
          <label class="form-label">New Owner Name *</label>
          <input class="form-control" id="f-m-new" placeholder="Buyer/Heir name" required>
        </div>
        <div class="form-group">
          <label class="form-label">Registration Doc Number *</label>
          <input class="form-control" id="f-m-docno" placeholder="e.g. 1234/2023" required>
        </div>
        <div class="form-group">
          <label class="form-label">Registration Date *</label>
          <input class="form-control" id="f-m-regdate" type="date" required>
        </div>
      `;
    } else if (type === 'land_verification') {
      html += `
        <div class="form-group span-2">
          <label class="form-label">Purpose of Verification *</label>
          <input class="form-control" id="f-purpose" placeholder="e.g. Bank loan, Personal record" required>
        </div>
      `;
    } else if (type === 'encumbrance_certificate') {
      html += `
        <div class="form-group">
          <label class="form-label">Period From *</label>
          <input class="form-control" id="f-ec-from" type="date" required>
        </div>
        <div class="form-group">
          <label class="form-label">Period To *</label>
          <input class="form-control" id="f-ec-to" type="date" required>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Purpose *</label>
          <input class="form-control" id="f-purpose" placeholder="Reason for EC request" required>
        </div>
      `;
    } else if (type === 'new_pattadar_passbook' || type === 'duplicate_pattadar_passbook') {
      html += `
        <div class="form-group ${type.includes('duplicate') ? '' : 'span-2'}">
          <label class="form-label">Reason for Request *</label>
          <input class="form-control" id="f-reason" placeholder="e.g. New purchase, Lost, Damaged" required>
        </div>
      `;
      if (type.includes('duplicate')) {
        html += `
          <div class="form-group">
            <label class="form-label">Existing Passbook Number</label>
            <input class="form-control" id="f-pbno" placeholder="e.g. AP12345">
          </div>
        `;
      }
    } else if (type === 'passbook_correction') {
      html += `
        <div class="form-group">
          <label class="form-label">Passbook Number *</label>
          <input class="form-control" id="f-pbno" required>
        </div>
        <div class="form-group">
          <label class="form-label">Correction Type *</label>
          <select class="form-control" id="f-corr-type" required>
            <option>Name Correction</option>
            <option>Survey Number Correction</option>
            <option>Extent Correction</option>
            <option>Father/Husband Name Correction</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Existing Value *</label>
          <input class="form-control" id="f-corr-old" required>
        </div>
        <div class="form-group">
          <label class="form-label">Correct Value *</label>
          <input class="form-control" id="f-corr-new" required>
        </div>
      `;
    } else if (type === 'possession_certificate') {
      html += `
        <div class="form-group span-2">
          <label class="form-label">Possession Details *</label>
          <textarea class="form-control" id="f-poss-details" rows="2" placeholder="Describe the current status of possession on land" required></textarea>
        </div>
      `;
    } else if (type === 'survey_boundary_verification') {
      html += `
        <div class="form-group span-2">
          <label class="form-label">Nature of Issue *</label>
          <input class="form-control" id="f-survey-issue" placeholder="e.g. Boundary mismatch, Encroachment" required>
        </div>
        <div class="form-group span-2">
          <label class="form-label">Boundary Description</label>
          <textarea class="form-control" id="f-survey-desc" rows="2" placeholder="Details of north, south, east, west boundaries"></textarea>
        </div>
      `;
    }

    html += `
      <div class="form-group span-2">
        <label class="form-label">Additional Remarks</label>
        <textarea class="form-control" id="f-remarks" rows="2" placeholder="Any other information..."></textarea>
      </div>
    `;

    container.innerHTML = html;
    this.renderDocSections();
  },

  renderDocSections() {
    const container = document.getElementById('document-upload-sections');
    const docs = this.getRequiredDocs(this.currentType);
    
    container.innerHTML = docs.map(d => `
      <div class="doc-upload-block" id="doc-block-${d.key}" style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--white);">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-2); margin-bottom: 10px;">
          ${d.mandatory ? 'Required Document:' : 'Optional Document:'} ${d.name} ${d.mandatory ? '<span style="color:red;">*</span>' : ''}
        </div>
        <div id="doc-status-${d.key}">
          ${this.uploadedDocs[d.key] ? this.renderUploadedItem(d.key, this.uploadedDocs[d.key]) : `
            <div class="upload-control" style="display:flex; align-items:center; gap:10px;">
              <input type="file" id="input-${d.key}" style="display:none;" accept=".pdf,.jpg,.jpeg,.png" onchange="Pages.apply.uploadSpecificFile('${d.key}', this.files[0])">
              <button class="btn btn-outline btn-sm" onclick="document.getElementById('input-${d.key}').click()">
                <i class="ti ti-upload"></i> Upload File
              </button>
              <span style="font-size: 11px; color: var(--text-3);">PDF, JPG or PNG (Max 10MB)</span>
            </div>
          `}
        </div>
      </div>
    `).join('');
  },

  renderUploadedItem(key, doc) {
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; background:var(--surface); padding:8px 12px; border-radius:6px; animation: fadeIn 0.3s ease;">
        <div style="display:flex; align-items:center; gap:8px; font-size:12px;">
          <i class="ti ti-file-check" style="color:var(--teal); font-size:18px;"></i>
          <div>
            <div style="font-weight:600;">${doc.name}</div>
            <div style="font-size:10px; color:var(--text-3);">Uploaded successfully</div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="Pages.apply.removeDocument('${key}', '${doc.id}')" title="Undo / Remove" style="padding:4px 8px; border-color: rgba(163, 45, 45, 0.2);">
          <i class="ti ti-trash" style="color:var(--red);"></i>
        </button>
      </div>
    `;
  },

  getRequiredDocs(type) {
    const aadhaar = { key: 'aadhaarCard', name: 'Aadhaar Card', mandatory: true };
    const saleDeed = { key: 'saleDeed', name: 'Registered Sale Deed', mandatory: true };
    const passbook = { key: 'passbook', name: 'Existing Pattadar Passbook', mandatory: true };
    const landDoc = { key: 'ownershipDocument', name: 'Land Ownership Document', mandatory: true };
    const support = { key: 'supportingDocument', name: 'Supporting Evidence', mandatory: false };

    if (type === 'mutation') {
      const mType = document.getElementById('f-m-type')?.value || 'sale';
      const docs = [aadhaar, saleDeed, passbook];
      if (mType === 'inheritance') {
        docs.push({ key: 'deathCertificate', name: 'Death Certificate', mandatory: true });
        docs.push({ key: 'legalHeirCertificate', name: 'Legal Heir Certificate', mandatory: true });
      }
      return docs;
    }
    if (type === 'land_verification') return [aadhaar, landDoc];
    if (type === 'encumbrance_certificate') return [aadhaar];
    if (type === 'new_pattadar_passbook') return [aadhaar, landDoc];
    if (type === 'duplicate_pattadar_passbook') return [aadhaar, { key: 'firCopy', name: 'FIR Copy', mandatory: true }];
    if (type === 'passbook_correction') return [aadhaar, passbook, support];
    if (type === 'possession_certificate') return [aadhaar, landDoc];
    if (type === 'survey_boundary_verification') return [aadhaar, landDoc, support];
    return [aadhaar];
  },

  async uploadSpecificFile(key, file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File exceeds 10MB limit.', 'error'); return; }

    const statusEl = document.getElementById(`doc-status-${key}`);
    statusEl.innerHTML = `<div style="padding:8px; font-size:12px; color:var(--text-3);"><span class="loading-spinner" style="width:14px; height:14px; margin-right:8px;"></span> Uploading ${file.name}…</div>`;

    try {
      const docTypeMap = {
        aadhaarCard: 'aadhaar',
        saleDeed: 'sale_deed',
        passbook: 'pattadar_passbook',
        deathCertificate: 'other',
        legalHeirCertificate: 'other',
        ownershipDocument: 'other',
        firCopy: 'other',
        supportingDocument: 'other'
      };
      const fd = new FormData();
      fd.append('document', file);
      fd.append('documentType', docTypeMap[key] || 'other');

      const res = await api.upload('/documents/upload', fd);
      this.uploadedDocs[key] = { id: res.data._id, name: file.name, path: res.data.filePath };
      
      statusEl.innerHTML = this.renderUploadedItem(key, this.uploadedDocs[key]);
      showToast(`${file.name} uploaded.`, 'success');
    } catch (err) {
      statusEl.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('input-${key}').click()"><i class="ti ti-upload"></i> Try Again</button>
          <span style="font-size:11px; color:var(--red);">Upload failed: ${err.message}</span>
        </div>
      `;
      showToast(err.message, 'error');
    }
  },

  async removeDocument(key, docId) {
    try {
      await api.delete('/documents/' + docId);
      delete this.uploadedDocs[key];
      
      const statusEl = document.getElementById(`doc-status-${key}`);
      statusEl.innerHTML = `
        <div class="upload-control" style="display:flex; align-items:center; gap:10px;">
          <input type="file" id="input-${key}" style="display:none;" accept=".pdf,.jpg,.jpeg,.png" onchange="Pages.apply.uploadSpecificFile('${key}', this.files[0])">
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('input-${key}').click()">
            <i class="ti ti-upload"></i> Upload File
          </button>
          <span style="font-size: 11px; color: var(--text-3);">PDF, JPG or PNG (Max 10MB)</span>
        </div>
      `;
      showToast('Document removed.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  },

  async submitApplication() {
    const type = this.currentType;
    const required = this.getRequiredDocs(type);
    
    // Validate mandatory documents
    for (const d of required) {
      if (d.mandatory && !this.uploadedDocs[d.key]) {
        showToast(`Please upload ${d.name}.`, 'warning');
        return;
      }
    }

    const data = {
      applicationType: type,
      aadhaarNumber: document.getElementById('f-aadhaar').value.trim(),
      surveyNumber: document.getElementById('f-survey').value.trim(),
      district: document.getElementById('f-district').value,
      mandal: document.getElementById('f-mandal').value.trim(),
      village: document.getElementById('f-village').value.trim(),
      extent: document.getElementById('f-extent').value.trim(),
      remarks: document.getElementById('f-remarks').value.trim(),
      documentIds: {} // Send as object map
    };

    // Fill documentIds object
    Object.keys(this.uploadedDocs).forEach(k => {
      data.documentIds[k] = this.uploadedDocs[k].id;
    });

    // Common Validation
    if (!data.aadhaarNumber || data.aadhaarNumber.length !== 12) {
      showToast('Please enter a valid 12-digit Aadhaar number.', 'warning');
      return;
    }
    if (!data.surveyNumber || !data.district || !data.mandal || !data.village || !data.extent) {
      showToast('Please fill all mandatory land details.', 'warning');
      return;
    }

    // Service specific data
    if (type === 'mutation') {
      data.mutationDetails = {
        transferType: document.getElementById('f-m-type').value,
        previousOwnerName: document.getElementById('f-m-prev').value.trim(),
        newOwnerName: document.getElementById('f-m-new').value.trim(),
        registrationDocNumber: document.getElementById('f-m-docno').value.trim(),
        registrationDate: document.getElementById('f-m-regdate').value
      };
    } else if (type === 'encumbrance_certificate') {
      data.ecDetails = {
        periodFrom: document.getElementById('f-ec-from').value,
        periodTo: document.getElementById('f-ec-to').value,
        purpose: document.getElementById('f-purpose').value.trim()
      };
    } else if (type === 'passbook_correction') {
      data.passbookDetails = {
        existingPassbookNumber: document.getElementById('f-pbno').value.trim(),
        correctionType: document.getElementById('f-corr-type').value,
        existingValue: document.getElementById('f-corr-old').value.trim(),
        correctValue: document.getElementById('f-corr-new').value.trim()
      };
    } else if (type.includes('passbook')) {
      data.passbookDetails = {
        reasonForRequest: document.getElementById('f-reason').value.trim(),
        existingPassbookNumber: document.getElementById('f-pbno')?.value.trim()
      };
    } else if (type === 'possession_certificate') {
      data.possessionDetails = document.getElementById('f-poss-details').value.trim();
    } else if (type === 'survey_boundary_verification') {
      data.surveyDetails = {
        natureOfIssue: document.getElementById('f-survey-issue').value.trim(),
        boundaryDescription: document.getElementById('f-survey-desc').value.trim()
      };
    } else if (type === 'land_verification') {
       data.ecDetails = { purpose: document.getElementById('f-purpose').value.trim() };
    }

    const btn = document.getElementById('submit-app-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner"></span> Submitting…`;

    try {
      const res = await api.post('/applications', data);
      showToast(`Application ${res.data.applicationId} submitted successfully!`, 'success');
      setTimeout(() => App.loadPage('track'), 1500);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = `<i class="ti ti-send"></i> Submit Application`;
    }
  }
};

// ══════════════════════════════════════════
// TRACK APPLICATION
// ══════════════════════════════════════════
Pages.track = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Track Applications</h1><p>Real-time status of your submitted applications</p></div>
        <button class="btn btn-primary" onclick="App.loadPage('apply')"><i class="ti ti-plus"></i> New Application</button>
      </div>
      <div id="track-list"><div style="text-align:center;padding:2rem;"><div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div></div>`;
    await this.loadApplications();
  },

  async loadApplications() {
    try {
      const res = await api.get('/applications?limit=20');
      const apps = res.data;
      const el = document.getElementById('track-list');
      if (!apps.length) {
        el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3);"><i class="ti ti-radar" style="font-size:40px;display:block;margin-bottom:12px;"></i><h3 style="margin-bottom:6px;">No applications yet</h3><p>Submit your first application to get started.</p><button class="btn btn-primary" style="margin-top:16px;" onclick="App.loadPage('apply')"><i class="ti ti-plus"></i> Apply Now</button></div>`;
        return;
      }
      el.innerHTML = `<div class="two-col">${apps.map(a => this.appCard(a)).join('')}</div>`;
    } catch (err) {
      document.getElementById('track-list').innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  },

  appCard(a) {
    const stages = [
      { key: 'submitted', label: 'Submitted', icon: 'ti-send' },
      { key: 'under_verification', label: 'Verification', icon: 'ti-eye' },
      { key: 'survey_assigned', label: 'Field Survey', icon: 'ti-map-pin' },
      { key: 'under_review', label: 'Revenue Review', icon: 'ti-building-bank' },
      { key: 'approved', label: 'Final Approval', icon: 'ti-certificate' }
    ];
    // Define the logical order of all possible statuses to determine "done" vs "active"
    const stageOrder = [
      'submitted', 
      'under_verification', 
      'pending_documents', 
      'survey_assigned', 
      'field_inspection', 
      'survey_completed', 
      'under_review', 
      'pending_tahsildar_approval', 
      'approved', 
      'certificate_generated', 
      'passbook_generated'
    ];
    
    const currentIdx = stageOrder.indexOf(a.status);
    
    // Helper to determine if a visible stage is completed
    const isDone = (key) => {
      const idx = stageOrder.indexOf(key);
      return currentIdx > idx || (key === 'approved' && ['certificate_generated', 'passbook_generated'].includes(a.status));
    };
    
    // Helper to determine if a visible stage is currently active
    const isActive = (key) => {
      if (key === 'submitted' && a.status === 'submitted') return true;
      if (key === 'under_verification' && ['under_verification', 'pending_documents'].includes(a.status)) return true;
      if (key === 'survey_assigned' && ['survey_assigned', 'field_inspection', 'survey_completed'].includes(a.status)) return true;
      if (key === 'under_review' && ['under_review', 'pending_tahsildar_approval'].includes(a.status)) return true;
      if (key === 'approved' && a.status === 'approved') return true;
      return false;
    };

    const isRejected = a.status === 'rejected';

    return `
      <div class="card">
        <div class="card-header">
          <div><span class="mono" style="font-weight:700;">${a.applicationId}</span> ${statusBadge(a.status)}</div>
          <span style="font-size:12px;color:var(--text-3);">${formatDate(a.createdAt)}</span>
        </div>
        <div class="card-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px;">
            <div><label style="font-size:11px;color:var(--text-3);display:block;">Type</label>${appTypeLabel(a.applicationType)}</div>
            <div><label style="font-size:11px;color:var(--text-3);display:block;">Survey No.</label><span class="mono">${a.surveyNumber || '—'}</span></div>
            ${a.assignedOfficer ? `<div style="grid-column:span 2;"><label style="font-size:11px;color:var(--text-3);display:block;">Assigned Officer</label>${a.assignedOfficer}</div>` : ''}
          </div>
          ${isRejected ? `<div class="alert alert-danger" style="margin-bottom:12px;"><i class="ti ti-x"></i><div><strong>Rejected:</strong> ${a.rejectionReason || 'See details.'}</div></div>` : `
          <div class="timeline" style="padding-bottom:0;">
            ${stages.map((s, idx) => {
              const done = isDone(s.key);
              const active = isActive(s.key);
              // Find latest timeline event for this stage
              const event = (a.timeline || []).slice().reverse().find(t => {
                const stageText = t.stage?.toLowerCase() || '';
                return stageText.includes(s.label.toLowerCase()) || 
                       stageText.includes(s.key.replace('_', ' '));
              });

              return `
              <div class="tl-item" style="${idx === stages.length-1 ? 'padding-bottom:0;' : ''}">
                <div class="tl-dot ${done ? 'done' : active ? 'active' : 'pending'}">
                  ${done ? `<i class="ti ti-check"></i>` : active ? `<i class="ti ${s.icon}"></i>` : `<i class="ti ti-clock" style="opacity:0.4;"></i>`}
                </div>
                <div class="tl-content">
                  <h4>${s.label}</h4>
                  <p>${event ? formatDateTime(event.timestamp) : (done ? 'Completed' : active ? '<span style="color:var(--amber);">● In progress</span>' : 'Pending')}</p>
                  ${event?.remarks && active ? `<div class="tl-remark">${event.remarks}</div>` : ''}
                </div>
              </div>`;
            }).join('')}
          </div>`}
          ${['certificate_generated','passbook_generated'].includes(a.status) ? `<button class="btn btn-success btn-block" style="margin-top:12px;" onclick="Pages.applications.downloadCertificate('${a._id}')"><i class="ti ti-download"></i> Download ${a.status.split('_')[0].charAt(0).toUpperCase() + a.status.split('_')[0].slice(1)}</button>` : ''}
          ${a.expectedCompletionDate && !['approved','certificate_generated','passbook_generated','rejected'].includes(a.status) ? `<p style="font-size:12px;color:var(--text-3);margin-top:10px;"><i class="ti ti-calendar"></i> Expected completion: ${formatDate(a.expectedCompletionDate)}</p>` : ''}
        </div>
      </div>`;
  }
};

// ══════════════════════════════════════════
// CERTIFICATES
// ══════════════════════════════════════════
Pages.certificates = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1>My Certificates</h1><p>Download your issued land verification certificates</p></div></div>
      <div id="cert-list"><div style="text-align:center;padding:2rem;"><div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div></div>`;
    try {
      const res = await api.get('/applications?status=certificate_generated&limit=20');
      const apps = res.data;
      const el = document.getElementById('cert-list');
      if (!apps.length) {
        el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3);"><i class="ti ti-certificate" style="font-size:48px;display:block;margin-bottom:12px;color:var(--teal);"></i><h3>No certificates yet</h3><p style="margin-top:6px;">Approved applications will appear here.</p></div>`;
        return;
      }
      el.innerHTML = `<div class="card"><div class="card-body-sm"><div class="table-wrap"><table class="data-table">
        <thead><tr><th>Certificate No.</th><th>Application ID</th><th>Survey No.</th><th>Type</th><th>Issued Date</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${apps.map(a => `
          <tr>
            <td class="mono">${a.certificateDetails?.certificateNumber || 'CERT-' + a.applicationId}</td>
            <td class="mono">${a.applicationId}</td>
            <td class="mono">${a.surveyNumber || '—'}</td>
            <td>${appTypeLabel(a.applicationType)}</td>
            <td>${formatDate(a.completedDate)}</td>
            <td>${statusBadge('verified')}</td>
            <td><button class="btn btn-success btn-sm" onclick="Pages.applications.downloadCertificate('${a._id}')"><i class="ti ti-download"></i> Download PDF</button></td>
          </tr>`).join('')}
        </tbody></table></div></div></div>`;
    } catch (err) {
      document.getElementById('cert-list').innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  }
};

// ══════════════════════════════════════════
// CITIZEN APPLICATIONS — View only for officers/admin
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// CITIZEN APPLICATIONS — Global View
// ══════════════════════════════════════════
Pages.citizenApplications = {
  currentPage: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Global Applications</h1><p>Comprehensive overview of all citizen-submitted requests across the portal</p></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <input class="form-control" id="ca-search" placeholder="Search applicant, ID…" style="width:220px;" oninput="debounce(() => Pages.citizenApplications.load(1))()">
          <select class="form-control" id="ca-status" style="width:160px;" onchange="Pages.citizenApplications.load(1)">
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_verification">Verification</option>
            <option value="survey_assigned">Surveying</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button class="btn btn-outline" onclick="Pages.citizenApplications.load(1)"><i class="ti ti-refresh"></i></button>
        </div>
      </div>

      <div class="stat-grid" id="ca-stats-grid" style="margin-bottom:24px;"></div>

      <div class="card">
        <div class="card-body" style="padding:0;">
          <div id="ca-list-wrap">
            <div style="text-align:center;padding:4rem;"><div class="loading-spinner" style="width:32px;height:32px;border-color:rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div>
          </div>
        </div>
      </div>
      <div id="ca-pagination" style="margin-top:20px;"></div>`;

    await this.loadStats();
    await this.load(1);
  },

  async loadStats() {
    try {
      const res = await api.get('/applications/stats');
      const s = res.data;
      const el = document.getElementById('ca-stats-grid');
      if (!el) return;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.total}</div><div class="stat-label">Total Volume</div></div><div class="stat-icon navy"><i class="ti ti-database"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.submitted}</div><div class="stat-label">Pending Review</div></div><div class="stat-icon gold"><i class="ti ti-inbox"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.under_review}</div><div class="stat-label">Under Process</div></div><div class="stat-icon blue"><i class="ti ti-loader"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.approved}</div><div class="stat-label">Total Approved</div></div><div class="stat-icon teal"><i class="ti ti-check"></i></div></div>`;
    } catch (e) {}
  },

  async load(page = 1) {
    this.currentPage = page;
    const status = document.getElementById('ca-status')?.value || '';
    const search = document.getElementById('ca-search')?.value || '';
    const el = document.getElementById('ca-list-wrap');
    if (!el) return;

    try {
      const params = new URLSearchParams({ page, limit: 12 });
      if (status) params.set('status', status);
      if (search) params.set('search', search);

      const res = await api.get(`/applications?${params}`);
      this.renderTable(res.data, el);
      renderPagination(document.getElementById('ca-pagination'), res.pagination, 'Pages.citizenApplications.load');
    } catch (err) { el.innerHTML = `<div class="alert alert-danger" style="margin:20px;">${err.message}</div>`; }
  },

  viewDetails(id) { Pages.applications.viewApp(id); },

    renderTable(apps, el) {
    if (!apps.length) {
      el.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--text-3);"><i class="ti ti-search" style="font-size:48px;opacity:0.2;margin-bottom:16px;display:block;"></i>No applications found.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>App ID</th><th>Citizen</th><th>Location</th><th>Type</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
          <tbody>
            ${apps.map(a => `
              <tr>
                <td><span class="mono" style="font-weight:700;">${a.applicationId}</span></td>
                <td>
                  <div style="font-weight:600;">${a.applicantName || a.applicant?.fullName || '—'}</div>
                  <div style="font-size:11px;color:var(--text-3);">${a.applicantContact || 'No Contact'}</div>
                </td>
                <td><div style="font-size:13px;">${a.village}</div><div style="font-size:11px;color:var(--text-3);">${a.mandal}</div></td>
                <td><span class="badge badge-navy">${appTypeLabel(a.applicationType)}</span></td>
                <td>${statusBadge(a.status)}</td>
                <td>${formatDate(a.createdAt)}</td>
                <td><button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')"><i class="ti ti-eye"></i> View</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
};

// ══════════════════════════════════════════
// APPLICATIONS QUEUE (OFFICIAL)
// ══════════════════════════════════════════
Pages.applications = {
  currentPage: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Applications Queue</h1><p>Review, verify, and process land record applications</p></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <input class="form-control" id="f-search" placeholder="Search App ID / Name…" style="width:220px;" oninput="debounce(() => Pages.applications.load(1))()">
          <select class="form-control" id="f-assigned" style="width:160px;" onchange="Pages.applications.load(1)">
            <option value="">All Applications</option>
            <option value="me">Assigned to Me</option>
          </select>
          <select class="form-control" id="f-status" style="width:160px;" onchange="Pages.applications.load(1)">
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_verification">Verification</option>
            <option value="pending_documents">Pending Docs</option>
            <option value="survey_assigned">Survey Assigned</option>
            <option value="survey_completed">Survey Completed</option>
            <option value="pending_tahsildar_approval">Pending Tahsildar</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button class="btn btn-outline" onclick="Pages.applications.load(1)"><i class="ti ti-refresh"></i></button>
        </div>
      </div>

      <div class="stat-grid" id="q-stats" style="margin-bottom:24px;"></div>
      
      <div class="card">
        <div class="card-body" style="padding:0;">
          <div id="applications-list">
            <div style="text-align:center;padding:4rem;">
              <div class="loading-spinner" style="width:32px;height:32px;border-color:rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div>
            </div>
          </div>
        </div>
      </div>
      <div id="q-pagination" style="margin-top:20px;"></div>`;

    await this.loadStats();
    await this.load(1);
  },

  async loadStats() {
    try {
      const res = await api.get('/applications/stats');
      const s = res.data;
      const el = document.getElementById('q-stats');
      if (!el) return;
      el.innerHTML = `
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.submitted}</div><div class="stat-label">New Submissions</div></div><div class="stat-icon navy"><i class="ti ti-file-import"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.under_review}</div><div class="stat-label">In Progress</div></div><div class="stat-icon gold"><i class="ti ti-clock"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.approved}</div><div class="stat-label">Processed</div></div><div class="stat-icon teal"><i class="ti ti-check"></i></div></div>
        <div class="stat-card"><div class="stat-details"><div class="stat-value">${s.flagged}</div><div class="stat-label">Flagged</div></div><div class="stat-icon red"><i class="ti ti-alert-circle"></i></div></div>`;
    } catch (e) {}
  },

  async load(page = 1) {
    this.currentPage = page;
    const status = document.getElementById('f-status')?.value || '';
    const assignedMe = document.getElementById('f-assigned')?.value === 'me';
    const search = document.getElementById('f-search')?.value || '';
    
    const listEl = document.getElementById('applications-list');
    if (!listEl) return;
    listEl.innerHTML = `<div style="text-align:center;padding:4rem;"><div class="loading-spinner" style="width:32px;height:32px;border-color:rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div>`;

    try {
      const params = new URLSearchParams({ page, limit: 10 });
      if (status) params.set('status', status);
      if (assignedMe) params.set('assignedTo', Auth.user._id);
      if (search) params.set('search', search);

      const res = await api.get(`/applications?${params}`);
      this.renderTable(res.data, listEl);
      renderPagination(document.getElementById('q-pagination'), res.pagination, 'Pages.applications.load');
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-danger" style="margin:20px;">${err.message}</div>`;
    }
  },

  applyFilters() { this.load(1); },

    renderTable(apps, el) {
    if (!apps.length) {
      el.innerHTML = `<div style="text-align:center;padding:4rem;color:var(--text-3);"><i class="ti ti-inbox" style="font-size:48px;opacity:0.2;margin-bottom:16px;display:block;"></i>No applications found matching filters.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Application ID</th>
              <th>Applicant</th>
              <th>Location</th>
              <th>Service Type</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${apps.map(a => `
              <tr>
                <td><span class="mono" style="font-weight:700;">${a.applicationId}</span></td>
                <td>
                  <div style="font-weight:600;">${a.applicantName || a.applicant?.fullName || '—'}</div>
                  <div style="font-size:11px;color:var(--text-3);">${a.aadhaarNumber || 'No Aadhaar'}</div>
                </td>
                <td>
                  <div style="font-size:13px;">${a.village}</div>
                  <div style="font-size:11px;color:var(--text-3);">${a.district} · ${a.surveyNumber}</div>
                </td>
                <td><span class="badge badge-navy">${appTypeLabel(a.applicationType)}</span></td>
                <td>${statusBadge(a.status)}</td>
                <td>${formatDate(a.createdAt)}</td>
                <td>
                  <button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')">
                    <i class="ti ti-eye"></i> View
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }
,

  async viewApp(id) {
    try {
      const res = await api.get(`/applications/${id}`);
      const a = res.data;
      const html = `
        <div class="modal-overlay" id="app-modal">
          <div class="modal" style="max-width:850px;">
            <div class="modal-header">
              <h3>${a.applicationId} — ${appTypeLabel(a.applicationType)}</h3>
              <button class="modal-close"><i class="ti ti-x"></i></button>
            </div>
            <div class="modal-body">
              ${a.isFlagged ? `
                <div class="alert alert-danger" style="margin-bottom:20px; border-left: 5px solid var(--red);">
                  <div style="display:flex; align-items:center; gap:12px;">
                    <i class="ti ti-alert-octagon" style="font-size:24px;"></i>
                    <div style="flex:1;">
                      <div style="font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">${a.fraudScore >= 61 ? 'High Risk Application Detected' : 'Medium Risk Application Detected'}</div>
                      <div style="font-size:12px; margin-top:2px;">Reasons: ${a.flagReasons.join(', ')}</div>
                    </div>
                    <div style="text-align:right;">
                      <div style="font-size:10px; text-transform:uppercase; color:rgba(0,0,0,0.5);">Risk Score</div>
                      <div style="font-size:20px; font-weight:800;">${a.fraudScore}%</div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <div style="display:flex;gap:8px;margin-bottom:20px;">
                ${statusBadge(a.status)} 
                <span class="badge badge-${a.priority==='urgent'?'danger':a.priority==='high'?'warning':'navy'}">${a.priority} Priority</span>
                ${a.fraudScore > 0 ? `
                  <span class="badge ${a.fraudScore >= 61 ? 'badge-danger' : a.fraudScore >= 31 ? 'badge-warning' : 'badge-info'}">
                    <i class="ti ti-shield-check"></i> ${a.fraudScore >= 61 ? 'High' : a.fraudScore >= 31 ? 'Medium' : 'Low'} Risk
                  </span>
                ` : ''}
              </div>
              
              <div class="two-col" style="gap:24px;">
                <div>
                  <h4 style="font-size:13px;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:12px;">Applicant & Land Details</h4>
                  <div class="form-grid" style="margin-bottom:20px;">
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Applicant</strong><p>${a.applicantName}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Aadhaar</strong><p>${a.aadhaarNumber || '—'}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Contact</strong><p>${a.applicantContact || '—'}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Survey Number</strong><p class="mono">${a.surveyNumber}${a.subDivisionNumber ? ' / '+a.subDivisionNumber : ''}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Location</strong><p>${a.village}, ${a.mandal}, ${a.district}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Extent</strong><p>${a.extent || '—'}</p></div>
                    <div><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Assigned Officer</strong><p>${a.assignedOfficer || 'Unassigned'} ${a.assignedTo && a.assignedTo._id?.toString() === Auth.user._id?.toString() ? '<strong>(You)</strong>' : ''}</p></div>
                  </div>

                  ${a.assignedTo && a.assignedTo._id?.toString() !== Auth.user._id?.toString() && !Auth.hasRole('admin') ? `
                    <div class="alert alert-info" style="margin-bottom:20px; font-size:12px;">
                      <i class="ti ti-lock"></i> READ-ONLY: This application is assigned to ${a.assignedOfficer}.
                    </div>
                  ` : ''}

                  <h4 style="font-size:13px;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:12px;">Service Specific Details</h4>
                  <div class="details-box" style="background:var(--surface);padding:12px;border-radius:8px;font-size:13px;margin-bottom:20px;">
                    ${this.renderServiceDetails(a)}
                  </div>
                  
                  ${a.reviewNotes ? `<div style="margin-bottom:20px;"><strong style="font-size:11px;color:var(--text-3);text-transform:uppercase;">Officer Review Notes</strong><p style="margin-top:4px;font-style:italic;">"${a.reviewNotes}"</p></div>` : ''}
                </div>

                <div>
                  <h4 style="font-size:13px;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:12px;">Uploaded Documents</h4>
                  <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">
                    ${Object.keys(a.documents || {}).length > 0 ? Object.entries(a.documents).map(([key, d]) => {
                      if (!d) return '';
                      return `
                        <div class="doc-item" style="border:1px solid var(--border);border-radius:8px;background:white;overflow:hidden;">
                          <div style="background:var(--surface);padding:6px 12px;font-size:11px;font-weight:700;color:var(--navy);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
                            <span>${appTypeLabel(key)}</span>
                            ${d.verificationStatus === 'verified' ? '<span style="color:var(--teal);"><i class="ti ti-circle-check"></i> Verified</span>' : d.verificationStatus === 'rejected' ? '<span style="color:var(--red);"><i class="ti ti-circle-x"></i> Rejected</span>' : '<span style="color:var(--amber);"><i class="ti ti-clock"></i> Pending Review</span>'}
                          </div>
                          <div style="padding:10px;display:flex;flex-direction:column;gap:10px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                              <div style="display:flex;align-items:center;gap:10px;">
                                <i class="ti ti-file-text" style="font-size:20px;color:var(--blue);"></i>
                                <div style="font-size:12px;">
                                  <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;">${d.originalName}</div>
                                  <div style="color:var(--text-3);">${(d.fileSize/1024).toFixed(0)}KB</div>
                                </div>
                              </div>
                              <div style="display:flex;gap:4px;">
                                <a href="http://127.0.0.1:5000${d.filePath}" target="_blank" class="btn btn-outline btn-sm" title="View"><i class="ti ti-external-link"></i></a>
                                ${Auth.isOfficialRole() && d.verificationStatus === 'pending' ? `
                                  <button class="btn btn-success btn-sm" onclick="Pages.applications.verifyDoc('${a._id}','${d._id}','verified')" title="Verify"><i class="ti ti-check"></i></button>
                                  <button class="btn btn-danger btn-sm" onclick="Pages.applications.verifyDoc('${a._id}','${d._id}','rejected')" title="Reject"><i class="ti ti-x"></i></button>
                                ` : ''}
                              </div>
                            </div>

                            <!-- OCR EXTRACTION DATA -->
                            ${d.ocrStatus === 'completed' && d.ocrData ? `
                              <div style="background:var(--surface); padding:10px; border-radius:6px; border:1px dashed var(--border);">
                                <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-3); margin-bottom:6px; display:flex; justify-content:space-between;">
                                  <span>Automated Data Extraction (OCR)</span>
                                  <span style="color:var(--teal);">${d.ocrData.confidence}% Confidence</span>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
                                  <div style="color:var(--text-2);">Name: <span style="font-weight:600; ${d.ocrData.ownerName.toLowerCase() !== a.applicantName.toLowerCase() ? 'color:var(--red);' : ''}">${d.ocrData.ownerName}</span></div>
                                  <div style="color:var(--text-2);">Survey: <span style="font-weight:600; ${a.surveyNumber && d.ocrData.surveyNumber !== a.surveyNumber ? 'color:var(--red);' : ''}">${d.ocrData.surveyNumber}</span></div>
                                  <div style="color:var(--text-2);">Village: <span style="font-weight:600; ${a.village && d.ocrData.village !== a.village ? 'color:var(--red);' : ''}">${d.ocrData.village}</span></div>
                                  <div style="color:var(--text-2);">Reg No: <span style="font-weight:600;">${d.ocrData.registrationNumber || '—'}</span></div>
                                  <div style="color:var(--text-2);">District: <span style="font-weight:600; ${a.district && d.ocrData.district !== a.district ? 'color:var(--red);' : ''}">${d.ocrData.district}</span></div>
                                  <div style="color:var(--text-2);">Extent: <span style="font-weight:600; ${a.extent && d.ocrData.extent !== a.extent ? 'color:var(--red);' : ''}">${d.ocrData.extent}</span></div>
                                </div>
                                ${ (d.ocrData.ownerName.toLowerCase() !== a.applicantName.toLowerCase() || (a.surveyNumber && d.ocrData.surveyNumber !== a.surveyNumber) || (a.village && d.ocrData.village !== a.village)) ? `
                                  <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(0,0,0,0.05); color:var(--red); font-size:10px; font-weight:700;">
                                    <i class="ti ti-alert-triangle"></i> CONSISTENCY WARNING: Data Mismatch Detected
                                  </div>
                                ` : ''}
                              </div>
                            ` : d.ocrStatus === 'pending' ? `
                              <div style="text-align:center; padding:10px; font-size:11px; color:var(--text-3);">
                                <div class="loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; margin-right:6px;"></div>
                                Processing OCR analysis...
                              </div>
                            ` : ''}
                          </div>
                        </div>
                      `;
                    }).join('') : '<p style="color:var(--text-3);font-size:12px;text-align:center;padding:20px;background:var(--surface);border-radius:8px;">No documents uploaded.</p>'}
                  </div>

                  <h4 style="font-size:13px;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:6px;margin-bottom:12px;">Application Timeline</h4>
                  <div class="timeline" style="max-height: 250px; overflow-y: auto;">
                    ${(a.timeline || []).map(t => `
                      <div class="tl-item">
                        <div class="tl-dot ${t.status === 'completed' ? 'done' : t.status === 'rejected' ? 'rejected' : 'active'}">
                          <i class="ti ${t.status === 'completed' ? 'ti-check' : t.status === 'rejected' ? 'ti-x' : 'ti-loader'}"></i>
                        </div>
                        <div class="tl-content">
                          <h4 style="font-size:12px;">${t.stage}</h4>
                          <p style="font-size:11px;">${t.performedByName || 'System'} · ${formatDateTime(t.timestamp)}</p>
                        </div>
                      </div>`).join('')}
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-outline" onclick="closeModal('app-modal')">Close</button>
              
              <!-- ONLY SHOW ACTIONS IF ASSIGNED OR ADMIN -->
              ${(a.assignedTo && a.assignedTo._id?.toString() === Auth.user._id?.toString()) || Auth.hasRole('admin') ? `
                
                <!-- REVENUE OFFICER ACTIONS -->
                ${Auth.canVerifyDocs() && a.status === 'submitted' ? `
                  <button class="btn btn-warning" onclick="Pages.applications.updateStatus('${a._id}', 'under_verification')"><i class="ti ti-eye"></i> Start Verification</button>
                ` : ''}
                
                ${Auth.canVerifyDocs() && (a.status === 'under_verification' || a.status === 'survey_completed') ? `
                  <button class="btn btn-outline" onclick="Pages.applications.updateStatus('${a._id}', 'pending_documents')"><i class="ti ti-file-alert"></i> Request Documents</button>
                  <button class="btn btn-success" onclick="Pages.applications.updateStatus('${a._id}', 'verified')"><i class="ti ti-check"></i> Complete Verification</button>
                ` : ''}

                ${Auth.canVerifyDocs() && a.status === 'under_review' ? `
                  <button class="btn btn-primary" onclick="Pages.applications.updateStatus('${a._id}', 'pending_tahsildar_approval')"><i class="ti ti-arrow-forward-up"></i> Send for Approval</button>
                ` : ''}

                <!-- SURVEYOR ACTIONS -->
                ${Auth.hasRole('surveyor') && a.status === 'survey_assigned' ? `
                  <button class="btn btn-info" onclick="Pages.applications.updateStatus('${a._id}', 'field_inspection')"><i class="ti ti-map-pin"></i> Start Inspection</button>
                ` : ''}

                ${Auth.hasRole('surveyor') && a.status === 'field_inspection' ? `
                  <button class="btn btn-gold" onclick="Pages.applications.showSurveyReportModal('${a._id}')"><i class="ti ti-file-upload"></i> Upload Survey Report</button>
                ` : ''}

                <!-- TAHSILDAR ACTIONS -->
                ${(Auth.hasRole('tahsildar', 'registrar', 'admin')) && a.status === 'pending_tahsildar_approval' ? `
                  <button class="btn btn-success" onclick="Pages.applications.updateStatus('${a._id}', 'approved')"><i class="ti ti-circle-check"></i> Final Approve</button>
                  <button class="btn btn-danger" onclick="Pages.applications.rejectPrompt('${a._id}')"><i class="ti ti-circle-x"></i> Reject Application</button>
                ` : ''}

              ` : ''}
            </div>
          </div>
        </div>`;
      document.body.insertAdjacentHTML('beforeend', html);
      openModal('app-modal');
    } catch (err) { showToast(err.message, 'error'); }
  },

  renderServiceDetails(a) {
    const type = a.applicationType;
    if (type === 'mutation' && a.mutationDetails) {
      const m = a.mutationDetails;
      return `
        <div><strong>Transfer Type:</strong> <span style="text-transform:capitalize;">${m.transferType}</span></div>
        <div style="margin-top:4px;"><strong>Previous Owner:</strong> ${m.previousOwnerName}</div>
        <div style="margin-top:4px;"><strong>New Owner:</strong> ${m.newOwnerName}</div>
        <div style="margin-top:4px;"><strong>Registration:</strong> #${m.registrationDocNumber} (${formatDate(m.registrationDate)})</div>
      `;
    }
    if (type === 'encumbrance_certificate' && a.ecDetails) {
      return `
        <div><strong>Search Period:</strong> ${formatDate(a.ecDetails.periodFrom)} to ${formatDate(a.ecDetails.periodTo)}</div>
        <div style="margin-top:4px;"><strong>Purpose:</strong> ${a.ecDetails.purpose}</div>
      `;
    }
    if (type === 'passbook_correction' && a.passbookDetails) {
      const p = a.passbookDetails;
      return `
        <div><strong>Passbook No:</strong> ${p.existingPassbookNumber}</div>
        <div style="margin-top:4px;"><strong>Correction:</strong> ${p.correctionType}</div>
        <div style="margin-top:4px; color:var(--red);"><strong>Old Value:</strong> ${p.existingValue}</div>
        <div style="margin-top:4px; color:var(--teal);"><strong>New Value:</strong> ${p.correctValue}</div>
      `;
    }
    if (a.passbookDetails) {
       return `<div><strong>Reason:</strong> ${a.passbookDetails.reasonForRequest}</div>
               ${a.passbookDetails.existingPassbookNumber ? `<div style="margin-top:4px;"><strong>Existing Passbook:</strong> ${a.passbookDetails.existingPassbookNumber}</div>` : ''}`;
    }
    if (a.possessionDetails) return `<div><strong>Possession Details:</strong> ${a.possessionDetails}</div>`;
    if (a.surveyDetails) return `<div><strong>Nature of Issue:</strong> ${a.surveyDetails.natureOfIssue}</div>
                                 <div style="margin-top:4px;"><strong>Boundary:</strong> ${a.surveyDetails.boundaryDescription}</div>`;
    if (a.ecDetails?.purpose) return `<div><strong>Purpose:</strong> ${a.ecDetails.purpose}</div>`;
    return '<div>No additional details provided.</div>';
  },

  async verifyDoc(appId, docId, status) {
    try {
      await api.patch(`/documents/${docId}/verify`, { verificationStatus: status });
      showToast(`Document marked as ${status}.`, 'success');
      closeModal('app-modal');
      this.viewApp(appId); // Refresh modal
    } catch (err) { showToast(err.message, 'error'); }
  },

  async updateStatus(id, status, extra = {}) {
    try {
      await api.patch(`/applications/${id}/status`, { status, ...extra });
      showToast(`Application moved to ${status.replace(/_/g,' ')}.`, 'success');
      closeModal('app-modal');
      this.load(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },

  async assignSurveyor(id) {
    try {
      // For now, simple transition. In a real system, we might pick a specific surveyor user.
      await this.updateStatus(id, 'survey_assigned', { remarks: 'Land survey requested.' });
    } catch (err) { showToast(err.message, 'error'); }
  },

  showSurveyReportModal(id) {
    const html = `
      <div class="modal-overlay" id="survey-modal">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header"><h3>Submit Survey Report</h3><button class="modal-close"><i class="ti ti-x"></i></button></div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Upload Report (PDF/JPG)</label>
              <input type="file" id="survey-file-input" class="form-control" accept=".pdf,.jpg,.jpeg,.png">
            </div>
            <div class="form-group">
              <label class="form-label">Field Remarks</label>
              <textarea id="survey-remarks" class="form-control" rows="3" placeholder="Notes from ground inspection..."></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('survey-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="Pages.applications.submitSurveyReport('${id}')">Submit Report</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal('survey-modal');
  },

  async submitSurveyReport(id) {
    const file = document.getElementById('survey-file-input').files[0];
    const remarks = document.getElementById('survey-remarks').value;
    if (!file) return showToast('Please upload the survey report file.', 'warning');

    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('documentType', 'survey_map');
      const res = await api.upload('/documents/upload', fd);
      
      await this.updateStatus(id, 'survey_completed', { 
        surveyReportId: res.data._id,
        remarks: remarks || 'Field verification completed and report uploaded.' 
      });
      closeModal('survey-modal');
    } catch (err) { showToast(err.message, 'error'); }
  },

  async downloadCertificate(id) {
    try {
      const res = await api.get(`/applications/${id}/download-certificate`, { responseType: 'blob' });
      // Note: Centralized api client might need a tweak for blob, but usually we can use fetch for direct downloads
      const token = localStorage.getItem('bhoomi_token');
      const response = await fetch(`http://127.0.0.1:5000/api/applications/${id}/download-certificate`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to download certificate.');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async finalApprove(id, type) {
    let status = 'approved';
    if (type === 'mutation' || type.includes('passbook')) status = 'passbook_generated';
    else if (type.includes('certificate') || type === 'land_verification') status = 'certificate_generated';
    
    try {
      await api.patch(`/applications/${id}/status`, { status, remarks: `Approved by ${Auth.user.fullName}. ${status.replace(/_/g,' ')}.` });
      closeModal('app-modal');
      showToast(`Application approved. Status: ${status.replace(/_/g,' ')}`, 'success');
      this.load(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },

  rejectPrompt(id) {
    const html = `
      <div class="modal-overlay" id="reject-modal">
        <div class="modal" style="max-width:440px;">
          <div class="modal-header"><h3>Reject Application</h3><button class="modal-close"><i class="ti ti-x"></i></button></div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Rejection Reason *</label>
              <select class="form-control" id="reject-reason">
                <option value="">Select reason</option>
                <option>Incomplete or incorrect documents submitted</option>
                <option>Duplicate ownership claim detected</option>
                <option>Survey number mismatch with records</option>
                <option>Document forgery suspected</option>
                <option>Boundary mismatch — re-survey required</option>
                <option>Encumbrance or court stay active on property</option>
                <option>Application not eligible for this service type</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Additional Notes</label>
              <textarea class="form-control" id="reject-notes" rows="3" placeholder="Optional: provide more details for the applicant"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('reject-modal')">Cancel</button>
            <button class="btn btn-danger" onclick="Pages.applications.confirmReject('${id}')"><i class="ti ti-x"></i> Confirm Rejection</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal('reject-modal');
  },

  async confirmReject(id) {
    const reason = document.getElementById('reject-reason').value;
    const notes = document.getElementById('reject-notes').value;
    if (!reason) { showToast('Please select a rejection reason.', 'warning'); return; }
    try {
      await api.patch(`/applications/${id}/status`, { status: 'rejected', rejectionReason: reason, remarks: notes });
      closeModal('reject-modal');
      showToast('Application rejected.', 'success');
      this.load(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },


};

// ══════════════════════════════════════════
// VERIFY DOCUMENTS
// ══════════════════════════════════════════
Pages.verify = {
  currentPage: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Document Verification</h1><p>Review and verify documents uploaded by citizens for their applications</p></div>
      </div>
      <div class="two-col">
        <div>
          <div class="card">
            <div class="card-header">
              <h3>Pending Documents</h3>
              <div style="display:flex;gap:8px;">
                <select class="form-control" id="doc-status-filter" style="width:150px;padding:7px 10px;" onchange="Pages.verify.load()">
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="">All</option>
                </select>
              </div>
            </div>
            <div id="doc-list">
              <div style="padding:2rem;text-align:center;">
                <div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div>
              </div>
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header"><h3>Verification Stats</h3></div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                <div style="background:var(--amber-pale);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--amber);" id="vst-pending">0</div><div style="font-size:11px;color:var(--amber);">Pending</div></div>
                <div style="background:var(--teal-pale);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--teal);" id="vst-verified">0</div><div style="font-size:11px;color:var(--teal);">Verified</div></div>
                <div style="background:var(--red-pale);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--red);" id="vst-rejected">0</div><div style="font-size:11px;color:var(--red);">Rejected</div></div>
                <div style="background:var(--surface);border-radius:8px;padding:12px;text-align:center;"><div style="font-size:22px;font-weight:700;color:var(--navy);" id="vst-total">0</div><div style="font-size:11px;color:var(--text-3);">Total</div></div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>OCR Engine Status</h3></div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--teal-pale);border-radius:8px;">
                <i class="ti ti-cpu" style="color:var(--teal);font-size:20px;"></i>
                <div><div style="font-size:13px;font-weight:600;color:var(--teal);">OCR Engine Active</div><div style="font-size:12px;color:var(--text-3);">Documents scanned automatically on upload</div></div>
                <span class="badge badge-success" style="margin-left:auto;">Online</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface);border-radius:8px;">
                <i class="ti ti-database" style="color:var(--navy);font-size:18px;"></i>
                <div><div style="font-size:13px;font-weight:500;">Cross-Reference Check</div><div style="font-size:12px;color:var(--text-3);">Checks against existing records</div></div>
                <span class="badge badge-success" style="margin-left:auto;">Active</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--surface);border-radius:8px;">
                <i class="ti ti-fingerprint" style="color:var(--navy);font-size:18px;"></i>
                <div><div style="font-size:13px;font-weight:500;">Forgery Detection</div><div style="font-size:12px;color:var(--text-3);">Pixel-level tampering analysis</div></div>
                <span class="badge badge-success" style="margin-left:auto;">Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    await this.load();
  },

  async load() {
    const status = document.getElementById('doc-status-filter')?.value || 'pending';
    const el = document.getElementById('doc-list');
    el.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-3);">Loading documents…</div>`;
    try {
      // Load applications then get their documents
      const res = await api.get('/applications?limit=50');
      const apps = res.data || [];

      // Collect all applications with documents
      const pending = apps.filter(a => ['submitted','under_review','documents_pending','field_inspection'].includes(a.status));

      // Update stats
      let vPending = 0, vVerified = 0, vRejected = 0;
      apps.forEach(a => {
        if (['submitted','under_review','documents_pending'].includes(a.status)) vPending++;
        else if (['approved','certificate_issued'].includes(a.status)) vVerified++;
        else if (a.status === 'rejected') vRejected++;
      });
      const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
      set('vst-pending', vPending);
      set('vst-verified', vVerified);
      set('vst-rejected', vRejected);
      set('vst-total', apps.length);

      const showApps = status === 'pending' ? pending :
                       status === 'verified' ? apps.filter(a => ['approved','certificate_issued'].includes(a.status)) :
                       status === 'rejected' ? apps.filter(a => a.status === 'rejected') : apps;

      if (!showApps.length) {
        el.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-3);">
          <i class="ti ti-file-check" style="font-size:40px;display:block;margin-bottom:10px;opacity:0.4;"></i>
          <h3 style="margin-bottom:6px;">No documents to review</h3>
          <p>All documents have been processed or no applications have been submitted yet.</p>
        </div>`;
        return;
      }

      el.innerHTML = showApps.map(a => `
        <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start;">
          <div style="width:40px;height:40px;background:var(--blue-pale);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <i class="ti ti-file-text" style="color:var(--blue);font-size:18px;"></i>
          </div>
          <div style="flex:1;">
            <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${a.applicationId} — ${appTypeLabel(a.applicationType)}</div>
            <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">
              Applicant: ${a.applicantName || '—'} · Survey: ${a.surveyNumber || '—'} · Submitted: ${formatDate(a.createdAt)}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-success btn-sm" onclick="Pages.verify.approve('${a._id}')">
                <i class="ti ti-check"></i> Approve Documents
              </button>
              <button class="btn btn-danger btn-sm" onclick="Pages.verify.reject('${a._id}')">
                <i class="ti ti-x"></i> Reject
              </button>
              <button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')">
                <i class="ti ti-eye"></i> View Application
              </button>
            </div>
          </div>
          <div>${statusBadge(a.status)}</div>
        </div>`).join('');
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger" style="margin:16px;"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  },

  async approve(appId) {
    try {
      await api.patch('/applications/' + appId + '/status', {
        status: 'under_review',
        remarks: 'Documents verified and approved by ' + Auth.user.fullName
      });
      showToast('Documents approved! Application moved to Under Review.', 'success');
      this.load();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async reject(appId) {
    try {
      await api.patch('/applications/' + appId + '/status', {
        status: 'rejected',
        rejectionReason: 'Documents rejected by verification officer',
        remarks: 'Documents did not pass verification checks'
      });
      showToast('Documents rejected.', 'warning');
      this.load();
    } catch (err) { showToast(err.message, 'error'); }
  }
};

// ══════════════════════════════════════════
// FRAUD DETECTION
// ══════════════════════════════════════════
Pages.fraud = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Fraud Detection</h1><p>Flagged applications with suspicious or duplicate records</p></div>
      </div>
      <div class="alert alert-danger">
        <i class="ti ti-alert-octagon"></i>
        <div><strong>Automated Fraud Detection Active</strong> — The system automatically flags applications with duplicate survey numbers, document forgery, or boundary mismatches.</div>
      </div>
      <div class="two-col">
        <div id="fraud-list">
          <div style="padding:2rem;text-align:center;">
            <div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <div class="card-header"><h3>Fraud Statistics</h3></div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
                <div style="background:var(--red-pale);border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-size:22px;font-weight:700;color:var(--red);" id="fraud-total">0</div>
                  <div style="font-size:11px;color:var(--red);font-weight:500;">Total Alerts</div>
                </div>
                <div style="background:var(--amber-pale);border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-size:22px;font-weight:700;color:var(--amber);" id="fraud-active">0</div>
                  <div style="font-size:11px;color:var(--amber);font-weight:500;">Active</div>
                </div>
              </div>
              <div style="font-size:13px;font-weight:600;margin-bottom:10px;">Detection Methods</div>
              <div style="display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface);border-radius:8px;">
                  <i class="ti ti-cpu" style="color:var(--teal);font-size:18px;flex-shrink:0;"></i>
                  <div><div style="font-size:12px;font-weight:600;">OCR Document Scanning</div><div style="font-size:11px;color:var(--text-3);">Detects tampered fields and forged signatures</div></div>
                </div>
                <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface);border-radius:8px;">
                  <i class="ti ti-database" style="color:var(--amber);font-size:18px;flex-shrink:0;"></i>
                  <div><div style="font-size:12px;font-weight:600;">Duplicate Record Check</div><div style="font-size:11px;color:var(--text-3);">Flags same survey number under multiple owners</div></div>
                </div>
                <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:var(--surface);border-radius:8px;">
                  <i class="ti ti-map-pin" style="color:var(--blue);font-size:18px;flex-shrink:0;"></i>
                  <div><div style="font-size:12px;font-weight:600;">GPS Boundary Validation</div><div style="font-size:11px;color:var(--text-3);">Detects coordinate mismatches and overlaps</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
    await this.load();
  },

  async load() {
    const el = document.getElementById('fraud-list');
    try {
      const res = await api.get('/applications?isFlagged=true&limit=20');
      const flagged = res.data || [];

      const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
      set('fraud-total', res.pagination?.total || flagged.length);
      set('fraud-active', flagged.filter(a => !['approved','certificate_issued','rejected'].includes(a.status)).length);

      if (!flagged.length) {
        el.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:3rem;">
          <i class="ti ti-shield-check" style="font-size:48px;color:var(--teal);display:block;margin-bottom:12px;"></i>
          <h3 style="margin-bottom:6px;color:var(--teal);">No Fraud Alerts</h3>
          <p style="color:var(--text-3);">No flagged applications at this time. The system is monitoring all submissions automatically.</p>
        </div></div>`;
        return;
      }

      el.innerHTML = flagged.map(a => {
        const riskLevel = a.fraudScore >= 61 ? 'high' : a.fraudScore >= 31 ? 'medium' : 'low';
        const riskColor = riskLevel === 'high' ? 'var(--red)' : riskLevel === 'medium' ? 'var(--amber)' : 'var(--blue)';
        
        return `
        <div class="fraud-item" style="border-left:3px solid ${riskColor};">
          <div class="risk-badge ${riskLevel}">
            <strong>${a.fraudScore || '??'}</strong>
            <span>Risk</span>
          </div>
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              <span class="mono" style="font-weight:700;">${a.applicationId}</span>
              <span class="badge ${riskLevel === 'high' ? 'badge-danger' : riskLevel === 'medium' ? 'badge-warning' : 'badge-info'}">${(a.flagReasons || ['Suspicious activity'])[0]}</span>
            </div>
            <p style="font-size:13px;color:var(--text-2);margin-bottom:6px;">
              Applicant: <strong>${a.applicantName || '—'}</strong> · Survey: <strong>${a.surveyNumber || '—'}</strong>
            </p>
            ${(a.flagReasons || []).length > 1 ? `
              <div style="font-size:12px;color:var(--text-3);margin-bottom:8px;">
                ${a.flagReasons.map(r => '<span class="badge badge-danger" style="margin-right:4px;margin-bottom:4px; font-size:10px;">' + r + '</span>').join('')}
              </div>` : ''}
            <p style="font-size:12px;color:var(--text-3);margin-bottom:10px;">
              <i class="ti ti-calendar"></i> Flagged ${formatDate(a.updatedAt)} · ${statusBadge(a.status)}
            </p>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-danger btn-sm" onclick="Pages.fraud.blockApp('${a._id}')">
                <i class="ti ti-ban"></i> Block Application
              </button>
              <button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')">
                <i class="ti ti-eye"></i> View Details
              </button>
              <button class="btn btn-outline btn-sm" onclick="Pages.fraud.clearFlag('${a._id}')">
                <i class="ti ti-shield-check"></i> Clear Flag
              </button>
            </div>
          </div>
        </div>`;
      }).join('');
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  },

  async blockApp(id) {
    try {
      await api.patch('/applications/' + id + '/status', {
        status: 'rejected',
        rejectionReason: 'Application blocked due to fraud detection alert'
      });
      showToast('Application blocked successfully.', 'success');
      this.load();
    } catch (err) { showToast(err.message, 'error'); }
  },

  async clearFlag(id) {
    try {
      await api.patch('/applications/' + id + '/flag', { isFlagged: false });
      showToast('Fraud flag cleared.', 'success');
      this.load();
    } catch (err) { showToast(err.message, 'error'); }
  }
};

// ══════════════════════════════════════════
// MUTATIONS
// ══════════════════════════════════════════
Pages.mutations = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Mutation Records</h1><p>Ownership transfer and mutation applications</p></div>
        <button class="btn btn-primary" onclick="App.loadPage('applications')">
          <i class="ti ti-inbox"></i> View All Applications
        </button>
      </div>
      <div id="mut-content">
        <div style="text-align:center;padding:2rem;">
          <div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div>
        </div>
      </div>`;
    await this.load();
  },

  async load() {
    const el = document.getElementById('mut-content');
    try {
      const res = await api.get('/applications?applicationType=mutation&limit=30');
      const apps = res.data || [];

      if (!apps.length) {
        el.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;padding:3rem;">
          <i class="ti ti-arrows-exchange" style="font-size:48px;color:var(--text-3);display:block;margin-bottom:12px;opacity:0.4;"></i>
          <h3 style="margin-bottom:6px;">No Mutation Records</h3>
          <p style="color:var(--text-3);">No mutation or ownership transfer applications have been submitted yet.</p>
        </div></div>`;
        return;
      }

      el.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>Mutation Applications</h3>
            <span style="font-size:12px;color:var(--text-3);">${apps.length} records</span>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr>
                <th>Application ID</th>
                <th>Applicant</th>
                <th>Survey No.</th>
                <th>Applied On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr></thead>
              <tbody>
                ${apps.map(a => `
                  <tr>
                    <td class="mono">${a.applicationId}</td>
                    <td>
                      <div style="font-weight:500;">${a.applicantName || '—'}</div>
                      <div style="font-size:11px;color:var(--text-3);">${a.applicant?.email || ''}</div>
                    </td>
                    <td class="mono">${a.surveyNumber || '—'}</td>
                    <td style="color:var(--text-3);">${formatDate(a.createdAt)}</td>
                    <td>${statusBadge(a.status)}</td>
                    <td>
                      <div style="display:flex;gap:4px;">
                        <button class="btn btn-outline btn-sm" onclick="Pages.applications.viewApp('${a._id}')">
                          <i class="ti ti-eye"></i> View
                        </button>
                        ${['submitted','under_review','field_inspection'].includes(a.status) ? `
                          <button class="btn btn-success btn-sm" onclick="Pages.applications.updateStatus('${a._id}','approved')">
                            <i class="ti ti-check"></i>
                          </button>
                          <button class="btn btn-danger btn-sm" onclick="Pages.applications.rejectPrompt('${a._id}')">
                            <i class="ti ti-x"></i>
                          </button>` : ''}
                        ${a.status === 'certificate_issued' ? `
                          <button class="btn btn-success btn-sm" onclick="showToast('Certificate downloaded!','success')">
                            <i class="ti ti-download"></i>
                          </button>` : ''}
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  }
};

// ══════════════════════════════════════════
// USER MANAGEMENT
// ══════════════════════════════════════════
Pages.users = {
  currentPage: 1,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>User Management</h1><p>Add and manage citizens, officers, revenue staff, registrars and admins</p></div>
        <button class="btn btn-primary" onclick="Pages.users.showAddModal()">
          <i class="ti ti-user-plus"></i> Add New User
        </button>
      </div>

      <!-- Role stat cards -->
      <div id="user-stat-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px;">
        ${['Citizen', 'Verification Officer', 'Surveyor', 'Revenue Staff', 'Tahsildar', 'Admin'].map((label, i) => {
          const roles = ['citizen', 'verification_officer', 'surveyor', 'revenue_staff', 'tahsildar', 'admin'];
          const icons = ['ti-user', 'ti-badge', 'ti-map-pin', 'ti-building-bank', 'ti-gavel', 'ti-shield'];
          return `
          <div class="stat-card c-navy" style="cursor:pointer;" onclick="Pages.users.filterByRole('${roles[i]}')">
            <div class="stat-icon navy"><i class="ti ${icons[i]}"></i></div>
            <div class="stat-value" id="cnt-${roles[i]}">—</div>
            <div class="stat-label">${label}s</div>
          </div>`;
        }).join('')}
      </div>

      <!-- Filters -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-body" style="padding:14px 18px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <input class="form-control" id="u-search" placeholder="Search by name, email, employee ID…" style="flex:1;min-width:200px;padding:8px 12px;" oninput="Pages.users.applyFilters()">
            <select class="form-control" id="u-role" style="width:180px;padding:8px 12px;" onchange="Pages.users.applyFilters()">
              <option value="">All Roles</option>
              <option value="citizen">Citizen</option>
              <option value="verification_officer">Verification Officer</option>
              <option value="surveyor">Surveyor</option>
              <option value="revenue_staff">Revenue Staff</option>
              <option value="tahsildar">Tahsildar</option>
              <option value="admin">Admin</option>
            </select>
            <select class="form-control" id="u-active" style="width:140px;padding:8px 12px;" onchange="Pages.users.applyFilters()">
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <button class="btn btn-outline btn-sm" onclick="Pages.users.clearFilters()"><i class="ti ti-x"></i> Clear</button>
          </div>
        </div>
      </div>

      <!-- Users table -->
      <div class="card">
        <div class="card-header">
          <h3 id="u-table-title">All Users</h3>
          <span id="u-table-count" style="font-size:12px;color:var(--text-3);"></span>
        </div>
        <div id="u-table-wrap"><div style="padding:2rem;text-align:center;"><div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div></div>
      </div>
      <div id="u-pagination"></div>`;

    await this.loadCounts();
    await this.loadUsers(1);
  },

  filterByRole(role) {
    document.getElementById('u-role').value = role;
    this.applyFilters();
  },

  clearFilters() {
    document.getElementById('u-search').value = '';
    document.getElementById('u-role').value = '';
    document.getElementById('u-active').value = '';
    this.loadUsers(1);
  },

  applyFilters() { this.loadUsers(1); },

  async loadCounts() {
    try {
      const res = await api.get('/users/counts');
      const d = res.data;
      ['citizen', 'verification_officer', 'surveyor', 'revenue_staff', 'tahsildar', 'admin'].forEach(role => {
        const el = document.getElementById('cnt-' + role);
        if (el) el.textContent = d[role] || 0;
      });
    } catch (e) {}
  },

  async loadUsers(page = 1) {
    this.currentPage = page;
    const search = document.getElementById('u-search')?.value || '';
    const role = document.getElementById('u-role')?.value || '';
    const isActive = document.getElementById('u-active')?.value || '';
    const el = document.getElementById('u-table-wrap');
    el.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-3);">Loading…</div>`;

    try {
      const params = new URLSearchParams({ page, limit: 15 });
      if (role) params.set('role', role);
      if (isActive !== '') params.set('isActive', isActive);
      if (search) params.set('search', search);

      const res = await api.get('/users?' + params);
      const users = res.data;

      const countEl = document.getElementById('u-table-count');
      if (countEl) countEl.textContent = res.pagination?.total + ' users found';

      if (!users.length) {
        el.innerHTML = `<div style="padding:2.5rem;text-align:center;color:var(--text-3);">
          <i class="ti ti-users" style="font-size:40px;display:block;margin-bottom:10px;"></i>
          <h3 style="margin-bottom:6px;">No users found</h3>
          <p>Try changing your filters or add a new user.</p>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="Pages.users.showAddModal()"><i class="ti ti-user-plus"></i> Add User</button>
        </div>`;
        return;
      }

      const roleColors = {
        citizen: 'badge-info', verification_officer: 'badge-success',
        revenue_staff: 'badge-warning', registrar: 'badge-gold', admin: 'badge-danger'
      };
      const roleLabels = {
        citizen: 'Citizen', verification_officer: 'Verification Officer',
        surveyor: 'Surveyor', revenue_staff: 'Revenue Staff',
        tahsildar: 'Tahsildar', registrar: 'Registrar', admin: 'Admin'
      };

      el.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>District</th>
          <th>Employee ID</th><th>Joined</th><th>Last Login</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>${users.map(u => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;border-radius:8px;background:rgba(13,33,55,0.08);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:var(--navy);flex-shrink:0;">
                  ${u.fullName.split(' ').map(n=>n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight:500;">${u.fullName}</div>
                  <div style="font-size:11px;color:var(--text-3);">${u.phone || '—'}</div>
                </div>
              </div>
            </td>
            <td style="font-size:12px;">${u.email}</td>
            <td><span class="badge ${roleColors[u.role] || 'badge-navy'}">${roleLabels[u.role] || u.role}</span></td>
            <td>${u.district || '—'}</td>
            <td class="mono">${u.employeeId || '—'}</td>
            <td style="color:var(--text-3);font-size:12px;">${formatDate(u.createdAt)}</td>
            <td style="color:var(--text-3);font-size:12px;">${u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}</td>
            <td><span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
            <td>
              <div style="display:flex;gap:4px;">
                <button class="btn btn-outline btn-sm" title="Edit" onclick="Pages.users.showEditModal('${u._id}','${u.fullName.replace(/'/g,"\'")}','${u.phone||''}','${u.district||''}','${u.mandal||''}','${u.designation||''}','${u.employeeId||''}','${u.role}')">
                  <i class="ti ti-pencil"></i>
                </button>
                <button class="btn btn-outline btn-sm" title="${u.isActive ? 'Deactivate' : 'Activate'}" onclick="Pages.users.toggleUser('${u._id}','${u.isActive}')">
                  <i class="ti ${u.isActive ? 'ti-lock' : 'ti-lock-open'}"></i>
                </button>
                <button class="btn btn-outline btn-sm" title="Change Role" onclick="Pages.users.showRoleModal('${u._id}','${u.role}','${u.fullName.replace(/'/g,"\'")}')">
                  <i class="ti ti-arrows-exchange"></i>
                </button>
                <button class="btn btn-danger btn-sm" title="Delete" onclick="Pages.users.deleteUser('${u._id}','${u.fullName.replace(/'/g,"\'")}')">
                  <i class="ti ti-trash"></i>
                </button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;

      renderPagination(document.getElementById('u-pagination'), res.pagination, 'Pages.users.loadUsers');
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger" style="margin:16px;"><i class="ti ti-alert-circle"></i> ${err.message}</div>`;
    }
  },

  showAddModal() {
    const existingModal = document.getElementById('add-user-modal');
    if (existingModal) existingModal.remove();

    const html = `
      <div class="modal-overlay" id="add-user-modal">
        <div class="modal" style="max-width:600px;">
          <div class="modal-header">
            <h3><i class="ti ti-user-plus" style="margin-right:8px;color:var(--navy);"></i>Add New User</h3>
            <button class="modal-close"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body">
            <div id="add-user-error" class="alert alert-danger hidden"><i class="ti ti-alert-circle"></i><span id="add-user-error-text"></span></div>

            <!-- Role selector with visual cards -->
            <div style="margin-bottom:18px;">
              <label class="form-label">Select Role *</label>
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
                ${[
                  ['verification_officer','Verification Officer','ti-badge','teal'],
                  ['surveyor','Surveyor','ti-map-pin','blue'],
                  ['revenue_staff','Revenue Staff','ti-building-bank','gold'],
                  ['tahsildar','Tahsildar','ti-gavel','navy'],
                  ['admin','Administrator','ti-shield','red'],
                  ['citizen','Citizen','ti-user','blue']
                ].map(([val,label,icon,color]) => `
                  <label style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border:2px solid var(--border);border-radius:var(--radius);cursor:pointer;transition:all 0.15s;text-align:center;" id="role-card-${val}">
                    <input type="radio" name="new-user-role" value="${val}" style="display:none;" onchange="Pages.users.onRoleSelect('${val}')">
                    <i class="ti ${icon}" style="font-size:20px;color:var(--${color === 'blue' ? 'blue' : color === 'teal' ? 'teal' : color === 'gold' ? 'amber' : color === 'red' ? 'red' : 'navy'});"></i>
                    <span style="font-size:11px;font-weight:600;color:var(--text-2);">${label}</span>
                  </label>`).join('')}
              </div>
            </div>

            <div class="form-grid">
              <div class="form-group span-2">
                <label class="form-label">Full Name *</label>
                <input class="form-control" id="nu-name" placeholder="Enter full name">
              </div>
              <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input class="form-control" id="nu-email" type="email" placeholder="official@domain.gov.in">
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input class="form-control" id="nu-phone" placeholder="10-digit mobile" maxlength="10" oninput="this.value=this.value.replace(/\D/g,'')">
              </div>
              <div class="form-group">
                <label class="form-label">Password *</label>
                <input class="form-control" id="nu-pass" type="password" placeholder="Min 8 characters">
              </div>
              <div class="form-group">
                <label class="form-label">District</label>
                <select class="form-control" id="nu-district" onchange="GeoData.setupDependentDropdown('nu-district', 'nu-mandal')">
                  <option value="">Select District</option>
                  ${GeoData.getDistrictOptions()}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Mandal</label>
                <select class="form-control" id="nu-mandal" disabled>
                  <option value="">Select District first</option>
                </select>
              </div>
              <div class="form-group" id="nu-desig-group">
                <label class="form-label">Designation</label>
                <input class="form-control" id="nu-designation" placeholder="e.g. Revenue Inspector">
              </div>
              <div class="form-group" id="nu-empid-group">
                <label class="form-label">Employee ID</label>
                <input class="form-control" id="nu-empid" placeholder="e.g. EMP-RVN-0001">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('add-user-modal')">Cancel</button>
            <button class="btn btn-primary" id="add-user-btn" onclick="Pages.users.createUser()">
              <i class="ti ti-user-plus"></i> Create Account
            </button>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    openModal('add-user-modal');
    // Select verification_officer by default
    const firstRoleInput = document.querySelector('input[name="new-user-role"]');
    if (firstRoleInput) {
      firstRoleInput.checked = true;
      Pages.users.onRoleSelect(firstRoleInput.value);
    }
  },

  onRoleSelect(role) {
    document.querySelectorAll('[id^="role-card-"]').forEach(card => {
      card.style.borderColor = 'var(--border)';
      card.style.background = 'transparent';
    });
    const selected = document.getElementById('role-card-' + role);
    if (selected) {
      selected.style.borderColor = 'var(--navy)';
      selected.style.background = 'rgba(13,33,55,0.04)';
    }
    const showEmp = role !== 'citizen';
    const empGrp = document.getElementById('nu-empid-group');
    const desGrp = document.getElementById('nu-desig-group');
    if (empGrp) empGrp.style.display = showEmp ? '' : 'none';
    if (desGrp) desGrp.style.display = showEmp ? '' : 'none';

    // District required for all officer roles; mandal required for tahsildar & revenue_staff
    const districtGrp = document.getElementById('nu-district') && document.getElementById('nu-district').closest('.form-group');
    const mandalGrp = document.getElementById('nu-mandal') && document.getElementById('nu-mandal').closest('.form-group');
    const districtEl = document.getElementById('nu-district');
    const mandalEl = document.getElementById('nu-mandal');

    const needsDistrict = role !== 'citizen';
    const needsMandal = ['tahsildar', 'revenue_staff'].includes(role);

    if (districtGrp) {
      const lbl = districtGrp.querySelector('.form-label');
      if (lbl) lbl.textContent = needsDistrict ? 'District *' : 'District';
    }
    if (districtEl) districtEl.required = needsDistrict;

    if (mandalGrp) {
      mandalGrp.style.display = needsDistrict ? '' : 'none';
      const lbl = mandalGrp.querySelector('.form-label');
      if (lbl) lbl.textContent = needsMandal ? 'Mandal *' : 'Mandal';
    }
    if (mandalEl) mandalEl.required = needsMandal;
  },

  async createUser() {
    const role = document.querySelector('input[name="new-user-role"]:checked')?.value;
    const fullName = document.getElementById('nu-name').value.trim();
    const email = document.getElementById('nu-email').value.trim();
    const phone = document.getElementById('nu-phone').value.trim();
    const password = document.getElementById('nu-pass').value;
    const district = document.getElementById('nu-district').value;
    const mandal = document.getElementById('nu-mandal').value.trim();
    const designation = document.getElementById('nu-designation').value.trim();
    const employeeId = document.getElementById('nu-empid').value.trim();

    const errEl = document.getElementById('add-user-error');
    const errTxt = document.getElementById('add-user-error-text');
    errEl.classList.add('hidden');

    if (!role) { errTxt.textContent = 'Please select a role.'; errEl.classList.remove('hidden'); return; }
    if (!fullName) { errTxt.textContent = 'Full name is required.'; errEl.classList.remove('hidden'); return; }
    if (!email || !email.includes('@')) { errTxt.textContent = 'Valid email address is required.'; errEl.classList.remove('hidden'); return; }
    if (!phone || phone.length !== 10) { errTxt.textContent = 'Valid 10-digit phone number is required.'; errEl.classList.remove('hidden'); return; }
    if (!password || password.length < 8) { errTxt.textContent = 'Password must be at least 8 characters.'; errEl.classList.remove('hidden'); return; }
    if (role !== 'citizen' && !district) { errTxt.textContent = 'District is required for officer accounts.'; errEl.classList.remove('hidden'); return; }
    if (['tahsildar', 'revenue_staff'].includes(role) && !mandal) { errTxt.textContent = 'Mandal is required for Tahsildar and Revenue Staff accounts.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('add-user-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Creating…';

    try {
      const body = { fullName, email, phone, password, role };
      if (district) body.district = district;
      if (mandal) body.mandal = mandal;
      if (designation) body.designation = designation;
      if (employeeId) body.employeeId = employeeId;

      await api.post('/users', body);
      closeModal('add-user-modal');
      showToast(fullName + ' account created successfully!', 'success');
      await this.loadCounts();
      await this.loadUsers(this.currentPage);
    } catch (err) {
      errTxt.textContent = err.message;
      errEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-user-plus"></i> Create Account';
    }
  },

  showEditModal(id, name, phone, district, mandal, designation, employeeId, role) {
    const existingModal = document.getElementById('edit-user-modal');
    if (existingModal) existingModal.remove();

    const html = `
      <div class="modal-overlay" id="edit-user-modal">
        <div class="modal" style="max-width:500px;">
          <div class="modal-header">
            <h3><i class="ti ti-pencil" style="margin-right:8px;"></i>Edit User — ${name}</h3>
            <button class="modal-close"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="form-group span-2">
                <label class="form-label">Full Name</label>
                <input class="form-control" id="eu-name" value="${name}">
              </div>
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input class="form-control" id="eu-phone" value="${phone}" maxlength="10" oninput="this.value=this.value.replace(/\D/g,'')">
              </div>
              <div class="form-group">
                <label class="form-label">District</label>
                <select class="form-control" id="eu-district" onchange="GeoData.setupDependentDropdown('eu-district', 'eu-mandal')">
                  <option value="">Select District</option>
                  ${GeoData.getDistrictOptions(district)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Mandal</label>
                <select class="form-control" id="eu-mandal" disabled>
                  ${GeoData.getMandalOptions(district, mandal)}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Designation</label>
                <input class="form-control" id="eu-designation" value="${designation}">
              </div>
              <div class="form-group">
                <label class="form-label">Employee ID</label>
                <input class="form-control" id="eu-empid" value="${employeeId}">
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('edit-user-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="Pages.users.saveEdit('${id}')"><i class="ti ti-check"></i> Save Changes</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal('edit-user-modal');
  },

  async saveEdit(id) {
    const body = {
      fullName: document.getElementById('eu-name').value.trim(),
      phone: document.getElementById('eu-phone').value.trim(),
      district: document.getElementById('eu-district').value,
      mandal: document.getElementById('eu-mandal').value.trim(),
      designation: document.getElementById('eu-designation').value.trim(),
      employeeId: document.getElementById('eu-empid').value.trim()
    };
    try {
      await api.put('/users/' + id, body);
      closeModal('edit-user-modal');
      showToast('User updated successfully!', 'success');
      this.loadUsers(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },

  showRoleModal(id, currentRole, name) {
    const existingModal = document.getElementById('role-modal');
    if (existingModal) existingModal.remove();

    const roleLabels = {
      citizen: 'Citizen', verification_officer: 'Verification Officer',
      surveyor: 'Surveyor', revenue_staff: 'Revenue Staff',
      tahsildar: 'Tahsildar', registrar: 'Registrar', admin: 'Admin'
    };

    const html = `
      <div class="modal-overlay" id="role-modal">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header">
            <h3><i class="ti ti-arrows-exchange" style="margin-right:8px;"></i>Change Role — ${name}</h3>
            <button class="modal-close"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-warning"><i class="ti ti-alert-triangle"></i><div>Changing a user's role affects what they can access on the portal. Make sure you intend to do this.</div></div>
            <div class="form-group">
              <label class="form-label">Current Role</label>
              <input class="form-control" value="${roleLabels[currentRole] || currentRole}" readonly style="background:var(--surface);color:var(--text-3);">
            </div>
            <div class="form-group">
              <label class="form-label">New Role *</label>
              <select class="form-control" id="new-role-select">
                ${Object.entries(roleLabels).map(([val,label]) => `<option value="${val}" ${val===currentRole?'selected':''}>${label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('role-modal')">Cancel</button>
            <button class="btn btn-primary" onclick="Pages.users.confirmRoleChange('${id}')"><i class="ti ti-check"></i> Update Role</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal('role-modal');
  },

  async confirmRoleChange(id) {
    const role = document.getElementById('new-role-select').value;
    try {
      await api.put('/users/' + id + '/role', { role });
      closeModal('role-modal');
      showToast('User role updated successfully.', 'success');
      await this.loadCounts();
      this.loadUsers(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },

  async toggleUser(id, current) {
    try {
      const res = await api.patch('/users/' + id + '/toggle');
      const nowActive = res.data?.isActive;
      showToast('User ' + (nowActive ? 'activated' : 'deactivated') + ' successfully.', 'success');
      await this.loadCounts();
      this.loadUsers(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  },

  deleteUser(id, name) {
    const existingModal = document.getElementById('delete-user-modal');
    if (existingModal) existingModal.remove();

    const html = `
      <div class="modal-overlay" id="delete-user-modal">
        <div class="modal" style="max-width:400px;">
          <div class="modal-header">
            <h3><i class="ti ti-trash" style="margin-right:8px;color:var(--red);"></i>Delete User</h3>
            <button class="modal-close"><i class="ti ti-x"></i></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-danger"><i class="ti ti-alert-octagon"></i><div><strong>This action cannot be undone.</strong><br>Are you sure you want to permanently delete <strong>${name}</strong>?</div></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" onclick="closeModal('delete-user-modal')">Cancel</button>
            <button class="btn btn-danger" onclick="Pages.users.confirmDelete('${id}')"><i class="ti ti-trash"></i> Yes, Delete</button>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    openModal('delete-user-modal');
  },

  async confirmDelete(id) {
    try {
      await api.delete('/users/' + id);
      closeModal('delete-user-modal');
      showToast('User deleted successfully.', 'success');
      await this.loadCounts();
      this.loadUsers(this.currentPage);
    } catch (err) { showToast(err.message, 'error'); }
  }
};

// ══════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════
Pages.reports = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1>Reports & Analytics</h1><p>Land administration performance metrics and insights</p></div><button class="btn btn-outline btn-sm"><i class="ti ti-download"></i> Export Report</button></div>
      <div id="report-content"><div style="text-align:center;padding:2rem;"><div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div></div>`;
    try {
      const res = await api.get('/reports/overview');
      const d = res.data;
      document.getElementById('report-content').innerHTML = `
        <div class="stat-grid" style="margin-bottom:24px;">
          <div class="stat-card c-navy"><div class="stat-icon navy"><i class="ti ti-map"></i></div><div class="stat-value" data-val="${d.totalLand}">0</div><div class="stat-label">Total Land Records</div></div>
          <div class="stat-card c-gold"><div class="stat-icon gold"><i class="ti ti-file-text"></i></div><div class="stat-value" data-val="${d.totalApps}">0</div><div class="stat-label">Total Applications</div></div>
          <div class="stat-card c-teal"><div class="stat-icon teal"><i class="ti ti-users"></i></div><div class="stat-value" data-val="${d.totalUsers}">0</div><div class="stat-label">Active Users</div></div>
          <div class="stat-card c-red"><div class="stat-icon red"><i class="ti ti-alert-triangle"></i></div><div class="stat-value" data-val="${d.fraudAlerts}">0</div><div class="stat-label">Fraud Alerts</div></div>
        </div>
        <div class="two-col">
          <div class="card">
            <div class="card-header"><h3>Applications by Month</h3></div>
            <div class="card-body">
              <div style="display:flex;gap:4px;align-items:flex-end;height:140px;">
                ${(d.appsByMonth || []).slice(-7).map((m, i, arr) => {
                  const max = Math.max(...arr.map(x => x.count), 1);
                  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;">
                    <span style="font-size:9px;color:var(--text-3);">${m.count}</span>
                    <div style="width:100%;background:var(--navy);opacity:${i===arr.length-1?1:0.3};border-radius:3px 3px 0 0;height:${Math.round(m.count/max*100)}%;min-height:4px;"></div>
                    <span style="font-size:9px;color:var(--text-3);">${m._id?.month || ''}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Records by District</h3></div>
            <div class="card-body">
              ${(d.landByDistrict || []).slice(0,6).map((item, i) => {
                const max = d.landByDistrict[0]?.count || 1;
                return `
                  <div style="margin-bottom:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span>${item._id}</span><span style="font-weight:600;">${item.count}</span></div>
                    <div style="height:5px;background:var(--surface-2);border-radius:3px;"><div style="height:100%;width:${Math.round(item.count/max*100)}%;background:var(--navy);border-radius:3px;opacity:${1 - i*0.12};"></div></div>
                  </div>`;
              }).join('')}
              ${!d.landByDistrict?.length ? '<p style="color:var(--text-3);font-size:13px;">No district data available yet.</p>' : ''}
            </div>
          </div>
        </div>`;
      document.querySelectorAll('[data-val]').forEach(el => animateNumber(el, parseInt(el.dataset.val) || 0));
    } catch (err) {
      document.getElementById('report-content').innerHTML = `<div class="alert alert-danger"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  }
};

// ══════════════════════════════════════════
// ADD LAND RECORD
// ══════════════════════════════════════════
Pages.landAdd = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <div><h1>Add Land Record</h1><p>Create a new land record in the centralized database</p></div>
      </div>
      <div class="two-col">
        <div>
          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3><i class="ti ti-user" style="margin-right:6px;color:var(--text-3);"></i>Survey & Owner Details</h3></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Survey Number *</label>
                  <input class="form-control" id="l-survey" placeholder="e.g. SY-001/1A" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Patta Number</label>
                  <input class="form-control" id="l-patta" placeholder="e.g. PTA-0001">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">Owner Full Name *</label>
                  <input class="form-control" id="l-owner" placeholder="Full name as per revenue records" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Owner Aadhaar</label>
                  <input class="form-control" id="l-aadhaar" placeholder="12-digit Aadhaar" maxlength="12" oninput="this.value=this.value.replace(/\D/g,'')">
                </div>
                <div class="form-group">
                  <label class="form-label">Owner Contact</label>
                  <input class="form-control" id="l-contact" placeholder="10-digit mobile" maxlength="10" oninput="this.value=this.value.replace(/\D/g,'')">
                </div>
                <div class="form-group span-2">
                  <label class="form-label">Owner Address</label>
                  <input class="form-control" id="l-address" placeholder="H.No, Street, Village, District, PIN">
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3><i class="ti ti-map-pin" style="margin-right:6px;color:var(--text-3);"></i>Location Details</h3></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">District *</label>
                  <select class="form-control" id="l-district" required onchange="GeoData.setupDependentDropdown('l-district', 'l-mandal')">
                    <option value="">Select District</option>
                    ${GeoData.getDistrictOptions()}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Mandal *</label>
                  <select class="form-control" id="l-mandal" required disabled>
                    <option value="">Select District first</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Village *</label>
                  <input class="form-control" id="l-village" placeholder="Village name" required>
                </div>
                <div class="form-group">
                  <label class="form-label">PIN Code</label>
                  <input class="form-control" id="l-pin" placeholder="6-digit PIN" maxlength="6" oninput="this.value=this.value.replace(/\D/g,'')">
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3><i class="ti ti-map-2" style="margin-right:6px;color:var(--text-3);"></i>GPS Coordinates <span style="font-size:11px;font-weight:400;color:var(--teal);background:var(--teal-pale);padding:2px 8px;border-radius:10px;margin-left:6px;">Required for GIS Map</span></h3></div>
            <div class="card-body">
              <div class="alert alert-info" style="margin-bottom:14px;">
                <i class="ti ti-info-circle"></i>
                <div><strong>How to get GPS coordinates:</strong> Open Google Maps → right-click on the land location → the first two numbers shown are Latitude and Longitude.</div>
              </div>
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Latitude *</label>
                  <input class="form-control" id="l-lat" placeholder="e.g. 17.0728" type="number" step="0.0001" oninput="Pages.landAdd.updateMapPreview()">
                  <div style="font-size:11px;color:var(--text-3);margin-top:3px;">Range: 12.5 to 19.5 (Andhra Pradesh)</div>
                </div>
                <div class="form-group">
                  <label class="form-label">Longitude *</label>
                  <input class="form-control" id="l-lng" placeholder="e.g. 81.8022" type="number" step="0.0001" oninput="Pages.landAdd.updateMapPreview()">
                  <div style="font-size:11px;color:var(--text-3);margin-top:3px;">Range: 76.7 to 84.8 (Andhra Pradesh)</div>
                </div>
              </div>
              <!-- Map Preview -->
              <div id="map-preview-wrap" style="display:none;margin-top:10px;">
                <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:6px;"><i class="ti ti-eye"></i> Location Preview</div>
                <div style="background:var(--surface);border-radius:var(--radius);padding:10px;display:flex;align-items:center;gap:10px;">
                  <div style="width:40px;height:40px;background:var(--teal-pale);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i class="ti ti-map-pin" style="color:var(--teal);font-size:20px;"></i>
                  </div>
                  <div>
                    <div style="font-size:13px;font-weight:600;" id="preview-coords">—</div>
                    <div style="font-size:12px;color:var(--text-3);">Coordinates will appear on GIS map after saving</div>
                  </div>
                  <a id="preview-gmaps-link" href="#" target="_blank" class="btn btn-outline btn-sm" style="margin-left:auto;">
                    <i class="ti ti-external-link"></i> Verify on Google Maps
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3><i class="ti ti-arrows-split" style="margin-right:6px;color:var(--text-3);"></i>Boundaries</h3></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-group"><label class="form-label">North</label><input class="form-control" id="l-bn" placeholder="e.g. PWD Road / SY-number"></div>
                <div class="form-group"><label class="form-label">South</label><input class="form-control" id="l-bs" placeholder="e.g. Canal / SY-number"></div>
                <div class="form-group"><label class="form-label">East</label><input class="form-control" id="l-be" placeholder="e.g. Existing building"></div>
                <div class="form-group"><label class="form-label">West</label><input class="form-control" id="l-bw" placeholder="e.g. Government land"></div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3><i class="ti ti-trees" style="margin-right:6px;color:var(--text-3);"></i>Land Details</h3></div>
            <div class="card-body">
              <div class="form-grid">
                <div class="form-group">
                  <label class="form-label">Land Type *</label>
                  <select class="form-control" id="l-type" required>
                    <option value="">Select Type</option>
                    <option value="agricultural">Agricultural</option>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="government">Government</option>
                    <option value="forest">Forest</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Land Use</label>
                  <input class="form-control" id="l-use" placeholder="e.g. Paddy cultivation">
                </div>
                <div class="form-group">
                  <label class="form-label">Extent Value *</label>
                  <input class="form-control" id="l-extent" type="number" step="0.01" min="0" placeholder="e.g. 3.45" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Extent Unit</label>
                  <select class="form-control" id="l-unit">
                    <option value="acres">Acres</option>
                    <option value="sq_yards">Sq. Yards</option>
                    <option value="sq_meters">Sq. Meters</option>
                    <option value="guntas">Guntas</option>
                    <option value="cents">Cents</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Market Value (₹)</label>
                  <input class="form-control" id="l-mval" type="number" placeholder="e.g. 2500000">
                </div>
                <div class="form-group">
                  <label class="form-label">Guidance Value (₹)</label>
                  <input class="form-control" id="l-gval" type="number" placeholder="e.g. 2000000">
                </div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-bottom:16px;">
            <div class="card-header"><h3><i class="ti ti-shield-check" style="margin-right:6px;color:var(--text-3);"></i>Verification & Registration</h3></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Verification Status</label>
                <select class="form-control" id="l-vstatus">
                  <option value="pending">Pending Verification</option>
                  <option value="verified">Verified</option>
                  <option value="under_review">Under Review</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Registration Date</label>
                <input class="form-control" id="l-regdate" type="date">
              </div>
              <div class="form-group">
                <label class="form-label">Remarks / Notes</label>
                <textarea class="form-control" id="l-remarks" rows="3" placeholder="Any additional notes about this land record…"></textarea>
              </div>
            </div>
          </div>

          <div class="alert alert-info">
            <i class="ti ti-info-circle"></i>
            <div>A unique <strong>Registration ID</strong> will be automatically assigned after saving. The record will immediately appear on the GIS map if GPS coordinates are provided.</div>
          </div>

          <button class="btn btn-primary btn-block btn-lg" id="save-land-btn" onclick="Pages.landAdd.save()">
            <i class="ti ti-map-pin-plus"></i> Save Land Record
          </button>
        </div>
      </div>`;
  },

  updateMapPreview() {
    const lat = parseFloat(document.getElementById('l-lat').value);
    const lng = parseFloat(document.getElementById('l-lng').value);
    const wrap = document.getElementById('map-preview-wrap');
    const coordEl = document.getElementById('preview-coords');
    const linkEl = document.getElementById('preview-gmaps-link');

    if (!isNaN(lat) && !isNaN(lng)) {
      wrap.style.display = 'block';
      coordEl.textContent = lat + ', ' + lng;
      linkEl.href = 'https://www.google.com/maps?q=' + lat + ',' + lng;
    } else {
      wrap.style.display = 'none';
    }
  },

  async save() {
    const surveyNumber  = document.getElementById('l-survey').value.trim();
    const ownerName     = document.getElementById('l-owner').value.trim();
    const district      = document.getElementById('l-district').value;
    const mandal        = document.getElementById('l-mandal').value.trim();
    const village       = document.getElementById('l-village').value.trim();
    const landType      = document.getElementById('l-type').value;
    const extentVal     = document.getElementById('l-extent').value;
    const lat           = parseFloat(document.getElementById('l-lat').value);
    const lng           = parseFloat(document.getElementById('l-lng').value);

    if (!surveyNumber || !ownerName || !district || !mandal || !village || !landType || !extentVal) {
      showToast('Please fill all required fields marked with *', 'warning');
      return;
    }

    if (!isNaN(lat) && (lat < 8 || lat > 37)) {
      showToast('Latitude seems incorrect. Expected range: 8 to 37 for India.', 'warning');
      return;
    }
    if (!isNaN(lng) && (lng < 68 || lng > 98)) {
      showToast('Longitude seems incorrect. Expected range: 68 to 98 for India.', 'warning');
      return;
    }

    const btn = document.getElementById('save-land-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading-spinner"></span> Saving…';

    const body = {
      surveyNumber,
      pattaNumber: document.getElementById('l-patta').value.trim() || undefined,
      currentOwner: {
        name:          ownerName,
        aadhaarNumber: document.getElementById('l-aadhaar').value.trim() || undefined,
        contact:       document.getElementById('l-contact').value.trim() || undefined,
        address:       document.getElementById('l-address').value.trim() || undefined
      },
      district, mandal, village,
      pincode:   document.getElementById('l-pin').value.trim() || undefined,
      landType,
      landUse:   document.getElementById('l-use').value.trim() || undefined,
      extent: {
        value: parseFloat(extentVal),
        unit:  document.getElementById('l-unit').value
      },
      marketValue:    parseFloat(document.getElementById('l-mval').value) || undefined,
      guidanceValue:  parseFloat(document.getElementById('l-gval').value) || undefined,
      boundaries: {
        north: document.getElementById('l-bn').value.trim(),
        south: document.getElementById('l-bs').value.trim(),
        east:  document.getElementById('l-be').value.trim(),
        west:  document.getElementById('l-bw').value.trim()
      },
      verificationStatus: document.getElementById('l-vstatus').value,
      registrationDate:   document.getElementById('l-regdate').value || undefined,
      remarks:            document.getElementById('l-remarks').value.trim() || undefined
    };

    // Add GPS data if provided
    if (!isNaN(lat) && !isNaN(lng)) {
      body.gisData = {
        latitude:  lat,
        longitude: lng,
        area:      parseFloat(extentVal)
      };
    }

    try {
      const res = await api.post('/land', body);
      showToast('Land record ' + res.data.registrationId + ' created successfully!', 'success');
      if (!isNaN(lat) && !isNaN(lng)) {
        showToast('GPS coordinates saved — record will appear on GIS map!', 'success');
      }
      setTimeout(() => App.loadPage('map'), 1800);
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-map-pin-plus"></i> Save Land Record';
    }
  }
};

// ══════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════
Pages.notifications = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1>Notifications</h1><p>SMS, email and system alerts</p></div><button class="btn btn-outline btn-sm" onclick="Pages.notifications.markAll()"><i class="ti ti-check"></i> Mark all read</button></div>
      <div class="card" id="notif-card"><div style="text-align:center;padding:2rem;"><div class="loading-spinner" style="width:28px;height:28px;border:3px solid rgba(13,33,55,0.15);border-top-color:var(--navy);margin:0 auto;"></div></div></div>`;
    await this.loadNotifications();
  },

  async loadNotifications() {
    try {
      const res = await api.get('/notifications');
      const notifs = res.data;
      const el = document.getElementById('notif-card');
      if (!notifs.length) { el.innerHTML = `<div style="text-align:center;padding:3rem;color:var(--text-3);"><i class="ti ti-bell" style="font-size:40px;display:block;margin-bottom:12px;"></i><h3>No notifications</h3><p>You're all caught up!</p></div>`; return; }
      const iconMap = { certificate_ready:'ti-certificate', fraud_alert:'ti-alert-triangle', document_verified:'ti-shield-check', application_update:'ti-file-text', system:'ti-bell', reminder:'ti-clock' };
      const colorMap = { certificate_ready:'var(--teal)', fraud_alert:'var(--red)', document_verified:'var(--teal)', application_update:'var(--blue)', system:'var(--navy)', reminder:'var(--amber)' };
      const bgMap = { certificate_ready:'var(--teal-pale)', fraud_alert:'var(--red-pale)', document_verified:'var(--teal-pale)', application_update:'var(--blue-pale)', system:'rgba(13,33,55,0.07)', reminder:'var(--amber-pale)' };
      el.innerHTML = notifs.map(n => `
        <div class="notif-item ${n.isRead ? '' : 'unread'}" onclick="Pages.notifications.markRead('${n._id}',this)">
          <div class="notif-icon" style="background:${bgMap[n.type]||'var(--surface)'};color:${colorMap[n.type]||'var(--navy)'};"><i class="ti ${iconMap[n.type]||'ti-bell'}"></i></div>
          <div class="notif-body"><h4>${n.title}</h4><p>${n.message}</p></div>
          <span class="notif-time">${timeAgo(n.createdAt)}</span>
          ${!n.isRead ? `<div style="width:8px;height:8px;background:var(--gold);border-radius:50%;flex-shrink:0;margin-top:6px;"></div>` : ''}
        </div>`).join('');
    } catch (err) {
      document.getElementById('notif-card').innerHTML = `<div class="alert alert-danger" style="margin:16px;"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  },

  async markRead(id, el) {
    el.classList.remove('unread');
    const dot = el.querySelector('[style*="background:var(--gold)"]');
    if (dot) dot.remove();
    await api.patch(`/notifications/${id}/read`).catch(() => {});
  },

  async markAll() {
    await api.patch('/notifications/mark-read').catch(() => {});
    document.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
    document.getElementById('badge-notif').textContent = '';
    showToast('All notifications marked as read.', 'success');
  }
};

// ══════════════════════════════════════════
// AUDIT LOGS
// ══════════════════════════════════════════
Pages.audit = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><div><h1>Audit Logs</h1><p>Complete activity trail for compliance and transparency</p></div><button class="btn btn-outline btn-sm"><i class="ti ti-download"></i> Export CSV</button></div>
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <select class="form-control" id="al-module" style="flex:0 0 140px;padding:8px 10px;" onchange="Pages.audit.load()"><option value="">All Modules</option><option value="auth">Auth</option><option value="land">Land</option><option value="application">Application</option><option value="document">Document</option><option value="user">User</option><option value="system">System</option></select>
            <select class="form-control" id="al-status" style="flex:0 0 130px;padding:8px 10px;" onchange="Pages.audit.load()"><option value="">All Status</option><option value="success">Success</option><option value="failure">Failure</option><option value="warning">Warning</option></select>
          </div>
        </div>
      </div>
      <div class="card"><div id="audit-table"><div style="padding:1.5rem;text-align:center;color:var(--text-3);">Loading audit logs…</div></div></div>`;
    await this.load();
  },

  async load() {
    const module = document.getElementById('al-module')?.value || '';
    const status = document.getElementById('al-status')?.value || '';
    const el = document.getElementById('audit-table');
    el.innerHTML = `<div style="padding:1rem;text-align:center;color:var(--text-3);">Loading…</div>`;
    try {
      const params = new URLSearchParams({ limit: 30 });
      if (module) params.set('module', module);
      if (status) params.set('status', status);
      const res = await api.get(`/audit?${params}`);
      const logs = res.data;
      if (!logs.length) { el.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-3);">No audit logs found.</div>`; return; }
      el.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Timestamp</th><th>User</th><th>Role</th><th>Module</th><th>Action</th><th>Details</th><th>IP</th><th>Status</th></tr></thead>
        <tbody>${logs.map(l => `
          <tr>
            <td class="mono" style="font-size:11px;">${formatDateTime(l.createdAt)}</td>
            <td><div style="font-size:13px;">${l.userName || 'System'}</div></td>
            <td><span class="badge badge-navy" style="text-transform:capitalize;">${(l.userRole || 'system').replace(/_/g,' ')}</span></td>
            <td><span class="badge badge-info">${l.module || '—'}</span></td>
            <td style="font-weight:500;font-size:13px;">${l.action}</td>
            <td style="font-size:12px;color:var(--text-2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${l.details || ''}">${l.details || '—'}</td>
            <td class="mono" style="font-size:11px;">${l.ipAddress || '—'}</td>
            <td><span class="badge ${l.status==='success'?'badge-success':l.status==='warning'?'badge-warning':'badge-danger'}">${l.status}</span></td>
          </tr>`).join('')}
        </tbody></table></div>`;
    } catch (err) {
      el.innerHTML = `<div class="alert alert-danger" style="margin:16px;"><i class="ti ti-alert-circle"></i>${err.message}</div>`;
    }
  }
};

// ══════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════
Pages.profile = {
  isEditing: false,

  async render(container) {
    const user = Auth.user;
    const isCitizen = user.role === 'citizen';

    container.innerHTML = `
      <div class="profile-banner">
        <div class="profile-av-lg">${Auth.initials()}</div>
        <div>
          <div class="profile-name">${user.fullName}</div>
          <div class="profile-sub">${Auth.roleLabel()} ${user.district ? '· ' + user.district : ''}</div>
          <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
            <span class="badge" style="background:rgba(29,158,117,0.2);color:#9fe1cb;">
              <i class="ti ti-shield-check"></i> Account Verified
            </span>
            ${user.employeeId ? `<span class="badge" style="background:rgba(200,146,42,0.2);color:var(--gold-light);"><i class="ti ti-id"></i> ${user.employeeId}</span>` : ''}
            ${isCitizen ? '' : `<span class="badge" style="background:rgba(30,74,122,0.3);color:#a8c8ff;"><i class="ti ti-eye"></i> View Only Profile</span>`}
          </div>
        </div>
      </div>

      <div class="two-col">
        <div class="card">
          <div class="card-header">
            <h3>Personal Information</h3>
            ${isCitizen
              ? `<button class="btn btn-outline btn-sm" id="edit-btn" onclick="Pages.profile.toggleEdit()">
                  <i class="ti ti-pencil"></i> Edit
                </button>`
              : `<span class="badge badge-info" style="font-size:12px;padding:6px 12px;">
                  <i class="ti ti-lock"></i> Read Only
                </span>`}
          </div>
          <div class="card-body">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input class="form-control" id="p-name" value="${user.fullName}" ${isCitizen ? 'readonly' : 'readonly disabled'} style="${isCitizen ? '' : 'background:var(--surface);color:var(--text-3);'}">
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input class="form-control" value="${user.email}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>
              <div class="form-group">
                <label class="form-label">Phone</label>
                <input class="form-control" id="p-phone" value="${user.phone || '—'}" ${isCitizen ? 'readonly' : 'readonly disabled'} style="${isCitizen ? '' : 'background:var(--surface);color:var(--text-3);'}">
              </div>
              <div class="form-group">
                <label class="form-label">Role</label>
                <input class="form-control" value="${Auth.roleLabel()}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>
              <div class="form-group">
                <label class="form-label">District</label>
                <input class="form-control" value="${user.district || '—'}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>
              <div class="form-group">
                <label class="form-label">Last Login</label>
                <input class="form-control" value="${user.lastLogin ? formatDateTime(user.lastLogin) : 'N/A'}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>
              ${user.designation ? `
              <div class="form-group">
                <label class="form-label">Designation</label>
                <input class="form-control" value="${user.designation}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>` : ''}
              ${user.employeeId ? `
              <div class="form-group">
                <label class="form-label">Employee ID</label>
                <input class="form-control" value="${user.employeeId}" readonly disabled style="background:var(--surface);color:var(--text-3);">
              </div>` : ''}
            </div>

            <!-- Edit action buttons — only shown to citizens when editing -->
            <div id="edit-action-btns" style="display:none;margin-top:10px;display:flex;gap:8px;">
              <button class="btn btn-primary btn-sm" onclick="Pages.profile.saveProfile()">
                <i class="ti ti-check"></i> Save Changes
              </button>
              <button class="btn btn-outline btn-sm" onclick="Pages.profile.cancelEdit()">
                Cancel
              </button>
            </div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:16px;">

          <!-- Change Password — available to all roles -->
          <div class="card">
            <div class="card-header"><h3>Change Password</h3></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input class="form-control" id="cp-current" type="password" placeholder="Enter current password">
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input class="form-control" id="cp-new" type="password" placeholder="Min 8 characters">
              </div>
              <div class="form-group">
                <label class="form-label">Confirm New Password</label>
                <input class="form-control" id="cp-confirm" type="password" placeholder="Repeat new password">
              </div>
              <button class="btn btn-primary btn-block" onclick="Pages.profile.changePassword()">
                <i class="ti ti-lock"></i> Update Password
              </button>
            </div>
          </div>

          <!-- Security Settings -->
          <div class="card">
            <div class="card-header"><h3>Security Settings</h3></div>
            <div class="card-body" style="display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--surface);border-radius:8px;">
                <div>
                  <div style="font-size:13px;font-weight:500;">Two-Factor Authentication</div>
                  <div style="font-size:12px;color:var(--text-3);">OTP via SMS on login</div>
                </div>
                <button class="btn btn-outline btn-sm" onclick="showToast('2FA setup coming soon','info')">Enable</button>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--surface);border-radius:8px;">
                <div>
                  <div style="font-size:13px;font-weight:500;">Login Notifications</div>
                  <div style="font-size:12px;color:var(--text-3);">Email alert on new device login</div>
                </div>
                <button class="btn btn-success btn-sm" style="pointer-events:none;">Active</button>
              </div>
              <button class="btn btn-danger btn-sm" style="justify-content:flex-start;gap:10px;margin-top:4px;" onclick="App.logout()">
                <i class="ti ti-logout"></i> Sign Out from All Devices
              </button>
            </div>
          </div>

        </div>
      </div>`;
  },

  toggleEdit() {
    const user = Auth.user;
    if (user.role !== 'citizen') return; // Extra safety check
    this.isEditing = !this.isEditing;

    const nameEl  = document.getElementById('p-name');
    const phoneEl = document.getElementById('p-phone');
    const editBtn = document.getElementById('edit-btn');
    const actionBtns = document.getElementById('edit-action-btns');

    if (this.isEditing) {
      if (nameEl)  { nameEl.removeAttribute('readonly');  nameEl.focus(); }
      if (phoneEl) { phoneEl.removeAttribute('readonly'); }
      if (editBtn) editBtn.innerHTML = '<i class="ti ti-x"></i> Cancel';
      if (actionBtns) actionBtns.style.display = 'flex';
    } else {
      this.cancelEdit();
    }
  },

  cancelEdit() {
    this.isEditing = false;
    const user = Auth.user;
    const nameEl  = document.getElementById('p-name');
    const phoneEl = document.getElementById('p-phone');
    const editBtn = document.getElementById('edit-btn');
    const actionBtns = document.getElementById('edit-action-btns');

    if (nameEl)  { nameEl.value = user.fullName; nameEl.setAttribute('readonly', true); }
    if (phoneEl) { phoneEl.value = user.phone || '—'; phoneEl.setAttribute('readonly', true); }
    if (editBtn) editBtn.innerHTML = '<i class="ti ti-pencil"></i> Edit';
    if (actionBtns) actionBtns.style.display = 'none';
  },

  async saveProfile() {
    if (Auth.user.role !== 'citizen') {
      showToast('Profile editing is not allowed for this role.', 'error');
      return;
    }
    const name  = document.getElementById('p-name')?.value.trim();
    const phone = document.getElementById('p-phone')?.value.trim();
    if (!name) { showToast('Name cannot be empty.', 'warning'); return; }
    showToast('Profile updated successfully!', 'success');
    Auth.user.fullName = name;
    Auth.user.phone = phone;
    localStorage.setItem('bhoomi_user', JSON.stringify(Auth.user));
    document.getElementById('sidebar-name').textContent = name;
    this.cancelEdit();
  },

  async changePassword() {
    const current = document.getElementById('cp-current').value;
    const newPass  = document.getElementById('cp-new').value;
    const confirm  = document.getElementById('cp-confirm').value;

    if (!current || !newPass || !confirm) {
      showToast('Please fill all password fields.', 'warning'); return;
    }
    if (newPass !== confirm) {
      showToast('New passwords do not match.', 'error'); return;
    }
    if (newPass.length < 8) {
      showToast('Password must be at least 8 characters.', 'warning'); return;
    }
    try {
      await api.put('/auth/change-password', { currentPassword: current, newPassword: newPass });
      showToast('Password changed successfully!', 'success');
      document.getElementById('cp-current').value = '';
      document.getElementById('cp-new').value = '';
      document.getElementById('cp-confirm').value = '';
    } catch (err) { showToast(err.message, 'error'); }
  }
};
