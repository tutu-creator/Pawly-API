/**
 * ==========================================================================
 * Pawly - Mənim Elanlarım (my-listings.html)
 * İstifadəçi öz elanlarını görür, "Tapıldı" edir və ya silir.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // Giriş etməyibsə, login səhifəsinə göndər
    if (!Auth.isLoggedIn()) {
        window.location.href = 'login.html?next=my-listings.html';
        return;
    }

    // Düymələrə basılmasını bir yerdə izləyirik
    document.querySelector('#my-listings-container').addEventListener('click', onActionClick);

    loadMyListings();
});

async function loadMyListings() {
    const grid = document.querySelector('#my-listings-container');
    const empty = document.querySelector('#my-empty-state');
    const countEl = document.querySelector('#my-total-count');

    grid.innerHTML = Array(3).fill('<div class="skeleton-card"></div>').join('');
    empty.style.display = 'none';

    try {
        const listings = await API.fetchMyListings();
        countEl.textContent = listings.length;

        if (listings.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }

        grid.innerHTML = listings.map(createMyListingCardHtml).join('');
    } catch (err) {
        console.error('Elanlar gətirilərkən xəta:', err);
        grid.innerHTML = `<div style="text-align:center;padding:40px;grid-column:1/-1;">${window.escapeHtml(err.message)}</div>`;
    }
}

/**
 * "Tapıldı" və "Sil" düymələrinə basılanda
 */
async function onActionClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    if (action === 'resolve' &&
        !confirm('Heyvan tapılıb? Elan "Tapıldı" kimi işarələnəcək və ümumi siyahıdan çıxacaq.')) return;
    if (action === 'delete' &&
        !confirm('Bu elanı həmişəlik silmək istəyirsiniz? Bunu geri qaytarmaq olmur.')) return;

    btn.disabled = true;
    try {
        if (action === 'resolve') {
            await API.resolveListing(id);
            window.showToast('Elan "Tapıldı" kimi işarələndi', 'success');
        } else {
            await API.deleteListing(id);
            window.showToast('Elan silindi', 'success');
        }
        loadMyListings();
    } catch (err) {
        window.showToast(window.escapeHtml(err.message), 'error');
        btn.disabled = false;
    }
}

/**
 * Bir elan kartı (saytdakı kartla eyni görünüş + düymələr)
 */
function createMyListingCardHtml(item) {
    const esc = window.escapeHtml;
    const imgUrl = (item.imageUrls && item.imageUrls[0]) ? item.imageUrls[0] : 'images/hero-pets.jpg';
    const address = item.location && item.location.address ? item.location.address : 'Bakı';
    const isResolved = item.status === 'resolved';

    let title = item.title || 'Heyvan haqqında elan';
    if (item.type === 'lost' && item.petName) {
        title = `İtkin: ${item.petName} (${title})`;
    }

    const statusBadge = isResolved
        ? `<div class="my-card-status"><span class="badge badge-resolved"><i class="fa-solid fa-circle-check"></i> Tapıldı</span></div>`
        : '';

    const resolveBtn = isResolved
        ? ''
        : `<button type="button" class="btn btn-success-outline btn-sm" data-action="resolve" data-id="${esc(item.id)}">
         <i class="fa-solid fa-circle-check"></i> Tapıldı
       </button>`;

    return `
    <article class="listing-card ${isResolved ? 'is-resolved' : ''}" data-id="${esc(item.id)}">
      <div class="listing-card-media">
        <img src="${esc(imgUrl)}" alt="${esc(title)}" loading="lazy" data-fallback="images/hero-pets.jpg">
        <div class="card-badges-top">
          ${window.getTypeBadge(item.type)}
          ${window.getAnimalBadge(item.animalType)}
        </div>
      </div>
      <div class="listing-card-body">
        <div class="card-meta-row">
          <span><i class="fa-regular fa-clock"></i> ${esc(window.formatRelativeTime(item.createdAt))}</span>
          <span>#${esc(item.id)}</span>
        </div>
        ${statusBadge}
        <h3 class="listing-card-title" title="${esc(title)}">${esc(title)}</h3>
        <p class="listing-card-desc">${esc(item.description || 'Əlavə qeyd yoxdur.')}</p>
        <div class="listing-card-location">
          <i class="fa-solid fa-location-dot"></i>
          <span title="${esc(address)}">${esc(address)}</span>
        </div>
        <div class="my-card-footer">
          <a href="listing-detail.html?id=${encodeURIComponent(item.id)}" class="btn btn-outline btn-sm btn-block">
            <span>Ətraflı bax</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
          <div class="my-card-actions">
            ${resolveBtn}
            <button type="button" class="btn btn-danger-outline btn-sm" data-action="delete" data-id="${esc(item.id)}">
              <i class="fa-solid fa-trash"></i> Sil
            </button>
          </div>
        </div>
      </div>
    </article>
  `;
}




/**
 * "Hesabımı sil" bölməsi: səhifənin aşağısında göstərilir
 */
document.addEventListener('DOMContentLoaded', () => {
    if (!window.Auth || !Auth.isLoggedIn()) return;

    const main = document.querySelector('main');
    if (!main) return;
    const container = main.querySelector('.container') || main;

    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 48px; padding: 24px; border: 1px solid var(--border-color); border-radius: var(--radius-md);';
    section.innerHTML = `
    <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Hesabı sil</h3>
    <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 16px;">
      Hesabınız, bütün elanlarınız və şəkilləriniz birdəfəlik silinəcək. Bunu geri qaytarmaq mümkün deyil.
    </p>
    <button type="button" class="btn btn-outline btn-sm" id="btn-delete-account"
      style="color: var(--danger); border-color: var(--danger);">
      <i class="fa-solid fa-trash-can"></i> Hesabımı sil
    </button>
  `;
    container.appendChild(section);

    section.querySelector('#btn-delete-account').addEventListener('click', openDeleteAccountModal);
});

function openDeleteAccountModal() {
    let modalOverlay = document.querySelector('#delete-account-modal');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'delete-account-modal';
        modalOverlay.className = 'modal-overlay';
        document.body.appendChild(modalOverlay);
    }

    modalOverlay.innerHTML = `
    <div class="modal-card">
      <button type="button" class="modal-close-btn" data-close>&times;</button>
      <h3 style="font-size: 1.35rem; margin-bottom: 6px;">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i> Hesabı silmək
      </h3>
      <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 18px;">
        Hesabınız, bütün elanlarınız və şəkilləriniz <strong>birdəfəlik</strong> silinəcək.
        Davam etmək üçün parolunuzu yazın.
      </p>

      <input type="password" id="delete-account-password" class="form-control"
        autocomplete="current-password" placeholder="Parolunuz" style="width: 100%; margin-bottom: 18px;">

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button type="button" class="btn btn-outline" data-close>İmtina</button>
        <button type="button" class="btn btn-primary" id="btn-confirm-delete-account" disabled
          style="background: var(--danger); border-color: var(--danger);">
          <i class="fa-solid fa-trash-can"></i> Hesabı sil
        </button>
      </div>
    </div>
  `;

    const close = () => modalOverlay.classList.remove('active');
    modalOverlay.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));

    const passwordInput = modalOverlay.querySelector('#delete-account-password');
    const confirmBtn = modalOverlay.querySelector('#btn-confirm-delete-account');

    // Parol yazılmayınca düymə aktiv olmur
    passwordInput.addEventListener('input', () => {
        confirmBtn.disabled = passwordInput.value.length === 0;
    });

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        try {
            const result = await API.deleteAccount(passwordInput.value);
            close();
            window.showToast(window.escapeHtml(result.message || 'Hesabınız silindi.'), 'success');
            Auth.logout();
            setTimeout(() => { window.location.href = 'index.html'; }, 1800);
        } catch (err) {
            window.showToast(window.escapeHtml(err.message), 'error');
            confirmBtn.disabled = false;
        }
    });

    modalOverlay.classList.add('active');
    passwordInput.focus();
}