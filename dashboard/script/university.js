// ============================================================
//  Ennovyx University — Dashboard tab + Pricing
// ============================================================

// ── EU COURSES — Dashboard tab ────────────────────────────────
async function loadUniversityCourses() {
  const grid = document.getElementById('euCoursesGrid');
  if (!grid) return;
  try {
    const res = await fetch('/api/university/courses');
    const courses = await res.json();

    if (!courses.length) {
      grid.innerHTML = `
        <div class="eu-empty-state">
                  <div class="eu-empty-badge"><i class='bx bx-rocket'></i> Coming Soon</div>
                  <br>
      
          <h2 class="eu-empty-title">Ennovyx University</h2>
          <p class="eu-empty-sub">Courses launching soon.</p>
        </div>`;
      return;
    }

    grid.innerHTML = courses.map(c => renderCourseCard(c)).join('');
  } catch(e) {
    grid.innerHTML = `<div class="eu-empty-state"><p style="color:#9ca3af">Could not load courses.</p></div>`;
  }
}

function renderCourseCard(c) {
  const videos = c.videoUrls?.length ? c.videoUrls : (c.videoUrl ? [c.videoUrl] : []);
  const hasPdf = !!c.pdfUrl;
  const typeParts = [];
  if (videos.length === 1) typeParts.push("<i class='bx bx-video'></i> Video");
  if (videos.length > 1)  typeParts.push(`<i class='bx bx-list-ul'></i> ${videos.length} Videos`);
  if (hasPdf) typeParts.push("<i class='bx bx-file-pdf'></i> PDF");
  const typeLabel = typeParts.join(' &middot; ');
  const thumb = c.thumbnail
    ? `<img src="${c.thumbnail}" class="eu-card-thumb" alt="${c.title}">`
    : `<div class="eu-card-thumb-placeholder"><i class='bx bx-play-circle'></i></div>`;
  return `
    <div class="eu-course-card" onclick="openCourse('${c.id}')">
      ${thumb}
      <div class="eu-course-info">
        <div class="eu-course-category">${c.category}</div>
        <div class="eu-course-title">${c.title}</div>
        <div class="eu-course-desc">${c.description}</div>
        <div class="eu-course-meta">
          <span class="eu-course-type">${typeLabel}</span>
          <span class="eu-course-views"><i class='bx bx-show'></i> ${c.views || 0}</span>
        </div>
      </div>
    </div>`;
}

function openCourse(id) {
  fetch(`/api/university/courses/${id}/view`, { method: 'POST' }).catch(() => {});
  window.open(`/university?course=${id}`, '_blank');
}
// Alias for compatibility
window.openCourse = openCourse;

// Init when home tab loads
document.addEventListener('DOMContentLoaded', () => {
  // Load EU courses when that tab is clicked
  document.querySelectorAll('.nav button[data-target="university"]').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(loadUniversityCourses, 80));
  });
  // Also preload if already on university tab
  if (document.querySelector('.nav button[data-target="university"].active')) {
    loadUniversityCourses();
  }
});
// ── EU Dashboard Logo theme swap ─────────────────────────
function updateEuDashLogo() {
  const logo = document.getElementById('euDashLogo');
  if (!logo) return;
  const isDark = document.body.classList.contains('dark-theme') || !document.body.classList.contains('light-theme');
  logo.src = isDark
    ? '/dashboard/images/eu-logo-transparent.png'
    : '/dashboard/images/eu-logo-light-transparent.png';
}

// Watch for theme class changes
const _euLogoObserver = new MutationObserver(updateEuDashLogo);
_euLogoObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
document.addEventListener('DOMContentLoaded', updateEuDashLogo);
