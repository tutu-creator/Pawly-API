document.addEventListener('DOMContentLoaded', () => {
      const form = document.querySelector('#register-form');
      const btn = document.querySelector('#btn-register');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const fullName = document.querySelector('#reg-name').value.trim();
        const email = document.querySelector('#reg-email').value.trim();
        const password = document.querySelector('#reg-password').value;

        if (!fullName) { window.showToast('Adınızı yazın', 'error'); return; }
        if (!email.includes('@')) { window.showToast('Düzgün e-poçt yazın', 'error'); return; }
        if (password.length < 8) { window.showToast('Parol ən azı 8 simvol olmalıdır', 'error'); return; }

        btn.disabled = true;
        try {
          await API.register({ fullName, email, password });

          // Qeydiyyatdan dərhal sonra avtomatik daxil edirik
          const result = await API.login(email, password);
          Auth.save(result.token, result.user);

          window.location.href = 'index.html';
        } catch (err) {
          window.showToast(err.message, 'error');
          btn.disabled = false;
        }
      });
    });
