// ==========================================
// OmniPathWorkout - MASTER JS CODEBASE
// ==========================================

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

const DEFAULT_MAX_LIFTS = {
  benchPress: 185,
  squat: 225,
  deadlift: 275,
  overheadPress: 115
};

const DEFAULT_SETTINGS = {
  profile: "standard",           // "standard", "powerlifter", "calisthenics"
  progressionScheme: "linear",   // "linear", "juggernaut", "five_three_one", "conjugate"
  split: "upper_lower",          // "upper_lower", "upper", "lower", "ppl", "ppl_push", "ppl_pull", "ppl_legs", "full_body"
  duration: 45,
  restTime: 60,
  equipment: ["barbell", "dumbbell", "cable", "leverage machine", "smith machine", "body weight", "kettlebell", "band", "other"],
  supersets: false,
  maxLifts: DEFAULT_MAX_LIFTS,
  calisthenicsUnlocked: { push: [1], pull: [1], legs: [1] } // Checked skill levels per pathway
};

let userSettings = JSON.parse(localStorage.getItem("gymbro_settings")) || DEFAULT_SETTINGS;
if (!userSettings.calisthenicsUnlocked) {
  userSettings.calisthenicsUnlocked = { push: [1], pull: [1], legs: [1] };
}
if (!userSettings.maxLifts) {
  userSettings.maxLifts = DEFAULT_MAX_LIFTS;
}

let activePlan = null;
let workoutHistory = JSON.parse(localStorage.getItem("gymbro_history")) || [];
let exerciseHistory = JSON.parse(localStorage.getItem("gymbro_exercise_history")) || {};
let customExercises = JSON.parse(localStorage.getItem("gymbro_custom_exercises")) || [];

// Muscle Maps
const UPPER_BODY_TARGETS = ["chest", "upper chest", "lower chest", "pectorals", "lats", "upper back", "shoulders", "front delts", "side delts", "rear delts", "traps", "biceps", "brachialis", "triceps", "forearms"];
const LOWER_BODY_TARGETS = ["quads", "hamstrings", "glutes", "glute medius", "calves", "soleus", "gastrocnemius", "adductors", "shin", "tibialis anterior", "abs", "obliques", "core", "lower back"];
const POWERLIFTER_COMPOUNDS = ["squat", "bench press", "deadlift", "overhead press", "barbell shoulder press", "sumo deadlift", "front squat", "incline bench press"];

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

// Calisthenics Bodyweight Skill Progression Pathways
const CALISTHENICS_SKILL_TREES = {
  push: [
    { level: 1, name: "Push-Up", target: "chest", equipment: "body weight", reps: "8-12 reps" },
    { level: 2, name: "Diamond Push-Up", target: "triceps", equipment: "body weight", reps: "8-12 reps" },
    { level: 3, name: "Pike Push-Up", target: "shoulders", equipment: "body weight", reps: "6-10 reps" },
    { level: 4, name: "Elevated Pike Push-Up", target: "shoulders", equipment: "body weight", reps: "5-8 reps" },
    { level: 5, name: "Handstand Push-Up (Wall Supported)", target: "shoulders", equipment: "body weight", reps: "3-5 reps" }
  ],
  pull: [
    { level: 1, name: "Australian Inverted Row", target: "upper back", equipment: "body weight", reps: "8-12 reps" },
    { level: 2, name: "Chin-Up", target: "biceps", equipment: "body weight", reps: "6-10 reps" },
    { level: 3, name: "Pull-Up", target: "lats", equipment: "body weight", reps: "5-8 reps" },
    { level: 4, name: "Archer Pull-Up", target: "lats", equipment: "body weight", reps: "4-6 reps" },
    { level: 5, name: "Muscle-Up", target: "lats", equipment: "body weight", reps: "2-4 reps" }
  ],
  legs: [
    { level: 1, name: "Air Squat", target: "quads", equipment: "body weight", reps: "15-20 reps" },
    { level: 2, name: "Bulgarian Split Squat", target: "quads", equipment: "body weight", reps: "8-12 reps" },
    { level: 3, name: "Shrimp Squat", target: "quads", equipment: "body weight", reps: "5-8 reps" },
    { level: 4, name: "Pistol Squat", target: "quads", equipment: "body weight", reps: "3-6 reps" }
  ]
};

// Dynamic Mobility Libraries
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
  ]
};

const COOL_DOWN_STRETCH_LIBRARY = {
  chest: [{ name: "Doorway Pectoral Stretch", duration: "45 sec hold", desc: "Place forearm against doorframe, step forward to stretch chest." }],
  shoulders: [{ name: "Cross-Body Shoulder Stretch", duration: "45 sec per side", desc: "Pull arm across chest with opposite arm." }],
  lats: [{ name: "Child's Pose w/ Lateral Reach", duration: "60 sec hold", desc: "Kneel, sit hips back, and walk hands diagonally to stretch lats." }],
  quads: [{ name: "Standing / Lying Quad Stretch", duration: "45 sec per side", desc: "Hold foot to glute, keeping knees together and core tight." }],
  hamstrings: [{ name: "Seated Single-Leg Hamstring Stretch", duration: "45 sec per side", desc: "Extend one leg, fold forward from hips with flat spine." }],
  glutes: [{ name: "Figure-Four / Pigeon Stretch", duration: "45 sec per side", desc: "Cross ankle over knee, lean forward to stretch deep glutes." }]
};

// Helper: Get Profile Storage Key
function getPlanStorageKey() {
  const preset = userSettings.profile || "standard";
  return `gymbro_active_plan_${preset}`;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
  await loadExercises();
  applyProfileThemeAndRules();
  initSettingsUI();
  initEventListeners();
  initFirebaseAuthListener();
  renderPathwaysTabUI();
  renderPlanUI();
  renderHistoryUI();
  checkActiveSession();
});

// Load Exercises & Custom Merging
async function loadExercises() {
  try {
    const response = await fetch("data/exercises.json");
    exerciseDataset = await response.json();
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

// Profile UI Control & Dynamic Pathway Visibility
function applyProfileThemeAndRules() {
  const body = document.body;
  const profile = userSettings.profile || "standard";
  
  body.classList.remove("theme-standard", "theme-powerlifter", "theme-calisthenics");
  
  const pathwaysTabBtn = document.querySelector('.tab-btn[data-tab="pathways-tab"]');
  const pathwaysTabContent = document.getElementById("pathways-tab");

  if (profile === "calisthenics") {
    body.classList.add("theme-calisthenics");
    document.getElementById("app-subhead").innerText = "CALISTHENICS";
    if (pathwaysTabBtn) pathwaysTabBtn.classList.remove("hidden");
  } else {
    if (profile === "powerlifter") {
      body.classList.add("theme-powerlifter");
      document.getElementById("app-subhead").innerText = "POWERLIFTER";
    } else {
      body.classList.add("theme-standard");
      document.getElementById("app-subhead").innerText = "WORKOUT";
    }
    // Hide Progression Pathways Tab for non-Calisthenics profiles
    if (pathwaysTabBtn) pathwaysTabBtn.classList.add("hidden");
    if (pathwaysTabContent && pathwaysTabContent.classList.contains("active")) {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.querySelector('.tab-btn[data-tab="generator-tab"]').classList.add("active");
      document.getElementById("generator-tab").classList.add("active");
    }
  }

  updateProfileSelectionUI(profile);
}

function updateProfileSelectionUI(profile) {
  const schemeGroup = document.getElementById("setting-progression-group");
  const maxLiftsGroup = document.getElementById("setting-max-lifts-group");

  if (profile === "calisthenics") {
    if (schemeGroup) schemeGroup.classList.add("hidden");
    if (maxLiftsGroup) maxLiftsGroup.classList.add("hidden");
  } else {
    if (schemeGroup) schemeGroup.classList.remove("hidden");
    if (maxLiftsGroup) maxLiftsGroup.classList.remove("hidden");
  }
}

// Firebase Auth Listener & Cloud Sync
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
        if (!userSettings.calisthenicsUnlocked) {
          userSettings.calisthenicsUnlocked = { push: [1], pull: [1], legs: [1] };
        }
        if (!userSettings.maxLifts) {
          userSettings.maxLifts = DEFAULT_MAX_LIFTS;
        }
        localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
        applyProfileThemeAndRules();
        initSettingsUI();
        renderPathwaysTabUI();
      }
      if (data.history) {
        workoutHistory = data.history;
        localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
        renderHistoryUI();
      }
      const preset = userSettings.profile || "standard";
      if (data.plans && data.plans[preset]) {
        activePlan = data.plans[preset];
        localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
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
      }
    }
  });
}

function saveUserDataToCloud() {
  if (!currentUser) return;
  const preset = userSettings.profile || "standard";
  
  db.ref(`users/${currentUser.uid}`).update({
    settings: userSettings,
    history: workoutHistory,
    exercise_history: exerciseHistory,
    custom_exercises: customExercises
  });

  if (activePlan) {
    db.ref(`users/${currentUser.uid}/plans/${preset}`).set(activePlan);
  }
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

// Rest Timer Engine
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
      setTimeout(() => { if (stickyBar) stickyBar.classList.add("hidden"); }, 5000);
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
  document.getElementById("rest-timer-display").innerText = "00:00";
  document.getElementById("floating-timer-display").innerText = "00:00";
  document.getElementById("sticky-timer-bar").classList.add("hidden");
}

// 1RM Max Lift Helper and Dynamic Scheme Target Calculations
function roundTo5(weight) {
  return Math.max(10, Math.round(weight / 5) * 5);
}

function getExerciseMaxLift(exercise) {
  const maxes = userSettings.maxLifts || DEFAULT_MAX_LIFTS;
  const name = (exercise.name || '').toLowerCase();
  const target = (exercise.target || '').toLowerCase();

  if (name.includes('bench') || name.includes('chest press') || target.includes('chest')) {
    return parseFloat(maxes.benchPress) || 185;
  }
  if (name.includes('squat') || name.includes('leg press') || target.includes('quad')) {
    return parseFloat(maxes.squat) || 225;
  }
  if (name.includes('deadlift') || name.includes('rdl') || name.includes('hip thrust') || target.includes('hamstring')) {
    return parseFloat(maxes.deadlift) || 275;
  }
  if (name.includes('press') || name.includes('shoulder') || target.includes('shoulder')) {
    return parseFloat(maxes.overheadPress) || 115;
  }
  return 135;
}

function calculateProgressionSetTargets(exercise, scheme, weekNum, setIdx) {
  const profile = userSettings.profile || "standard";

  if (profile === "calisthenics") {
    return { reps: 10, weight: 0, label: "Bodyweight Natural Flow", isBodyweight: true };
  }

  const maxLift = getExerciseMaxLift(exercise);
  let pct = 0.70;
  let reps = 10;
  let label = "";

  switch (scheme) {
    case "five_three_one": {
      const weekInCycle = ((weekNum - 1) % 4) + 1;
      if (weekInCycle === 1) {
        const pcts = [0.65, 0.75, 0.85];
        pct = pcts[Math.min(setIdx, 2)];
        reps = 5;
        label = `5/3/1 W1 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
      } else if (weekInCycle === 2) {
        const pcts = [0.70, 0.80, 0.90];
        pct = pcts[Math.min(setIdx, 2)];
        reps = 3;
        label = `5/3/1 W2 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
      } else if (weekInCycle === 3) {
        const pcts = [0.75, 0.85, 0.95];
        const repList = [5, 3, 1];
        pct = pcts[Math.min(setIdx, 2)];
        reps = repList[Math.min(setIdx, 2)];
        label = `5/3/1 W3 Set ${setIdx + 1} (${Math.round(pct * 100)}%)`;
      } else {
        pct = 0.50; reps = 5; label = `5/3/1 Deload (${Math.round(pct * 100)}%)`;
      }
      break;
    }
    case "juggernaut": {
      const wave = Math.ceil((weekNum % 16) / 4) || 1;
      if (weekNum % 4 === 0) {
        pct = 0.50; reps = 5; label = "Juggernaut Deload (50%)";
      } else if (wave === 1) {
        pct = 0.70; reps = 10; label = "4 Wk Wave 10s (70%)";
      } else if (wave === 2) {
        pct = 0.75; reps = 8; label = "4 Wk Wave 8s (75%)";
      } else if (wave === 3) {
        pct = 0.80; reps = 5; label = "4 Wk Wave 5s (80%)";
      } else {
        pct = 0.85; reps = 3; label = "4 Wk Wave 3s (85%)";
      }
      break;
    }
    case "conjugate": {
      const isMaxEffort = weekNum % 2 !== 0;
      if (isMaxEffort) {
        pct = 0.90; reps = 3; label = "Conjugate Max Effort (90%)";
      } else {
        pct = 0.55; reps = 2; label = "Conjugate Dynamic Speed (55%)";
      }
      break;
    }
    default: { // Linear
      if (profile === "powerlifter") {
        pct = 0.80; reps = 5; label = "Powerlifter Linear (80%)";
      } else {
        pct = 0.70; reps = 10; label = "Standard Linear (70%)";
      }
      break;
    }
  }

  const calculatedWeight = roundTo5(maxLift * pct);
  return { reps, weight: calculatedWeight, label, pct: Math.round(pct * 100), isBodyweight: false };
}

// Calisthenics Available Pool Helper
function getAvailableCalisthenicsExercises() {
  const availablePool = [];
  const unlockedMap = userSettings.calisthenicsUnlocked || { push: [1], pull: [1], legs: [1] };

  Object.keys(CALISTHENICS_SKILL_TREES).forEach(category => {
    const pathway = CALISTHENICS_SKILL_TREES[category];
    const checkedLevels = unlockedMap[category] || [1];

    const allowedLevels = new Set(checkedLevels);
    checkedLevels.forEach(lvl => {
      if (lvl < pathway.length) {
        allowedLevels.add(lvl + 1);
      }
    });

    pathway.forEach(item => {
      if (allowedLevels.has(item.level)) {
        availablePool.push({
          id: `cali_${category}_l${item.level}`,
          name: item.name,
          target: item.target,
          equipment: "body weight",
          movement_pattern: category === "push" ? "horizontal push" : category === "pull" ? "horizontal pull" : "squat",
          level: item.level,
          category
        });
      }
    });
  });

  return availablePool;
}

// Workout Generator Logic
function generateWorkoutSession(splitTypeOverride, isDeloadWeek = false) {
  mergeCustomExercises();

  const profile = userSettings.profile || "standard";
  const split = splitTypeOverride || userSettings.split;
  const duration = parseInt(userSettings.duration, 10);
  let exerciseCount = Math.max(3, Math.floor(duration / 7.5));

  if (isDeloadWeek) {
    exerciseCount = Math.max(2, Math.floor(exerciseCount * 0.8));
  }

  let availableExercises = [];

  if (profile === "calisthenics") {
    availableExercises = getAvailableCalisthenicsExercises();
  } else {
    let activeEquipment = userSettings.equipment.map(e => e.toLowerCase().trim());
    availableExercises = exerciseDataset.filter(ex => 
      activeEquipment.includes((ex.equipment || '').toLowerCase().trim())
    );

    if (profile === "powerlifter") {
      availableExercises = availableExercises.filter(ex => {
        const name = (ex.name || '').toLowerCase();
        return POWERLIFTER_COMPOUNDS.some(c => name.includes(c)) || 
               ['squat', 'bench', 'press', 'deadlift', 'row'].some(k => name.includes(k));
      });
    }
  }

  let targetMuscles = [];
  let title = `${profile.toUpperCase()} SESSION`;

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
  } else if (split === "ppl") {
    title = "PPL COMBINED SESSION";
  }

  let pool = availableExercises;
  if (targetMuscles.length > 0) {
    pool = availableExercises.filter(ex => 
      targetMuscles.includes((ex.target || '').toLowerCase().trim()) ||
      (ex.muscle_groups && ex.muscle_groups.primary.some(p => targetMuscles.includes(p.toLowerCase().trim())))
    );
  }

  if (pool.length < exerciseCount) pool = availableExercises;

  let selected = [];
  const poolCopy = [...pool];

  if (userSettings.supersets) {
    let pairCount = 1;
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const ex1Idx = Math.floor(Math.random() * poolCopy.length);
      const ex1 = poolCopy.splice(ex1Idx, 1)[0];
      const target1 = (ex1.target || '').toLowerCase().trim();
      
      ex1.supersetGroup = `SUPERSET ${pairCount} - A`;
      selected.push(ex1);

      if (selected.length >= exerciseCount) break;

      const antagonists = ANTAGONIST_MAP[target1] || [];
      
      let ex2Idx = poolCopy.findIndex(ex => 
        antagonists.includes((ex.target || '').toLowerCase().trim())
      );

      if (ex2Idx !== -1) {
        const ex2 = poolCopy.splice(ex2Idx, 1)[0];
        ex2.supersetGroup = `SUPERSET ${pairCount} - B`;
        selected.push(ex2);
      } else {
        const globalAntagonist = availableExercises.find(ex => 
          antagonists.includes((ex.target || '').toLowerCase().trim()) && 
          !selected.some(s => (s.id || s.name) === (ex.id || ex.name))
        );

        if (globalAntagonist) {
          const ex2 = { ...globalAntagonist, supersetGroup: `SUPERSET ${pairCount} - B` };
          selected.push(ex2);
        }
      }
      pairCount++;
    }
  } else {
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const idx = Math.floor(Math.random() * poolCopy.length);
      selected.push(poolCopy.splice(idx, 1)[0]);
    }
  }

  return { title, exercises: selected, isDeloadWeek };
}

// Balance Auditing & Mobility Generator
function auditWorkoutBalance(workoutExercises) {
  const counts = { horizontalPush: 0, horizontalPull: 0, verticalPush: 0, verticalPull: 0, kneeDominant: 0, hipDominant: 0 };
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
    if (Math.abs(hPush - hPull) <= 1) badges.push({ text: `Horizontal Push/Pull Balanced (${hPush}:${hPull})`, type: 'success' });
    else if (hPush > hPull) alerts.push(`⚠️ Horizontal Push Overdominant (${hPush} Push vs ${hPull} Pull). Consider adding a Row movement!`);
  }

  let html = `
    <div class="balance-audit-card">
      <div class="balance-header"><span class="balance-title">⚖️ Movement Pattern & Volume Audit</span></div>
      <div class="balance-badges">
        ${badges.map(b => `<span class="badge-balance badge-balance-${b.type}">✓ ${b.text}</span>`).join('')}
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
    if (target.includes('chest')) targetMuscles.add('chest');
    if (target.includes('shoulder')) targetMuscles.add('shoulders');
    if (target.includes('lat') || target.includes('back')) targetMuscles.add('lats');
    if (target.includes('quad')) targetMuscles.add('quads');
    if (target.includes('hamstring')) targetMuscles.add('hamstrings');
    if (target.includes('glute')) targetMuscles.add('glutes');
  });

  if (targetMuscles.size === 0) targetMuscles.add('shoulders');

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
  if (document.getElementById('warmupCountBadge')) document.getElementById('warmupCountBadge').textContent = `${mobility.warmups.length} Drills`;
  if (document.getElementById('cooldownCountBadge')) document.getElementById('cooldownCountBadge').textContent = `${mobility.cooldowns.length} Stretches`;

  if (warmupContainer) {
    warmupContainer.innerHTML = mobility.warmups.map(w => `
      <div class="mobility-item">
        <div style="display:flex; justify-content:space-between;"><span class="mobility-title">${w.name}</span><span class="mobility-duration">${w.duration}</span></div>
        <div class="mobility-desc">${w.desc}</div>
      </div>
    `).join('');
  }

  if (cooldownContainer) {
    cooldownContainer.innerHTML = mobility.cooldowns.map(c => `
      <div class="mobility-item">
        <div style="display:flex; justify-content:space-between;"><span class="mobility-title">${c.name}</span><span class="mobility-duration">${c.duration}</span></div>
        <div class="mobility-desc">${c.desc}</div>
      </div>
    `).join('');
  }
}

// Render Pathways Tab
function renderPathwaysTabUI() {
  const container = document.getElementById("pathways-container");
  if (!container) return;

  const unlockedMap = userSettings.calisthenicsUnlocked || { push: [1], pull: [1], legs: [1] };

  container.innerHTML = Object.keys(CALISTHENICS_SKILL_TREES).map(category => {
    const pathway = CALISTHENICS_SKILL_TREES[category];
    const checkedLevels = unlockedMap[category] || [1];

    const highestChecked = Math.max(...checkedLevels, 0);

    const stepsHtml = pathway.map(item => {
      const isChecked = checkedLevels.includes(item.level);
      const isNextAvailable = !isChecked && item.level === highestChecked + 1;

      let statusBadge = isChecked 
        ? `<span class="step-status" style="background: rgba(34, 197, 94, 0.2); color: #4ade80;">✓ Mastered</span>` 
        : isNextAvailable 
        ? `<span class="step-status" style="background: rgba(255, 215, 0, 0.2); color: #ffd700;">⚡ Next Available</span>`
        : `<span class="step-status" style="background: rgba(255,255,255,0.05); color: #94a3b8;">Locked</span>`;

      return `
        <div class="pathway-step ${isChecked ? 'checked-step' : isNextAvailable ? 'next-step' : ''}">
          <div class="step-info">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleCalisthenicsSkill('${category}', ${item.level}, this.checked)">
            <div>
              <span class="step-label">L${item.level}: ${item.name}</span>
              <div style="font-size: 0.75rem; color: #94a3b8;">Target Reps: ${item.reps} • Target: ${item.target}</div>
            </div>
          </div>
          ${statusBadge}
        </div>
      `;
    }).join('');

    return `
      <div class="pathway-card">
        <h3 class="pathway-title">${category.toUpperCase()} PATHWAY</h3>
        <div>${stepsHtml}</div>
      </div>
    `;
  }).join('');
}

window.toggleCalisthenicsSkill = function(category, level, isChecked) {
  if (!userSettings.calisthenicsUnlocked) {
    userSettings.calisthenicsUnlocked = { push: [1], pull: [1], legs: [1] };
  }

  let list = userSettings.calisthenicsUnlocked[category] || [];

  if (isChecked) {
    if (!list.includes(level)) list.push(level);
  } else {
    list = list.filter(l => l !== level);
  }

  userSettings.calisthenicsUnlocked[category] = list;
  localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
  saveUserDataToCloud();
  renderPathwaysTabUI();
};

// Event Listeners Initialization
function initEventListeners() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Auth Form Submit Handler
  const authForm = document.getElementById("auth-form");
  if (authForm) {
    authForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("auth-email").value.trim();
      const password = document.getElementById("auth-password").value.trim();
      const errorMsg = document.getElementById("auth-error-msg");
      if (errorMsg) errorMsg.innerText = "";

      if (!email || !password) {
        if (errorMsg) errorMsg.innerText = "Please enter email and password.";
        return;
      }

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

  const toggleAuthBtn = document.getElementById("toggle-auth-mode-btn");
  if (toggleAuthBtn) {
    toggleAuthBtn.addEventListener("click", () => {
      isSignUpMode = !isSignUpMode;
      document.getElementById("auth-title").innerText = isSignUpMode ? "CREATE OmniPathWorkout ACCOUNT" : "OmniPathWorkout LOGIN";
      document.getElementById("auth-submit-btn").innerText = isSignUpMode ? "SIGN UP" : "LOG IN";
      toggleAuthBtn.innerText = isSignUpMode ? "ALREADY HAVE AN ACCOUNT? LOG IN" : "NEED AN ACCOUNT? SIGN UP";
    });
  }

  // Custom Exercise Creator Modal Listeners
  const openCustomBtns = document.querySelectorAll("#open-custom-ex-btn");
  const closeCustomBtn = document.getElementById("close-custom-ex-btn");
  const customModal = document.getElementById("custom-ex-modal");
  const customForm = document.getElementById("custom-ex-form");

  openCustomBtns.forEach(btn => {
    btn.addEventListener("click", () => customModal.classList.remove("hidden"));
  });

  if (closeCustomBtn) {
    closeCustomBtn.addEventListener("click", () => customModal.classList.add("hidden"));
  }

  if (customForm) {
    customForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const newEx = {
        id: `custom_${Date.now()}`,
        name: document.getElementById("custom-ex-name").value.trim(),
        target: document.getElementById("custom-ex-target").value,
        equipment: document.getElementById("custom-ex-equipment").value,
        isCustom: true
      };

      customExercises.push(newEx);
      localStorage.setItem("gymbro_custom_exercises", JSON.stringify(customExercises));
      mergeCustomExercises();
      saveUserDataToCloud();

      customForm.reset();
      customModal.classList.add("hidden");
      alert("Custom exercise created successfully!");
    });
  }

  // Settings Modal Controls
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
    if (confirm("Reset current profile program plan?")) {
      activePlan = null;
      localStorage.removeItem(getPlanStorageKey());
      saveUserDataToCloud();
      renderPlanUI();
    }
  });
}

function initSettingsUI() {
  document.getElementById("setting-profile").value = userSettings.profile || "standard";
  document.getElementById("setting-progression").value = userSettings.progressionScheme || "linear";
  document.getElementById("setting-split").value = userSettings.split;
  document.getElementById("setting-duration").value = userSettings.duration;
  document.getElementById("setting-rest-time").value = userSettings.restTime || 60;
  document.getElementById("setting-supersets").checked = userSettings.supersets;

  const maxes = userSettings.maxLifts || DEFAULT_MAX_LIFTS;
  document.getElementById("setting-max-bench").value = maxes.benchPress || 185;
  document.getElementById("setting-max-squat").value = maxes.squat || 225;
  document.getElementById("setting-max-deadlift").value = maxes.deadlift || 275;
  document.getElementById("setting-max-ohp").value = maxes.overheadPress || 115;

  const eqCheckboxes = document.querySelectorAll("#equipment-toggles input");
  eqCheckboxes.forEach(cb => {
    cb.checked = userSettings.equipment.includes(cb.value);
  });

  updateProfileSelectionUI(userSettings.profile || "standard");
}

function saveSettingsUI() {
  userSettings.profile = document.getElementById("setting-profile").value;
  userSettings.progressionScheme = document.getElementById("setting-progression").value;
  userSettings.split = document.getElementById("setting-split").value;
  userSettings.duration = parseInt(document.getElementById("setting-duration").value, 10);
  userSettings.restTime = parseInt(document.getElementById("setting-rest-time").value, 10);
  userSettings.supersets = document.getElementById("setting-supersets").checked;

  userSettings.maxLifts = {
    benchPress: parseFloat(document.getElementById("setting-max-bench").value) || 185,
    squat: parseFloat(document.getElementById("setting-max-squat").value) || 225,
    deadlift: parseFloat(document.getElementById("setting-max-deadlift").value) || 275,
    overheadPress: parseFloat(document.getElementById("setting-max-ohp").value) || 115
  };

  const selectedEquipment = [];
  document.querySelectorAll("#equipment-toggles input:checked").forEach(cb => {
    selectedEquipment.push(cb.value);
  });
  userSettings.equipment = selectedEquipment;

  localStorage.setItem("gymbro_settings", JSON.stringify(userSettings));
  applyProfileThemeAndRules();
  saveUserDataToCloud();
  renderPlanUI();
  document.getElementById("settings-modal").classList.add("hidden");
  alert("Settings saved!");
}

function exportHistoryToCSV() {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }
  let csvContent = "Date,Workout Title,Exercises Completed,Total Volume (lbs)\n";
  workoutHistory.forEach(row => {
    csvContent += `"${row.date || ''}","${(row.title || '').replace(/"/g, '""')}",${row.exerciseCount || 0},${row.totalVolume || 0}\n`;
  });
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `omnipath_workout_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Render Generated Workout View
function renderGeneratedWorkout(session) {
  window.currentGeneratedSession = session;
  document.getElementById("workout-title").innerText = session.title;
  document.getElementById("workout-meta").innerText = `${userSettings.duration} Mins | Profile: ${userSettings.profile.toUpperCase()} | Progression: ${userSettings.progressionScheme.toUpperCase()}${session.isDeloadWeek ? " | 🧊 DELOAD WEEK (-20% Volume)" : ""}`;

  const exDiv = document.getElementById("exercise-list");
  exDiv.innerHTML = session.exercises.map(ex => `
    <div class="exercise-card">
      ${ex.supersetGroup ? `<div class="superset-badge">${ex.supersetGroup}</div>` : ""}
      <h5>${ex.name}</h5>
      <div class="exercise-tags margin-top">
        <span class="tag">Target: ${ex.target}</span>
        <span class="tag">Equip: ${ex.equipment}</span>
      </div>
    </div>
  `).join("");

  const balanceCounts = auditWorkoutBalance(session.exercises);
  renderBalanceBadgesAndAlerts(balanceCounts);
  const mobility = generateTargetedMobility(session.exercises);
  renderTargetedMobilityLists(mobility);

  document.getElementById("generated-workout-view").classList.remove("hidden");
}

// Multi-Month Plan Builder
function buildMultiMonthPlan() {
  const months = parseInt(document.getElementById("plan-duration").value, 10);
  const totalWeeks = months * 4;

  let schedulePattern = [
    { name: "Session A", type: "upper_lower_upper" },
    { name: "Session B", type: "upper_lower_lower" },
    { name: "Rest Day", type: "rest" },
    { name: "Session C", type: "upper_lower_upper" },
    { name: "Session D", type: "upper_lower_lower" },
    { name: "Rest Day", type: "rest" },
    { name: "Rest Day", type: "rest" }
  ];

  const weeks = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const isDeload = (w % 4 === 0);
    const days = schedulePattern.map((day, idx) => ({
      id: `w${w}_d${idx + 1}`,
      dayNum: idx + 1,
      title: `${day.name}${isDeload ? ' (Deload)' : ''}`,
      type: day.type,
      isDeload,
      completed: false
    }));
    weeks.push({ weekNum: w, isDeload, days });
  }

  activePlan = { months, totalWeeks, weeks, createdAt: new Date().toISOString() };
  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
}

function renderPlanUI() {
  const storageKey = getPlanStorageKey();
  activePlan = JSON.parse(localStorage.getItem(storageKey)) || null;

  const container = document.getElementById("active-plan-container");
  if (!activePlan) { container.classList.add("hidden"); return; }

  container.classList.remove("hidden");
  document.getElementById("plan-title").innerText = `${userSettings.profile.toUpperCase()} - ${activePlan.months}-MONTH PROGRAM (${activePlan.totalWeeks} WEEKS)`;

  let totalWorkouts = 0;
  let completedWorkouts = 0;

  const accordion = document.getElementById("plan-weeks-accordion");
  accordion.innerHTML = activePlan.weeks.map(week => {
    const weekDaysHtml = week.days.map(day => {
      if (day.type !== "rest") totalWorkouts++;
      if (day.completed) completedWorkouts++;

      return `
        <div class="day-row ${day.completed ? 'completed' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 0;">
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
      <div class="week-card margin-top">
        <div class="week-header" style="font-weight:bold; color:var(--accent-gold);">WEEK ${week.weekNum} ${week.isDeload ? '🧊 (DELOAD WEEK)' : ''}</div>
        <div class="week-body">${weekDaysHtml}</div>
      </div>
    `;
  }).join("");

  const percent = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
  document.getElementById("plan-progress-fill").style.width = `${percent}%`;
  document.getElementById("plan-stats-text").innerText = `${completedWorkouts} of ${totalWorkouts} Workouts Completed (${percent}%)`;
}

window.togglePlanDay = function(weekNum, dayId) {
  if (!activePlan) return;
  const week = activePlan.weeks.find(w => w.weekNum == weekNum);
  if (!week) return;
  const day = week.days.find(d => d.id === dayId);
  if (!day) return;

  if (day.completed) {
    day.completed = false;
  } else {
    const session = generateWorkoutSession(day.type, day.isDeload);
    session.title = `Week ${weekNum} - ${day.title}`;
    session.weekNum = weekNum;
    session.planDayRef = dayId;
    startActiveWorkout(session);
    return;
  }

  localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
  saveUserDataToCloud();
  renderPlanUI();
};

// Active Workout Session Manager
function startActiveWorkout(session) {
  const currentWeek = session.weekNum || 1;
  const scheme = userSettings.progressionScheme || "linear";
  const mobility = generateTargetedMobility(session.exercises);

  activeWorkout = {
    ...session,
    startTime: new Date().toISOString(),
    warmups: mobility.warmups,
    cooldowns: mobility.cooldowns,
    logs: session.exercises.map(ex => {
      const exKey = ex.id || ex.name;
      const historyRecord = exerciseHistory[exKey];

      const sets = [];
      for (let i = 0; i < 3; i++) {
        const target = calculateProgressionSetTargets(ex, scheme, currentWeek, i);
        
        let suggestIncrease = false;
        if (historyRecord && historyRecord.sets && historyRecord.sets.length > 0) {
          const topRepsReached = historyRecord.sets.every(s => (s.reps || 0) >= target.reps);
          if (topRepsReached && scheme === "linear") {
            suggestIncrease = true;
          }
        }

        let defaultWeight = target.isBodyweight ? 0 : target.weight;
        if (historyRecord && historyRecord.sets && historyRecord.sets[i]) {
          defaultWeight = suggestIncrease ? (historyRecord.sets[i].weight || defaultWeight) + 5 : (historyRecord.sets[i].weight || defaultWeight);
        }

        sets.push({
          reps: target.reps,
          weight: defaultWeight,
          completed: false,
          label: target.label,
          targetPct: target.pct ? `${target.pct}%` : null,
          suggestIncrease
        });
      }

      return {
        id: ex.id || ex.name,
        name: ex.name,
        supersetGroup: ex.supersetGroup || null,
        lastRecord: historyRecord || null,
        sets
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

  // Render Warm-ups at top
  const warmupContainer = document.getElementById("active-warmup-container");
  if (warmupContainer && activeWorkout.warmups && activeWorkout.warmups.length > 0) {
    warmupContainer.innerHTML = `
      <div class="mobility-card metal-subcard">
        <h4 style="color: var(--accent-gold); font-size: 0.85rem; margin-bottom: 6px;">🔥 TARGETED DYNAMIC WARM-UP</h4>
        ${activeWorkout.warmups.map(w => `
          <div class="mobility-item">
            <div style="display:flex; justify-content:space-between;"><span class="mobility-title">${w.name}</span><span class="mobility-duration">${w.duration}</span></div>
            <div class="mobility-desc">${w.desc}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // Render Exercise Cards in middle
  const container = document.getElementById("active-exercise-container");
  container.innerHTML = activeWorkout.logs.map((ex, exIdx) => {
    const hasSuggestedIncrease = ex.sets.some(s => s.suggestIncrease);
    let increaseBadge = hasSuggestedIncrease ? `<span class="badge-suggested-weight">🚀 +5 lbs Suggested</span>` : "";

    return `
      <div class="exercise-card margin-top">
        <div class="exercise-card-header" style="display:flex; justify-content:space-between; align-items:center;">
          <h5>${ex.name} ${ex.sets[0]?.label ? `<small style="font-size: 0.75rem; color: var(--accent-silver);">(${ex.sets[0].label})</small>` : ''}</h5>
          ${increaseBadge}
        </div>
        ${ex.supersetGroup ? `<div class="superset-badge margin-top">${ex.supersetGroup}</div>` : ""}
        <div class="sets-table margin-top">
          ${ex.sets.map((set, setIdx) => `
            <div class="set-row ${set.completed ? 'completed-set' : ''}" style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;">
              <span>Set ${setIdx + 1}</span>
              <div>
                <input type="number" value="${set.weight}" style="width: 65px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'weight', this.value)"> lbs
                <input type="number" value="${set.reps}" style="width: 55px; margin-left:4px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'reps', this.value)"> reps
              </div>
              <label class="set-check-label" style="font-size: 12px; cursor: pointer;">
                <input type="checkbox" ${set.completed ? 'checked' : ''} onchange="toggleSetComplete(${exIdx},${setIdx}, this.checked)"> DONE
              </label>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  // Render Cool-downs at bottom
  const cooldownContainer = document.getElementById("active-cooldown-container");
  if (cooldownContainer && activeWorkout.cooldowns && activeWorkout.cooldowns.length > 0) {
    cooldownContainer.innerHTML = `
      <div class="mobility-card metal-subcard">
        <h4 style="color: var(--accent-silver); font-size: 0.85rem; margin-bottom: 6px;">🧘 SPECIFIC COOL-DOWN STRETCHES</h4>
        ${activeWorkout.cooldowns.map(c => `
          <div class="mobility-item">
            <div style="display:flex; justify-content:space-between;"><span class="mobility-title">${c.name}</span><span class="mobility-duration">${c.duration}</span></div>
            <div class="mobility-desc">${c.desc}</div>
          </div>
        `).join("")}
      </div>
    `;
  }
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
      if (s.weight >= maxWeight) { maxWeight = s.weight; maxReps = s.reps; }
    });

    exerciseHistory[exKey] = {
      lastWeight: maxWeight || ex.sets[0]?.weight || 0,
      lastReps: maxReps || ex.sets[0]?.reps || 0,
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })),
      lastUpdated: new Date().toLocaleDateString()
    };

    return { name: ex.name, sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps })), exerciseVolume: exVolume };
  });

  localStorage.setItem("gymbro_exercise_history", JSON.stringify(exerciseHistory));

  if (activeWorkout.planDayRef && activePlan) {
    activePlan.weeks.forEach(w => {
      w.days.forEach(d => { if (d.id === activeWorkout.planDayRef) d.completed = true; });
    });
    localStorage.setItem(getPlanStorageKey(), JSON.stringify(activePlan));
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
  document.getElementById("sticky-timer-bar").classList.add("hidden");
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
        <div class="history-volume-badge" style="background: rgba(255, 215, 0, 0.15); color: var(--accent-gold); padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 13px;">
          ${(item.totalVolume || 0).toLocaleString()} lbs
        </div>
      </div>
      <div id="card_details_${item.id}" class="history-card-body hidden" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.1);">
        ${item.exercises ? item.exercises.map(ex => `
          <div class="history-exercise-block" style="margin-bottom: 6px;">
            <div class="history-exercise-name" style="color: var(--accent-gold); font-size: 13px; font-weight: 600;">${ex.name}</div>
            <div class="history-sets-summary" style="color: #94a3b8; font-size: 11px;">
              ${ex.sets ? ex.sets.map((s, idx) => `Set ${idx + 1}: ${s.weight} lbs × ${s.reps} reps`).join(" | ") : ""}
            </div>
          </div>
        `).join("") : ''}
      </div>
    </div>
  `).join("");
}

window.toggleHistoryCardDetails = function(cardId) {
  const el = document.getElementById(`card_details_${cardId}`);
  if (el) el.classList.toggle("hidden");
};
