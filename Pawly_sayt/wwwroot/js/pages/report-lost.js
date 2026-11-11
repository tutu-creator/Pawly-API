// Bugünün tarixini avtomatik seç
    document.addEventListener('DOMContentLoaded', () => {
      const dateInput = document.querySelector('#lostDate');
      if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        dateInput.max = today;
      }
    });
