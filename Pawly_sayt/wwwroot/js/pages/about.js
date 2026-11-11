// Əlaqə formasının göndərilməsi və validasiyası
    document.addEventListener('DOMContentLoaded', () => {
      const contactForm = document.querySelector('#contact-form');
      if (!contactForm) return;

      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.querySelector('#contact-name');
        const emailInput = document.querySelector('#contact-email');
        const messageInput = document.querySelector('#contact-message');
        const submitBtn = document.querySelector('#btn-submit-contact');

        let isValid = true;

        if (!nameInput.value.trim()) {
          showInputError(nameInput, "Adınızı daxil edin");
          isValid = false;
        } else {
          clearInputError(nameInput);
        }

        if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
          showInputError(emailInput, "Düzgün e-poçt ünvanı daxil edin");
          isValid = false;
        } else {
          clearInputError(emailInput);
        }

        if (!messageInput.value.trim()) {
          showInputError(messageInput, "Mesajınızı qeyd edin");
          isValid = false;
        } else {
          clearInputError(messageInput);
        }

        if (!isValid) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Göndərilir...';

        try {
          const payload = {
            fullName: nameInput.value.trim(),
            email: emailInput.value.trim(),
            phone: document.querySelector('#contact-phone').value.trim(),
            purpose: document.querySelector('#contact-purpose').value,
            message: messageInput.value.trim()
          };

          await API.sendContactMessage(payload);

          window.showToast("Müraciətiniz qəbul edildi! Ən qısa zamanda əlaqə saxlayacağıq.", "success", 5000);
          contactForm.reset();
        } catch (err) {
          window.showToast("Mesaj göndərilərkən xəta baş verdi.", "error");
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Müraciəti Göndər';
        }
      });

      function showInputError(input, msg) {
        input.parentElement.classList.add('has-error');
        let err = input.parentElement.querySelector('.error-message');
        if (!err) {
          err = document.createElement('div');
          err.className = 'error-message';
          input.parentElement.appendChild(err);
        }
        err.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
        err.style.display = 'flex';
      }

      function clearInputError(input) {
        input.parentElement.classList.remove('has-error');
        const err = input.parentElement.querySelector('.error-message');
        if (err) err.style.display = 'none';
      }
    });
