/**
 * ==========================================================================
 * Pawly - Admin Paneli (admin.html)
 * Şikayətlərə baxmaq, elanı silmək, istifadəçini bloklamaq.
 * Qeyd: buradakı yoxlamalar yalnız görünüş üçündür. Əsl qorunma serverdədir:
 * admin olmayan kəs sorğu göndərsə, server 403 qaytarır.
 * ==========================================================================
 */

let adminStatusFilter = 'open';

const REASON_LABELS = {
    Fake: 'Saxta elan',
    Inappropriate: 'Uyğunsuz məzmun',
    Spam: 'Spam / reklam',
    AlreadyResolved: 'Heyvan artıq tapılıb',
    Other: 'Digər'
};

document.addEventListener('DOMContentLoaded', () => {
    const user = Auth.isLoggedIn() ? Auth.getUser() : null;

    if (!user) {
        window.location.href = 'login.html?next=admin.html';
        return;
    }
    if (user.role !== 'Admin') {
        window.location.href = 'index.html';
        return;
    }

    // "Yeni / Hamısı" filtri
    document.querySelectorAll('.filter-pill[data-status]').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.filter-pill[data-status]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            adminStatusFilter = pill.dataset.status;
            loadReports();
        });
    });

    document.querySelector('#admin-reports-container').addEventListener('click', onAdminActionClick);

    loadReports();
});

async function loadReports() {
    const container = document.querySelector('#admin-reports-container');
    const empty = document.querySelector('#admin-empty-state');
    const countEl = document.querySelector('#admin-total-count');

    container.innerHTML = '<div class="skeleton-card" style="height:180px;"></div>';
    empty.style.display = 'none';

    try {
        const reports = await API.adminGetReports(adminStatusFilter);
        countEl.textContent = reports.length;

        if (reports.length === 0) {
            container.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        container.innerHTML = reports.map(createReportCardHtml).join('');
    } catch (err) {
        console.error('Şikayətlər gətirilərkən xəta:', err);
        container.innerHTML = `<div style="text-align:center;padding:40px;">${window.escapeHtml(err.message)}</div>`;
    }
}

function createReportCardHtml(r) {
    const esc = window.escapeHtml;
    const listing = r.listing;
    const owner = listing.owner;
    const isOpen = r.status === 'Open';

    const title = listing.title || 'Başlıqsız elan';
    const desc = (listing.description || '').length > 160
        ? listing.description.slice(0, 160) + '…'
        : (listing.description || 'Təsvir yoxdur.');

    const statusBadge = isOpen
        ? '<span class="badge" style="background:var(--danger-light);color:var(--danger);box-shadow:none;">Yeni</span>'
        : '<span class="badge" style="background:var(--success-light);color:#0B8A63;box-shadow:none;">Baxılıb</span>';

    const ownerHtml = owner
        ? `${esc(owner.fullName)} <span style="color:var(--text-light);">(${esc(owner.email)})</span>
       ${owner.isBlocked ? '<span class="badge" style="background:var(--danger);color:#fff;margin-left:6px;">Bloklanıb</span>' : ''}`
        : '<span style="color:var(--text-light);">Sahibi yoxdur</span>';

    const blockBtn = owner
        ? (owner.isBlocked
            ? `<button type="button" class="btn btn-outline btn-sm" data-action="unblock" data-user-id="${esc(owner.id)}">
             <i class="fa-solid fa-unlock"></i> Blokdan çıxar
           </button>`
            : `<button type="button" class="btn btn-danger-outline btn-sm" data-action="block" data-user-id="${esc(owner.id)}">
             <i class="fa-solid fa-ban"></i> Sahibini blokla
           </button>`)
        : '';

    const reviewBtn = isOpen
        ? `<button type="button" class="btn btn-success-outline btn-sm" data-action="review" data-report-id="${esc(r.id)}">
         <i class="fa-solid fa-check"></i> Baxıldı
       </button>`
        : '';

    return `
    <article style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow-sm);">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span class="badge" style="background:var(--primary-light);color:var(--primary);box-shadow:none;">
            <i class="fa-solid fa-flag"></i> ${esc(REASON_LABELS[r.reason] || r.reason)}
          </span>
          ${statusBadge}
          ${r.reportCount > 1 ? `<span style="font-size:0.85rem;color:var(--danger);font-weight:700;">Bu elana ${esc(r.reportCount)} şikayət</span>` : ''}
        </div>
        <span style="font-size:0.85rem;color:var(--text-light);">
          <i class="fa-regular fa-clock"></i> ${esc(window.formatRelativeTime(r.createdAt))}
        </span>
      </div>

      <h3 style="font-size:1.15rem;margin-bottom:6px;">
        <a href="listing-detail.html?id=${encodeURIComponent(listing.id)}" target="_blank" rel="noopener">${esc(title)}</a>
        <span style="font-size:0.85rem;color:var(--text-light);font-weight:500;">#${esc(listing.id)}</span>
      </h3>
      <p style="color:var(--text-muted);font-size:0.92rem;margin-bottom:14px;">${esc(desc)}</p>

      ${r.comment ? `
        <div style="background:var(--bg-subtle);border-radius:var(--radius-sm);padding:10px 14px;font-size:0.9rem;margin-bottom:14px;">
          <strong>Şikayətçinin qeydi:</strong> ${esc(r.comment)}
        </div>` : ''}

      <div style="display:grid;gap:6px;font-size:0.9rem;margin-bottom:18px;">
        <div><strong>Şikayət edən:</strong> ${esc(r.reporter.fullName)} <span style="color:var(--text-light);">(${esc(r.reporter.email)})</span></div>
        <div><strong>Elanın sahibi:</strong> ${ownerHtml}</div>
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border-color);">
        <a href="listing-detail.html?id=${encodeURIComponent(listing.id)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
          <i class="fa-solid fa-eye"></i> Elana bax
        </a>
        ${reviewBtn}
        <button type="button" class="btn btn-danger-outline btn-sm" data-action="delete" data-listing-id="${esc(listing.id)}">
          <i class="fa-solid fa-trash"></i> Elanı sil
        </button>
        ${blockBtn}
      </div>
    </article>
  `;
}

async function onAdminActionClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;

    const confirmTexts = {
        delete: 'Bu elanı silmək istəyirsiniz? Elan, şəkilləri və ona gələn bütün şikayətlər silinəcək. Bunu geri qaytarmaq olmur.',
        block: 'Bu istifadəçini bloklamaq istəyirsiniz? O, hesabından dərhal çıxarılacaq, daxil ola bilməyəcək və elanları siyahıda görünməyəcək.',
        unblock: 'Bu istifadəçinin blokunu götürmək istəyirsiniz?'
    };
    if (confirmTexts[action] && !confirm(confirmTexts[action])) return;

    btn.disabled = true;
    try {
        if (action === 'review') {
            await API.adminReviewReport(btn.dataset.reportId);
            window.showToast('Şikayət "baxıldı" kimi işarələndi', 'success');
        } else if (action === 'delete') {
            await API.adminDeleteListing(btn.dataset.listingId);
            window.showToast('Elan silindi', 'success');
        } else if (action === 'block') {
            await API.adminBlockUser(btn.dataset.userId);
            window.showToast('İstifadəçi bloklandı', 'success');
        } else if (action === 'unblock') {
            await API.adminUnblockUser(btn.dataset.userId);
            window.showToast('Blok götürüldü', 'success');
        }
        loadReports();
    } catch (err) {
        window.showToast(window.escapeHtml(err.message), 'error');
        btn.disabled = false;
    }
}