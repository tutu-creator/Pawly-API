/**
 * ==========================================================================
 * Pawly - Xəritə Modulu (Leaflet + OpenStreetMap)
 * 1) Elan formalarında: xəritədə basıb heyvanın yerini seçmək
 * 2) Elan detalında: heyvanın yerini xəritədə göstərmək
 * ==========================================================================
 */
(function () {
    const DEFAULT_CENTER = [40.4093, 49.8671]; // Bakı
    const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    const PICKER_HINT = 'Xəritədə heyvanın olduğu yerə basın (nöqtəni sürüşdürmək də olar):';
    const NEAR_CITY_METERS = 30000;   // nöqtə şəhərdən bu qədər uzaqdırsa, "Digər" sayılır

    // Şəhər seçiləndə xəritə ora keçsin
    const CITY_CENTERS = {
        'Bakı': [40.4093, 49.8671],
        'Sumqayıt': [40.5897, 49.6686],
        'Xırdalan': [40.4481, 49.7553],
        'Gəncə': [40.6828, 46.3606],
        'Mingəçevir': [40.7703, 47.0496],
        'Şirvan': [39.9376, 48.9203],
        'Lənkəran': [38.7543, 48.8506],
        'Şəki': [41.1919, 47.1706],
        'Naxçıvan': [39.2089, 45.4122]
    };

    // Saytın rəngində pin (Font Awesome ikonu)
    function pinIcon() {
        return L.divIcon({
            className: 'pawly-map-pin',
            html: '<i class="fa-solid fa-location-dot"></i>',
            iconSize: [32, 32],
            iconAnchor: [16, 32]
        });
    }

    function createBaseMap(element, center, zoom) {
        // scrollWheelZoom: false, yoxsa səhifəni aşağı sürüşdürəndə xəritə böyüyüb-kiçilir
        const map = L.map(element, { scrollWheelZoom: false }).setView(center, zoom);
        L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
        return map;
    }

    let picker = null;

    // Elan formasındakı yer tutucunu real xəritə ilə əvəz edir
    function initPicker() {
        const box = document.querySelector('.animal-report-form #map-placeholder');
        if (!box || typeof L === 'undefined') return;

        const latInput = document.querySelector('#location-lat');
        const lngInput = document.querySelector('#location-lng');
        const coordsBadge = document.querySelector('.coords-badge-row');
        const coordsText = document.querySelector('#coords-display-text');
        const citySelect = document.querySelector('#city');

        box.innerHTML = '';
        box.className = 'pawly-map';
        box.style.height = '320px';

        // Xəritənin üstündə izah
        const prev = box.previousElementSibling;
        if (prev && prev.classList.contains('form-hint')) {
            prev.textContent = PICKER_HINT;
        } else {
            const hint = document.createElement('div');
            hint.className = 'form-hint';
            hint.style.margin = '12px 0 8px';
            hint.textContent = PICKER_HINT;
            box.before(hint);
        }

        const map = createBaseMap(box, DEFAULT_CENTER, 12);
        let marker = null;

        // Şəhər hələ seçilməyibsə, nöqtəyə ən yaxın şəhəri avtomatik seçir.
        // İstifadəçi şəhəri özü seçibsə, ona toxunmuruq.
        function autoSelectCity(lat, lng) {
            if (!citySelect || citySelect.value) return;

            let nearest = null;
            let nearestDistance = Infinity;
            for (const [name, center] of Object.entries(CITY_CENTERS)) {
                const distance = map.distance([lat, lng], center);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearest = name;
                }
            }

            citySelect.value = nearestDistance <= NEAR_CITY_METERS ? nearest : 'Digər';
            citySelect.parentElement.classList.remove('has-error');
        }

        function setPoint(lat, lng, moveMap) {
            if (!marker) {
                marker = L.marker([lat, lng], { icon: pinIcon(), draggable: true }).addTo(map);
                marker.on('dragend', () => {
                    const p = marker.getLatLng();
                    setPoint(p.lat, p.lng, false);
                });
            } else {
                marker.setLatLng([lat, lng]);
            }

            if (moveMap) map.setView([lat, lng], Math.max(map.getZoom(), 16));

            const latStr = lat.toFixed(6);
            const lngStr = lng.toFixed(6);
            if (latInput) latInput.value = latStr;
            if (lngInput) lngInput.value = lngStr;

            autoSelectCity(lat, lng);

            if (coordsBadge && coordsText) {
                coordsText.textContent = `Seçilmiş nöqtə: ${latStr}, ${lngStr}`;
                coordsBadge.classList.add('show');
            }
        }

        map.on('click', (e) => setPoint(e.latlng.lat, e.latlng.lng, false));

        // Nöqtəni silir (şəhər dəyişib və nöqtə artıq köhnə şəhərdə qalıbsa)
        function clearPoint() {
            if (marker) {
                map.removeLayer(marker);
                marker = null;
            }
            if (latInput) latInput.value = '';
            if (lngInput) lngInput.value = '';
            if (coordsBadge) coordsBadge.classList.remove('show');
        }

        // Şəhər seçiləndə xəritə həmin şəhərə keçir.
        // Əvvəl qoyulmuş nöqtə yeni şəhərdən 30 km-dən uzaqdırsa, silinir.
        if (citySelect) {
            citySelect.addEventListener('change', () => {
                const center = CITY_CENTERS[citySelect.value];
                if (!center) return;

                if (marker && map.distance(marker.getLatLng(), center) > NEAR_CITY_METERS) {
                    clearPoint();
                    window.showToast('Şəhər dəyişdi. Zəhmət olmasa xəritədə nöqtəni yenidən seçin.', 'info');
                }

                if (marker) {
                    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
                } else {
                    map.setView(center, 13);
                }
            });
        }

        picker = { setPoint };
    }

    // Elan detalında yalnız göstərmək üçün xəritə
    function showPoint(elementId, lat, lng) {
        const element = document.getElementById(elementId);
        if (!element || typeof L === 'undefined') return;

        const map = createBaseMap(element, [lat, lng], 16);
        L.marker([lat, lng], { icon: pinIcon() }).addTo(map);
    }

    window.PawlyMap = {
        // "Mənim məkanım" düyməsi bunu çağırır
        setPickerPoint(lat, lng) {
            if (picker) picker.setPoint(lat, lng, true);
        },
        showPoint
    };

    document.addEventListener('DOMContentLoaded', initPicker);
})();