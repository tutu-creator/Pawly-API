/**
 * ==========================================================================
 * Pawly - Forma İdarəetmə Modulu (Vanilla JS)
 * Şəkil yükləmə (emal, önizləmə, drag-and-drop), Geolocation API və Validasiya
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elan formaları yalnız daxil olanlar üçündür
  if (document.querySelector('.animal-report-form') && !Auth.isLoggedIn()) {
    const page = window.location.pathname.split('/').pop();
    window.location.href = 'login.html?next=' + encodeURIComponent(page);
    return;
  }

  initImageUploader();
  initGeolocationPicker();
  initFormValidationAndSubmit();
});

// Şəkil emalı parametrləri
const MAX_PHOTOS = 5;                        // serverdəki limitlə eyni
const MAX_INPUT_SIZE = 25 * 1024 * 1024;     // emaldan ƏVVƏL qəbul olunan ən böyük ölçü
const MAX_DIMENSION = 1600;                  // ən uzun tərəf (piksel)
const JPEG_QUALITY = 0.85;

// Emal olunmuş fayllar və onların önizləmələri (eyni sırada)
let selectedFiles = [];
let previewUrls = [];

/**
 * Şəkli brauzerdə emal edir:
 * - 1600 piksələ qədər kiçildir
 * - JPEG kimi yenidən yaradır (GPS və digər gizli məlumatlar silinir)
 * - iPhone-un HEIC şəkillərini (brauzer oxuya bilirsə) JPEG-ə çevirir
 */
async function processImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();   // brauzer bu formatı oxuya bilmirsə, burada xəta verir

    let { naturalWidth: width, naturalHeight: height } = img;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';              // şəffaf PNG-lər qara görünməsin
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob alınmadı'))), 'image/jpeg', JPEG_QUALITY);
    });

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'sekil';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Şəkil yükləmə və Drag & Drop mexanizmi
 */
function initImageUploader() {
  const dropzone = document.querySelector('.upload-dropzone');
  const fileInput = document.querySelector('.upload-file-input');
  const previewGrid = document.querySelector('.upload-preview-grid');

  if (!dropzone || !fileInput || !previewGrid) return;

  // Drag over / Drag leave effektləri
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    }, false);
  });

  // Drop hadisəsi
  dropzone.addEventListener('drop', (e) => {
    handleFiles(e.dataTransfer.files);
  });

  // File input dəyişdikdə
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';   // eyni şəkli yenidən seçmək mümkün olsun
  });

  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (selectedFiles.length >= MAX_PHOTOS) {
        window.showToast(`Ən çox ${MAX_PHOTOS} şəkil əlavə etmək olar`, 'error');
        break;
      }

      if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
        window.showToast('Yalnız şəkil faylları qəbul edilir', 'error');
        continue;
      }

      if (file.size > MAX_INPUT_SIZE) {
        window.showToast('Şəkil həcmi 25 MB-dan çox ola bilməz', 'error');
        continue;
      }

      let processed;
      let convertOnServer = false;   // brauzer HEIC-i oxuya bilməsə, server çevirəcək
      try {
        processed = await processImage(file);
      } catch (err) {
        const isHeic = /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

        if (isHeic && file.size <= 10 * 1024 * 1024) {
          // Məsələn, Chrome HEIC-i oxuya bilmir: şəkli olduğu kimi göndəririk,
          // server onu JPEG-ə çevirib gizli məlumatları siləcək
          processed = file;
          convertOnServer = true;
        } else {
          console.error('Şəkil emal olunmadı:', err);
          window.showToast(
              `"${window.escapeHtml(file.name)}" açıla bilmədi. JPG və ya PNG formatında şəkil seçin.`,
              'error', 8000);
          continue;
        }
      }

      const previewUrl = URL.createObjectURL(processed);
      selectedFiles.push(processed);
      previewUrls.push(previewUrl);

      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';
      previewItem.innerHTML = convertOnServer
          ? `
          <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px;text-align:center;font-size:0.72rem;color:var(--text-muted);background:var(--bg-secondary);">
            <i class="fa-solid fa-image" style="font-size:1.5rem;"></i>
            iPhone şəkli<br>yüklənəndə görünəcək
          </div>
          <button type="button" class="preview-remove-btn" title="Şəkli sil">&times;</button>
        `
          : `
          <img src="${previewUrl}" alt="Önizləmə">
          <button type="button" class="preview-remove-btn" title="Şəkli sil">&times;</button>
        `;

      // Şəkli silmə düyməsi
      previewItem.querySelector('.preview-remove-btn').addEventListener('click', () => {
        const index = previewUrls.indexOf(previewUrl);
        if (index > -1) {
          previewUrls.splice(index, 1);
          selectedFiles.splice(index, 1);
        }
        URL.revokeObjectURL(previewUrl);
        previewItem.remove();
      });

      previewGrid.appendChild(previewItem);
    }
  }
}

/**
 * Geolocation API ilə istifadəçinin koordinatlarını almaq.
 * Əvvəl yüksək dəqiqliklə (GPS) cəhd edir, alınmasa adi dəqiqliklə (Wi-Fi).
 */
function initGeolocationPicker() {
  const geoBtn = document.querySelector('.btn-geolocation');
  const addressInput = document.querySelector('#location-address');
  const latInput = document.querySelector('#location-lat');
  const lngInput = document.querySelector('#location-lng');
  const coordsBadge = document.querySelector('.coords-badge-row');
  const coordsText = document.querySelector('#coords-display-text');

  if (!geoBtn) return;

  function resetButton(text) {
    geoBtn.classList.remove('loading');
    geoBtn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> ${text}`;
  }

  function onSuccess(position) {
    resetButton('Məkanım təyin edildi');

    const lat = position.coords.latitude.toFixed(6);
    const lng = position.coords.longitude.toFixed(6);

    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;

    // Nöqtəni xəritədə də göstər
    if (window.PawlyMap) {
      PawlyMap.setPickerPoint(position.coords.latitude, position.coords.longitude);
    }

    if (coordsBadge && coordsText) {
      coordsText.textContent = `Enlik: ${lat}, Uzunluq: ${lng} (Dəqiqlik: ~${Math.round(position.coords.accuracy)}m)`;
      coordsBadge.classList.add('show');
    }

    if (addressInput && !addressInput.value.trim()) {
      addressInput.value = `Cari GPS koordinatları (${lat}, ${lng})`;
    }

    window.showToast('Məkanınız uğurla təyin edildi!', 'success');
  }

  function onError(error) {
    resetButton('Mənim məkanım');

    let errMessage = 'Məkan təyin edilə bilmədi.';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errMessage = 'Məkan icazəsi rədd edildi. Zəhmət olmasa ünvanı əl ilə yazın.';
        break;
      case error.POSITION_UNAVAILABLE:
        errMessage = 'Məkan məlumatı əlçatan deyil. Xəritədə basaraq yeri özünüz seçin.';
        break;
      case error.TIMEOUT:
        errMessage = 'Məkan sorğusu vaxtaşımına uğradı. Xəritədə basaraq yeri özünüz seçin.';
        break;
    }
    window.showToast(errMessage, 'error');
  }

  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      window.showToast('Brauzeriniz məkan təyin etməni (Geolocation) dəstəkləmir', 'error');
      return;
    }

    geoBtn.classList.add('loading');
    geoBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Təyin edilir...';

    // 1-ci cəhd: yüksək dəqiqlik (telefonlarda GPS)
    navigator.geolocation.getCurrentPosition(
        onSuccess,
        (error) => {
          // İcazə verilməyibsə, yenidən soruşmağın mənası yoxdur
          if (error.code === error.PERMISSION_DENIED) {
            onError(error);
            return;
          }

          // 2-ci cəhd: adi dəqiqlik (Wi-Fi ilə, kompüterlərdə daha etibarlıdır)
          navigator.geolocation.getCurrentPosition(
              onSuccess,
              onError,
              { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
          );
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Forma Validasiyası və Göndərilməsi
 */
function initFormValidationAndSubmit() {
  const form = document.querySelector('.animal-report-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Validasiya yoxlanışı
    let isValid = true;
    clearErrors(form);

    // Heyvan növü
    const animalType = form.querySelector('input[name="animalType"]:checked');
    if (!animalType) {
      showError(form.querySelector('.animal-type-grid').parentElement, "Zəhmət olmasa heyvan növünü seçin");
      isValid = false;
    }

    // Ünvan / Məkan sahəsi
    const addressInput = form.querySelector('#location-address');
    if (addressInput && !addressInput.value.trim()) {
      showError(addressInput.parentElement, "Zəhmət olmasa heyvanın olduğu məkanı/ünvanı daxil edin");
      isValid = false;
    }

    // Təsvir sahəsi
    const descInput = form.querySelector('#description');
    if (descInput) {
      if (!descInput.value.trim()) {
        showError(descInput.parentElement, "Zəhmət olmasa ətraflı təsvir yazın");
        isValid = false;
      } else if (descInput.value.trim().length < 15) {
        showError(descInput.parentElement, "Təsvir ən azı 15 simvoldan ibarət olmalıdır");
        isValid = false;
      }
    }

    // İtmiş heyvan forması üçün sahibin əlaqə nömrəsi (MÜTLƏQ SAHƏ)
    const phoneInput = form.querySelector('#contactInfo');
    const isContactRequired = phoneInput && phoneInput.hasAttribute('required');
    if (isContactRequired) {
      if (!phoneInput.value.trim()) {
        showError(phoneInput.parentElement, "Əlaqə nömrəsi mütləq qeyd edilməlidir");
        isValid = false;
      } else if (!validatePhone(phoneInput.value.trim())) {
        showError(phoneInput.parentElement, "Düzgün nömrə formatı daxil edin (məs: +994 50 123 45 67)");
        isValid = false;
      }
    }

    // İtmiş heyvan adı (əgər sahə varsa)
    const petNameInput = form.querySelector('#petName');
    if (petNameInput && !petNameInput.value.trim()) {
      showError(petNameInput.parentElement, "Heyvanın adını qeyd edin");
      isValid = false;
    }

    // Şəhər (əgər formada belə sahə varsa)
    const cityInput = form.querySelector('#city');
    if (cityInput && !cityInput.value) {
      showError(cityInput.parentElement, "Zəhmət olmasa şəhəri seçin");
      isValid = false;
    }

    // Əgər səhv varsa ilk səhvə skroll et
    if (!isValid) {
      const firstError = form.querySelector('.has-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // 2. FormData hazırlanması
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Göndərilir...';

    try {
      const formData = new FormData(form);

      // Emal olunmuş şəkilləri əlavə et
      selectedFiles.forEach((file) => {
        formData.append('images[]', file);
      });

      // API-yə göndər (js/api.js)
      const result = await API.createReport(formData);

      // Uğur modalını göstər
      showSuccessModal(result.data);

    } catch (err) {
      console.error(err);
      window.showToast("Göndərilərkən xəta baş verdi: " + err.message, "error", 8000);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  function showError(container, msg) {
    container.classList.add('has-error');
    let errElem = container.querySelector('.error-message');
    if (!errElem) {
      errElem = document.createElement('div');
      errElem.className = 'error-message';
      container.appendChild(errElem);
    }
    errElem.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
    errElem.style.display = 'flex';
  }

  function clearErrors(formContainer) {
    const errorContainers = formContainer.querySelectorAll('.has-error');
    errorContainers.forEach(el => el.classList.remove('has-error'));
    const messages = formContainer.querySelectorAll('.error-message');
    messages.forEach(m => m.style.display = 'none');
  }

  function validatePhone(phone) {
    // Sadə telefon yoxlanışı (minimum 7 rəqəm)
    const cleaned = phone.replace(/[^0-9]/g, '');
    return cleaned.length >= 7;
  }
}

/**
 * Uğurlu Göndərmə Modalı
 */
function showSuccessModal(listing) {
  let modalOverlay = document.querySelector('#form-success-modal');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'form-success-modal';
    modalOverlay.className = 'modal-overlay';
    document.body.appendChild(modalOverlay);
  }

  modalOverlay.innerHTML = `
    <div class="modal-card" style="text-align: center;">
      <div style="width: 72px; height: 72px; border-radius: 50%; background-color: var(--success-light); color: var(--success); display: inline-flex; align-items: center; justify-content: center; font-size: 2.2rem; margin-bottom: 20px;">
        <i class="fa-solid fa-check"></i>
      </div>
      <h2 style="font-size: 1.6rem; margin-bottom: 12px; color: var(--text-main);">Bildirişiniz Uğurla Qəbul Edildi!</h2>
      <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 28px; line-height: 1.6;">
        Təşəkkür edirik! Məlumat qeydə alındı və saytın ümumi elanlar bazasına əlavə olundu. Bu sayədə heyvana köməklik göstərilməsi şansı artır.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="listings.html" class="btn btn-primary">
          <i class="fa-solid fa-list-ul"></i> Elanlara bax
        </a>
        <a href="index.html" class="btn btn-outline">
          <i class="fa-solid fa-house"></i> Ana səhifə
        </a>
      </div>
    </div>
  `;

  modalOverlay.classList.add('active');
}