import './style.css';
import { PLANES } from './data/planes.js';
import { LEVELS } from './data/levels.js';
import { QUESTIONS } from './data/questions.js';
import { SoundManager } from './audio/SoundManager.js';
import { GameEngine } from './game/GameEngine.js';

const STORAGE_KEY = 'gokyuzu_kanatlari_save_v1';
const MAX_LIVES = 3;
const QUIZ_SECONDS = 20;

const sound = new SoundManager();

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const data = JSON.parse(raw);
    return {
      totalStars: Math.max(0, Number(data.totalStars) || 0),
      highestUnlockedPlane: Math.min(5, Math.max(1, Number(data.highestUnlockedPlane) || 1)),
      selectedPlaneId: Math.min(5, Math.max(1, Number(data.selectedPlaneId) || 1)),
      highestUnlockedLevel: Math.min(5, Math.max(1, Number(data.highestUnlockedLevel) || 1)),
      completedLevels: Array.isArray(data.completedLevels) ? data.completedLevels : []
    };
  } catch {
    return {
      totalStars: 0,
      highestUnlockedPlane: 1,
      selectedPlaneId: 1,
      highestUnlockedLevel: 1,
      completedLevels: []
    };
  }
}

const state = loadSave();
if (state.selectedPlaneId > state.highestUnlockedPlane) {
  state.selectedPlaneId = state.highestUnlockedPlane;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

// Runtime session variables
let selectedLevelId = state.highestUnlockedLevel;
let inspectedPlaneId = state.selectedPlaneId;
let currentLives = MAX_LIVES;
let currentLevelStars = 0;
let questionDeck = [];
let quizTimerInterval = null;
let quizAnswered = false;

// DOM Elements
const canvas = document.getElementById('game-canvas');
const hud = document.getElementById('hud');
const hudLives = document.getElementById('hud-lives');
const hudLevelBadge = document.getElementById('hud-level-badge');
const hudPlaneName = document.getElementById('hud-plane-name');
const hudLevelName = document.getElementById('hud-level-name');
const hudDistance = document.getElementById('hud-distance');
const hudProgressFill = document.getElementById('hud-progress-fill');
const hudLevelStars = document.getElementById('hud-level-stars');
const hudTotalStars = document.getElementById('hud-total-stars');
const hudSpeed = document.getElementById('hud-speed');
const hudBoostFill = document.getElementById('hud-boost-fill');

const menuScreen = document.getElementById('menu-screen');
const levelGrid = document.getElementById('level-grid');

const hangarScreen = document.getElementById('hangar-screen');
const hangarTotalStars = document.getElementById('hangar-total-stars');
const planeListEl = document.getElementById('plane-list');
const detailName = document.getElementById('detail-name');
const detailSubtitle = document.getElementById('detail-subtitle');
const detailDesc = document.getElementById('detail-desc');
const detailStatusBadge = document.getElementById('detail-status-badge');
const statSpeed = document.getElementById('stat-speed');
const statManeuver = document.getElementById('stat-maneuver');
const statMagnet = document.getElementById('stat-magnet');
const statPower = document.getElementById('stat-power');
const btnPlaneAction = document.getElementById('btn-plane-action');

const quizModal = document.getElementById('quiz-modal');
const quizQuestion = document.getElementById('quiz-question');
const quizOptions = document.getElementById('quiz-options');
const quizFeedback = document.getElementById('quiz-feedback');
const quizTimerFill = document.getElementById('quiz-timer-fill');

const pauseModal = document.getElementById('pause-modal');
const completeModal = document.getElementById('complete-modal');
const completeTitle = document.getElementById('complete-title');
const completeSubtitle = document.getElementById('complete-subtitle');
const completeCollected = document.getElementById('complete-collected');
const completeBonus = document.getElementById('complete-bonus');
const completeTotal = document.getElementById('complete-total');
const completeUnlockHint = document.getElementById('complete-unlock-hint');
const btnNextLevel = document.getElementById('btn-next-level');

const gameoverModal = document.getElementById('gameover-modal');
const gameoverCollected = document.getElementById('gameover-collected');
const gameoverTotal = document.getElementById('gameover-total');

const btnMute = document.getElementById('btn-mute');
const btnMenuMute = document.getElementById('btn-menu-mute');

function getPlaneById(id) {
  return PLANES.find((p) => p.id === id) || PLANES[0];
}

function getLevelById(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

// Initialize Three.js Engine
const engine = new GameEngine(canvas, {
  onStarCollected(levelStars) {
    currentLevelStars = levelStars;
    state.totalStars += 1;
    saveState();
    sound.playStar();
    hudLevelStars.textContent = String(currentLevelStars);
    hudTotalStars.textContent = String(state.totalStars);
  },
  onObstacleHit() {
    sound.playHit();
    openQuizModal();
  },
  onProgress({ progress, distance, goal, speedKmh, boostEnergy }) {
    hudProgressFill.style.width = `${(progress * 100).toFixed(1)}%`;
    hudDistance.textContent = `${distance} / ${goal} m`;
    hudSpeed.textContent = String(speedKmh);
    hudBoostFill.style.width = `${boostEnergy.toFixed(0)}%`;
  },
  onLevelComplete(levelStars) {
    handleLevelComplete(levelStars);
  },
  onTogglePause() {
    togglePause();
  },
  onBoostStart() {
    sound.playBoost();
  }
});

// ==================== UI RENDERING ====================
function renderLives() {
  hudLives.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const span = document.createElement('span');
    span.className = 'heart' + (i >= currentLives ? ' lost' : '');
    span.textContent = '❤️';
    hudLives.appendChild(span);
  }
}

function renderMenu() {
  const levelEmojis = { 1: '🏝️', 2: '🏜️', 3: '❄️', 4: '🌋', 5: '🌌' };
  levelGrid.innerHTML = '';
  for (const lvl of LEVELS) {
    const unlocked = lvl.id <= state.highestUnlockedLevel;
    const completed = state.completedLevels.includes(lvl.id);
    const btn = document.createElement('button');
    btn.className = `level-card theme-${lvl.id}`;
    if (!unlocked) btn.classList.add('locked');
    if (lvl.id === selectedLevelId) btn.classList.add('selected');
    btn.disabled = !unlocked;

    const statusIcon = !unlocked ? '🔒' : completed ? '✅' : '⭐';
    btn.innerHTML = `
      <span class="level-status">${statusIcon}</span>
      <span class="level-emoji">${levelEmojis[lvl.id] || '✈️'}</span>
      <span class="level-num">Seviye ${lvl.id}</span>
      <span class="level-name">${lvl.name}</span>
      <span class="level-meta">+${lvl.completionBonus} ⭐ ödül</span>
    `;
    btn.addEventListener('click', () => {
      if (!unlocked) return;
      selectedLevelId = lvl.id;
      engine.applyLevelTheme(lvl);
      renderMenu();
    });
    levelGrid.appendChild(btn);
  }
}

function renderHangar() {
  hangarTotalStars.textContent = String(state.totalStars);
  planeListEl.innerHTML = '';

  for (const plane of PLANES) {
    const isOwned = plane.level <= state.highestUnlockedPlane;
    const isEquipped = plane.id === state.selectedPlaneId;
    const isNextUnlockable = plane.level === state.highestUnlockedPlane + 1;

    const item = document.createElement('button');
    item.className = 'plane-item' + (plane.id === inspectedPlaneId ? ' inspected' : '');

    let tagHtml = '';
    if (isEquipped) {
      tagHtml = `<span class="plane-tag tag-equipped">✓ Seçili</span>`;
    } else if (isOwned) {
      tagHtml = `<span class="plane-tag tag-owned">Açık</span>`;
    } else if (isNextUnlockable) {
      tagHtml = `<span class="plane-tag tag-unlockable">🔓 ${plane.cost} ⭐</span>`;
    } else {
      tagHtml = `<span class="plane-tag tag-locked">🔒 Kilitli</span>`;
    }

    item.innerHTML = `
      <div class="plane-item-left">
        <span class="plane-item-title">Sv.${plane.level} — ${plane.name}</span>
        <span class="plane-item-sub">${plane.subtitle.split('•')[1]?.trim() || ''}</span>
      </div>
      ${tagHtml}
    `;

    item.addEventListener('click', () => {
      inspectedPlaneId = plane.id;
      engine.setPlane(plane);
      renderHangar();
    });
    planeListEl.appendChild(item);
  }

  // Detail card for inspected plane
  const inspected = getPlaneById(inspectedPlaneId);
  const isOwned = inspected.level <= state.highestUnlockedPlane;
  const isEquipped = inspected.id === state.selectedPlaneId;
  const isNextUnlockable = inspected.level === state.highestUnlockedPlane + 1;
  const canAfford = state.totalStars >= inspected.cost;

  detailName.textContent = inspected.name;
  detailSubtitle.textContent = inspected.subtitle;
  detailDesc.textContent = inspected.description;

  statSpeed.style.width = `${inspected.stats.speed}%`;
  statManeuver.style.width = `${inspected.stats.maneuver}%`;
  statMagnet.style.width = `${inspected.stats.magnet}%`;
  statPower.style.width = `${inspected.stats.power}%`;

  btnPlaneAction.className = 'btn btn-full';
  btnPlaneAction.disabled = false;

  if (isEquipped) {
    detailStatusBadge.textContent = 'Aktif Uçak';
    btnPlaneAction.textContent = '✓ Şu An Kullanılıyor';
    btnPlaneAction.classList.add('btn-ghost');
    btnPlaneAction.disabled = true;
  } else if (isOwned) {
    detailStatusBadge.textContent = 'Kilidi Açık';
    btnPlaneAction.textContent = '✈️ Bu Uçağı Seç';
    btnPlaneAction.classList.add('btn-primary');
  } else if (isNextUnlockable) {
    detailStatusBadge.textContent = `Gerekli: ${inspected.cost} ⭐`;
    if (canAfford) {
      btnPlaneAction.textContent = `🔓 Kilidi Aç (${inspected.cost} ⭐)`;
      btnPlaneAction.classList.add('btn-success');
    } else {
      const missing = inspected.cost - state.totalStars;
      btnPlaneAction.textContent = `⭐ ${missing} Yıldız Daha Gerekli (${inspected.cost} ⭐)`;
      btnPlaneAction.classList.add('btn-secondary');
      btnPlaneAction.disabled = true;
    }
  } else {
    detailStatusBadge.textContent = 'Kilitli';
    btnPlaneAction.textContent = `🔒 Önce Seviye ${inspected.level - 1} Uçağını Aç`;
    btnPlaneAction.classList.add('btn-ghost');
    btnPlaneAction.disabled = true;
  }
}

function handlePlaneActionClick() {
  const inspected = getPlaneById(inspectedPlaneId);
  const isOwned = inspected.level <= state.highestUnlockedPlane;
  const isNextUnlockable = inspected.level === state.highestUnlockedPlane + 1;

  if (isOwned) {
    state.selectedPlaneId = inspected.id;
    saveState();
    sound.playStar();
    renderHangar();
    return;
  }

  if (isNextUnlockable && state.totalStars >= inspected.cost) {
    state.totalStars -= inspected.cost;
    state.highestUnlockedPlane = inspected.level;
    state.selectedPlaneId = inspected.id;
    saveState();
    sound.playUpgrade();
    renderHangar();
  }
}

// ==================== SCREEN NAVIGATION ====================
function hideAllOverlays() {
  menuScreen.classList.add('hidden');
  hangarScreen.classList.add('hidden');
  quizModal.classList.add('hidden');
  pauseModal.classList.add('hidden');
  completeModal.classList.add('hidden');
  gameoverModal.classList.add('hidden');
}

function showMenu() {
  clearQuizTimer();
  hideAllOverlays();
  hud.classList.add('hidden');
  menuScreen.classList.remove('hidden');

  const lvl = getLevelById(selectedLevelId);
  const plane = getPlaneById(state.selectedPlaneId);
  engine.applyLevelTheme(lvl);
  engine.setPlane(plane);
  engine.setMode('menu');
  renderMenu();
}

function showHangar() {
  clearQuizTimer();
  hideAllOverlays();
  hud.classList.add('hidden');
  hangarScreen.classList.remove('hidden');

  inspectedPlaneId = state.selectedPlaneId;
  engine.setPlane(getPlaneById(inspectedPlaneId));
  engine.setMode('hangar');
  renderHangar();
}

function startFlight(levelId = selectedLevelId) {
  clearQuizTimer();
  hideAllOverlays();

  selectedLevelId = levelId;
  const levelCfg = getLevelById(levelId);
  const planeCfg = getPlaneById(state.selectedPlaneId);

  currentLives = MAX_LIVES;
  currentLevelStars = 0;

  hud.classList.remove('hidden');
  hudLevelBadge.textContent = `Seviye ${levelCfg.id}`;
  hudPlaneName.textContent = planeCfg.name;
  hudLevelName.textContent = levelCfg.name;
  hudDistance.textContent = `0 / ${levelCfg.distanceGoal} m`;
  hudProgressFill.style.width = '0%';
  hudLevelStars.textContent = '0';
  hudTotalStars.textContent = String(state.totalStars);
  renderLives();

  engine.startLevel(levelCfg, planeCfg);
}

function togglePause() {
  if (engine.mode === 'playing') {
    engine.mode = 'paused';
    pauseModal.classList.remove('hidden');
  } else if (engine.mode === 'paused') {
    pauseModal.classList.add('hidden');
    engine.mode = 'playing';
  }
}

// ==================== OBSTACLE QUIZ SYSTEM ====================
function refillQuestionDeck() {
  questionDeck = QUESTIONS.map((_, i) => i);
  // Fisher-Yates shuffle so all 160 questions come in completely random order
  for (let i = questionDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questionDeck[i], questionDeck[j]] = [questionDeck[j], questionDeck[i]];
  }
}

function pickQuestion() {
  if (questionDeck.length === 0) {
    refillQuestionDeck();
  }
  return QUESTIONS[questionDeck.pop()];
}

function clearQuizTimer() {
  if (quizTimerInterval) {
    clearInterval(quizTimerInterval);
    quizTimerInterval = null;
  }
}

function openQuizModal() {
  const q = pickQuestion();
  quizAnswered = false;
  quizQuestion.textContent = q.question;
  quizFeedback.className = 'quiz-feedback hidden';
  quizFeedback.textContent = '';
  quizOptions.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  q.options.forEach((optText, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.innerHTML = `<span class="opt-letter">${letters[idx]}</span><span>${optText}</span>`;
    btn.addEventListener('click', () => resolveQuizAnswer(idx === q.correct, idx, q.correct));
    quizOptions.appendChild(btn);
  });

  quizTimerFill.style.width = '100%';
  quizModal.classList.remove('hidden');

  const startedAt = performance.now();
  clearQuizTimer();
  quizTimerInterval = setInterval(() => {
    if (quizAnswered) {
      clearQuizTimer();
      return;
    }
    const elapsedSec = (performance.now() - startedAt) / 1000;
    const remainRatio = Math.max(0, 1 - elapsedSec / QUIZ_SECONDS);
    quizTimerFill.style.width = `${(remainRatio * 100).toFixed(1)}%`;
    if (remainRatio <= 0) {
      resolveQuizAnswer(false, -1, q.correct, true);
    }
  }, 80);
}

function resolveQuizAnswer(isCorrect, chosenIdx, correctIdx, timedOut = false) {
  if (quizAnswered) return;
  quizAnswered = true;
  clearQuizTimer();

  const optionBtns = quizOptions.querySelectorAll('.quiz-option');
  optionBtns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIdx) btn.classList.add('correct');
    else if (i === chosenIdx && !isCorrect) btn.classList.add('wrong');
  });

  quizFeedback.classList.remove('hidden');

  if (isCorrect) {
    sound.playCorrect();
    quizFeedback.className = 'quiz-feedback ok';
    quizFeedback.textContent = '🛡️ Doğru Cevap! Canın gitmedi, uçuşa devam!';
    setTimeout(() => {
      quizModal.classList.add('hidden');
      engine.resumeAfterQuiz(true);
    }, 1150);
  } else {
    sound.playWrong();
    currentLives = Math.max(0, currentLives - 1);
    renderLives();
    quizFeedback.className = 'quiz-feedback fail';
    quizFeedback.textContent = timedOut
      ? `⏱️ Süre Doldu! 1 Can kaybettin (Kalan: ${currentLives})`
      : `💔 Yanlış Cevap! 1 Can kaybettin (Kalan: ${currentLives})`;

    setTimeout(() => {
      quizModal.classList.add('hidden');
      if (currentLives <= 0) {
        handleGameOver();
      } else {
        engine.resumeAfterQuiz(false);
      }
    }, 1400);
  }
}

// ==================== END SCREENS ====================
function handleLevelComplete(levelStars) {
  sound.playLevelComplete();
  const levelCfg = getLevelById(selectedLevelId);
  const bonus = levelCfg.completionBonus;

  state.totalStars += bonus;
  if (!state.completedLevels.includes(levelCfg.id)) {
    state.completedLevels.push(levelCfg.id);
  }
  if (levelCfg.id < LEVELS.length && state.highestUnlockedLevel < levelCfg.id + 1) {
    state.highestUnlockedLevel = levelCfg.id + 1;
  }
  saveState();

  hudTotalStars.textContent = String(state.totalStars);
  completeTitle.textContent =
    levelCfg.id === LEVELS.length
      ? 'Tüm Seviyeleri Tamamladın!'
      : `Seviye ${levelCfg.id} Tamamlandı!`;
  completeSubtitle.textContent = `${levelCfg.name} başarıyla geçildi.`;
  completeCollected.textContent = `+${levelStars} ⭐`;
  completeBonus.textContent = `+${bonus} ⭐`;
  completeTotal.textContent = `${state.totalStars} ⭐`;

  // Check if next plane can now be unlocked
  const nextPlane = PLANES.find((p) => p.level === state.highestUnlockedPlane + 1);
  if (nextPlane && state.totalStars >= nextPlane.cost) {
    completeUnlockHint.classList.remove('hidden');
    completeUnlockHint.textContent = `✨ Harika! Hangar'da Seviye ${nextPlane.level} "${nextPlane.name}" uçağının kilidini açabilirsin!`;
  } else {
    completeUnlockHint.classList.add('hidden');
  }

  if (levelCfg.id < LEVELS.length) {
    btnNextLevel.classList.remove('hidden');
    btnNextLevel.textContent = `➡ Seviye ${levelCfg.id + 1}'e Geç`;
  } else {
    btnNextLevel.classList.add('hidden');
  }

  completeModal.classList.remove('hidden');
}

function handleGameOver() {
  engine.mode = 'ended';
  gameoverCollected.textContent = `+${currentLevelStars} ⭐`;
  gameoverTotal.textContent = `${state.totalStars} ⭐`;
  gameoverModal.classList.remove('hidden');
}

function updateMuteButtons() {
  const muted = sound.muted;
  btnMute.textContent = muted ? '🔇' : '🔊';
  btnMenuMute.textContent = muted ? '🔇 Ses Kapalı' : '🔊 Ses Açık';
}

// ==================== MOBILE TOUCH CONTROLS & LANDSCAPE SUPPORT ====================
const joystickZone = document.getElementById('touch-joystick');
const joystickKnob = document.getElementById('joystick-knob');
const btnTouchBoost = document.getElementById('btn-touch-boost');

let activeJoystickPointerId = null;
let joystickOrigin = { x: 0, y: 0 };
const MAX_JOY_DIST = 44;

function resetJoystick() {
  activeJoystickPointerId = null;
  if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  engine.setTouchInput(0, 0);
}

if (joystickZone && joystickKnob) {
  joystickZone.addEventListener('pointerdown', (e) => {
    if (activeJoystickPointerId !== null) return;
    e.preventDefault();
    activeJoystickPointerId = e.pointerId;
    joystickZone.setPointerCapture(e.pointerId);
    const rect = joystickZone.getBoundingClientRect();
    joystickOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    const dx = e.clientX - joystickOrigin.x;
    const dy = e.clientY - joystickOrigin.y;
    const dist = Math.min(MAX_JOY_DIST, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const ox = Math.cos(ang) * dist;
    const oy = Math.sin(ang) * dist;
    joystickKnob.style.transform = `translate(${ox}px, ${oy}px)`;
    engine.setTouchInput(ox / MAX_JOY_DIST, -oy / MAX_JOY_DIST);
  });

  joystickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activeJoystickPointerId) return;
    e.preventDefault();
    const dx = e.clientX - joystickOrigin.x;
    const dy = e.clientY - joystickOrigin.y;
    const dist = Math.min(MAX_JOY_DIST, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const ox = Math.cos(ang) * dist;
    const oy = Math.sin(ang) * dist;
    joystickKnob.style.transform = `translate(${ox}px, ${oy}px)`;
    engine.setTouchInput(ox / MAX_JOY_DIST, -oy / MAX_JOY_DIST);
  });

  const endJoy = (e) => {
    if (e.pointerId !== activeJoystickPointerId) return;
    resetJoystick();
  };
  joystickZone.addEventListener('pointerup', endJoy);
  joystickZone.addEventListener('pointercancel', endJoy);
}

if (btnTouchBoost) {
  btnTouchBoost.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btnTouchBoost.classList.add('active');
    engine.setTouchBoost(true);
  });
  const endBoost = () => {
    btnTouchBoost.classList.remove('active');
    engine.setTouchBoost(false);
  };
  btnTouchBoost.addEventListener('pointerup', endBoost);
  btnTouchBoost.addEventListener('pointercancel', endBoost);
  btnTouchBoost.addEventListener('pointerleave', endBoost);
}

// Auto-pause if a mobile device is rotated to portrait mid-flight
function handleOrientationCheck() {
  const isTouchPortrait =
    window.matchMedia('(pointer: coarse)').matches && window.innerHeight > window.innerWidth;
  if (isTouchPortrait && engine.mode === 'playing') {
    resetJoystick();
    engine.setTouchBoost(false);
    togglePause();
  }
}
window.addEventListener('resize', handleOrientationCheck);
window.addEventListener('orientationchange', handleOrientationCheck);

// Try locking to landscape on supported mobile browsers when flight starts
function tryLockLandscape() {
  if (window.matchMedia('(pointer: coarse)').matches && screen.orientation?.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

// ==================== BUTTON LISTENERS ====================
document.getElementById('btn-start-flight').addEventListener('click', () => {
  tryLockLandscape();
  startFlight(selectedLevelId);
});
document.getElementById('btn-open-hangar').addEventListener('click', showHangar);
document.getElementById('btn-close-hangar').addEventListener('click', showMenu);
btnPlaneAction.addEventListener('click', handlePlaneActionClick);

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-pause-restart').addEventListener('click', () => startFlight(selectedLevelId));
document.getElementById('btn-pause-menu').addEventListener('click', showMenu);

btnNextLevel.addEventListener('click', () => {
  const nextId = Math.min(LEVELS.length, selectedLevelId + 1);
  startFlight(nextId);
});
document.getElementById('btn-complete-hangar').addEventListener('click', showHangar);
document.getElementById('btn-complete-menu').addEventListener('click', showMenu);

document.getElementById('btn-retry').addEventListener('click', () => startFlight(selectedLevelId));
document.getElementById('btn-gameover-hangar').addEventListener('click', showHangar);
document.getElementById('btn-gameover-menu').addEventListener('click', showMenu);

btnMute.addEventListener('click', () => {
  sound.toggleMute();
  updateMuteButtons();
});
btnMenuMute.addEventListener('click', () => {
  sound.toggleMute();
  updateMuteButtons();
});

// Boot & Smooth Airplane Preloader
const preloaderEl = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloader-bar');
const preloaderStatus = document.getElementById('preloader-status');

function setPreloaderProgress(pct, text) {
  if (preloaderBar) preloaderBar.style.width = `${pct}%`;
  if (preloaderStatus && text) preloaderStatus.textContent = text;
}

const bootStart = performance.now();
setPreloaderProgress(42, 'Gökyüzü hazırlanıyor...');

updateMuteButtons();
showMenu();

setPreloaderProgress(82, 'Uçaklar hangardan çıkıyor...');

const fontsReady = document.fonts?.ready
  ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 850))])
  : Promise.resolve();

fontsReady.then(() => {
  const elapsed = performance.now() - bootStart;
  const remaining = Math.max(0, 750 - elapsed);
  setTimeout(() => {
    setPreloaderProgress(100, 'Kalkışa hazır!');
    setTimeout(() => {
      if (!preloaderEl) return;
      preloaderEl.classList.add('hidden');
      setTimeout(() => preloaderEl.remove(), 480);
    }, 220);
  }, remaining);
});
