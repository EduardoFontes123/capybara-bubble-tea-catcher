/* ========================================
   Capybara Bubble Tea Catcher - Game Logic
   Pure JavaScript, no frameworks
   ======================================== */

// ===== DOM References =====
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const gameArea = document.getElementById('game-area');
const capybara = document.getElementById('capybara');
const scoreEl = document.getElementById('score');
const heartsEl = document.getElementById('hearts');
const levelEl = document.getElementById('level');
const finalScoreEl = document.getElementById('final-score-value');
const finalLevelEl = document.getElementById('final-level');
const gameoverMsgEl = document.getElementById('gameover-message');
const effectsContainer = document.getElementById('effects-container');

// Mobile controls
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// ===== Game Constants =====
const CAPY_WIDTH = 70;
const CAPY_HEIGHT = 60;
const CAPY_SPEED = 6; // pixels per frame
const INITIAL_LIVES = 5;
const INITIAL_SPAWN_INTERVAL = 1200; // ms
const MIN_SPAWN_INTERVAL = 400; // ms
const INITIAL_FALL_SPEED = 2; // pixels per frame
const MAX_FALL_SPEED = 8;
const LEVEL_UP_SCORE = 50; // score per level
const ITEM_SIZE = 36; // approximate size of falling items

// ===== Item Definitions =====
const GOOD_ITEMS = [
    { emoji: '🥤', name: 'bubble tea', points: 15 },
    { emoji: '🔮', name: 'boba pearl', points: 10 },
    { emoji: '❤️', name: 'heart', points: 8 },
    { emoji: '🍓', name: 'strawberry', points: 12 },
    { emoji: '🍰', name: 'cake', points: 10 },
    { emoji: '🍮', name: 'pudding', points: 10 },
    { emoji: '🍡', name: 'dango', points: 12 },
    { emoji: '🌸', name: 'sakura', points: 5 },
    { emoji: '🍪', name: 'cookie', points: 8 },
    { emoji: '🍩', name: 'donut', points: 10 },
];

const BAD_ITEMS = [
    { emoji: '🌶️', name: 'hot pepper', damage: 1 },
    { emoji: '💣', name: 'bomb', damage: 1 },
    { emoji: '⛈️', name: 'storm cloud', damage: 1 },
    { emoji: '🍋', name: 'sour lemon', damage: 1 },
    { emoji: '💀', name: 'skull', damage: 2 },
    { emoji: '🦂', name: 'scorpion', damage: 1 },
    { emoji: '👻', name: 'ghost', damage: 1 },
];

// ===== Game Over Messages =====
const GAMEOVER_MESSAGES = [
    "The boba pearls will miss you! 🔮",
    "Even capybaras need a break~ 💤",
    "The milk tea gods shall await your return! 🍵",
    "You did your best, cute capybara! 🌸",
    "Time for a real bubble tea break! 🥤",
];

// ===== Game State =====
let state = {
    score: 0,
    lives: INITIAL_LIVES,
    level: 1,
    isRunning: false,
    isPaused: false,
    capyX: 0, // capybara X position
    items: [], // active falling items
    fallSpeed: INITIAL_FALL_SPEED,
    spawnInterval: INITIAL_SPAWN_INTERVAL,
    lastSpawnTime: 0,
    animFrameId: null,
    lastTime: 0,
    spawnTimerId: null,
    keysPressed: {},
    mobileLeft: false,
    mobileRight: false,
};

// ===== Audio System (Web Audio API) =====
let audioCtx = null;

/** Initialize AudioContext on first user interaction */
function initAudio() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            // Audio not supported, fail silently
            console.log('Web Audio API not available');
        }
    }
}

/** Play a short beep/tone */
function playSound(frequency, duration, type = 'sine', volume = 0.15) {
    if (!audioCtx) return;
    try {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + duration);
    } catch (e) {
        // Silently ignore audio errors
    }
}

/** Sound effects */
function playCatchSound() {
    playSound(880, 0.15, 'sine', 0.12);
    setTimeout(() => playSound(1100, 0.1, 'sine', 0.08), 80);
}

function playHurtSound() {
    playSound(200, 0.2, 'square', 0.1);
    setTimeout(() => playSound(150, 0.15, 'square', 0.08), 100);
}

function playGameOverSound() {
    playSound(440, 0.3, 'sine', 0.12);
    setTimeout(() => playSound(330, 0.3, 'sine', 0.1), 200);
    setTimeout(() => playSound(220, 0.5, 'sine', 0.08), 400);
}

function playLevelUpSound() {
    playSound(523, 0.15, 'sine', 0.1);
    setTimeout(() => playSound(659, 0.15, 'sine', 0.1), 100);
    setTimeout(() => playSound(784, 0.2, 'sine', 0.1), 200);
}

// ===== Screen Management =====
function showScreen(screen) {
    [startScreen, gameScreen, gameoverScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// ===== Game Initialization =====
function resetState() {
    state.score = 0;
    state.lives = INITIAL_LIVES;
    state.level = 1;
    state.isRunning = false;
    state.isPaused = false;
    state.items = [];
    state.fallSpeed = INITIAL_FALL_SPEED;
    state.spawnInterval = INITIAL_SPAWN_INTERVAL;
    state.lastSpawnTime = 0;
    state.lastTime = 0;
    state.keysPressed = {};
    state.mobileLeft = false;
    state.mobileRight = false;

    // Cancel any running loops/timers
    if (state.animFrameId) {
        cancelAnimationFrame(state.animFrameId);
        state.animFrameId = null;
    }
    if (state.spawnTimerId) {
        clearInterval(state.spawnTimerId);
        state.spawnTimerId = null;
    }
}

function startGame() {
    initAudio();
    resetState();

    // Clear old items from DOM
    const oldItems = gameArea.querySelectorAll('.falling-item');
    oldItems.forEach(el => el.remove());

    // Remove any lingering effects
    const effects = effectsContainer.querySelectorAll('*');
    effects.forEach(el => el.remove());

    // Reset capybara position to center
    const areaWidth = gameArea.clientWidth;
    state.capyX = (areaWidth - CAPY_WIDTH) / 2;
    capybara.style.left = state.capyX + 'px';
    capybara.classList.remove('hit', 'happy');

    // Update HUD
    updateHUD();

    // Show game screen
    showScreen(gameScreen);

    // Start game loop
    state.isRunning = true;
    state.lastTime = performance.now();
    state.lastSpawnTime = performance.now();
    state.animFrameId = requestAnimationFrame(gameLoop);
}

// ===== HUD Updates =====
function updateHUD() {
    scoreEl.textContent = state.score;
    levelEl.textContent = state.level;
    
    // Render hearts
    let heartsStr = '';
    for (let i = 0; i < INITIAL_LIVES; i++) {
        heartsStr += i < state.lives ? '❤️' : '🖤';
    }
    heartsEl.textContent = heartsStr;
}

// ===== Difficulty Scaling =====
function updateDifficulty() {
    const newLevel = Math.floor(state.score / LEVEL_UP_SCORE) + 1;
    if (newLevel > state.level) {
        state.level = newLevel;
        playLevelUpSound();
        // Show level up effect
        showFloatText(gameArea.clientWidth / 2, gameArea.clientHeight / 2, `⭐ Level ${newLevel}!`, 'good');
    }

    // Increase fall speed gradually
    state.fallSpeed = Math.min(
        MAX_FALL_SPEED,
        INITIAL_FALL_SPEED + (state.level - 1) * 0.4
    );

    // Decrease spawn interval (faster spawning)
    state.spawnInterval = Math.max(
        MIN_SPAWN_INTERVAL,
        INITIAL_SPAWN_INTERVAL - (state.level - 1) * 80
    );
}

// ===== Item Spawning =====
function spawnItem() {
    if (!state.isRunning) return;

    const areaWidth = gameArea.clientWidth;
    // 65% chance good item, 35% chance bad item
    const isGood = Math.random() < 0.65;
    const itemPool = isGood ? GOOD_ITEMS : BAD_ITEMS;
    const itemData = itemPool[Math.floor(Math.random() * itemPool.length)];

    // Create DOM element
    const el = document.createElement('div');
    el.className = `falling-item ${isGood ? 'good' : 'bad'}`;
    el.textContent = itemData.emoji;

    // Random X position (keep within bounds)
    const x = Math.random() * (areaWidth - ITEM_SIZE);
    el.style.left = x + 'px';
    el.style.top = '-40px';

    gameArea.appendChild(el);

    // Track in state
    const item = {
        el: el,
        x: x,
        y: -40,
        isGood: isGood,
        data: itemData,
        speed: state.fallSpeed + (Math.random() * 0.8 - 0.4), // slight speed variation
    };
    state.items.push(item);
}

// ===== Collision Detection =====
function checkCollision(item) {
    // Simple AABB collision
    const capyLeft = state.capyX;
    const capyRight = state.capyX + CAPY_WIDTH;
    const capyTop = gameArea.clientHeight - CAPY_HEIGHT - 10;
    const capyBottom = gameArea.clientHeight - 10;

    const itemLeft = item.x;
    const itemRight = item.x + ITEM_SIZE;
    const itemTop = item.y;
    const itemBottom = item.y + ITEM_SIZE;

    return (
        capyLeft < itemRight &&
        capyRight > itemLeft &&
        capyTop < itemBottom &&
        capyBottom > itemTop
    );
}

// ===== Visual Effects =====
function showFloatText(x, y, text, type) {
    const el = document.createElement('div');
    el.className = `float-text ${type}`;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    gameArea.appendChild(el);

    // Remove after animation
    setTimeout(() => el.remove(), 1000);
}

function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.background = color;

        // Random direction
        const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const distance = 30 + Math.random() * 30;
        const dx = Math.cos(angle) * distance;
        const dy = Math.sin(angle) * distance;
        particle.style.setProperty('--dx', dx + 'px');
        particle.style.setProperty('--dy', dy + 'px');

        gameArea.appendChild(particle);
        setTimeout(() => particle.remove(), 600);
    }
}

function flashScreen(type) {
    gameArea.classList.remove('flash-good', 'flash-bad');
    // Force reflow
    void gameArea.offsetWidth;
    gameArea.classList.add(type === 'good' ? 'flash-good' : 'flash-bad');
    setTimeout(() => gameArea.classList.remove('flash-good', 'flash-bad'), 300);
}

// ===== Input Handling =====

// Keyboard
document.addEventListener('keydown', (e) => {
    state.keysPressed[e.key] = true;
    
    // Prevent page scroll with arrow keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    state.keysPressed[e.key] = false;
});

// Mobile controls
btnLeft.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.mobileLeft = true;
});
btnLeft.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.mobileLeft = false;
});
btnLeft.addEventListener('mousedown', () => state.mobileLeft = true);
btnLeft.addEventListener('mouseup', () => state.mobileLeft = false);
btnLeft.addEventListener('mouseleave', () => state.mobileLeft = false);

btnRight.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.mobileRight = true;
});
btnRight.addEventListener('touchend', (e) => {
    e.preventDefault();
    state.mobileRight = false;
});
btnRight.addEventListener('mousedown', () => state.mobileRight = true);
btnRight.addEventListener('mouseup', () => state.mobileRight = false);
btnRight.addEventListener('mouseleave', () => state.mobileRight = false);

// Touch on game area (left/right half)
gameArea.addEventListener('touchstart', (e) => {
    if (!state.isRunning) return;
    const touch = e.touches[0];
    const areaRect = gameArea.getBoundingClientRect();
    const touchX = touch.clientX - areaRect.left;
    
    if (touchX < areaRect.width / 2) {
        state.mobileLeft = true;
    } else {
        state.mobileRight = true;
    }
});

gameArea.addEventListener('touchend', () => {
    state.mobileLeft = false;
    state.mobileRight = false;
});

gameArea.addEventListener('touchcancel', () => {
    state.mobileLeft = false;
    state.mobileRight = false;
});

/** Process input and update capybara position */
function processInput() {
    const areaWidth = gameArea.clientWidth;
    let moving = false;

    // Left movement
    if (state.keysPressed['ArrowLeft'] || state.keysPressed['a'] || state.keysPressed['A'] || state.mobileLeft) {
        state.capyX -= CAPY_SPEED;
        moving = true;
    }

    // Right movement
    if (state.keysPressed['ArrowRight'] || state.keysPressed['d'] || state.keysPressed['D'] || state.mobileRight) {
        state.capyX += CAPY_SPEED;
        moving = true;
    }

    // Clamp position within game area
    state.capyX = Math.max(0, Math.min(areaWidth - CAPY_WIDTH, state.capyX));

    // Update DOM
    capybara.style.left = state.capyX + 'px';
}

// ===== Item Handling =====
function handleItemCatch(item) {
    if (item.isGood) {
        // Good item caught!
        state.score += item.data.points;
        playCatchSound();
        flashScreen('good');
        showFloatText(item.x, item.y, `+${item.data.points}`, 'good');
        spawnParticles(item.x + ITEM_SIZE / 2, item.y + ITEM_SIZE / 2, '#FFB6C1', 5);

        // Happy animation on capybara
        capybara.classList.remove('happy');
        void capybara.offsetWidth;
        capybara.classList.add('happy');
        setTimeout(() => capybara.classList.remove('happy'), 300);

        updateDifficulty();
    } else {
        // Bad item hit!
        const damage = item.data.damage || 1;
        state.lives = Math.max(0, state.lives - damage);
        playHurtSound();
        flashScreen('bad');
        showFloatText(item.x, item.y, damage > 1 ? `-${damage} 💔` : '-1 💔', 'bad');
        spawnParticles(item.x + ITEM_SIZE / 2, item.y + ITEM_SIZE / 2, '#FF6B6B', 6);

        // Shake animation on capybara
        capybara.classList.remove('hit');
        void capybara.offsetWidth;
        capybara.classList.add('hit');
        setTimeout(() => capybara.classList.remove('hit'), 400);

        // Check game over
        if (state.lives <= 0) {
            gameOver();
            return;
        }
    }

    updateHUD();
}

// ===== Game Over =====
function gameOver() {
    state.isRunning = false;
    playGameOverSound();

    // Cancel animation frame
    if (state.animFrameId) {
        cancelAnimationFrame(state.animFrameId);
        state.animFrameId = null;
    }

    // Show game over screen with a short delay
    setTimeout(() => {
        finalScoreEl.textContent = state.score;
        finalLevelEl.textContent = `You reached Level ${state.level}!`;
        
        // Random cute message
        const msg = GAMEOVER_MESSAGES[Math.floor(Math.random() * GAMEOVER_MESSAGES.length)];
        gameoverMsgEl.textContent = msg;

        showScreen(gameoverScreen);
    }, 500);
}

// ===== Main Game Loop =====
function gameLoop(timestamp) {
    if (!state.isRunning) return;

    const deltaTime = timestamp - state.lastTime;
    state.lastTime = timestamp;

    // Process input
    processInput();

    // Spawn items based on interval
    if (timestamp - state.lastSpawnTime >= state.spawnInterval) {
        spawnItem();
        state.lastSpawnTime = timestamp;
    }

    // Update falling items
    const areaHeight = gameArea.clientHeight;
    const itemsToRemove = [];

    for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];

        // Move item down
        item.y += item.speed;
        item.el.style.top = item.y + 'px';

        // Check collision with capybara
        if (checkCollision(item)) {
            handleItemCatch(item);
            item.el.remove();
            state.items.splice(i, 1);
            continue;
        }

        // Check if item fell off screen
        if (item.y > areaHeight + 40) {
            item.el.remove();
            state.items.splice(i, 1);
        }
    }

    // Continue loop
    state.animFrameId = requestAnimationFrame(gameLoop);
}

// ===== Event Listeners =====
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Handle window resize - reposition capybara
window.addEventListener('resize', () => {
    if (state.isRunning) {
        const areaWidth = gameArea.clientWidth;
        state.capyX = Math.min(state.capyX, areaWidth - CAPY_WIDTH);
        capybara.style.left = state.capyX + 'px';
    }
});

// Prevent context menu on long press (mobile)
document.addEventListener('contextmenu', (e) => {
    if (state.isRunning) {
        e.preventDefault();
    }
});

// ===== Initial Setup =====
// Show start screen
showScreen(startScreen);
console.log('🧋 Capybara Bubble Tea Catcher loaded! Have fun~');
