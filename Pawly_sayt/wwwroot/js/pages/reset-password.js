document.addEventListener('DOMContentLoaded', () => {
        // E-poçt və gizli kod linkdən oxunur: reset-password.html?email=...&token=...
        const params = new URLSearchParams(window.location.search);
        const email = params.get('email');
        const token = params.get('token');

        const form = document.querySelector('#reset-form');
        const btn = document.querySelector('#btn-reset');

        // Link səhv və ya natamamdırsa, formanı göstərmirik
        if (!email || !token) {
            form.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Link natamamdır. Zəhmət olmasa e-poçtdakı linkə yenidən basın və ya <a href="forgot-password.html" style="font-weight:600;">yeni link istəyin</a>.</p>';
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const p1 = document.querySelector('#reset-password').value;
            const p2 = document.querySelector('#reset-password2').value;

            if (p1.length < 8) {
                window.showToast('Parol ən azı 8 simvol olmalıdır', 'error');
                return;
            }
            if (p1 !== p2) {
                window.showToast('Parollar eyni deyil', 'error');
                return;
            }

            btn.disabled = true;
            try {
                const result = await API.resetPassword(email, token, p1);
                window.showToast(window.escapeHtml(result.message), 'success');
                // 2 saniyə sonra daxil ol səhifəsinə keçir
                setTimeout(() => { window.location.href = 'login.html'; }, 2000);
            } catch (err) {
                window.showToast(window.escapeHtml(err.message), 'error');
                btn.disabled = false;
            }
        });
    });
