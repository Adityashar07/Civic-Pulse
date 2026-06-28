/**
 * CivicPulse - Application Javascript
 * Handles State, Leaflet Map, Charts, Personas, Comments, and AI Integration.
 */

// Application State
const state = {
  issues: [],
  users: [],
  currentUser: null,
  activeTab: 'tab-map',
  map: null,
  markers: [],
  hotspotLayer: null,
  categoryChart: null,
  trendChart: null,
  aiDebounceTimer: null
};

// Category Metadata
const categoryMeta = {
  pothole: { label: 'Pothole', color: 'hsl(38, 92%, 50%)', icon: 'cone' },
  water_leak: { label: 'Water Leak', color: 'hsl(199, 89%, 48%)', icon: 'droplet' },
  streetlight: { label: 'Streetlight', color: 'hsl(45, 100%, 60%)', icon: 'lightbulb' },
  waste_management: { label: 'Waste Management', color: 'hsl(142, 70%, 45%)', icon: 'trash-2' },
  infrastructure: { label: 'Infrastructure', color: 'hsl(263, 90%, 68%)', icon: 'milestone' },
  other: { label: 'Other', color: 'hsl(215, 20%, 65%)', icon: 'help-circle' }
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initial Icon Load
  lucide.createIcons();

  // 2. Setup Persona selector
  await fetchUsersAndSetPersona();

  // 3. Initialize Interactive Leaflet Map
  initMap();

  // 4. Set active navigation tabs
  setupTabs();

  // 5. Initial Data Load
  await refreshData();

  // 6. Set up Event Listeners
  setupEventListeners();
});

// Setup Leaflet Map
function initMap() {
  // Centered in New Delhi by default
  state.map = L.map('map').setView([28.6139, 77.2090], 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(state.map);

  state.hotspotLayer = L.layerGroup().addTo(state.map);

  // Set Lat/Lng in report form when user clicks map
  state.map.on('click', (e) => {
    document.getElementById('input-latitude').value = e.latlng.lat.toFixed(6);
    document.getElementById('input-longitude').value = e.latlng.lng.toFixed(6);
    
    // Automatically trigger address mockup
    mockAddressLookup(e.latlng.lat, e.latlng.lng);
    
    // Check duplicates if enough text is entered
    runAiCopilotAnalysis();
    
    showToast('Location pinned on map!', 'info');
  });
}

// Mock Address Lookup using coordinates
function mockAddressLookup(lat, lng) {
  const categories = ['Main Road', 'Sector Road', 'Service Lane', 'Market Circle', 'Park Avenue'];
  const sectors = ['Sector 1', 'Sector 2', 'Sector 3', 'Sector 4', 'Sector 5', 'Connaught Place'];
  
  const randomRoad = categories[Math.floor(Math.random() * categories.length)];
  const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
  
  document.getElementById('input-address').value = `${randomRoad}, near landmark, ${randomSector}, New Delhi`;
}

// Fetch Users and Setup Active Persona
async function fetchUsersAndSetPersona() {
  try {
    const res = await fetch('/api/users/leaderboard');
    state.users = await res.json();

    // Default to Aria Green (id: 1)
    const select = document.getElementById('role-select');
    const selectedUserId = parseInt(select.value);
    
    const user = state.users.find(u => u.id === selectedUserId) || state.users[0];
    setCurrentUser(user);
  } catch (error) {
    console.error('Failed to load personas:', error);
  }
}

// Set Active User profile inside UI
function setCurrentUser(user) {
  state.currentUser = user;
  
  // Update Profile Card
  document.getElementById('current-user-name').innerText = user.username;
  document.getElementById('current-user-role').innerText = user.role;
  document.getElementById('current-user-rep').innerText = user.reputation_points;
  
  // Set initial initials for avatar
  const initials = user.username.split('_').map(n => n[0]).join('').substring(0,2).toUpperCase();
  const avatar = document.getElementById('current-user-avatar');
  avatar.innerText = initials;
  
  // Set reputation progress bar (up to 500)
  const percent = Math.min(100, Math.round((user.reputation_points / 500) * 100));
  document.getElementById('current-user-progress').style.width = `${percent}%`;

  // Render Badges
  const badgesContainer = document.getElementById('current-user-badges');
  badgesContainer.innerHTML = '';
  const badges = JSON.parse(user.badges || '[]');
  
  if (badges.length === 0) {
    badgesContainer.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">No badges yet.</span>';
  } else {
    badges.forEach(badge => {
      const isGold = badge === 'Community Hero';
      badgesContainer.innerHTML += `
        <span class="badge-tag ${isGold ? 'gold' : ''}">
          <i data-lucide="${isGold ? 'sparkles' : 'award'}" style="width:12px; height:12px;"></i>
          ${badge}
        </span>
      `;
    });
    lucide.createIcons();
  }

  // If issue details is open, re-render to reflect new official actions
  const detailsModal = document.getElementById('modal-details');
  if (detailsModal.classList.contains('active')) {
    // If active issue ID is available, reload details
    const activeIssueId = detailsModal.getAttribute('data-issue-id');
    if (activeIssueId) showIssueDetails(parseInt(activeIssueId));
  }
}

// Setup navigation tab actions
function setupTabs() {
  document.querySelectorAll('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      // Remove active from all tabs
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      
      // Activate clicked tab
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      state.activeTab = tabId;

      // Handle map resizing bug when hidden initially
      if (tabId === 'tab-map' && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
      }
    });
  });
}

// Setup Event Listeners
function setupEventListeners() {
  // Persona change dropdown
  document.getElementById('role-select').addEventListener('change', async (e) => {
    const selectedUserId = parseInt(e.target.value);
    const user = state.users.find(u => u.id === selectedUserId);
    if (user) {
      setCurrentUser(user);
      showToast(`Switched view to ${user.username} (${user.role})`, 'success');
    }
  });

  // Dark/Light Theme toggler
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    
    if (newTheme === 'light') {
      sunIcon.style.display = 'none';
      moonIcon.style.display = 'block';
    } else {
      sunIcon.style.display = 'block';
      moonIcon.style.display = 'none';
    }
    
    // Refresh theme on Leaflet (re-apply dark styling overlay)
    showToast(`Switched to ${newTheme} mode!`, 'info');
  });

  // Open/Close Report modal
  document.getElementById('btn-open-report').addEventListener('click', () => {
    // Attempt to autofill current location if possible, else default to central park
    document.getElementById('input-latitude').value = '28.6139';
    document.getElementById('input-longitude').value = '77.2090';
    mockAddressLookup(28.6139, 77.2090);
    
    openModal('modal-report');
  });

  document.getElementById('btn-close-report').addEventListener('click', () => closeModal('modal-report'));
  document.getElementById('btn-cancel-report').addEventListener('click', () => closeModal('modal-report'));
  document.getElementById('btn-close-details').addEventListener('click', () => {
    closeModal('modal-details');
    document.getElementById('modal-details').removeAttribute('data-issue-id');
  });

  // AI assistant preview trigger as user types
  document.getElementById('input-title').addEventListener('input', debounceAiCopilot);
  document.getElementById('input-description').addEventListener('input', debounceAiCopilot);
  document.getElementById('input-latitude').addEventListener('input', debounceAiCopilot);
  document.getElementById('input-longitude').addEventListener('input', debounceAiCopilot);

  // Submit report form
  document.getElementById('report-form').addEventListener('submit', handleReportSubmit);

  // Filter lists in feed
  document.getElementById('feed-category-filter').addEventListener('change', refreshFeedList);
  document.getElementById('feed-status-filter').addEventListener('change', refreshFeedList);

  // Map Filter (Toggle AI Hotspots)
  document.querySelectorAll('.filter-map').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-map').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const filterMode = btn.getAttribute('data-map-filter');
      if (filterMode === 'hotspots') {
        renderMapHotspots(true);
      } else {
        renderMapHotspots(false);
      }
    });
  });
}

// Debounce helper for AI Copilot inputs
function debounceAiCopilot() {
  clearTimeout(state.aiDebounceTimer);
  state.aiDebounceTimer = setTimeout(runAiCopilotAnalysis, 500);
}

// AI Copilot analysis (Categorization & Duplicate Warning)
async function runAiCopilotAnalysis() {
  const title = document.getElementById('input-title').value.trim();
  const description = document.getElementById('input-description').value.trim();
  const latitude = parseFloat(document.getElementById('input-latitude').value);
  const longitude = parseFloat(document.getElementById('input-longitude').value);

  const aiBox = document.getElementById('ai-assist-box');
  const catEl = document.getElementById('ai-preview-category');
  const sevEl = document.getElementById('ai-preview-severity');
  const dupEl = document.getElementById('ai-preview-duplicate');

  if (title.length < 5 && description.length < 5) {
    catEl.innerText = 'Drafting...';
    sevEl.innerText = 'Drafting...';
    dupEl.style.display = 'none';
    return;
  }

  // 1. Fetch AI Categorization
  try {
    const res = await fetch('/api/issues/analyze-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    
    if (res.ok) {
      const data = await res.json();
      catEl.innerText = categoryMeta[data.category] ? categoryMeta[data.category].label : 'Other';
      sevEl.innerText = data.severity.toUpperCase();
      
      // Update styling based on severity
      sevEl.className = 'value';
      if (data.severity === 'high') {
        sevEl.style.color = 'var(--danger)';
      } else if (data.severity === 'medium') {
        sevEl.style.color = 'var(--warning)';
      } else {
        sevEl.style.color = 'var(--success)';
      }
    }

    // 2. Fetch duplicate check (if coordinates are valid)
    if (!isNaN(latitude) && !isNaN(longitude)) {
      const dupRes = await fetch('/api/issues/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, latitude, longitude })
      });
      
      if (dupRes.ok) {
        const dupData = await dupRes.json();
        if (dupData.isDuplicate) {
          dupEl.style.display = 'flex';
          dupEl.querySelector('span').innerHTML = `
            Warning: Similar issue found ${dupData.distance}m away! 
            <a href="#" onclick="viewDuplicate(${dupData.duplicateOf}); return false;">View duplicate issue #${dupData.duplicateOf}</a>
          `;
          
          // Log inside AI engine card
          logAiEngineActivity(`[Duplicate Alert] Match found for draft: "${title.substring(0, 20)}..." similarity score ${dupData.similarity * 100}%`);
        } else {
          dupEl.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('AI assistant failed:', error);
  }
}

// Shortcut to view the conflicting duplicate from form
function viewDuplicate(id) {
  closeModal('modal-report');
  showIssueDetails(id);
}

// Log message in AI Activity engine panel
function logAiEngineActivity(message) {
  const logs = document.getElementById('ai-logs');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  logs.insertAdjacentHTML('afterbegin', `
    <div class="log-item" style="animation: fadeIn 0.3s ease;">
      <span class="time">${time}</span>
      <p>${message}</p>
    </div>
  `);
  
  // Keep logs list trimmed
  if (logs.children.length > 6) {
    logs.removeChild(logs.lastChild);
  }
}

// Modal open/close helpers
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Submit issue reporting
async function handleReportSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('input-title').value.trim();
  const description = document.getElementById('input-description').value.trim();
  const latitude = parseFloat(document.getElementById('input-latitude').value);
  const longitude = parseFloat(document.getElementById('input-longitude').value);
  const address = document.getElementById('input-address').value.trim();
  const image_url = document.getElementById('input-image').value.trim();

  if (!title || !description || isNaN(latitude) || isNaN(longitude)) {
    showToast('Please complete all required fields.', 'danger');
    return;
  }

  try {
    const response = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        latitude,
        longitude,
        address,
        image_url,
        reporter_id: state.currentUser ? state.currentUser.id : 1
      })
    });

    if (response.ok) {
      const data = await response.json();
      closeModal('modal-report');
      document.getElementById('report-form').reset();
      
      // Update notifications
      logAiEngineActivity(`[Issue Created] ${data.issue.title.substring(0, 25)}... assigned category: ${data.issue.category}`);
      
      if (data.duplicateCheck.isDuplicate) {
        showToast('Issue flagged as a duplicate. Moderators will review.', 'warning');
      } else {
        showToast('Issue reported! Earned +15 Reputation!', 'success');
      }
      
      // Refresh database records
      await fetchUsersAndSetPersona();
      await refreshData();
    } else {
      const err = await response.json();
      showToast(`Error: ${err.error}`, 'danger');
    }
  } catch (error) {
    showToast('Failed to connect to backend api.', 'danger');
    console.error(error);
  }
}

// Refresh whole app data
async function refreshData() {
  await fetchIssues();
  await refreshFeedList();
  await renderAnalytics();
  await renderLeaderboard();
}

// Fetch all issues and draw markers
async function fetchIssues() {
  try {
    const res = await fetch('/api/issues');
    state.issues = await res.json();
    
    // Refresh markers on Map
    clearMarkers();
    
    state.issues.forEach(issue => {
      const color = categoryMeta[issue.category] ? categoryMeta[issue.category].color : '#999';
      const iconName = categoryMeta[issue.category] ? categoryMeta[issue.category].icon : 'help-circle';
      const isResolved = issue.status === 'resolved';

      // Create Custom HTML Leaflet Icon
      const markerHtml = `
        <div style="
          background: ${isResolved ? 'hsl(142, 70%, 40%)' : color};
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          opacity: ${issue.status === 'duplicate' ? 0.5 : 1};
          transform: scale(${issue.severity === 'high' && !isResolved ? 1.15 : 1});
        ">
          <i data-lucide="${iconName}" style="width: 15px; height: 15px;"></i>
        </div>
      `;

      const divIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-map-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([issue.latitude, issue.longitude], { icon: divIcon })
        .addTo(state.map)
        .bindPopup(`
          <div style="font-family: var(--font-sans); padding: 5px;">
            <h4 style="margin-bottom:4px; font-weight:600;">${issue.title}</h4>
            <span class="pill ${issue.status}" style="font-size:0.6rem; padding: 2px 6px;">${issue.status.replace('_', ' ')}</span>
            <p style="margin-top:6px; font-size:0.75rem; color:#666;">${issue.address}</p>
            <button onclick="window.showIssueDetails(${issue.id})" style="
              margin-top: 8px; width: 100%; padding: 4px; font-size:0.7rem; border-radius:4px; 
              background:#8b5cf6; border:none; color:white; font-weight:600; cursor:pointer;">
              View Details
            </button>
          </div>
        `);
      
      state.markers.push(marker);
    });

    // Make Lucide replace tags inside custom map icons
    lucide.createIcons();

  } catch (error) {
    showToast('Failed to fetch issues from database.', 'danger');
    console.error(error);
  }
}

// Clear Leaflet markers
function clearMarkers() {
  state.markers.forEach(m => state.map.removeLayer(m));
  state.markers = [];
}

// Filter and render feed list column
function refreshFeedList() {
  const catFilter = document.getElementById('feed-category-filter').value;
  const statusFilter = document.getElementById('feed-status-filter').value;
  const listContainer = document.getElementById('issues-feed-list');
  
  listContainer.innerHTML = '';

  const filteredIssues = state.issues.filter(issue => {
    const matchesCat = !catFilter || issue.category === catFilter;
    const matchesStatus = !statusFilter || issue.status === statusFilter;
    return matchesCat && matchesStatus;
  });

  if (filteredIssues.length === 0) {
    listContainer.innerHTML = '<div class="loader">No reports found matching filters.</div>';
    return;
  }

  filteredIssues.forEach(issue => {
    const isUpvoted = false; // Mocking upvoted state
    const createdStr = new Date(issue.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
    
    listContainer.insertAdjacentHTML('beforeend', `
      <div class="issue-card" onclick="showIssueDetails(${issue.id})" style="animation: fadeIn 0.3s ease;">
        <div class="issue-card-header">
          <h4>${issue.title}</h4>
          <span class="pill ${issue.status}">${issue.status.replace('_', ' ')}</span>
        </div>
        <p class="description">${issue.description}</p>
        <div class="issue-card-footer">
          <div class="issue-meta">
            <span><i data-lucide="tag"></i> ${categoryMeta[issue.category] ? categoryMeta[issue.category].label : 'Other'}</span>
            <span><i data-lucide="clock"></i> ${createdStr}</span>
          </div>
          <button class="upvote-button" onclick="event.stopPropagation(); handleUpvote(${issue.id})">
            <i data-lucide="thumbs-up" style="width:13px; height:13px;"></i>
            <span>${issue.upvotes}</span>
          </button>
        </div>
      </div>
    `);
  });

  lucide.createIcons();
}

// Handle Upvote action
async function handleUpvote(id) {
  try {
    const response = await fetch(`/api/issues/${id}/upvote`, { method: 'POST' });
    if (response.ok) {
      showToast('Issue upvoted! Reporter awarded +5 reputation.', 'success');
      
      // Update logs
      const updatedIssue = await response.json();
      logAiEngineActivity(`[Community Upvote] Issue #${id} upvoted. Total upvotes: ${updatedIssue.upvotes}`);
      
      await fetchUsersAndSetPersona();
      await refreshData();
    }
  } catch (error) {
    console.error(error);
  }
}

// Render Hotspot Heatmap circles on Leaflet
function renderMapHotspots(show) {
  state.hotspotLayer.clearLayers();
  
  if (!show) {
    logAiEngineActivity('[Map Filter] AI Hotspots hidden.');
    return;
  }
  
  logAiEngineActivity('[Map Filter] Rendered AI Hotspots overlay.');

  // Fetch hotspots from current analytics
  fetch('/api/analytics')
    .then(res => res.json())
    .then(data => {
      data.hotspots.forEach(hotspot => {
        // Red circle with pulsing border effects
        const circle = L.circle([hotspot.latitude, hotspot.longitude], {
          color: hotspot.severity === 'high' ? 'var(--danger)' : 'var(--warning)',
          fillColor: hotspot.severity === 'high' ? 'var(--danger)' : 'var(--warning)',
          fillOpacity: 0.35,
          radius: 120 // meters radius
        }).addTo(state.hotspotLayer);

        circle.bindPopup(`
          <div style="font-family: var(--font-sans); padding: 5px;">
            <h4 style="color:var(--danger); font-weight:700;">🚨 AI Hotspot Cluster</h4>
            <p style="font-size:0.75rem; margin-top:4px;"><b>${hotspot.issuesCount} active issues</b> located within close proximity.</p>
            <p style="font-size:0.7rem; color:#666;">Priority: <b>${hotspot.severity.toUpperCase()}</b></p>
          </div>
        `);
      });
      
      // Zoom map to show all hotspots if available
      if (data.hotspots.length > 0) {
        const group = L.featureGroup(state.hotspotLayer.getLayers());
        state.map.fitBounds(group.getBounds().pad(0.2));
      }
    });
}

// Show Issue Details Modal
async function showIssueDetails(id) {
  try {
    // Save active issue ID in modal
    document.getElementById('modal-details').setAttribute('data-issue-id', id);

    const issueRes = await fetch('/api/issues');
    const all = await issueRes.json();
    const issue = all.find(i => i.id === id);

    if (!issue) {
      showToast('Error: issue details not found.', 'danger');
      return;
    }

    const commentsRes = await fetch(`/api/issues/${id}/comments`);
    const comments = await commentsRes.json();

    const isOfficial = state.currentUser && state.currentUser.role === 'official';
    const isModerator = state.currentUser && state.currentUser.role === 'moderator';
    const canChangeStatus = isOfficial || isModerator;

    const detailsBody = document.getElementById('details-body');
    const createdStr = new Date(issue.created_at).toLocaleString();

    detailsBody.innerHTML = `
      <div class="details-grid">
        <!-- Image panel -->
        <div class="details-image-container">
          <img src="${issue.image_url || 'https://images.unsplash.com/photo-1515162305285-0293e4767cc2?q=80&w=600&auto=format&fit=crop'}" alt="Report Photo">
        </div>
        
        <!-- Info Panel -->
        <div class="details-info">
          <h3 style="font-size: 1.1rem; font-weight: 700;">${issue.title}</h3>
          
          <div class="details-meta-row">
            <span class="pill ${issue.status}">${issue.status.replace('_', ' ')}</span>
            <span class="pill" style="background-color: var(--surface-highlight); color: var(--text); border: 1px solid var(--surface-border)">
              Severity: ${issue.severity.toUpperCase()}
            </span>
          </div>

          <p class="description">${issue.description}</p>
          
          <p style="font-size: 0.8rem; color: var(--text-muted);">
            <i data-lucide="map-pin" style="width:13px; height:13px; display:inline-block; vertical-align:middle;"></i> 
            Address: <b>${issue.address}</b>
          </p>
          <p style="font-size: 0.75rem; color: var(--text-muted);">
            Reported by: <b>${issue.reporter_name || 'Anonymous'}</b> on ${createdStr}
          </p>

          <!-- Upvote Row -->
          <div style="margin-top: 10px; display:flex; gap:12px; align-items:center;">
            <button class="upvote-button" onclick="handleUpvote(${issue.id})">
              <i data-lucide="thumbs-up" style="width:14px; height:14px;"></i>
              <span>${issue.upvotes} Upvotes</span>
            </button>
          </div>
        </div>

        <!-- Official Control Panel -->
        ${canChangeStatus ? `
          <div class="official-controls" style="grid-column: span 2;">
            <h4><i data-lucide="shield-check" style="width:14px; height:14px; display:inline-block; vertical-align:-2px;"></i> Official Resolution Center</h4>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom: 8px;">As a ${state.currentUser.role}, you can update status and authorize repairs.</p>
            <div class="official-controls-row">
              <button class="btn btn-secondary btn-sm" onclick="updateIssueStatus(${issue.id}, 'verified')">Verify Report</button>
              <button class="btn btn-primary btn-sm" onclick="updateIssueStatus(${issue.id}, 'in_progress')">Set In Progress</button>
              <button class="btn btn-sm" style="background-color:var(--success); color:white;" onclick="updateIssueStatus(${issue.id}, 'resolved')">Mark Resolved</button>
            </div>
          </div>
        ` : ''}

        <!-- Comments footer section -->
        <div class="details-footer">
          <div class="comments-section">
            <h3>Community Discussions (${comments.length})</h3>
            
            <div class="comments-list" id="comments-list-box">
              ${comments.length === 0 ? '<p style="font-size:0.8rem; color:var(--text-muted); padding: 8px 0;">No comments yet. Start the conversation!</p>' : ''}
              ${comments.map(c => {
                const commentDate = new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `
                  <div class="comment-item">
                    <div class="comment-item-header">
                      <span class="commenter-name">${c.username} <span style="font-size:0.6rem; opacity:0.7;">(${c.role})</span></span>
                      <span class="comment-time">${commentDate}</span>
                    </div>
                    <p class="comment-item-body">${c.content}</p>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Add Comment Form -->
            <form class="comment-form" onsubmit="event.preventDefault(); handleCommentSubmit(${issue.id})">
              <input type="text" id="comment-input-field" placeholder="Share local update or offer help..." required>
              <button type="submit" class="btn btn-secondary btn-sm"><i data-lucide="send"></i> Post</button>
            </form>
          </div>
        </div>
      </div>
    `;

    openModal('modal-details');
    lucide.createIcons();

    // Scroll to bottom of comments list
    const box = document.getElementById('comments-list-box');
    box.scrollTop = box.scrollHeight;

  } catch (error) {
    console.error(error);
  }
}

// Update Issue Status (Official Action)
async function updateIssueStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/issues/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      showToast(`Status updated to ${newStatus.replace('_', ' ')}!`, 'success');
      
      const issue = await res.json();
      logAiEngineActivity(`[Official Action] Issue #${id} status changed to "${newStatus}" by official ${state.currentUser.username}`);
      
      if (newStatus === 'resolved') {
        showToast('Reporter awarded +50 points for resolved issue!', 'success');
      }

      await fetchUsersAndSetPersona();
      await refreshData();
      
      // Close details and reopen to refresh actions
      closeModal('modal-details');
      setTimeout(() => showIssueDetails(id), 200);
    }
  } catch (error) {
    console.error(error);
  }
}

// Submit a new comment
async function handleCommentSubmit(issueId) {
  const input = document.getElementById('comment-input-field');
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        user_id: state.currentUser ? state.currentUser.id : 1
      })
    });

    if (res.ok) {
      input.value = '';
      showToast('Comment posted! +2 reputation.', 'success');
      
      logAiEngineActivity(`[Citizen discussion] ${state.currentUser.username} commented on issue #${issueId}`);
      
      await fetchUsersAndSetPersona();
      await refreshData();
      
      // Reload details modal to show new comment
      showIssueDetails(issueId);
    }
  } catch (error) {
    console.error(error);
  }
}

// Render Analytics Dashboard (ChartJS integration)
async function renderAnalytics() {
  try {
    const res = await fetch('/api/analytics');
    const data = await res.json();

    // 1. Fill quick indicators
    document.getElementById('stat-total').innerText = data.totalIssues;
    document.getElementById('stat-resolved').innerText = data.statusBreakdown.resolved;
    document.getElementById('stat-hotspots').innerText = data.hotspots.length;
    document.getElementById('stat-resolution-time').innerText = data.avgResolutionDays || 'N/A';

    // 2. Render Doughnut Chart for Categories
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    
    // Destroy previous instance to prevent visual glitching
    if (state.categoryChart) state.categoryChart.destroy();
    
    const categories = Object.keys(data.categoryBreakdown);
    const catLabels = categories.map(cat => categoryMeta[cat] ? categoryMeta[cat].label : cat);
    const catColors = categories.map(cat => categoryMeta[cat] ? categoryMeta[cat].color : '#999');
    const catValues = categories.map(cat => data.categoryBreakdown[cat]);

    state.categoryChart = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catValues,
          backgroundColor: catColors,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: 'var(--text)', font: { family: 'Outfit' } }
          }
        }
      }
    });

    // 3. Render Trend & Forecasting Chart
    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    if (state.trendChart) state.trendChart.destroy();

    const historicalWeeks = data.forecast.historical.map(h => h.week);
    const historicalCounts = data.forecast.historical.map(h => h.count);
    
    // Predicted addition
    const predictionWeeks = (data.forecast.predictions || []).map(p => p.week);
    const predictionCounts = (data.forecast.predictions || []).map(p => p.count);

    const labelsCombined = [...historicalWeeks, ...predictionWeeks];
    // Pad historical with nulls for prediction line, and vice-versa
    const histData = [...historicalCounts, ...Array(predictionCounts.length).fill(null)];
    
    // Connect historical end to prediction start
    const predData = [
      ...Array(historicalCounts.length - 1).fill(null), 
      historicalCounts[historicalCounts.length - 1], 
      ...predictionCounts
    ];

    state.trendChart = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: labelsCombined,
        datasets: [
          {
            label: 'Historical Weekly Issues',
            data: histData,
            borderColor: 'hsl(263, 90%, 68%)',
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'AI Trend Prediction',
            data: predData,
            borderColor: 'hsl(315, 90%, 60%)',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: 'var(--text)', font: { family: 'Outfit' } }
          }
        },
        scales: {
          x: { ticks: { color: 'var(--text-muted)' }, grid: { color: 'var(--surface-border)' } },
          y: { ticks: { color: 'var(--text-muted)', stepSize: 1 }, grid: { color: 'var(--surface-border)' } }
        }
      }
    });

    // 4. Render Hotspot Breakdown list
    const hotspotContainer = document.getElementById('hotspots-list-container');
    hotspotContainer.innerHTML = '';
    
    if (data.hotspots.length === 0) {
      hotspotContainer.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted);">No hotspots detected. Excellent job, community!</p>';
    } else {
      data.hotspots.forEach(hotspot => {
        const breakStrings = Object.entries(hotspot.categoryBreakdown).map(
          ([cat, count]) => `${categoryMeta[cat] ? categoryMeta[cat].label : cat}: ${count}`
        ).join(', ');

        hotspotContainer.innerHTML += `
          <div class="hotspot-item ${hotspot.severity}" style="animation: fadeIn 0.3s ease;">
            <div class="hotspot-item-header">
              <span style="display:flex; align-items:center; gap:6px;">
                <i data-lucide="flame" style="width:16px; height:16px; color:var(--danger)"></i>
                Cluster at ${hotspot.latitude.toFixed(4)}, ${hotspot.longitude.toFixed(4)}
              </span>
              <span class="danger-pill">${hotspot.issuesCount} Issues</span>
            </div>
            <div class="hotspot-item-body">
              <p>Breakdown: <b>${breakStrings}</b></p>
              <button class="btn btn-secondary btn-sm" style="margin-top:8px; padding: 2px 6px;" onclick="zoomToHotspot(${hotspot.latitude}, ${hotspot.longitude})">
                <i data-lucide="locate-fixed" style="width:12px; height:12px;"></i> View hotspot
              </button>
            </div>
          </div>
        `;
      });
      lucide.createIcons();
    }

  } catch (error) {
    console.error(error);
  }
}

// Hotspot locate shortcut
function zoomToHotspot(lat, lng) {
  // Switch to map tab
  document.querySelector('.nav-item[data-tab="tab-map"]').click();
  setTimeout(() => {
    state.map.setView([lat, lng], 16);
    renderMapHotspots(true);
    
    // Set map filter active state
    document.querySelectorAll('.filter-map').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-map[data-map-filter="hotspots"]').classList.add('active');
  }, 200);
}

// Render Leaderboard table
async function renderLeaderboard() {
  try {
    const res = await fetch('/api/users/leaderboard');
    const leaders = await res.json();

    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';

    leaders.forEach((user, idx) => {
      const rank = idx + 1;
      const badges = JSON.parse(user.badges || '[]');
      const badgesHtml = badges.map(b => `
        <span class="badge-tag ${b === 'Community Hero' ? 'gold' : ''}" style="font-size:0.65rem;">
          ${b}
        </span>
      `).join(' ');

      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="rank">${rank}</td>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:30px; height:30px; border-radius:50%; background:#8b5cf6; display:flex; align-items:center; justify-content:center; color:white; font-weight:700; font-size:0.75rem;">
                ${user.username[0].toUpperCase()}
              </div>
              <span style="font-weight:600;">${user.username}</span>
            </div>
          </td>
          <td><span class="badge-role">${user.role}</span></td>
          <td><div class="badges-row">${badgesHtml || 'None'}</div></td>
          <td style="font-weight:700; color:var(--primary);">${user.reputation_points} pts</td>
        </tr>
      `);
    });
  } catch (error) {
    console.error(error);
  }
}

// Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'info';
  if (type === 'success') icon = 'check-circle-2';
  if (type === 'warning') icon = 'alert-octagon';
  if (type === 'danger') icon = 'x-circle';

  toast.innerHTML = `
    <i data-lucide="${icon}" style="width:16px; height:16px;"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  // Remove toast after 4s
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease reverse';
    setTimeout(() => container.removeChild(toast), 300);
  }, 4000);
}

// Global scope attachment for HTML triggers
window.showIssueDetails = showIssueDetails;
window.updateIssueStatus = updateIssueStatus;
window.handleCommentSubmit = handleCommentSubmit;
window.zoomToHotspot = zoomToHotspot;
window.handleUpvote = handleUpvote;
window.viewDuplicate = viewDuplicate;
