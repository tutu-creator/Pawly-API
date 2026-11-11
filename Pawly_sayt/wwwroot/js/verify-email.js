/**
 * ==========================================================================
 * Pawly - E-poçt Təsdiqi (verify-email.html)
 * Linkdəki e-poçt və kodu serverə göndərib hesabı təsdiqləyir.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    const box = document.querySelector('#verify-box');
    if (!box) return;

    const params = new URLSearchParams(window.location.search);
    const email = params.get('email');
    const token = params.get('token');

    if (!email || !token) {
        showResult(box, false, 'Link natamamdır. Məktubdakı düyməyə yenidən basın.');
        return;
    }

    try {
        const result = await API.confirmEmail(email, token);

        // Bu brauzerdə həmin hesabla daxil olunubsa, yaddaşdakı məlumatı da yeniləyirik
        if (Auth.isLoggedIn()) {
            const user = Auth.getUser();
            if (user && user.email && user.email.toLowerCase() === email.toLowerCase()) {
                user.emailConfirmed = true;
                Auth.save(Auth.getToken(), user);
            }
        }

        showResult(box, true, result.message || 'E-poçtunuz təsdiqləndi.');
    } catch (err) {
        showResult(box, false, err.message);
    }
});

function showResult(box, success, message) {
    const esc = window.escapeHtml;

    const icon = success
        ? '<div style="width:72px;height:72px;border-radius:50%;background:var(--success-light);color:var(--success);display:inline-flex;align-items:center;justify-content:center;font-size:2.2rem;margin-bottom:18px;"><i class="fa-solid fa-check"></i></div>'
        : '<div style="width:72px;height:72px;border-radius:50%;background:var(--danger-light);color:var(--danger);display:inline-flex;align-items:center;justify-content:center;font-size:2.2rem;margin-bottom:18px;"><i class="fa-solid fa-xmark"></i></div>';

    let buttons;
    if (success) {
        buttons = `
      <a href="report-stray.html" class="btn btn-primary"><i class="fa-solid fa-plus"></i> Elan yerləşdir</a>
      <a href="index.html" class="btn btn-outline"><i class="fa-solid fa-house"></i> Ana səhifə</a>`;
    } else if (Auth.isLoggedIn()) {
        buttons = `
      <button type="button" class="btn btn-primary" id="btn-resend-confirm"><i class="fa-solid fa-paper-plane"></i> Yeni link göndər</button>
      <a href="index.html" class="btn btn-outline"><i class="fa-solid fa-house"></i> Ana səhifə</a>`;
    } else {
        buttons = `
      <a href="login.html" class="btn btn-primary"><i class="fa-solid fa-right-to-bracket"></i> Daxil ol</a>
      <a href="index.html" class="btn btn-outline"><i class="fa-solid fa-house"></i> Ana səhifə</a>`;
    }

    box.innerHTML = `
    ${icon}
    <h2 style="font-size:1.5rem;margin-bottom:10px;">${success ? 'Təsdiqləndi!' : 'Təsdiq alınmadı'}</h2>
    <p style="color:var(--text-muted);margin-bottom:24px;">${esc(message)}</p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">${buttons}</div>
  `;

    const resendBtn = document.querySelector('#btn-resend-confirm');
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            resendBtn.disabled = true;
            try {
                const res = await API.resendConfirmation();
                window.showToast(esc(res.message || 'Link göndərildi.'), 'success', 6000);
            } catch (err) {
                window.showToast(esc(err.message), 'error');
                resendBtn.disabled = false;
            }
        });
    }
}