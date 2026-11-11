/**
 * ==========================================================================
 * Pawly - Ana səhifə statistikası
 * Rəqəmləri serverdən (bazadan) alır. Elan sayı azdırsa, blok gizli qalır.
 * ==========================================================================
 */

const STATS_MIN_TO_SHOW = 10;   // cəmi elan bu saydan azdırsa, statistika göstərilmir

document.addEventListener('DOMContentLoaded', async () => {
    const row = document.querySelector('#hero-stats');
    if (!row) return;

    try {
        const response = await fetch('/api/stats', { headers: { 'Accept': 'application/json' } });
        if (!response.ok) return;

        const stats = await response.json();
        if ((stats.total ?? 0) < STATS_MIN_TO_SHOW) return;

        document.querySelector('#stat-total').textContent = stats.total;
        document.querySelector('#stat-reunited').textContent = stats.reunited;
        document.querySelector('#stat-care').textContent = stats.careReports;

        row.style.display = '';   // CSS-dəki əsl görünüşə qayıdır
    } catch (err) {
        // Statistika yüklənməsə, blok sadəcə gizli qalır, səhifənin qalanına təsir etmir
        console.error('Statistika yüklənmədi:', err);
    }
});