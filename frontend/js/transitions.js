// transitions.js — Smooth screen-to-screen transitions for BhoomiSeva

const Transitions = {
  _lock: false,

  async switchScreen(hideIds, showId, showFn) {
    if (this._lock) return;
    this._lock = true;

    // Hide all current visible screens with exit animation
    const visibleScreens = hideIds
      .map(id => document.getElementById(id))
      .filter(el => el && !el.classList.contains('hidden') && el.style.display !== 'none');

    // Animate out
    await Promise.all(visibleScreens.map(el => {
      return new Promise(resolve => {
        el.classList.add('screen-exit');
        const done = () => {
          el.classList.remove('screen-exit');
          el.classList.add('hidden');
          el.style.display = '';
          resolve();
        };
        el.addEventListener('animationend', done, { once: true });
        setTimeout(done, 350); // fallback
      });
    }));

    // Show the target screen
    const target = document.getElementById(showId);
    if (target) {
      target.classList.remove('hidden');
      target.style.display = '';
      // Run any additional setup
      if (typeof showFn === 'function') showFn();
      // Animate in
      target.classList.add('screen-enter');
      target.addEventListener('animationend', () => {
        target.classList.remove('screen-enter');
      }, { once: true });
    }

    this._lock = false;
  },

  toLanding() {
    const allIds = ['login-screen', 'register-screen', 'app-screen'];
    const showId = 'landing-screen';
    this.switchScreen(allIds, showId, null);
  },

  toLogin(initFn) {
    const allIds = ['landing-screen', 'register-screen', 'app-screen'];
    const showId = 'login-screen';
    this.switchScreen(allIds, showId, initFn);
  },

  toRegister(initFn) {
    const allIds = ['landing-screen', 'login-screen', 'app-screen'];
    const showId = 'register-screen';
    this.switchScreen(allIds, showId, initFn);
  },

  toApp(initFn) {
    const allIds = ['landing-screen', 'login-screen', 'register-screen'];
    const showId = 'app-screen';
    this.switchScreen(allIds, showId, initFn);
  }
};
