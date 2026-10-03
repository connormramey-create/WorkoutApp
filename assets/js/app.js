class GymBroApp {
  constructor() {
    this.state = {
      exerciseDatabase: [],
      activeWorkout: null,
      history: [],
      restSeconds: 0,
      restInterval: null
    };
    this.init();
  }

async init() {
    this.registerServiceWorker();
    this.loadState();
    await this.fetchDataset();
    this.render();

    // --- ADD THE TIMER EVENT LISTENERS HERE ---
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const seconds = parseInt(e.target.getAttribute('data-seconds'));
        this.startRestTimer(seconds);
      });
    });

    const closeBtn = document.getElementById('timer-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.stopRestTimer());

    const plusBtn = document.getElementById('timer-plus-30');
    if (plusBtn) plusBtn.addEventListener('click', () => this.adjustRestTime(30));

    const minusBtn = document.getElementById('timer-minus-15');
    if (minusBtn) minusBtn.addEventListener('click', () => this.adjustRestTime(-15));

    const toggleBtn = document.getElementById('timer-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (this.state && this.state.isRunning) {
          this.pauseRestTimer();
        } else {
          this.resumeRestTimer();
        }
      });
    }
    // ------------------------------------------
  }

  // Enables offline iOS capabilities
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./assets/js/sw.js').catch(err => console.log('SW Registration Failed', err));
    }
  }

  async fetchDataset() {
    try {
      const response = await fetch('./data/exercises.json');
      if (response.ok) {
        this.state.exerciseDatabase = await response.json();
      }
    } catch (e) {
      console.warn("Using offline fallback or database empty.");
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('gym_bro_local_state');
      if (saved) this.state = { ...this.state, ...JSON.parse(saved) };
    } catch (e) {}
  }

  saveState() {
    try {
      localStorage.setItem('gym_bro_local_state', JSON.stringify(this.state));
    } catch (e) {}
  }

  playSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  }

  switchTab(tab) {
    const homeView = document.getElementById('homeView');
    const workoutView = document.getElementById('workoutView');
    const homeBtn = document.getElementById('navHomeBtn');
    const workoutBtn = document.getElementById('navWorkoutBtn');

    if (tab === 'home') {
      homeView.classList.remove('hidden');
      workoutView.classList.add('hidden');
      homeBtn.className = "flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition bg-[#39FF14] text-black shadow-md";
      workoutBtn.className = "flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition text-[#8A90A6] hover:text-white hover:bg-[#232738]/50";
    } else {
      homeView.classList.add('hidden');
      workoutView.classList.remove('hidden');
      workoutBtn.className = "flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition bg-[#39FF14] text-black shadow-md";
      homeBtn.className = "flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm transition text-[#8A90A6] hover:text-white hover:bg-[#232738]/50";
    }
  }

  generateWorkout() {
    const split = document.getElementById('splitSelect').value;
    const equip = document.getElementById('equipSelect').value;
    const isSuperset = document.getElementById('supersetToggle').checked;

    // Filter database based on user inputs
    let pool = this.state.exerciseDatabase.filter(ex => {
      const matchEquip = equip === 'all' || ex.equipment === equip;
      const matchSplit = split === 'Full Body' || 
                         (split === 'Push' && ['chest', 'shoulders', 'triceps'].includes(ex.target)) ||
                         (split === 'Pull' && ['back', 'biceps', 'lats'].includes(ex.target)) ||
                         (split === 'Legs' && ['quads', 'hamstrings', 'glutes', 'calves'].includes(ex.target));
      return matchEquip && matchSplit;
    });

    // Fallback static data if dataset is empty/loading
    if (pool.length < 3) {
      pool = [
        { name: `Dumbbell ${split} Press`, target: split, gif_url: "" },
        { name: `Cable ${split} Fly`, target: split, gif_url: "" },
        { name: `Machine ${split} Extension`, target: split, gif_url: "" }
      ];
    }

    // Shuffle and pick 4
    let shuffled = pool.sort(() => 0.5 - Math.random());
    let mainSets = shuffled.slice(0, 4).map(ex => ({
      name: ex.name,
      target: ex.target,
      gif: ex.gif_url,
      sets: [false, false, false],
      isSuperset: isSuperset
    }));

    this.state.activeWorkout = {
      title: `${split} Protocol ${isSuperset ? '(Supersets)' : ''}`,
      warmup: [{ name: `Dynamic ${split} Activation`, duration: "3 Mins" }],
      exercises: mainSets,
      cooldown: [{ name: `Static ${split} Stretching`, duration: "3 Mins" }]
    };

    this.saveState();
    this.switchTab('workout');
    this.render();
  }

  toggleSet(exIdx, setIdx) {
    if (!this.state.activeWorkout) return;
    const current = this.state.activeWorkout.exercises[exIdx].sets[setIdx];
    this.state.activeWorkout.exercises[exIdx].sets[setIdx] = !current;
    
    if (!current) this.startRestTimer(60); // Modular rest time triggering
    
    this.saveState();
    this.render();
  }

startRestTimer(seconds) {
    if (this.state && this.state.restInterval) {
      clearInterval(this.state.restInterval);
    }
    
    // Initialize state if it doesn't exist
    if (!this.state) this.state = {};
    this.state.restSeconds = seconds;
    this.state.isRunning = true;
    
    // Target the new modular container instead of restTimerDisplay
    const container = document.getElementById('rest-timer-container');
    if (container) {
      container.classList.remove('translate-y-[150%]', 'opacity-0', 'pointer-events-none');
    }
    
    const toggleBtn = document.getElementById('timer-toggle');
    if (toggleBtn) toggleBtn.textContent = 'Pause';

    this.updateRestClock();

    this.state.restInterval = setInterval(() => {
      if (!this.state.isRunning) return;
      
      this.state.restSeconds--;
      if (this.state.restSeconds <= 0) {
        this.stopRestTimer();
        if (typeof this.playSound === 'function') {
          this.playSound(); // Audible completion alert
        }
      } else {
        this.updateRestClock();
      }
    }, 1000);
  }

  updateRestClock() {
    if (!this.state || typeof this.state.restSeconds !== 'number') return;
    const m = Math.floor(this.state.restSeconds / 60).toString().padStart(2, '0');
    const s = (this.state.restSeconds % 60).toString().padStart(2, '0');
    
    // Target the new timer-display element
    const displayEl = document.getElementById('timer-display');
    if (displayEl) {
      displayEl.textContent = `${m}:${s}`;
    }
  }

  pauseRestTimer() {
    this.state.isRunning = false;
    const toggleBtn = document.getElementById('timer-toggle');
    if (toggleBtn) toggleBtn.textContent = 'Resume';
  }

  resumeRestTimer() {
    if (this.state.restSeconds > 0) {
      this.state.isRunning = true;
      const toggleBtn = document.getElementById('timer-toggle');
      if (toggleBtn) toggleBtn.textContent = 'Pause';
    }
  }

  stopRestTimer() {
    if (this.state && this.state.restInterval) {
      clearInterval(this.state.restInterval);
    }
    if (this.state) this.state.isRunning = false;
    
    const container = document.getElementById('rest-timer-container');
    if (container) {
      container.classList.add('translate-y-[150%]', 'opacity-0', 'pointer-events-none');
    }
  }

  adjustRestTime(amount) {
    if (!this.state) return;
    this.state.restSeconds = Math.max(0, this.state.restSeconds + amount);
    this.updateRestClock();
    if (this.state.restSeconds === 0) {
      this.stopRestTimer();
      if (typeof this.playSound === 'function') {
        this.playSound();
      }
    }
  }
  render() {
    const banner = document.getElementById('activeWorkoutBanner');
    banner.style.display = this.state.activeWorkout ? 'flex' : 'none';

    const container = document.getElementById('activeWorkoutContent');
    if (!container) return;

    if (this.state.activeWorkout) {
      const w = this.state.activeWorkout;
      container.innerHTML = `
        <h2 class="font-black text-xl text-white uppercase italic mb-4">${w.title}</h2>
        
        <div class="bg-[#11131C] border border-[#232738] rounded-2xl p-4 mb-4">
          <h3 class="font-bold text-[#39FF14] text-sm mb-2">🔥 Dynamic Warm-Up</h3>
          ${w.warmup.map(item => `<p class="text-xs text-[#8A90A6] py-1">• ${item.name} (${item.duration})</p>`).join('')}
        </div>

        <div class="space-y-4 mb-4">
          ${w.exercises.map((ex, exIdx) => `
            <div class="bg-[#11131C] border ${ex.isSuperset ? 'border-orange-500/50' : 'border-[#232738]'} rounded-2xl p-4 shadow-lg">
              <div class="flex justify-between items-start mb-3">
                <div>
                  <h4 class="font-bold text-white text-base capitalize">${ex.name}</h4>
                  <p class="text-xs text-[#8A90A6]">Target: <span class="text-[#39FF14]">${ex.target}</span></p>
                </div>
                ${ex.isSuperset ? `<span class="text-[10px] font-bold bg-orange-950 text-orange-400 px-2 py-1 rounded">SUPERSET</span>` : ''}
              </div>
              
              <div class="grid grid-cols-3 gap-2">
                ${ex.sets.map((done, setIdx) => `
                  <button onclick="app.toggleSet(${exIdx}, ${setIdx})" class="py-2.5 rounded-lg font-bold text-xs transition ${done ? 'bg-[#39FF14] text-black' : 'bg-[#090A0F] border border-[#232738] text-[#8A90A6] hover:border-[#39FF14]'}">
                    ${done ? '✓ Done' : `Set ${setIdx + 1}`}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="bg-[#11131C] border border-[#232738] rounded-2xl p-4">
          <h3 class="font-bold text-[#39FF14] text-sm mb-2">🧘 Static Stretching</h3>
          ${w.cooldown.map(item => `<p class="text-xs text-[#8A90A6] py-1">• ${item.name} (${item.duration})</p>`).join('')}
        </div>
      `;
    } else {
      container.innerHTML = `<p class="text-sm text-[#8A90A6]">No active session. Generate a protocol from the home tab.</p>`;
    }
    
    if (window.lucide) lucide.createIcons();
  }
}

let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new GymBroApp();
});
