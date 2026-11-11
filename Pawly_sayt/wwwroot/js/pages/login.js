document.addEventListener('DOMContentLoaded', () => {
      const form = document.querySelector('#login-form');
      const btn = document.querySelector('#btn-login');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.querySelector('#login-email').value.trim();
        const password = document.querySelector('#login-password').value;

        if (!email || !password) {
          window.showToast('E-poçt və parolu yazın', 'error');
          return;
        }

        btn.disabled = true;
        try {
          const result = await API.login(email, password);
          Auth.save(result.token, result.user);   // bileti yadda saxla
          // Əgər başqa səhifədən gəlibsə (məs: elan forması), ora qaytar
          const next = new URLSearchParams(window.location.search).get('next');
          const safe = next && /^[a-z-]+\.html$/.test(next) ? next : 'index.html';
          window.location.href = safe;
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
