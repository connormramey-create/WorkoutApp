// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1fJ7pOsNQvmFQVXhFKji62c3TUbYfymg",
  authDomain: "omnipathworkout.firebaseapp.com",
  projectId: "omnipathworkout",
  storageBucket: "omnipathworkout.firebasestorage.app",
  messagingSenderId: "868629854877",
  appId: "1:868629854877:web:2d7d74b54fc4e913e47274",
  measurementId: "G-9YDR5HP3DQ"
};

// Initialize Firebase Services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// State Management
let exerciseDataset = [];
let activeWorkout = null;
let timerInterval = null;
let timerRemainingSeconds = 0;
let isTimerPaused = false;
let currentUser = null;
let isSignUpMode = false;

const DEFAULT_SETTINGS = {
  split: "upper_lower",
  duration: 45,
  restTime: 60,
  equipment: ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight", "kettlebell", "band", "other"],
  supersets: false
};

let userSettings = JSON.parse(localStorage.getItem("gymbro_settings")) || DEFAULT_SETTINGS;
let activePlan = JSON.parse(localStorage.getItem("gymbro_active_plan")) || null;
let workoutHistory = JSON.parse(localStorage.getItem("gymbro_history")) || [];
let exerciseHistory = JSON.parse(localStorage.getItem("gymbro_exercise_history")) || {};
let customExercises = JSON.parse(localStorage.getItem("gymbro_custom_exercises")) || [];

// Target Muscle Maps
const UPPER_BODY_TARGETS = ["chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", "brachialis", "triceps", "forearms"];
const LOWER_BODY_TARGETS = ["quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"];

const ANTAGONIST_MAP = {
  "chest": ["lats", "upper back", "rhomboids"],
  "upper chest": ["lats", "upper back"],
  "lower chest": ["lats", "upper back"],
  "pectorals": ["lats", "upper back"],
  "lats": ["chest", "pectorals", "shoulders"],
  "upper back": ["chest", "pectorals"],
  "biceps": ["triceps"],
  "brachialis": ["triceps"],
  "triceps": ["biceps", "brachialis"],
  "quads": ["hamstrings", "glutes"],
  "hamstrings": ["quads"],
  "shoulders": ["lats", "rear delts"],
  "front delts": ["rear delts", "lats"],
  "side delts": ["traps", "lats"],
  "abs": ["lower back"],
  "obliques": ["lower back"],
  "lower back": ["abs", "obliques"]
};

// Movement Patterns & Volume Balancing Maps
const MOVEMENT_PATTERNS = {
  HORIZONTAL_PUSH: ['horizontal push'],
  HORIZONTAL_PULL: ['horizontal pull'],
  VERTICAL_PUSH: ['vertical push'],
  VERTICAL_PULL: ['vertical pull'],
  KNEE_DOMINANT: ['squat', 'knee extension'],
  HIP_DOMINANT: ['hinge', 'hip extension', 'knee flexion']
};

// Targeted Dynamic Warm-up Library
const DYNAMIC_WARMUP_LIBRARY = {
  chest: [
    { name: "Arm Swings & Chest Openers", duration: "45 sec", desc: "Cross arms across chest, then pull back dynamically to open pectorals." },
    { name: "Band Pull-Aparts", duration: "15 reps", desc: "Hold light band at chest height, pull outward focusing on upper back activation." }
  ],
  shoulders: [
    { name: "Shoulder Dislocates (PVC/Band)", duration: "12 reps", desc: "Pass band overhead from front to back with straight arms." },
    { name: "Arm Circles (Forward & Reverse)", duration: "30 sec each", desc: "Small to large arm rotations to warm rotator cuff muscles." }
  ],
  lats: [
    { name: "Lat Overhead Side Reaches", duration: "10 per side", desc: "Side bend with overhead reach to dynamically stretch lats." },
    { name: "Cat-Cow Stretch", duration: "10 reps", desc: "Flex and extend spine to articulate thoracic spine and lats." }
  ],
  upper_back: [
    { name: "Thoracic Windmills", duration: "8 per side", desc: "Side-lying rotational arm movement to open thoracic spine." },
    { name: "Banded Face Pulls", duration: "15 reps", desc: "Light high pulls to activate rear delts and rhomboids." }
  ],
  quads: [
    { name: "Bodyweight Goblet Squat Hold w/ Pry", duration: "45 sec", desc: "Sink into deep squat, gently prying knees out with elbows." },
    { name: "Dynamic Walking Quad Stretch", duration: "10 per leg", desc: "Pull foot to glute while reaching opposite hand overhead." }
  ],
  hamstrings: [
    { name: "Frankenstein Dynamic Sweeps", duration: "10 per leg", desc: "Hinge forward and sweep hands toward toes on extended heel." },
    { name: "Good Morning Hip Hinges", duration: "12 reps", desc: "Hands behind head, hinge at hips with flat back to prime posterior chain." }
  ],
  glutes: [
    { name: "Bodyweight Glute Bridges", duration: "15 reps", desc: "Squeeze glutes at top pause to prime posterior chain." },
    { name: "Hip Openers / Fire Hydrants", duration: "10 per leg", desc: "Circle knees outward on all fours to activate glute medius." }
  ],
  abs: [
    { name: "Plank to Downward Dog", duration: "8 reps", desc: "Shift from high plank into downward dog to warm core and shoulders." },
    { name: "Standing Torso Twists", duration: "30 sec", desc: "Rotational torso turns with loose arms." }
  ]
};

// Targeted Static Cool-Down Library
const COOL_DOWN_STRETCH_LIBRARY = {
  chest: [
    { name: "Doorway Pectoral Stretch", duration: "45 sec hold", desc: "Place forearm against doorframe, step forward to stretch chest." }
  ],
  shoulders: [
    { name: "Cross-Body Shoulder Stretch", duration: "45 sec per side", desc: "Pull arm across chest with opposite arm." },
    { name: "Overhead Triceps & Shoulder Stretch", duration: "40 sec per side", desc: "Reach elbow overhead and gently pull backward." }
  ],
  lats: [
    { name: "Child's Pose w/ Lateral Reach", duration: "60 sec hold", desc: "Kneel, sit hips back, and walk hands diagonally to stretch lats." }
  ],
  quads: [
    { name: "Standing / Lying Quad Stretch", duration: "45 sec per side", desc: "Hold foot to glute, keeping knees together and core tight." }
  ],
  hamstrings: [
    { name: "Seated Single-Leg Hamstring Stretch", duration: "45 sec per side", desc: "Extend one leg, fold forward from hips with flat spine." }
  ],
  glutes: [
    { name: "Figure-Four / Pigeon Stretch", duration: "45 sec per side", desc: "Cross ankle over knee, lean forward to stretch deep glutes." }
  ],
  abs: [
    { name: "Cobra Abdominal Stretch", duration: "45 sec hold", desc: "Lie prone, press upper body up on forearms/hands to stretch abs." }
  ]
};

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
  await loadExercises();
  initSettingsUI();
  initEventListeners();
  initFirebaseAuthListener();
  renderPlanUI();
  renderHistoryUI();
  renderCustomExerciseListUI();
  checkActiveSession();
});

// Load Exercises & Merge Custom User Exercises
async function loadExercises() {
  try {
    const response = await fetch("data/exercises.json");
    const rawDataset = await response.json();
    exerciseDataset = rawDataset;
    mergeCustomExercises();
  } catch (err) {
    console.error("Failed to load exercises dataset:", err);
  }
}

function mergeCustomExercises() {
  exerciseDataset = exerciseDataset.filter(ex => !ex.isCustom);
  const taggedCustoms = customExercises.map(ex => ({ ...ex, isCustom: true }));
  exerciseDataset = [...exerciseDataset, ...taggedCustoms];
}

// Firebase Auth Observer & Cloud Sync
function initFirebaseAuthListener() {
  auth.onAuthStateChanged(async (user) => {
    const authModal = document.getElementById("auth-modal");
    if (user) {
      currentUser = user;
      if (authModal) authModal.classList.add("hidden");
      syncUserDataFromCloud(user.uid);
    } else {
      currentUser = null;
      if (authModal) authModal.classList.remove("hidden");
    }
  });
}

function syncUserDataFromCloud(uid) {
  const userRef = db.ref(`users/${uid}`);
  userRef.on("value", (snapshot) => {
    const data = snapshot.val();
    if (data) {
      if (data.settings) {
        userSettings = data.settings;
        localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
        initSettingsUI();
      }
      if (data.history) {
        workoutHistory = data.history;
        localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
        renderHistoryUI();
      }
      if (data.active_plan) {
        activePlan = data.active_plan;
        localStorage.setItem("gymbro_active_plan", JSON.stringify(activePlan));
        renderPlanUI();
      }
      if (data.exercise_history) {
        exerciseHistory = data.exercise_history;
        localStorage.setItem("gymbro_exercise_history", JSON.stringify(exerciseHistory));
      }
      if (data.custom_exercises) {
        customExercises = data.custom_exercises;
        localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
        mergeCustomExercises();
        renderCustomExerciseListUI();
      }
    }
  });
}

function saveUserDataToCloud() {
  if (!currentUser) return;
  db.ref(`users/${currentUser.uid}`).update({
    settings: userSettings,
    history: workoutHistory,
    active_plan: activePlan,
    exercise_history: exerciseHistory,
    custom_exercises: customExercises
  });
}

// Sound & Haptic Feedback Engine
function playRestTimerFinishSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "sine";
    osc2.type = "triangle";

    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc2.frequency.setValueAtTime(1760, ctx.currentTime);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 1.2);
    osc2.stop(ctx.currentTime + 1.2);
  } catch (err) {
    console.error("Audio playback error:", err);
  }

  if ("vibrate" in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

// Timer Logic Engine
function startRestTimer(seconds) {
  clearInterval(timerInterval);
  timerRemainingSeconds = seconds || parseInt(userSettings.restTime || 60, 10);
  isTimerPaused = false;

  updateTimerButtonsUI();
  const stickyBar = document.getElementById("sticky-timer-bar");
  if (stickyBar) stickyBar.classList.remove("hidden");

  const tick = () => {
    if (isTimerPaused) return;

    const mins = Math.floor(timerRemainingSeconds / 60);
    const secs = timerRemainingSeconds % 60;
    const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const modalDisplay = document.getElementById("rest-timer-display");
    const floatingDisplay = document.getElementById("floating-timer-display");

    if (modalDisplay) modalDisplay.innerText = formatted;
    if (floatingDisplay) floatingDisplay.innerText = formatted;

    if (timerRemainingSeconds <= 0) {
      clearInterval(timerInterval);
      if (modalDisplay) modalDisplay.innerText = "TIME UP!";
      if (floatingDisplay) floatingDisplay.innerText = "TIME UP!";
      playRestTimerFinishSound();
      setTimeout(() => {
        if (stickyBar) stickyBar.classList.add("hidden");
      }, 5000);
      return;
    }
    timerRemainingSeconds--;
  };

  tick();
  timerInterval = setInterval(tick, 1000);
}

function adjustRestTimer(secondsToAdd) {
  timerRemainingSeconds = Math.max(0, timerRemainingSeconds + secondsToAdd);
  const mins = Math.floor(timerRemainingSeconds / 60);
  const secs = timerRemainingSeconds % 60;
  const formatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const modalDisplay = document.getElementById("rest-timer-display");
  const floatingDisplay = document.getElementById("floating-timer-display");

  if (modalDisplay) modalDisplay.innerText = formatted;
  if (floatingDisplay) floatingDisplay.innerText = formatted;
}

function togglePauseRestTimer() {
  isTimerPaused = !isTimerPaused;
  updateTimerButtonsUI();
}

function updateTimerButtonsUI() {
  const modalBtn = document.getElementById("modal-pause-btn");
  const stickyBtn = document.getElementById("timer-pause-btn");
  const label = isTimerPaused ? "RESUME" : "PAUSE";

  if (modalBtn) modalBtn.innerText = label;
  if (stickyBtn) stickyBtn.innerText = label;
}

function skipRestTimer() {
  clearInterval(timerInterval);
  timerRemainingSeconds = 0;
  const modalDisplay = document.getElementById("rest-timer-display");
  const floatingDisplay = document.getElementById("floating-timer-display");
  const stickyBar = document.getElementById("sticky-timer-bar");

  if (modalDisplay) modalDisplay.innerText = "00:00";
  if (floatingDisplay) floatingDisplay.innerText = "00:00";
  if (stickyBar) stickyBar.classList.add("hidden");
}

// Generate Workout Session with Built-in Volume Balancing (Max Variance = 1)
function generateWorkoutSession(splitTypeOverride) {
  const split = splitTypeOverride || userSettings.split;
  const duration = parseInt(userSettings.duration, 10);
  const exerciseCount = Math.max(3, Math.floor(duration / 7.5));

  const availableExercises = exerciseDataset.filter(ex => 
    userSettings.equipment.includes(ex.equipment.toLowerCase())
  );

  let targetMuscles = [];
  let title = "FULL BODY SESSION";

  if (split === "upper" || split === "upper_lower_upper") {
    targetMuscles = UPPER_BODY_TARGETS;
    title = "UPPER BODY SESSION";
  } else if (split === "lower" || split === "upper_lower_lower") {
    targetMuscles = LOWER_BODY_TARGETS;
    title = "LOWER BODY SESSION";
  } else if (split === "ppl_push") {
    targetMuscles = ["chest", "upper chest", "lower chest", "pectorals", "shoulders", "front delts", "side delts", "triceps"];
    title = "PUSH SESSION";
  } else if (split === "ppl_pull") {
    targetMuscles = ["lats", "upper back", "rear delts", "traps", "biceps", "brachialis", "forearms"];
    title = "PULL SESSION";
  } else if (split === "ppl_legs") {
    targetMuscles = ["quads", "hamstrings", "glutes", "calves", "abs", "core"];
    title = "LEGS SESSION";
  }

  let pool = availableExercises;
  if (targetMuscles.length > 0) {
    pool = availableExercises.filter(ex => 
      targetMuscles.includes(ex.target.toLowerCase()) ||
      (ex.muscle_groups && ex.muscle_groups.primary.some(p => targetMuscles.includes(p.toLowerCase())))
    );
  }

  function getPatternCategory(ex) {
    const pattern = (ex.movement_pattern || '').toLowerCase();
    const target = (ex.target || ex.muscle_group || '').toLowerCase();

    if (MOVEMENT_PATTERNS.HORIZONTAL_PUSH.includes(pattern) || ['chest', 'pectorals'].some(m => target.includes(m))) {
      return 'hPush';
    }
    if (MOVEMENT_PATTERNS.HORIZONTAL_PULL.includes(pattern) || ['upper back', 'rhomboids'].some(m => target.includes(m))) {
      return 'hPull';
    }
    if (MOVEMENT_PATTERNS.VERTICAL_PUSH.includes(pattern) || ['shoulders', 'front delts', 'side delts'].some(m => target.includes(m))) {
      return 'vPush';
    }
    if (MOVEMENT_PATTERNS.VERTICAL_PULL.includes(pattern) || ['lats'].some(m => target.includes(m))) {
      return 'vPull';
    }
    if (MOVEMENT_PATTERNS.KNEE_DOMINANT.includes(pattern) || ['quads'].some(m => target.includes(m))) {
      return 'knee';
    }
    if (MOVEMENT_PATTERNS.HIP_DOMINANT.includes(pattern) || ['hamstrings', 'glutes'].some(m => target.includes(m))) {
      return 'hip';
    }
    return 'other';
  }

  let poolCopy = [...pool];
  const selected = [];
  const counts = { hPush: 0, hPull: 0, vPush: 0, vPull: 0, knee: 0, hip: 0, other: 0 };

  if (userSettings.supersets) {
    let pairCount = 1;
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const ex1Idx = Math.floor(Math.random() * poolCopy.length);
      const ex1 = poolCopy.splice(ex1Idx, 1)[0];
      const target1 = ex1.target.toLowerCase();
      
      ex1.supersetGroup = `SUPERSET ${pairCount} - A`;
      const cat1 = getPatternCategory(ex1);
      counts[cat1] = (counts[cat1] || 0) + 1;
      selected.push(ex1);

      if (selected.length >= exerciseCount) break;

      const antagonists = ANTAGONIST_MAP[target1] || [];
      const ex2Idx = poolCopy.findIndex(ex => 
        antagonists.includes(ex.target.toLowerCase()) ||
        (ex.muscle_groups && ex.muscle_groups.primary.some(p => antagonists.includes(p.toLowerCase())))
      );

      if (ex2Idx !== -1) {
        const ex2 = poolCopy.splice(ex2Idx, 1)[0];
        ex2.supersetGroup = `SUPERSET ${pairCount} - B`;
        const cat2 = getPatternCategory(ex2);
        counts[cat2] = (counts[cat2] || 0) + 1;
        selected.push(ex2);
      } else if (poolCopy.length > 0) {
        const ex2Fallback = poolCopy.splice(0, 1)[0];
        ex2Fallback.supersetGroup = `SUPERSET ${pairCount} - B`;
        const catFallback = getPatternCategory(ex2Fallback);
        counts[catFallback] = (counts[catFallback] || 0) + 1;
        selected.push(ex2Fallback);
      }
      pairCount++;
    }
  } else {
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      let requiredCategory = null;

      if (counts.hPush > counts.hPull) requiredCategory = 'hPull';
      else if (counts.hPull > counts.hPush) requiredCategory = 'hPush';
      else if (counts.vPush > counts.vPull) requiredCategory = 'vPull';
      else if (counts.vPull > counts.vPush) requiredCategory = 'vPush';
      else if (counts.knee > counts.hip) requiredCategory = 'hip';
      else if (counts.hip > counts.knee) requiredCategory = 'knee';

      let chosenIdx = -1;
      if (requiredCategory) {
        chosenIdx = poolCopy.findIndex(ex => getPatternCategory(ex) === requiredCategory);
      }

      if (chosenIdx === -1) {
        chosenIdx = Math.floor(Math.random() * poolCopy.length);
      }

      const chosenEx = poolCopy.splice(chosenIdx, 1)[0];
      const cat = getPatternCategory(chosenEx);
      counts[cat] = (counts[cat] || 0) + 1;
      selected.push(chosenEx);
    }
  }

  const warmups = [
    "Arm Circles & Shoulder Dislocates - 60s",
    "Bodyweight Squats & Hip Openers - 60s",
    "Dynamic Cat-Cow & Torso Twists - 60s"
  ];

  const cooldowns = [
    "Doorway Chest/Shoulder Stretch - 45s per side",
    "Hamstring & Hip Flexor Static Stretch - 45s per side",
    "Deep Child's Pose & Lower Back Decompression - 60s"
  ];

  return { title, exercises: selected, warmups, cooldowns };
}

// Phase 3 Auditing & Dynamic Mobility Engine
function auditWorkoutBalance(workoutExercises) {
  const counts = {
    horizontalPush: 0,
    horizontalPull: 0,
    verticalPush: 0,
    verticalPull: 0,
    kneeDominant: 0,
    hipDominant: 0
  };

  workoutExercises.forEach(ex => {
    const pattern = (ex.movement_pattern || '').toLowerCase();
    const target = (ex.target || ex.muscle_group || '').toLowerCase();

    if (MOVEMENT_PATTERNS.HORIZONTAL_PUSH.includes(pattern)) counts.horizontalPush++;
    else if (MOVEMENT_PATTERNS.HORIZONTAL_PULL.includes(pattern)) counts.horizontalPull++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PUSH.includes(pattern)) counts.verticalPush++;
    else if (MOVEMENT_PATTERNS.VERTICAL_PULL.includes(pattern)) counts.verticalPull++;
    else if (MOVEMENT_PATTERNS.KNEE_DOMINANT.includes(pattern)) counts.kneeDominant++;
    else if (MOVEMENT_PATTERNS.HIP_DOMINANT.includes(pattern)) counts.hipDominant++;
    else {
      if (['chest', 'pectorals'].some(m => target.includes(m))) counts.horizontalPush++;
      else if (['lats', 'upper back', 'rhomboids'].some(m => target.includes(m))) counts.horizontalPull++;
      else if (['shoulders', 'front delts', 'side delts'].some(m => target.includes(m))) counts.verticalPush++;
      else if (['quads'].some(m => target.includes(m))) counts.kneeDominant++;
      else if (['hamstrings', 'glutes'].some(m => target.includes(m))) counts.hipDominant++;
    }
  });

  return counts;
}

function renderBalanceBadgesAndAlerts(counts) {
  const container = document.getElementById('balanceAuditContainer');
  if (!container) return;

  const badges = [];
  const alerts = [];

  const hPush = counts.horizontalPush;
  const hPull = counts.horizontalPull;
  if (hPush > 0 || hPull > 0) {
    if (Math.abs(hPush - hPull) <= 1) {
      badges.push({ text: `Horizontal Push/Pull Balanced (${hPush}:${hPull})`, type: 'success' });
    } else if (hPush > hPull) {
      alerts.push(`⚠️ Horizontal Push Overdominant (${hPush} Push vs ${hPull} Pull). Consider adding a Row movement!`);
      badges.push({ text: `Push Heavy (${hPush}:${hPull})`, type: 'warning' });
    } else {
      alerts.push(`⚠️ Horizontal Pull Overdominant (${hPull} Pull vs ${hPush} Push). Consider adding a Chest Press!`);
      badges.push({ text: `Pull Heavy (${hPull}:${hPush})`, type: 'warning' });
    }
  }

  const vPush = counts.verticalPush;
  const vPull = counts.verticalPull;
  if (vPush > 0 || vPull > 0) {
    if (Math.abs(vPush - vPull) <= 1) {
      badges.push({ text: `Vertical Push/Pull Balanced (${vPush}:${vPull})`, type: 'success' });
    } else if (vPush > vPull) {
      alerts.push(`⚠️ Vertical Push Overdominant (${vPush} Push vs ${vPull} Pull). Consider adding Pull-ups or Lat Pulldowns!`);
      badges.push({ text: `Overhead Heavy (${vPush}:${vPull})`, type: 'warning' });
    } else {
      alerts.push(`⚠️ Vertical Pull Overdominant (${vPull} Pull vs ${vPush} Push). Consider adding an Overhead Shoulder Press!`);
      badges.push({ text: `Lat Heavy (${vPull}:${vPush})`, type: 'warning' });
    }
  }

  const knee = counts.kneeDominant;
  const hip = counts.hipDominant;
  if (knee > 0 || hip > 0) {
    if (Math.abs(knee - hip) <= 1) {
      badges.push({ text: `Leg Ratio Balanced (${knee}:${hip})`, type: 'success' });
    } else if (knee > hip) {
      alerts.push(`⚠️ Knee Dominant Overdominant (${knee} Quads vs ${hip} Hamstrings/Glutes). Add RDLs or Leg Curls!`);
      badges.push({ text: `Quad Heavy (${knee}:${hip})`, type: 'warning' });
    } else {
      alerts.push(`⚠️ Hip Dominant Overdominant (${hip} Hamstrings/Glutes vs ${knee} Quads). Add Squats or Lunges!`);
      badges.push({ text: `Posterior Heavy (${hip}:${knee})`, type: 'warning' });
    }
  }

  let html = `
    <div class="balance-audit-card">
      <div class="balance-header">
        <span class="balance-title">⚖️ Movement Pattern & Volume Audit</span>
      </div>
      <div class="balance-badges">
        ${badges.map(b => `<span class="badge-balance badge-balance-${b.type}">${b.type === 'success' ? '✓' : '⚠️'} ${b.text}</span>`).join('')}
      </div>`;

  if (alerts.length > 0) {
    html += `<div class="balance-alerts">${alerts.map(a => `<div class="alert-item">${a}</div>`).join('')}</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function generateTargetedMobility(workoutExercises) {
  const targetMuscles = new Set();
  workoutExercises.forEach(ex => {
    const target = (ex.target || ex.muscle_group || '').toLowerCase();
    if (target.includes('chest') || target.includes('pec')) targetMuscles.add('chest');
    if (target.includes('shoulder') || target.includes('delt')) targetMuscles.add('shoulders');
    if (target.includes('lat') || target.includes('back')) { targetMuscles.add('lats'); targetMuscles.add('upper_back'); }
    if (target.includes('quad')) targetMuscles.add('quads');
    if (target.includes('hamstring')) targetMuscles.add('hamstrings');
    if (target.includes('glute')) targetMuscles.add('glutes');
    if (target.includes('ab') || target.includes('waist') || target.includes('oblique')) targetMuscles.add('abs');
  });

  if (targetMuscles.size === 0) {
    targetMuscles.add('shoulders');
    targetMuscles.add('glutes');
  }

  const warmups = [];
  const cooldowns = [];
  targetMuscles.forEach(m => {
    if (DYNAMIC_WARMUP_LIBRARY[m]) warmups.push(...DYNAMIC_WARMUP_LIBRARY[m]);
    if (COOL_DOWN_STRETCH_LIBRARY[m]) cooldowns.push(...COOL_DOWN_STRETCH_LIBRARY[m]);
  });

  return { warmups, cooldowns };
}

function renderTargetedMobilityLists(mobility) {
  const warmupContainer = document.getElementById('dynamicWarmupList');
  const cooldownContainer = document.getElementById('cooldownStretchList');
  const warmupBadge = document.getElementById('warmupCountBadge');
  const cooldownBadge = document.getElementById('cooldownCountBadge');

  if (warmupBadge) warmupBadge.textContent = `${mobility.warmups.length} Drills`;
  if (cooldownBadge) cooldownBadge.textContent = `${mobility.cooldowns.length} Stretches`;

  if (warmupContainer) {
    warmupContainer.innerHTML = mobility.warmups.map(w => `
      <div class="mobility-item flex flex-col justify-between">
        <div class="flex items-center justify-between" style="display:flex; justify-content:space-between;">
          <span class="mobility-title">${w.name}</span>
          <span class="mobility-duration">${w.duration}</span>
        </div>
        <div class="mobility-desc">${w.desc}</div>
      </div>
    `).join('');
  }

  if (cooldownContainer) {
    cooldownContainer.innerHTML = mobility.cooldowns.map(c => `
      <div class="mobility-item flex flex-col justify-between">
        <div class="flex items-center justify-between" style="display:flex; justify-content:space-between;">
          <span class="mobility-title">${c.name}</span>
          <span class="mobility-duration">${c.duration}</span>
        </div>
        <div class="mobility-desc">${c.desc}</div>
      </div>
    `).join('');
  }
}

// Custom Exercise Management
function addCustomExercise() {
  const nameInput = document.getElementById("custom-ex-name");
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) {
    alert("Please enter a custom exercise name.");
    return;
  }

  const target = document.getElementById("custom-ex-target").value;
  const equipment = document.getElementById("custom-ex-equipment").value;
  const pattern = document.getElementById("custom-ex-pattern").value;
  const symmetry = document.getElementById("custom-ex-symmetry").value;
  const difficulty = document.getElementById("custom-ex-difficulty").value;

  const newEx = {
    id: `custom_${Date.now()}`,
    name: name,
    target: target,
    muscle_groups: {
      primary: [target],
      secondary: []
    },
    movement_pattern: pattern,
    equipment: equipment,
    symmetry: symmetry,
    difficulty: difficulty,
    isCustom: true
  };

  customExercises.push(newEx);
  localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
  mergeCustomExercises();
  saveUserDataToCloud();
  renderCustomExerciseListUI();

  nameInput.value = "";
  alert(`Added custom exercise: ${name}`);
}

window.deleteCustomExercise = function(id) {
  if (confirm("Delete this custom exercise?")) {
    customExercises = customExercises.filter(ex => ex.id !== id);
    localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
    mergeCustomExercises();
    saveUserDataToCloud();
    renderCustomExerciseListUI();
  }
};

function renderCustomExerciseListUI() {
  const container = document.getElementById("custom-exercise-list");
  if (!container) return;

  if (customExercises.length === 0) {
    container.innerHTML = '<p class="subtitle" style="font-size: 12px; margin-top: 5px;">No custom exercises added yet.</p>';
    return;
  }

  container.innerHTML = customExercises.map(ex => `
    <div class="day-row" style="background: #0f172a; padding: 6px 10px; margin-top: 6px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="color: var(--accent-gold); font-size: 13px;">${ex.name}</strong><br>
        <small style="color: #cbd5e1; font-size: 11px;">${ex.target} • ${ex.equipment} • ${ex.movement_pattern}</small>
      </div>
      <button class="metal-btn danger-btn small-btn" onclick="deleteCustomExercise('${ex.id}')">✕</button>
    </div>
  `).join("");
}

// UI Event Handlers
function initEventListeners() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  const toggleAuthBtn = document.getElementById("toggle-auth-mode-btn");
  if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById("auth-title").innerText = isSignUpMode ? "CREATE IRON BRO ACCOUNT" : "IRON BRO LOGIN";
      document.getElementById("auth-submit-btn").innerText = isSignUpMode ? "SIGN UP" : "LOG IN";
      toggleAuthBtn.innerText = isSignUpMode ? "ALREADY HAVE AN ACCOUNT? LOG IN" : "NEED AN ACCOUNT? SIGN UP";
    });
  }

  const authForm = document.getElementById("auth-form");
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value;
      const password = document.getElementById("auth-password").value;
      const errorMsg = document.getElementById("auth-error-msg");
      if (errorMsg) errorMsg.innerText = "";

      try {
        if (isSignUpMode) {
          await auth.createUserWithEmailAndPassword(email, password);
        } else {
          await auth.signInWithEmailAndPassword(email, password);
        }
      } catch (err) {
        if (errorMsg) errorMsg.innerText = err.message;
      }
    });
  }

  const addCustomBtn = document.getElementById("add-custom-ex-btn");
  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", addCustomExercise);
  }

  document.getElementById("open-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.remove("hidden");
  });
  document.getElementById("close-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.add("hidden");
  });
  document.getElementById("save-settings-btn").addEventListener("click", saveSettingsUI);

  const exportBtn = document.getElementById("export-csv-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportHistoryToCSV);

  document.getElementById("generate-workout-btn").addEventListener("click", () => {
    const session = generateWorkoutSession();
    renderGeneratedWorkout(session);
  });

  document.getElementById("start-workout-btn").addEventListener("click", () => {
    const sessionData = window.currentGeneratedSession;
    if (sessionData) startActiveWorkout(sessionData);
  });

  document.getElementById("resume-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.remove("hidden");
  });
  document.getElementById("minimize-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.add("hidden");
  });
  document.getElementById("finish-workout-btn").addEventListener("click", finishActiveWorkout);

  document.getElementById("create-plan-btn").addEventListener("click", buildMultiMonthPlan);
  document.getElementById("reset-plan-btn").addEventListener("click", () => {
    if (confirm("Reset current program plan?")) {
      activePlan = null;
      localStorage.removeItem("gymbro_active_plan");
      saveUserDataToCloud();
      renderPlanUI();
    }
  });
}

function initSettingsUI() {
  document.getElementById("setting-split").value = userSettings.split;
  document.getElementById("setting-duration").value = userSettings.duration;
  const restElem = document.getElementById("setting-rest-time");
  if (restElem) restElem.value = userSettings.restTime || 60;
  document.getElementById("setting-supersets").checked = userSettings.supersets;

  const eqCheckboxes = document.querySelectorAll("#equipment-toggles input");
  eqCheckboxes.forEach(cb => {
    cb.checked = userSettings.equipment.includes(cb.value);
  });
}

function saveSettingsUI() {
  userSettings.split = document.getElementById("setting-split").value;
  userSettings.duration = parseInt(document.getElementById("setting-duration").value, 10);
  const restElem = document.getElementById("setting-rest-time");
  if (restElem) userSettings.restTime = parseInt(restElem.value, 10);
  userSettings.supersets = document.getElementById("setting-supersets").checked;

  const selectedEquipment = [];
  document.querySelectorAll("#equipment-toggles input:checked").forEach(cb => {
    selectedEquipment.push(cb.value);
  });
  userSettings.equipment = selectedEquipment;

  localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
  saveUserDataToCloud();
  document.getElementById("settings-modal").classList.add("hidden");
  alert("Iron Bro Settings saved!");
}

function exportHistoryToCSV() {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }

  let csvContent = "Date,Workout Title,Exercises Completed,Total Volume (lbs)\n";

  workoutHistory.forEach(row => {
    const safeTitle = `"${(row.title || "").replace(/"/g, '""')}"`;
    csvContent += `"${row.date || ''}",${safeTitle},${row.exerciseCount || 0},${row.totalVolume || 0}\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = `iron_bro_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadAnchor.click();
  URL.revokeObjectURL(url);
}

function renderGeneratedWorkout(session) {
  window.currentGeneratedSession = session;
  document.getElementById("workout-title").innerText = session.title;
  document.getElementById("workout-meta").innerText = `${userSettings.duration} Mins | ${session.exercises.length} Exercises${userSettings.supersets ? " (Antagonistic Supersets)" : ""}`;

  const exDiv = document.getElementById("exercise-list");
  exDiv.innerHTML = session.exercises.map(ex => `
    <div class="exercise-card">
      ${ex.supersetGroup ? `<div class="superset-badge">${ex.supersetGroup}</div>` : ""}
      <h5>${ex.name}${ex.isCustom ? ' <span class="tag" style="color:var(--accent-gold);">[CUSTOM]</span>' : ''}</h5>
      <div class="exercise-tags">
        <span class="tag">Target: ${ex.target}</span>
        <span class="tag">Equip: ${ex.equipment}</span>
        <span class="tag">Pattern: ${ex.movement_pattern}</span>
      </div>
    </div>
  `).join("");

  // Phase 3 Trigger Calls
  const balanceCounts = auditWorkoutBalance(session.exercises);
  renderBalanceBadgesAndAlerts(balanceCounts);

  const mobility = generateTargetedMobility(session.exercises);
  renderTargetedMobilityLists(mobility);

  document.getElementById("generated-workout-view").classList.remove("hidden");
}

function buildMultiMonthPlan() {
  const months = parseInt(document.getElementById("plan-duration").value, 10);
  const totalWeeks = months * 4;
  const split = userSettings.split;

  let schedulePattern = [];
  if (split === "upper_lower") {
    schedulePattern = [
      { name: "Upper Body A", type: "upper_lower_upper" },
      { name: "Lower Body A", type: "upper_lower_lower" },
      { name: "Rest Day", type: "rest" },
      { name: "Upper Body B", type: "upper_lower_upper" },
      { name: "Lower Body B", type: "upper_lower_lower" },
      { name: "Rest Day", type: "rest" },
      { name: "Rest Day", type: "rest" }
    ];
  } else if (split === "ppl") {
    schedulePattern = [
      { name: "Push Day", type: "ppl_push" },
      { name: "Pull Day", type: "ppl_pull" },
      { name: "Legs Day", type: "ppl_legs" },
      { name: "Rest Day", type: "rest" },
      { name: "Push Day B", type: "ppl_push" },
      { name: "Pull Day B", type: "ppl_pull" },
      { name: "Rest Day", type: "rest" }
    ];
  } else {
    schedulePattern = [
      { name: "Full Body A", type: "full_body" },
      { name: "Rest Day", type: "rest" },
      { name: "Full Body B", type: "full_body" },
      { name: "Rest Day", type: "rest" },
      { name: "Full Body C", type: "full_body" },
      { name: "Rest Day", type: "rest" },
      { name: "Rest Day", type: "rest" }
    ];
  }

  const weeks = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const days = schedulePattern.map((day, idx) => ({
      id: `w${w}_d${idx + 1}`,
      dayNum: idx + 1,
      title: day.name,
      type: day.type,
      completed: false
    }));
    weeks.push({ weekNum: w, days });
  }

  activePlan = {
    months,
    totalWeeks,
    split,
    weeks,
    createdAt: new Date().toISOString()
  };

  localStorage.setItem("gymbro_active_plan", JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
}

function renderPlanUI() {
  const container = document.getElementById("active-plan-container");
  if (!activePlan) {
    container.classList.add("hidden");
    return;
  }

  container.classList.remove("hidden");
  document.getElementById("plan-title").innerText = `${activePlan.months}-MONTH (${activePlan.totalWeeks} WEEKS) ${activePlan.split.replace('_', '/').toUpperCase()} PROGRAM`;

  let totalWorkouts = 0;
  let completedWorkouts = 0;

  const accordion = document.getElementById("plan-weeks-accordion");
  accordion.innerHTML = activePlan.weeks.map(week => {
    const weekDaysHtml = week.days.map(day => {
      if (day.type !== "rest") totalWorkouts++;
      if (day.completed) completedWorkouts++;

      return `
        <div class="day-row ${day.completed ? 'completed' : ''}">
          <span>Day ${day.dayNum}: ${day.title}</span>
          ${day.type !== "rest" ? `
            <button class="metal-btn small-btn ${day.completed ? 'danger-btn' : 'primary-btn'}" onclick="togglePlanDay('${week.weekNum}', '${day.id}')">
              ${day.completed ? 'UNDO' : 'START / LOG'}
            </button>
          ` : '<span class="tag">REST</span>'}
        </div>
      `;
    }).join("");

    return `
      <div class="week-card">
        <div class="week-header">WEEK ${week.weekNum}</div>
        <div class="week-body">${weekDaysHtml}</div>
      </div>
    `;
  }).join("");

  const percent = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
  document.getElementById("plan-progress-fill").style.width = `${percent}%`;
  document.getElementById("plan-stats-text").innerText = `${completedWorkouts} of ${totalWorkouts} Workouts Completed (${percent}%)`;
}

window.togglePlanDay = function(weekNum, dayId) {
  const week = activePlan.weeks.find(w => w.weekNum == weekNum);
  if (!week) return;
  const day = week.days.find(d => d.id === dayId);
  if (!day) return;

  if (day.completed) {
    day.completed = false;
  } else {
    const session = generateWorkoutSession(day.type);
    session.title = `Week ${weekNum} - ${day.title}`;
    session.planDayRef = dayId;
    startActiveWorkout(session);
    return;
  }

  localStorage.setItem("gymbro_active_plan", JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
};

// Active Session Tracking & Set Memory
function startActiveWorkout(session) {
  activeWorkout = {
    ...session,
    startTime: new Date().toISOString(),
    logs: session.exercises.map(ex => {
      const exKey = ex.id || ex.name;
      const historyRecord = exerciseHistory[exKey];

      let defaultSets = [
        { reps: 10, weight: 100, completed: false },
        { reps: 10, weight: 100, completed: false },
        { reps: 10, weight: 100, completed: false }
      ];

      if (historyRecord && historyRecord.sets && historyRecord.sets.length > 0) {
        defaultSets = historyRecord.sets.map(s => ({
          reps: s.reps || 10,
          weight: s.weight || 100,
          completed: false
        }));
      }

      return {
        id: ex.id || ex.name,
        name: ex.name,
        supersetGroup: ex.supersetGroup || null,
        lastRecord: historyRecord || null,
        sets: defaultSets
      };
    })
  };

  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));
  checkActiveSession();
  document.getElementById("active-workout-modal").classList.remove("hidden");
}

function checkActiveSession() {
  const stored = localStorage.getItem("gymbro_active_session");
  const banner = document.getElementById("active-session-banner");
  
  if (stored) {
    activeWorkout = JSON.parse(stored);
    banner.classList.remove("hidden");
    renderActiveWorkoutModal();
  } else {
    banner.classList.add("hidden");
  }
}

function renderActiveWorkoutModal() {
  if (!activeWorkout) return;
  document.getElementById("active-workout-name").innerText = activeWorkout.title;

  const container = document.getElementById("active-exercise-container");
  container.innerHTML = activeWorkout.logs.map((ex, exIdx) => {
    let lastBadge = "";
    if (ex.lastRecord) {
      const topWeight = ex.lastRecord.lastWeight || ex.lastRecord.sets?.[0]?.weight || 0;
      const topReps = ex.lastRecord.lastReps || ex.lastRecord.sets?.[0]?.reps || 0;
      if (topWeight > 0) {
        lastBadge = `<span class="tag" style="background: #1e293b; color: var(--accent-gold); border: 1px solid var(--accent-gold);">
          LAST: ${topWeight} lbs × ${topReps} reps
        </span>`;
      }
    }

    return `
      <div class="exercise-card margin-top">
        <div class="exercise-card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h5>${ex.name}</h5>
          ${lastBadge}
        </div>
        ${ex.supersetGroup ? `<div class="superset-badge">${ex.supersetGroup}</div>` : ""}
        <div class="sets-table margin-top">
          ${ex.sets.map((set, setIdx) => `
            <div class="set-row ${set.completed ? 'completed-set' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
              <span>Set ${setIdx + 1}</span>
              <div>
                <input type="number" value="${set.weight}" style="width: 65px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'weight', this.value)"> lbs
                <input type="number" value="${set.reps}" style="width: 55px; margin-left:4px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'reps', this.value)"> reps
              </div>
              <label class="set-check-label" style="font-size: 12px; cursor: pointer;">
                <input type="checkbox" ${set.completed ? 'checked' : ''} class="set-check-input" onchange="toggleSetComplete(${exIdx},${setIdx}, this.checked)">
                DONE
              </label>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
}

window.updateSetData = function(exIdx, setIdx, field, val) {
  if (!activeWorkout) return;
  activeWorkout.logs[exIdx].sets[setIdx][field] = parseFloat(val) || 0;
  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));
};

window.toggleSetComplete = function(exIdx, setIdx, isChecked) {
  if (!activeWorkout) return;
  activeWorkout.logs[exIdx].sets[setIdx].completed = isChecked;
  localStorage.setItem("gymbro_active_session", JSON.stringify(activeWorkout));

  renderActiveWorkoutModal();

  if (isChecked) {
    startRestTimer(parseInt(userSettings.restTime || 60, 10));
  }
};

function finishActiveWorkout() {
  if (!activeWorkout) return;

  let totalSessionVolume = 0;
  let totalCompletedSets = 0;

  const exerciseBreakdowns = activeWorkout.logs.map(ex => {
    const exKey = ex.id || ex.name;
    let exVolume = 0;
    let maxWeight = 0;
    let maxReps = 0;

    ex.sets.forEach(s => {
      const setVol = (s.weight || 0) * (s.reps || 0);
      exVolume += setVol;
      totalSessionVolume += setVol;
      totalCompletedSets++;

      if (s.weight >= maxWeight) {
        maxWeight = s.weight;
        maxReps = s.reps;
      }
    });

    exerciseHistory[exKey] = {
      lastWeight: maxWeight || ex.sets[0]?.weight || 0,
      lastReps: maxReps || ex.sets[0]?.reps || 0,
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })),
      lastUpdated: new Date().toLocaleDateString()
    };

    return {
      name: ex.name,
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })),
      exerciseVolume: exVolume
    };
  });

  localStorage.setItem("gymbro_exercise_history", JSON.stringify(exerciseHistory));

  if (activeWorkout.planDayRef && activePlan) {
    activePlan.weeks.forEach(w => {
      w.days.forEach(d => {
        if (d.id === activeWorkout.planDayRef) d.completed = true;
      });
    });
    localStorage.setItem("gymbro_active_plan", JSON.stringify(activePlan));
    renderPlanUI();
  }

  const historyEntry = {
    id: `log_${Date.now()}`,
    title: activeWorkout.title,
    date: new Date().toLocaleDateString(),
    exerciseCount: activeWorkout.logs.length,
    totalCompletedSets,
    totalVolume: totalSessionVolume,
    exercises: exerciseBreakdowns
  };

  workoutHistory.unshift(historyEntry);
  localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
  localStorage.removeItem("gymbro_active_session");

  saveUserDataToCloud();

  activeWorkout = null;
  document.getElementById("active-workout-modal").classList.add("hidden");
  const stickyBar = document.getElementById("sticky-timer-bar");
  if (stickyBar) stickyBar.classList.add("hidden");
  clearInterval(timerInterval);

  checkActiveSession();
  renderHistoryUI();
  alert(`Workout Logged! Total Volume Lifted: ${totalSessionVolume.toLocaleString()} lbs`);
}

function renderHistoryUI() {
  const container = document.getElementById("history-list");
  if (!workoutHistory || workoutHistory.length === 0) {
    container.innerHTML = '<p class="empty-msg">No completed workouts logged yet.</p>';
    return;
  }

  container.innerHTML = workoutHistory.map(item => `
    <div class="history-card" style="background: #0f172a; border-radius: 8px; padding: 12px; margin-bottom: 10px; border-left: 4px solid var(--accent-gold);">
      <div class="history-card-header" onclick="toggleHistoryCardDetails('${item.id}')" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
        <div>
          <div class="history-title"><strong style="color: #e2e8f0;">${item.title}</strong></div>
          <div class="history-meta" style="color: #cbd5e1; font-size: 12px;">${item.date} • ${item.exerciseCount || 0} Exercises • ${item.totalCompletedSets || 0} Sets</div>
        </div>
        <div class="history-volume-badge" style="background: rgba(255, 215, 0, 0.15); color: #ffd700; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 13px;">
          ${(item.totalVolume || 0).toLocaleString()} lbs
        </div>
      </div>
      <div id="card_details_${item.id}" class="history-card-body hidden" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
        ${item.exercises ? item.exercises.map(ex => `
          <div class="history-exercise-block" style="margin-bottom: 6px;">
            <div class="history-exercise-name" style="color: #ffd700; font-size: 13px; font-weight: 600;">${ex.name}</div>
            <div class="history-sets-summary" style="color: #94a3b8; font-size: 11px;">
              ${ex.sets ? ex.sets.map((s, idx) => `Set ${idx + 1}: ${s.weight} lbs × ${s.reps} reps`).join(" | ") : ""}
            </div>
          </div>
        `).join("") : '<p class="history-sets-summary" style="color: #94a3b8; font-size: 11px;">Standard session details recorded.</p>'}
      </div>
    </div>
  `).join("");
}

window.toggleHistoryCardDetails = function(cardId) {
  const el = document.getElementById(`card_details_${cardId}`);
  if (el) el.classList.toggle("hidden");
};
