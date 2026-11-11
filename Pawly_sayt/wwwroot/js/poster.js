/**
 * ==========================================================================
 * Pawly - Çap üçün plakat (poster.html?id=...)
 * Elanı divara asılan vərəqə kimi göstərir: böyük şəkil, əsas məlumatlar,
 * iri telefon nömrəsi, elana aparan QR kod və kiçik Pawly yazısı.
 * "PDF yüklə" plakatı A4 PDF faylı kimi yükləyir (bütün brauzerlərdə işləyir).
 * ==========================================================================
 */

const POSTER_TITLES = {
    lost: 'İTİB!',
    stray: 'SAHİBSİZ HEYVAN',
    needs_help: 'KÖMƏK LAZIMDIR!'
};

const POSTER_ANIMALS = { dog: 'İt', cat: 'Pişik', other: 'Digər' };

document.addEventListener('DOMContentLoaded', async () => {
    const posterEl = document.querySelector('#poster');
    const id = new URLSearchParams(window.location.search).get('id');

    const printBtn = document.querySelector('#btn-print');
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    const pdfBtn = document.querySelector('#btn-pdf');
    if (pdfBtn) pdfBtn.addEventListener('click', () => downloadPosterPdf(pdfBtn, id));

    document.querySelector('#btn-back').href = id
        ? `listing-detail.html?id=${encodeURIComponent(id)}`
        : 'listings.html';

    if (!id) {
        showPosterMessage(posterEl, 'Elan nömrəsi qeyd olunmayıb.');
        return;
    }

    const item = await API.fetchListingById(id);
    if (!item) {
        showPosterMessage(posterEl, 'Elan tapılmadı və ya silinib.');
        return;
    }

    renderPoster(posterEl, item);
});

function showPosterMessage(posterEl, text) {
    posterEl.innerHTML = `<div class="poster-message">${window.escapeHtml(text)}</div>`;
}

// "2026-10-20" → "20.10.2026"
function formatPosterDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    return m ? `${m[3]}.${m[2]}.${m[1]}` : (value || '');
}

function shorten(text, max) {
    const t = (text || '').trim();
    return t.length > max ? t.slice(0, max).trimEnd() + '…' : t;
}

function renderPoster(posterEl, item) {
    const esc = window.escapeHtml;

    posterEl.className = `poster type-${item.type}`;
    document.title = `${POSTER_TITLES[item.type] || 'Elan'} - Pawly`;

    const image = (item.imageUrls && item.imageUrls[0]) ? item.imageUrls[0] : 'images/hero-pets.jpg';
    const address = item.location && item.location.address ? item.location.address : item.city;

    // Yalnız doldurulmuş sahələri göstəririk
    const rows = [];
    const add = (label, value) => { if (value) rows.push(`<div><strong>${esc(label)}:</strong> ${esc(value)}</div>`); };

    add('Növü', POSTER_ANIMALS[item.animalType]);

    if (item.type === 'lost') {
        add('Cinsi', item.breed);
        add('Rəngi', item.color);
        add('Yaşı', item.age);
        add('İtdiyi tarix', formatPosterDate(item.lostDate));
        add('İtdiyi yer', address);
        add('Əlamətləri', shorten(item.description, 220));
    } else {
        add('Görüldüyü yer', address);
        if (item.type === 'needs_help' && item.conditions && item.conditions.length > 0) {
            add('Vəziyyəti', item.conditions.join(', '));
        }
        add('Qeyd', shorten(item.description, 260));
    }

    const nameHtml = (item.type === 'lost' && item.petName)
        ? `<div class="poster-name">${esc(item.petName)}</div>`
        : '';

    const phoneHtml = item.contactInfo ? `
    <div class="poster-phone">
      <div class="label">${item.type === 'lost' ? 'Görsəniz, zəhmət olmasa zəng edin:' : 'Əlaqə:'}</div>
      <div class="number"><i class="fa-solid fa-phone"></i> ${esc(item.contactInfo)}</div>
    </div>` : '';

    const host = window.location.host;

    posterEl.innerHTML = `
    <div class="poster-title">${esc(POSTER_TITLES[item.type] || 'ELAN')}</div>
    <img class="poster-photo" src="${esc(image)}" alt="">
    ${nameHtml}
    <div class="poster-details">${rows.join('')}</div>
    ${phoneHtml}
    <div class="poster-bottom">
      <div class="poster-qr" id="poster-qr"></div>
      <div class="poster-qr-text">
        <strong>Telefonun kamerası ilə skan edin</strong><br>
        Daha çox şəkil, xəritədə yeri və elanın son vəziyyəti.
      </div>
    </div>
    <div class="poster-brand">
      <b>Pawly</b> · sahibsiz və itmiş heyvanlara dəstək platforması · ${esc(host)}
    </div>
  `;

    // QR kod: elanın saytdakı səhifəsinə aparır
    const listingUrl = `${window.location.origin}/listing-detail.html?id=${encodeURIComponent(item.id)}`;
    if (window.QRCode) {
        new QRCode(document.querySelector('#poster-qr'), {
            text: listingUrl,
            width: 256,
            height: 256,
            correctLevel: QRCode.CorrectLevel.M
        });
    }
}

/**
 * Plakatın "şəklini çəkib" A4 PDF faylı kimi yükləyir.
 * Brauzerin çap sisteminə güvənmir, ona görə Safari və telefonlarda da işləyir.
 */
async function downloadPosterPdf(button, id) {
    if (!window.html2canvas || !window.jspdf) {
        window.showToast('PDF hazırlamaq mümkün olmadı. Səhifəni yeniləyib yenidən cəhd edin.', 'error');
        return;
    }

    const posterEl = document.querySelector('#poster');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hazırlanır...';

    try {
        // Şriftlər tam yüklənsin ki, PDF-də yazılar düzgün görünsün
        if (document.fonts && document.fonts.ready) await document.fonts.ready;

        const canvas = await html2canvas(posterEl, {
            scale: 2,                 // daha aydın keyfiyyət
            backgroundColor: '#ffffff',
            useCORS: true
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Şəkli A4 vərəqinə (10 mm kənar boşluqla) sığdırırıq
        const pageW = 210, pageH = 297, margin = 10;
        let w = pageW - margin * 2;
        let h = canvas.height * w / canvas.width;
        if (h > pageH - margin * 2) {
            h = pageH - margin * 2;
            w = canvas.width * h / canvas.height;
        }
        const x = (pageW - w) / 2;

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, margin, w, h);
        pdf.save(`pawly-elan-${id || 'plakat'}.pdf`);
    } catch (err) {
        console.error('PDF yaradılmadı:', err);
        window.showToast('PDF yaradılmadı. Yenidən cəhd edin.', 'error');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}