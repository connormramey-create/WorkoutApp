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
let currentUser = null;
let isSignUpMode = false;

const DEFAULT_SETTINGS = {
  split: "upper_lower",
  duration: 45,
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

// Load exercises & merge custom user exercises
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
  // Remove previously merged custom exercises to prevent duplication
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

// Custom Exercise Management
function addCustomExercise() {
  const nameInput = document.getElementById("custom-ex-name");
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

// Workout Generator Logic
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

  let selected = [];

  if (userSettings.supersets) {
    const poolCopy = [...pool];
    let pairCount = 1;

    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const ex1Idx = Math.floor(Math.random() * poolCopy.length);
      const ex1 = poolCopy.splice(ex1Idx, 1)[0];
      const target1 = ex1.target.toLowerCase();
      
      ex1.supersetGroup = `SUPERSET ${pairCount} - A`;
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
        selected.push(ex2);
      } else if (poolCopy.length > 0) {
        const ex2Fallback = poolCopy.splice(0, 1)[0];
        ex2Fallback.supersetGroup = `SUPERSET ${pairCount} - B`;
        selected.push(ex2Fallback);
      }
      pairCount++;
    }
  } else {
    const poolCopy = [...pool];
    while (selected.length < exerciseCount && poolCopy.length > 0) {
      const idx = Math.floor(Math.random() * poolCopy.length);
      selected.push(poolCopy.splice(idx, 1)[0]);
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

// UI Event Handlers
function initEventListeners() {
  // Navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Auth Modal Listeners
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

  // Custom Exercise Creation Listener
  const addCustomBtn = document.getElementById("add-custom-ex-btn");
  if (addCustomBtn) {
    addCustomBtn.addEventListener("click", addCustomExercise);
  }

  // Settings Modal
  document.getElementById("open-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.remove("hidden");
  });
  document.getElementById("close-settings-btn").addEventListener("click", () => {
    document.getElementById("settings-modal").classList.add("hidden");
  });
  document.getElementById("save-settings-btn").addEventListener("click", saveSettingsUI);

  // CSV Export
  const exportBtn = document.getElementById("export-csv-btn");
  if (exportBtn) exportBtn.addEventListener("click", exportHistoryToCSV);

  // Generator
  document.getElementById("generate-workout-btn").addEventListener("click", () => {
    const session = generateWorkoutSession();
    renderGeneratedWorkout(session);
  });

  document.getElementById("start-workout-btn").addEventListener("click", () => {
    const sessionData = window.currentGeneratedSession;
    if (sessionData) startActiveWorkout(sessionData);
  });

  // Active Session Controls
  document.getElementById("resume-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.remove("hidden");
  });
  document.getElementById("minimize-workout-btn").addEventListener("click", () => {
    document.getElementById("active-workout-modal").classList.add("hidden");
  });
  document.getElementById("finish-workout-btn").addEventListener("click", finishActiveWorkout);

  // Multi-Month Plan
  document.getElementById("create-plan-btn").addEventListener("click", buildMultiMonthPlan);
  document.getElementById("reset-plan-btn").addEventListener("click", () => {
    if (confirm("Reset current program plan?")) {
      activePlan = null;
      localStorage.removeItem("gymbro_active_plan");
      saveUserDataToCloud();
      renderPlanUI();
    }
  });

  // Rest Timer Quick Buttons
  document.querySelectorAll(".timer-quick-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      startRestTimer(parseInt(btn.dataset.time, 10));
    });
  });
  document.getElementById("stop-timer-btn").addEventListener("click", () => {
    clearInterval(timerInterval);
    document.getElementById("rest-timer-display").innerText = "00:00";
  });
}

// Settings UI Management
function initSettingsUI() {
  document.getElementById("setting-split").value = userSettings.split;
  document.getElementById("setting-duration").value = userSettings.duration;
  document.getElementById("setting-supersets").checked = userSettings.supersets;

  const eqCheckboxes = document.querySelectorAll("#equipment-toggles input");
  eqCheckboxes.forEach(cb => {
    cb.checked = userSettings.equipment.includes(cb.value);
  });
}

function saveSettingsUI() {
  userSettings.split = document.getElementById("setting-split").value;
  userSettings.duration = parseInt(document.getElementById("setting-duration").value, 10);
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

// CSV Export Logic
function exportHistoryToCSV() {
  if (!workoutHistory || workoutHistory.length === 0) {
    alert("No logged workout history available to export.");
    return;
  }

  let csvContent = "Date,Workout Title,Exercises Completed\n";

  workoutHistory.forEach(row => {
    const safeTitle = `"${(row.title || "").replace(/"/g, '""')}"`;
    csvContent += `"${row.date || ''}",${safeTitle},${row.exerciseCount || 0}\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.href = url;
  downloadAnchor.download = `iron_bro_progress_log_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadAnchor.click();
  URL.revokeObjectURL(url);
}

// Render Generator View
function renderGeneratedWorkout(session) {
  window.currentGeneratedSession = session;
  document.getElementById("workout-title").innerText = session.title;
  document.getElementById("workout-meta").innerText = `${userSettings.duration} Mins | ${session.exercises.length} Exercises${userSettings.supersets ? " (Antagonistic Supersets)" : ""}`;

  const warmupUl = document.getElementById("warmup-list");
  warmupUl.innerHTML = session.warmups.map(w => `<li>${w}</li>`).join("");

  const cooldownUl = document.getElementById("cooldown-list");
  cooldownUl.innerHTML = session.cooldowns.map(c => `<li>${c}</li>`).join("");

  const exDiv = document.getElementById("exercise-list");
  exDiv.innerHTML = session.exercises.map(ex => `
    <div class="exercise-card">
      ${ex.supersetGroup ? `<div class="superset-badge">${ex.supersetGroup}</div>` : ""}
      <h5>${ex.name}${ex.isCustom ? ' <span class="tag" style="color:var(--accent-gold);">[CUSTOM]</span>' : ''}</h5>
      <div class="exercise-tags">
        <span class="tag">Target: ${ex.target}</span>
        <span class="tag">Equip: ${ex.equipment}</span>
        <span class="tag">Symmetry: ${ex.symmetry}</span>
        <span class="tag">Pattern: ${ex.movement_pattern}</span>
      </div>
    </div>
  `).join("");

  document.getElementById("generated-workout-view").classList.remove("hidden");
}

// Program Planning Logic
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

// Active Session Tracking & Exercise History Auto-Populate
function startActiveWorkout(session) {
  activeWorkout = {
    ...session,
    startTime: new Date().toISOString(),
    logs: session.exercises.map(ex => {
      const exKey = ex.id || ex.name;
      const historyRecord = exerciseHistory[exKey];

      let defaultSets = [
        { reps: 10, weight: 100 },
        { reps: 10, weight: 100 },
        { reps: 10, weight: 100 }
      ];

      if (historyRecord && historyRecord.sets && historyRecord.sets.length > 0) {
        defaultSets = historyRecord.sets.map(s => ({
          reps: s.reps || 10,
          weight: s.weight || 100
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
        lastBadge = `<div class="tag" style="background: #1e293b; color: var(--accent-gold); margin-bottom: 8px; border: 1px solid var(--accent-gold); display: inline-block;">
          LAST TIME: ${topWeight} lbs × ${topReps} reps
        </div>`;
      }
    }

    return `
      <div class="exercise-card margin-top">
        ${ex.supersetGroup ? `<div class="superset-badge">${ex.supersetGroup}</div>` : ""}
        <h5>${ex.name}</h5>
        ${lastBadge}
        <div class="sets-table">
          ${ex.sets.map((set, setIdx) => `
            <div class="day-row" style="padding: 5px 0;">
              <span>Set ${setIdx + 1}</span>
              <input type="number" value="${set.weight}" style="width: 70px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'weight', this.value)"> lbs
              <input type="number" value="${set.reps}" style="width: 60px;" class="metal-input" onchange="updateSetData(${exIdx},${setIdx}, 'reps', this.value)"> reps
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

function finishActiveWorkout() {
  if (!activeWorkout) return;

  activeWorkout.logs.forEach(ex => {
    const exKey = ex.id || ex.name;
    let maxWeight = 0;
    let maxReps = 0;

    ex.sets.forEach(s => {
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

  workoutHistory.unshift({
    title: activeWorkout.title,
    date: new Date().toLocaleDateString(),
    exerciseCount: activeWorkout.logs.length
  });

  localStorage.setItem("gymbro_history", JSON.stringify(workoutHistory));
  localStorage.removeItem("gymbro_active_session");

  saveUserDataToCloud();

  activeWorkout = null;
  document.getElementById("active-workout-modal").classList.add("hidden");
  checkActiveSession();
  renderHistoryUI();
  alert("Workout Completed & Logged!");
}

function renderHistoryUI() {
  const container = document.getElementById("history-list");
  if (workoutHistory.length === 0) {
    container.innerHTML = '<p class="empty-msg">No completed workouts logged yet.</p>';
    return;
  }

  container.innerHTML = workoutHistory.map(item => `
    <div class="day-row" style="background: #0f172a; margin-bottom: 8px; border-radius: 4px; border-left: 3px solid var(--accent-gold);">
      <div>
        <strong>${item.title}</strong><br>
        <small style="color: #cbd5e1;">${item.date} • ${item.exerciseCount} Exercises Completed</small>
      </div>
    </div>
  `).join("");
}

// Timer Logic
function startRestTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  const display = document.getElementById("rest-timer-display");

  const update = () => {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      display.innerText = "TIME UP!";
    }
    remaining--;
  };

  update();
  timerInterval = setInterval(update, 1000);
}
