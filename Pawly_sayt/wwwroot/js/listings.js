/**
 * ==========================================================================
 * Pawly - Elanlar Siyahısı Modulu (listings.html)
 * Axtarış, filtr və çeşidləmə serverdə edilir.
 * Elanlar hissə-hissə gəlir: "Daha çox göstər" növbəti hissəni yükləyir.
 * ==========================================================================
 */

const PAGE_SIZE = 12;

let currentFilterState = {
  type: 'all',
  animalType: 'all',
  search: '',
  sort: 'newest'
};

let loadedListings = [];   // indiyə qədər yüklənmiş elanlar
let totalListings = 0;     // serverdə filtrə uyğun cəmi elan sayı
let currentPage = 1;
let requestCounter = 0;    // köhnə cavabların yenisinin üstünə yazılmasının qarşısını alır

document.addEventListener('DOMContentLoaded', () => {
  initUrlParams();
  initFilterControls();
  loadAndRenderListings();
});

/**
 * URL-dən ilkin parametrləri oxumaq (məsələn: listings.html?type=lost)
 */
function initUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const typeParam = params.get('type');
  const animalParam = params.get('animalType');

  if (typeParam) currentFilterState.type = typeParam;
  if (animalParam) currentFilterState.animalType = animalParam;
}

/**
 * Filter elementlərinə listener-lərin qoyulması
 */
function initFilterControls() {
  const typePills = document.querySelectorAll('.filter-pill[data-type]');
  const animalSelect = document.querySelector('#filter-animal-type');
  const searchInput = document.querySelector('#filter-search-input');
  const sortSelect = document.querySelector('#filter-sort-select');
  const resetBtn = document.querySelector('#btn-reset-filters');
  const loadMoreBtn = document.querySelector('#btn-load-more');

  // Aktiv pill-i təyin et
  typePills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.type === currentFilterState.type);

    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilterState.type = pill.dataset.type;
      loadAndRenderListings();
    });
  });

  // Heyvan növü seçimi
  if (animalSelect) {
    if (currentFilterState.animalType !== 'all') {
      animalSelect.value = currentFilterState.animalType;
    }
    animalSelect.addEventListener('change', () => {
      currentFilterState.animalType = animalSelect.value;
      loadAndRenderListings();
    });
  }

  // Axtarış sahəsi: istifadəçi yazmağı dayandırandan 400 ms sonra serverə sorğu gedir
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilterState.search = e.target.value;
        loadAndRenderListings();
      }, 400);
    });
  }

  // Çeşidləmə
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentFilterState.sort = sortSelect.value;
      loadAndRenderListings();
    });
  }

  // Filterləri sıfırla düyməsi
  if (resetBtn) {
    resetBtn.addEventListener('click', resetAllFilters);
  }

  // Daha çox göstər: növbəti hissəni serverdən gətirir
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreListings);
  }
}

function resetAllFilters() {
  currentFilterState = {
    type: 'all',
    animalType: 'all',
    search: '',
    sort: 'newest'
  };

  const searchInput = document.querySelector('#filter-search-input');
  if (searchInput) searchInput.value = '';

  const animalSelect = document.querySelector('#filter-animal-type');
  if (animalSelect) animalSelect.value = 'all';

  const sortSelect = document.querySelector('#filter-sort-select');
  if (sortSelect) sortSelect.value = 'newest';

  document.querySelectorAll('.filter-pill[data-type]').forEach(p => {
    p.classList.toggle('active', p.dataset.type === 'all');
  });

  loadAndRenderListings();
}

/**
 * Filtr dəyişəndə: siyahını sıfırdan, 1-ci hissədən yükləyir
 */
async function loadAndRenderListings() {
  const gridContainer = document.querySelector('#listings-container');
  const emptyContainer = document.querySelector('#empty-state-container');
  const countEl = document.querySelector('#listings-total-count');
  const loadMoreBtn = document.querySelector('#btn-load-more');
  const countDisplay = document.querySelector('#visible-count-text');

  if (!gridContainer) return;

  const requestId = ++requestCounter;

  // Yüklənmə skeleti göstər
  gridContainer.innerHTML = Array(3).fill('<div class="skeleton-card"></div>').join('');
  if (emptyContainer) emptyContainer.style.display = 'none';
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';
  if (countDisplay) countDisplay.textContent = '';

  try {
    const result = await API.searchListings(currentFilterState, 1, PAGE_SIZE);

    // İstifadəçi bu arada filtri yenidən dəyişibsə, bu köhnə cavabı atırıq
    if (requestId !== requestCounter) return;

    loadedListings = result.items;
    totalListings = result.total;
    currentPage = 1;

    if (countEl) countEl.textContent = totalListings;

    if (loadedListings.length === 0) {
      gridContainer.innerHTML = '';
      if (emptyContainer) emptyContainer.style.display = 'block';
      return;
    }

    renderListingsGrid();

  } catch (error) {
    if (requestId !== requestCounter) return;
    console.error('Elanlar gətirilərkən xəta:', error);
    gridContainer.innerHTML = `<div style="text-align:center;padding:40px;grid-column:1/-1;">Elanlar yüklənərkən xəta baş verdi.</div>`;
  }
}

/**
 * "Daha çox göstər": növbəti hissəni gətirib mövcud siyahının sonuna əlavə edir
 */
async function loadMoreListings() {
  const loadMoreBtn = document.querySelector('#btn-load-more');
  const requestId = requestCounter;

  if (loadMoreBtn) loadMoreBtn.disabled = true;

  try {
    const result = await API.searchListings(currentFilterState, currentPage + 1, PAGE_SIZE);
    if (requestId !== requestCounter) return;

    currentPage = result.page;
    totalListings = result.total;

    // Eyni elan iki dəfə görünməsin (bu arada yeni elan əlavə olunubsa)
    const existingIds = new Set(loadedListings.map(l => l.id));
    loadedListings = loadedListings.concat(result.items.filter(l => !existingIds.has(l.id)));

    renderListingsGrid();
  } catch (error) {
    console.error('Əlavə elanlar gətirilərkən xəta:', error);
    window.showToast('Elanlar yüklənmədi. Yenidən cəhd edin.', 'error');
  } finally {
    if (loadMoreBtn) loadMoreBtn.disabled = false;
  }
}

/**
 * Kartları səhifəyə yerləşdirmək
 */
function renderListingsGrid() {
  const gridContainer = document.querySelector('#listings-container');
  const loadMoreBtn = document.querySelector('#btn-load-more');
  const countDisplay = document.querySelector('#visible-count-text');

  if (!gridContainer) return;

  gridContainer.innerHTML = loadedListings.map(createListingCardHtml).join('');

  const hasMore = loadedListings.length < totalListings;

  if (loadMoreBtn) {
    loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
  }
  if (countDisplay) {
    countDisplay.textContent = hasMore
        ? `Göstərilir: ${loadedListings.length} / ${totalListings} elan`
        : `Bütün ${totalListings} elan göstərildi`;
  }
}

/**
 * Tək bir elan kartının HTML şablonu
 */
function createListingCardHtml(item) {
  const esc = window.escapeHtml;
  const imgUrl = (item.imageUrls && item.imageUrls[0]) ? item.imageUrls[0] : 'images/hero-pets.jpg';
  const typeBadge = window.getTypeBadge(item.type);
  const animalBadge = window.getAnimalBadge(item.animalType);
  const timeFormatted = window.formatRelativeTime(item.createdAt);
  const address = item.location && item.location.address ? item.location.address : 'Bakı';

  let title = item.title || 'Heyvan haqqında elan';
  if (item.type === 'lost' && item.petName) {
    title = `İtkin: ${item.petName} (${title})`;
  }

  return `
    <article class="listing-card" data-id="${esc(item.id)}">
      <div class="listing-card-media">
        <img src="${esc(imgUrl)}" alt="${esc(title)}" loading="lazy" data-fallback="images/hero-pets.jpg">
        <div class="card-badges-top">
          ${typeBadge}
          ${animalBadge}
        </div>
      </div>
      <div class="listing-card-body">
        <div class="card-meta-row">
          <span><i class="fa-regular fa-clock"></i> ${esc(timeFormatted)}</span>
          <span>#${esc(item.id)}</span>
        </div>
        <h3 class="listing-card-title" title="${esc(title)}">${esc(title)}</h3>
        <p class="listing-card-desc">${esc(item.description || 'Əlavə qeyd yoxdur.')}</p>
        <div class="listing-card-location">
          <i class="fa-solid fa-location-dot"></i>
          <span title="${esc(address)}">${esc(address)}</span>
        </div>
        <div class="listing-card-footer">
          <a href="listing-detail.html?id=${encodeURIComponent(item.id)}" class="btn btn-outline btn-sm btn-block">
            <span>Ətraflı bax</span>
            <i class="fa-solid fa-arrow-right"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}