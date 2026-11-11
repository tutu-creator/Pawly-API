/**
 * ==========================================================================
 * Pawly - API Xidmət Modulu
 * Front-end ilə back-end (ASP.NET) arasındakı körpü.
 * ==========================================================================
 */

// Front-endin sözləri  <->  back-endin sözləri
const TYPE_TO_SERVER = { stray: 'Stray', lost: 'Lost', needs_help: 'NeedsHelp' };
const TYPE_FROM_SERVER = { Stray: 'stray', Lost: 'lost', NeedsHelp: 'needs_help' };
const ANIMAL_TO_SERVER = { dog: 'Dog', cat: 'Cat', other: 'Other' };
const ANIMAL_FROM_SERVER = { Dog: 'dog', Cat: 'cat', Other: 'other' };

// Şəkil yoxdursa göstəriləcək standart şəkil
function defaultImageFor(type, animalType) {
  if (type === 'needs_help') return 'images/dog-needs-care-1.jpg';
  if (type === 'lost') return animalType === 'cat' ? 'images/cat-lost-1.jpg' : 'images/dog-lost-1.jpg';
  return animalType === 'cat' ? 'images/cat-stray-1.jpg' : 'images/dog-stray-1.jpg';
}

function defaultTitleFor(animalType) {
  const name = animalType === 'dog' ? 'İt' : animalType === 'cat' ? 'Pişik' : 'Heyvan';
  return `${name} haqqında bildiriş`;
}

// Giriş etmişsə, sorğuya "bilet"i əlavə edən başlıq
function authHeader() {
  const token = window.Auth ? Auth.getToken() : null;
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Vəsiqə ləğv olunubsa: hesabdan çıxır və login səhifəsinə keçir
function sessionExpired() {
  if (window.Auth) Auth.logout();
  window.location.href = 'login.html';
}

// Boş mətni null-a çevirir (back-end boş sətir yox, "boş" dəyər gözləyir)
function cleanText(value) {
  const text = (value ?? '').toString().trim();
  return text === '' ? null : text;
}

function toNumberOrNull(value) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

// Back-enddən gələn elanı front-endin tanıdığı formaya çevirir
function listingFromServer(l) {
  const type = TYPE_FROM_SERVER[l.type] || 'stray';
  const animalType = ANIMAL_FROM_SERVER[l.animalKind] || 'other';
  const photoUrls = (l.photos || []).map(p => p.url);

  return {
    id: String(l.id),
    userId: l.userId ?? null,
    type,
    animalType,
    title: l.title || defaultTitleFor(animalType),
    petName: l.petName || '',
    breed: l.breed || '',
    age: l.age || '',
    color: l.color || '',
    lostDate: l.lostDate || '',
    observedDuration: l.observedDuration || '',
    conditions: l.conditions ? l.conditions.split('|') : [],
    description: l.description || '',
    city: l.city || '',
    hasCoords: l.latitude != null && l.longitude != null,
    location: {
      lat: l.latitude ?? 40.4093,
      lng: l.longitude ?? 49.8671,
      address: l.address || l.city || 'Bakı şəhəri'
    },
    imageUrls: photoUrls.length > 0 ? photoUrls : [defaultImageFor(type, animalType)],
    createdAt: l.createdAt,
    contactInfo: l.contactInfo || '',
    status: l.status === 'Resolved' ? 'resolved' : 'active'
  };
}

const API = {
  // Back-end eyni ünvanda işlədiyi üçün sadəcə /api yazırıq
  BASE_URL: '/api',

  /**
   * Yeni elan göndərmək (POST). Giriş məcburidir.
   * Əvvəl elan yaradılır, sonra şəkillər həmin elana yüklənir.
   */
  async createReport(formData) {
    const body = {
      type: TYPE_TO_SERVER[formData.get('type')] || 'Stray',
      animalKind: ANIMAL_TO_SERVER[formData.get('animalType')] || 'Other',
      title: cleanText(formData.get('title')),
      petName: cleanText(formData.get('petName')),
      breed: cleanText(formData.get('breed')),
      age: cleanText(formData.get('age')),
      color: cleanText(formData.get('color')),
      lostDate: cleanText(formData.get('lostDate')),
      observedDuration: cleanText(formData.get('observedDuration')),
      conditions: formData.getAll('conditions[]'),
      description: cleanText(formData.get('description')) || '',
      // Şəhər hər üç formada seçilir; seçilməyibsə "Digər" yazılır
      city: cleanText(formData.get('city')) || 'Digər',
      address: cleanText(formData.get('address')),
      latitude: toNumberOrNull(formData.get('lat')),
      longitude: toNumberOrNull(formData.get('lng')),
      contactInfo: cleanText(formData.get('contactInfo'))
    };

    const response = await fetch(`${this.BASE_URL}/listings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      Auth.logout();   // bilet köhnəlib və ya yoxdur
      throw new Error('Elan vermək üçün daxil olun');
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('❌ [API POST] Server cavabı:', response.status, errorBody);
      throw new Error(errorBody.message || 'Server xətası: ' + response.status);
    }

    const created = await response.json();

    // Şəkillər seçilibsə, elan yarandıqdan sonra onları həmin elana göndəririk
    const files = formData.getAll('images[]').filter(f => f instanceof File && f.size > 0);
    if (files.length > 0) {
      const photoData = new FormData();
      files.forEach(file => photoData.append('files', file));

      const photoResponse = await fetch(`${this.BASE_URL}/listings/${created.id}/photos`, {
        method: 'POST',
        headers: authHeader(),   // Content-Type yazmırıq, brauzer özü düzgün yazır
        body: photoData
      });

      if (photoResponse.ok) {
        created.photos = await photoResponse.json();
      } else {
        console.error('⚠️ Şəkillər yüklənmədi:', photoResponse.status, await photoResponse.text());
      }
    }

    return { success: true, data: listingFromServer(created) };
  },

  /**
   * Elanları serverdən hissə-hissə almaq (GET). Hamı görə bilər.
   * Axtarış, filtr və çeşidləmə serverdə edilir.
   * Qaytarır: { items, total, page, pageSize }
   */
  async searchListings(filters = {}, page = 1, pageSize = 12) {
    const params = new URLSearchParams();

    if (filters.type && TYPE_TO_SERVER[filters.type]) {
      params.set('type', TYPE_TO_SERVER[filters.type]);
    }
    if (filters.animalType && ANIMAL_TO_SERVER[filters.animalType]) {
      params.set('animalKind', ANIMAL_TO_SERVER[filters.animalType]);
    }
    if (filters.search && filters.search.trim() !== '') {
      params.set('search', filters.search.trim());
    }
    if (filters.sort === 'oldest') {
      params.set('sort', 'oldest');
    }
    params.set('page', page);
    params.set('pageSize', pageSize);

    const response = await fetch(`${this.BASE_URL}/listings?${params}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error('Elanlar alına bilmədi: ' + response.status);

    const data = await response.json();
    return {
      items: (data.items || []).map(listingFromServer),
      total: data.total ?? 0,
      page: data.page ?? page,
      pageSize: data.pageSize ?? pageSize
    };
  },

  /**
   * Sadə siyahı lazım olan yerlər üçün (məs. ana səhifədəki son elanlar)
   */
  async fetchListings(filters = {}) {
    try {
      const result = await this.searchListings(filters, 1, filters.pageSize || 12);
      return result.items;
    } catch (error) {
      console.error('❌ [API GET] Elanları gətirərkən xəta:', error);
      return [];
    }
  },

  /**
   * Tək elanın detalını almaq (GET).
   */
  async fetchListingById(id) {
    try {
      const response = await fetch(`${this.BASE_URL}/listings/${encodeURIComponent(id)}`);
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Elan alına bilmədi: ' + response.status);
      return listingFromServer(await response.json());
    } catch (error) {
      console.error(`❌ [API GET /listings/${id}] Xəta:`, error);
      return null;
    }
  },

  /**
   * Mənim elanlarım (GET /api/listings/mine). Giriş lazımdır.
   */
  async fetchMyListings() {
    const response = await fetch(`${this.BASE_URL}/listings/mine`, {
      headers: { 'Accept': 'application/json', ...authHeader() }
    });
    if (response.status === 401) {
      sessionExpired();
      throw new Error('Giriş müddəti bitib. Zəhmət olmasa yenidən daxil olun.');
    }
    if (!response.ok) throw new Error('Elanlar alına bilmədi: ' + response.status);
    return (await response.json()).map(listingFromServer);
  },

  /**
   * Elanı "Tapıldı" kimi işarələmək (POST /api/listings/{id}/resolve)
   */
  async resolveListing(id) {
    const response = await fetch(`${this.BASE_URL}/listings/${encodeURIComponent(id)}/resolve`, {
      method: 'POST',
      headers: authHeader()
    });
    if (response.status === 401) { sessionExpired(); throw new Error('Yenidən daxil olun.'); }
    if (response.status === 403) throw new Error('Bu elan sizə aid deyil.');
    if (!response.ok) throw new Error('Əməliyyat alınmadı: ' + response.status);
  },

  /**
   * Elanı silmək (DELETE /api/listings/{id})
   */
  async deleteListing(id) {
    const response = await fetch(`${this.BASE_URL}/listings/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeader()
    });
    if (response.status === 401) { sessionExpired(); throw new Error('Yenidən daxil olun.'); }
    if (response.status === 403) throw new Error('Bu elan sizə aid deyil.');
    if (!response.ok) throw new Error('Silinmədi: ' + response.status);
  },

  /**
   * Qeydiyyat (POST /api/auth/register)
   */
  async register(data) {
    const response = await fetch(`${this.BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Qeydiyyat alınmadı. Məlumatları yoxlayın.');
    }
    return result;
  },

  /**
   * Giriş (POST /api/auth/login)
   */
  async login(email, password) {
    const response = await fetch(`${this.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Giriş alınmadı. Məlumatları yoxlayın.');
    }
    return result;   // { token, user }
  },

  /**
   * "Parolu unutdum": e-poçta yeniləmə linki göndərilməsini istəyir (POST /api/password/forgot)
   */
  async forgotPassword(email) {
    const response = await fetch(`${this.BASE_URL}/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Sorğu göndərilmədi. E-poçtu yoxlayın.');
    }
    return result;
  },

  /**
   * Yeni parol təyin etmək (POST /api/password/reset)
   */
  async resetPassword(email, token, newPassword) {
    const response = await fetch(`${this.BASE_URL}/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, newPassword })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Parol yenilənmədi. Yenidən cəhd edin.');
    }
    return result;
  },

  /**
   * E-poçtu təsdiqləmək (POST /api/auth/confirm-email)
   */
  async confirmEmail(email, token) {
    const response = await fetch(`${this.BASE_URL}/auth/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Təsdiq alınmadı. Yenidən cəhd edin.');
    }
    return result;
  },

  /**
   * Təsdiq məktubunu yenidən göndərmək (POST /api/auth/resend-confirmation). Giriş lazımdır.
   */
  async resendConfirmation() {
    const response = await fetch(`${this.BASE_URL}/auth/resend-confirmation`, {
      method: 'POST',
      headers: authHeader()
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionExpired();
      throw new Error('Yenidən daxil olun.');
    }
    if (!response.ok) {
      throw new Error(result.message || 'Məktub göndərilmədi. Bir az sonra yenidən cəhd edin.');
    }
    return result;
  },
  
  /**
   * Admin sorğuları üçün ümumi köməkçi (yalnız admin üçün)
   */
  async adminRequest(path, options = {}) {
    const response = await fetch(`${this.BASE_URL}/admin${path}`, {
      ...options,
      headers: { 'Accept': 'application/json', ...authHeader() }
    });
    if (response.status === 401) {
      sessionExpired();
      throw new Error('Yenidən daxil olun.');
    }
    if (response.status === 403) {
      throw new Error('Bu bölməyə yalnız admin daxil ola bilər.');
    }
    const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Əməliyyat alınmadı: ' + response.status);
    }
    return result;
  },

  adminGetReports(status = 'open') {
    return this.adminRequest(`/reports?status=${encodeURIComponent(status)}`);
  },

  adminReviewReport(id) {
    return this.adminRequest(`/reports/${encodeURIComponent(id)}/review`, { method: 'POST' });
  },

  adminDeleteListing(id) {
    return this.adminRequest(`/listings/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  adminBlockUser(id) {
    return this.adminRequest(`/users/${encodeURIComponent(id)}/block`, { method: 'POST' });
  },

  adminUnblockUser(id) {
    return this.adminRequest(`/users/${encodeURIComponent(id)}/unblock`, { method: 'POST' });
  },
  /**
   * Hesabı birdəfəlik silmək (POST /api/auth/delete-account). Parol təsdiqi lazımdır.
   */
  async deleteAccount(password) {
    const response = await fetch(`${this.BASE_URL}/auth/delete-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ password })
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      Auth.logout();
      throw new Error('Sessiyanın vaxtı bitib. Yenidən daxil olun.');
    }
    if (!response.ok) {
      throw new Error(result.message || 'Hesab silinmədi. Yenidən cəhd edin.');
    }
    return result;
  },
  
  /**
   * Elana şikayət göndərmək (POST /api/listings/{id}/report). Giriş lazımdır.
   */
  async reportListing(id, reason, comment) {
    const response = await fetch(`${this.BASE_URL}/listings/${encodeURIComponent(id)}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ reason, comment: cleanText(comment) })
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      Auth.logout();
      throw new Error('Şikayət etmək üçün yenidən daxil olun.');
    }
    if (!response.ok) {
      throw new Error(result.message || 'Şikayət göndərilmədi. Yenidən cəhd edin.');
    }
    return result;
  },

  /**
   * Könüllülük / Əlaqə müraciətini bazaya göndərir (POST). Giriş tələb olunmur.
   */
  async sendContactMessage(data) {
    const body = {
      fullName: data.fullName,
      email: data.email,
      phone: cleanText(data.phone),
      purpose: data.purpose,
      message: data.message
    };

    const response = await fetch(`${this.BASE_URL}/volunteer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.error('❌ [API Volunteer] Server cavabı:', response.status, await response.text());
      throw new Error('Server xətası: ' + response.status);
    }

    return { success: true };
  }
};