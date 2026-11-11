// Ana səhifədə ən son 3 elanı göstərən skript
    document.addEventListener('DOMContentLoaded', async () => {
      const container = document.querySelector('#home-recent-listings');
      if (!container) return;
      try {
        const listings = await API.fetchListings({ sort: 'newest' });
        const recentThree = listings.slice(0, 3);
        
        container.innerHTML = recentThree.map(item => {
          const imgUrl = (item.imageUrls && item.imageUrls[0]) ? item.imageUrls[0] : 'images/hero-pets.jpg';
          const typeBadge = window.getTypeBadge(item.type);
          const animalBadge = window.getAnimalBadge(item.animalType);
          const timeFormatted = window.formatRelativeTime(item.createdAt);
          const address = item.location && item.location.address ? item.location.address : 'Bakı';
          let title = item.title || 'Heyvan haqqında elan';
          if (item.type === 'lost' && item.petName) title = `İtkin: ${item.petName} (${title})`;

          return `
            <article class="listing-card">
              <div class="listing-card-media">
                <img src="${imgUrl}" alt="${title}" loading="lazy" data-fallback="images/hero-pets.jpg">
                <div class="card-badges-top">
                  ${typeBadge}
                  ${animalBadge}
                </div>
              </div>
              <div class="listing-card-body">
                <div class="card-meta-row">
                  <span><i class="fa-regular fa-clock"></i> ${timeFormatted}</span>
                  <span>#${item.id}</span>
                </div>
                <h3 class="listing-card-title">${title}</h3>
                <p class="listing-card-desc">${item.description || 'Əlavə qeyd yoxdur.'}</p>
                <div class="listing-card-location">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${address}</span>
                </div>
                <div class="listing-card-footer">
                  <a href="listing-detail.html?id=${item.id}" class="btn btn-outline btn-sm btn-block">
                    <span>Ətraflı bax</span>
                    <i class="fa-solid fa-arrow-right"></i>
                  </a>
                </div>
              </div>
            </article>
          `;
        }).join('');
      } catch (e) {
        console.error("Ana səhifə elanları yüklənmədi:", e);
      }
    });
