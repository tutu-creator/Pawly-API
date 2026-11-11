document.addEventListener('DOMContentLoaded', () => {
        const form = document.querySelector('#forgot-form');
        const btn = document.querySelector('#btn-forgot');
        const success = document.querySelector('#forgot-success');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.querySelector('#forgot-email').value.trim();
            if (!email) {
                window.showToast('E-poçtunuzu yazın', 'error');
                return;
            }

            btn.disabled = true;
            try {
                await API.forgotPassword(email);
                // Forma yox olur, əvəzinə "məktub göndərildi" yazısı çıxır
                form.style.display = 'none';
                success.style.display = 'block';
            } catch (err) {
                window.showToast(window.escapeHtml(err.message), 'error');
                btn.disabled = false;
            }
        });
    });
