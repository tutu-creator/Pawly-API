/**
 * ==========================================================================
 * [SAYT ADI] - Əsas UI və Köməkçi Skriptlər (Vanilla JS)
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  initHeaderNavigation();
  initMobileMenu();
  initHeaderDropdown();
  setActiveNavLink();
  initAuthHeader();
  initEmailConfirmBanner();
});

/**
 * Header menyusu və skroll effekti
 */
function initHeaderNavigation() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
      header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.08)';
    } else {
      header.classList.remove('scrolled');
      header.style.boxShadow = 'none';
    }
  });
}

/**
 * Mobil menyu (Hamburger menu) açılıb-bağlanması
 */
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navMenu = document.querySelector('.nav-menu');

  if (!menuBtn || !navMenu) return;

  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navMenu.classList.toggle('active');
    const isOpen = navMenu.classList.contains('active');
    menuBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
  });

  // Kənara klikləyəndə bağlamaq
  document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !menuBtn.contains(e.target)) {
      navMenu.classList.remove('active');
      menuBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  });
}

/**
 * Header "Elan Yerləşdir" açılan menyusu (Dropdown)
 */
function initHeaderDropdown() {
  const toggleBtn = document.querySelector('.btn-post-dropdown-toggle');
  const menu = document.querySelector('.post-dropdown-menu');

  if (!toggleBtn || !menu) return;

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) {
      menu.classList.remove('show');
    }
  });
}

/**
 * Hazırkı səhifə linkinin aktiv edilməsi
 */
function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const page = currentPath.substring(currentPath.lastIndexOf('/') + 1) || 'index.html';

  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === page || (page === '' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}


/**
 * Qlobal Toast Bildiriş Sistemi
 * @param {string} message - Göstəriləcək mesaj
 * @param {'success'|'error'|'info'} type - Bildirişin növü
 * @param {number} duration - Ekranda qalma müddəti (ms)
 */
window.showToast = function(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconHtml = '<i class="fa-solid fa-circle-info" style="color:var(--secondary)"></i>';
  if (type === 'success') {
    iconHtml = '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>';
  } else if (type === 'error') {
    iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color:var(--danger)"></i>';
  }

  toast.innerHTML = `
    ${iconHtml}
    <div style="flex:1;">${message}</div>
    <button style="background:none;border:none;color:var(--text-light);cursor:pointer;font-size:1.1rem;" data-action="remove-parent">&times;</button>
  `;

  container.appendChild(toast);

  // Animasiya ilə göstər
  setTimeout(() => toast.classList.add('show'), 10);

  // Müddət bitəndə sil
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

/**
 * Tarixi Azərbaycan dilində oxunaqlı nisbi formata çevirir
 */
window.formatRelativeTime = function(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Bayaq';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} dəqiqə əvvəl`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} saat əvvəl`;
  if (diffSec < 172800) return 'Dünən';

  const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Elan növü üçün HTML Badge yaradır
 */
window.getTypeBadge = function(type) {
  switch (type) {
    case 'stray':
      return `<span class="badge badge-stray"><i class="fa-solid fa-paw"></i> Sahibsiz</span>`;
    case 'lost':
      return `<span class="badge badge-lost"><i class="fa-solid fa-bullhorn"></i> İtmiş Heyvan</span>`;
    case 'needs_help':
      return `<span class="badge badge-needs-help"><i class="fa-solid fa-heart-pulse"></i> Qayğı Lazımdır</span>`;
    default:
      return `<span class="badge"><i class="fa-solid fa-tag"></i> Elan</span>`;
  }
};

/**
 * Heyvan növü üçün ikon və ad
 */
window.getAnimalBadge = function(animalType) {
  switch (animalType) {
    case 'dog':
      return `<span class="badge badge-animal"><i class="fa-solid fa-dog"></i> İt</span>`;
    case 'cat':
      return `<span class="badge badge-animal"><i class="fa-solid fa-cat"></i> Pişik</span>`;
    default:
      return `<span class="badge badge-animal"><i class="fa-solid fa-dove"></i> Digər</span>`;
  }
};


/**
 * Giriş vəsiqəsini (token) brauzerdə saxlayan və oxuyan köməkçi
 */
window.Auth = {
  getToken() {
    try { return localStorage.getItem('pawly_token'); } catch (e) { return null; }
  },
  getUser() {
    try { return JSON.parse(localStorage.getItem('pawly_user')); } catch (e) { return null; }
  },
  save(token, user) {
    try {
      localStorage.setItem('pawly_token', token);
      localStorage.setItem('pawly_user', JSON.stringify(user));
    } catch (e) { /* brauzer icazə vermirsə, sadəcə keçirik */ }
  },
  logout() {
    try {
      localStorage.removeItem('pawly_token');
      localStorage.removeItem('pawly_user');
    } catch (e) { /* eyni */ }
  },
  isLoggedIn() {
    return !!this.getToken() && !!this.getUser();
  }
};

/**
 * Başlıqda (header): giriş edibsə "Ad ▾" menyusu (Mənim elanlarım, Çıxış),
 * etməyibsə "Daxil ol" göstərir
 */
function initAuthHeader() {
  const actions = document.querySelector('.header-actions');
  if (!actions) return;

  const box = document.createElement('div');
  box.className = 'user-menu';

  if (Auth.isLoggedIn()) {
    const firstName = Auth.getUser().fullName.split(' ')[0];

    // Düymə: [ikon] Ad ▾
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'user-menu-toggle';

    const userIcon = document.createElement('i');
    userIcon.className = 'fa-solid fa-circle-user';
    const nameEl = document.createElement('span');
    nameEl.className = 'user-menu-name';
    nameEl.textContent = firstName;   // textContent: təhlükəsiz yazır
    const chevron = document.createElement('i');
    chevron.className = 'fa-solid fa-chevron-down user-menu-chevron';
    toggle.append(userIcon, nameEl, chevron);

    // Açılan siyahı
    const dropdown = document.createElement('div');
    dropdown.className = 'user-menu-dropdown';

    const myListings = document.createElement('a');
    myListings.href = 'my-listings.html';
    myListings.className = 'user-menu-item';
    myListings.innerHTML = '<i class="fa-solid fa-list-check"></i> Mənim elanlarım';

    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'user-menu-item';
    logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Çıxış';
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'index.html';
    });

    // Admin üçün əlavə link (əsl qorunma serverdədir, bu yalnız görünüşdür)
    if (Auth.getUser().role === 'Admin') {
      const adminLink = document.createElement('a');
      adminLink.href = 'admin.html';
      adminLink.className = 'user-menu-item';
      adminLink.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Admin paneli';
      dropdown.append(myListings, adminLink, logoutBtn);
    } else {
      dropdown.append(myListings, logoutBtn);
    }
    box.append(toggle, dropdown);

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!box.contains(e.target)) dropdown.classList.remove('show');
    });
  } else {
    const loginLink = document.createElement('a');
    loginLink.href = 'login.html';
    loginLink.className = 'user-menu-login';
    loginLink.textContent = 'Daxil ol';
    box.append(loginLink);
  }

  actions.insertBefore(box, actions.firstChild);
}

/**
 * Mətni təhlükəsiz hala salır (istifadəçinin yazdığı < > " kimi simvollar
 * səhifədə kod kimi işləməsin deyə)
 */
window.escapeHtml = function(value) {
  return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
};



/**
 * E-poçtu təsdiqlənməyib: başlığın altında xatırlatma zolağı göstərir
 */
async function initEmailConfirmBanner() {
  if (!Auth.isLoggedIn()) return;
  if (window.location.pathname.endsWith('verify-email.html')) return;

  let user = Auth.getUser();
  if (!user || user.emailConfirmed !== false) return;

  // Başqa cihazda təsdiqləyibsə, bunu serverdən öyrənirik
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${Auth.getToken()}` }
    });
    if (res.ok) {
      const fresh = await res.json();
      user = { ...user, ...fresh };
      Auth.save(Auth.getToken(), user);
      if (user.emailConfirmed) return;
    }
  } catch (e) { /* şəbəkə xətası: zolağı yenə göstəririk */ }

  const header = document.querySelector('.site-header');
  if (!header) return;

  const banner = document.createElement('div');
  banner.style.cssText = 'background:var(--accent-amber-light);border-bottom:1px solid rgba(226,140,36,0.3);font-size:0.92rem;';
  banner.innerHTML = `
    <div class="container" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-top:12px;padding-bottom:12px;">
      <span>
        <i class="fa-solid fa-envelope" style="color:var(--accent-amber);"></i>
        E-poçtunuzu təsdiqləyin: <strong></strong> ünvanına link göndərmişik. Təsdiqdən sonra elan yerləşdirə bilərsiniz.
      </span>
      <button type="button" class="btn btn-outline btn-sm" id="btn-banner-resend">
        <i class="fa-solid fa-paper-plane"></i> Yenidən göndər
      </button>
    </div>
  `;
  banner.querySelector('strong').textContent = user.email;   // təhlükəsiz yazırıq
  header.insertAdjacentElement('afterend', banner);

  const btn = banner.querySelector('#btn-banner-resend');
  btn.addEventListener('click', async () => {
    if (!window.API) return;
    btn.disabled = true;
    try {
      const res = await API.resendConfirmation();
      window.showToast(window.escapeHtml(res.message || 'Link göndərildi.'), 'success', 6000);
    } catch (err) {
      window.showToast(window.escapeHtml(err.message), 'error');
      btn.disabled = false;
    }
  });
}



/**
 * HTML-in içinə kod yazmamaq üçün ümumi idarəçilər.
 * Düymələrdə onclick="..." əvəzinə data-action="..." istifadə olunur.
 */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'hide-parent':      // koordinat nişanını bağlamaq
      el.parentElement.classList.remove('show');
      break;
    case 'remove-parent':    // bildirişi (toast) bağlamaq
      el.parentElement.remove();
      break;
    case 'close-modal': {    // pəncərəni bağlamaq
      const modal = el.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
      break;
    }
    case 'reset-filters': {  // "Bütün Elanlar"-da filtrləri sıfırlamaq
      const btn = document.querySelector('#btn-reset-filters');
      if (btn) btn.click();
      break;
    }
  }
});

// Şəkil yüklənməsə, data-fallback-da göstərilən standart şəkil qoyulur
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.fallback || img.dataset.fellBack) return;
  img.dataset.fellBack = '1';
  img.src = img.dataset.fallback;
}, true);