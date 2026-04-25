// ─── CANVAS SETUP ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = 800;
canvas.height = 450;

// ─── CONSTANTS (Time-based, assuming 1 unit = 1 second) ─────────────────────
const GRAVITY        = 2700;  // px per sec^2
const JUMP_STRENGTH  = -960;  // px per sec
const GROUND_Y       = 330;   // Y of the player's feet
const OBSTACLE_SPEED = 360;   // px per sec
const SPAWN_MIN      = 1.4;   // seconds
const SPAWN_RANGE    = 1.2;   // seconds

// ─── ASSET LOADING ───────────────────────────────────────────────────────────
const assets = {};
let assetsLoaded = 0;
const ASSET_LIST = { crab: 'assets/crab.png', rock: 'assets/rock.png', bg: 'assets/bg.png', floor: 'assets/floor.png' };
const TOTAL_ASSETS = Object.keys(ASSET_LIST).length;

function loadAssets(onAllLoaded) {
    for (const [key, src] of Object.entries(ASSET_LIST)) {
        const img = new Image();
        img.onload = () => {
            assetsLoaded++;
            if (assetsLoaded === TOTAL_ASSETS) onAllLoaded();
        };
        img.onerror = () => {
            console.error(`[Crabby Jump] Failed to load asset: ${src}`);
            assetsLoaded++;
            if (assetsLoaded === TOTAL_ASSETS) onAllLoaded();
        };
        img.src = src;
        assets[key] = img;
    }
}

// ─── PARALLAX LAYER ──────────────────────────────────────────────────────────
class ParallaxLayer {
    constructor(image, speedMultiplier, y, renderHeight) {
        this.image           = image;
        this.speedMultiplier = speedMultiplier;
        this.y               = y;
        this.renderHeight    = renderHeight;
        this.tileW           = canvas.width;
        this.scrollX         = 0;
    }

    update(dt) {
        this.scrollX -= OBSTACLE_SPEED * this.speedMultiplier * dt;
        if (this.scrollX <= -this.tileW) {
            this.scrollX += this.tileW; 
        }
    }

    draw() {
        ctx.drawImage(this.image, this.scrollX, this.y, this.tileW, this.renderHeight);
        ctx.drawImage(this.image, this.scrollX + this.tileW, this.y, this.tileW, this.renderHeight);
    }
}

// ─── PARTICLE POOL ───────────────────────────────────────────────────────────
class Particle {
    constructor() {
        this.active = false;
    }
    spawn(x, y, color) {
        this.x       = x;
        this.y       = y;
        this.vx      = (Math.random() - 0.5) * 420;
        this.vy      = (Math.random() * -6 - 1) * 60;
        this.gravity = 0.25 * 3600; 
        this.radius  = Math.random() * 4 + 2;
        this.color   = color;
        this.alpha   = 1;
        this.active  = true;
    }
    update(dt) {
        if (!this.active) return;
        this.vy += this.gravity * dt;
        this.x  += this.vx * dt;
        this.y  += this.vy * dt;
        this.alpha -= 1.5 * dt;
        if (this.alpha <= 0) this.active = false;
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle   = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

const particlePool = Array.from({ length: 100 }, () => new Particle());

function spawnParticles(x, y, color, count) {
    let spawned = 0;
    for (let i = 0; i < particlePool.length; i++) {
        if (!particlePool[i].active) {
            particlePool[i].spawn(x, y, color);
            spawned++;
            if (spawned >= count) break;
        }
    }
}

// ─── OBSTACLE POOL ───────────────────────────────────────────────────────────
class Obstacle {
    constructor() {
        this.w      = 75;
        this.h      = 75;
        this.y      = GROUND_Y - this.h;
        this.active = false;
    }
    spawn() {
        this.x      = canvas.width;
        this.passed = false;
        this.active = true;
    }
    update(dt) {
        if (!this.active) return;
        this.x -= OBSTACLE_SPEED * dt;
        if (this.x + this.w < 0) this.active = false;
    }
    get hitbox() {
        const margin = 10;
        return { x: this.x + margin, y: this.y + margin, w: this.w - margin * 2, h: this.h - margin * 2 };
    }
    draw() {
        if (!this.active) return;
        ctx.drawImage(assets.rock, this.x, this.y, this.w, this.h);
    }
}

const obstaclePool = Array.from({ length: 10 }, () => new Obstacle());

// ─── PLAYER ──────────────────────────────────────────────────────────────────
class Player {
    constructor() {
        this.w = 90;
        this.h = 90;
        this.x = 60;
        this.reset();
    }
    reset() {
        this.y         = GROUND_Y - this.h;
        this.vy        = 0;
        this.jumps     = 0;
        this.maxJumps  = 1;
        this.onGround  = true;
    }
    jump() {
        if (this.jumps < this.maxJumps) {
            this.vy = JUMP_STRENGTH;
            this.jumps++;
            this.onGround = false;
        }
    }
    update(dt) {
        this.vy += GRAVITY * dt;
        this.y  += this.vy * dt;

        const groundTop = GROUND_Y - this.h;
        if (this.y >= groundTop) {
            if (!this.onGround) {
                spawnParticles(this.x + this.w / 2, GROUND_Y, '#00f3ff', 8);
            }
            this.y        = groundTop;
            this.vy       = 0;
            this.jumps    = 0;
            this.onGround = true;
        }
    }
    get hitbox() {
        const margin = 14;
        return { x: this.x + margin, y: this.y + margin, w: this.w - margin * 2, h: this.h - margin * 2 };
    }
    draw() {
        ctx.drawImage(assets.crab, this.x, this.y, this.w, this.h);
    }
}

// ─── COLLISION ───────────────────────────────────────────────────────────────
function boxCollide(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
}

// ─── GAME STATE ──────────────────────────────────────────────────────────────
let state           = 'LOADING'; // LOADING | INTRO | PLAYING | GAMEOVER
let score           = 0;
let rafId           = null;
let gameOverTimer   = null;
let spawnTimer      = 0;
let screenFlash     = 0;
let bgLayers        = [];
let player          = null;
let lastTime        = 0;

// ─── UI REFERENCES ───────────────────────────────────────────────────────────
const introScreen   = document.getElementById('intro-screen');
const gameOverScreen= document.getElementById('game-over-screen');
const hud           = document.getElementById('hud');
const scoreEl       = document.getElementById('score');
const finalScoreEl  = document.getElementById('final-score');
const startBtn      = document.getElementById('start-btn');
const restartBtn    = document.getElementById('restart-btn');

function showScreen(id) {
    [introScreen, gameOverScreen].forEach(s => s.classList.add('hidden'));
    hud.classList.add('hidden');
    if (id === 'intro')    { introScreen.classList.remove('hidden'); }
    if (id === 'gameover') { gameOverScreen.classList.remove('hidden'); }
    if (id === 'hud')      { hud.classList.remove('hidden'); }
}

// ─── INIT GAME ───────────────────────────────────────────────────────────────
function startGame() {
    if (gameOverTimer !== null) { clearTimeout(gameOverTimer); gameOverTimer = null; }

    score       = 0;
    screenFlash = 0;
    spawnTimer  = SPAWN_MIN + Math.random() * SPAWN_RANGE;
    player.reset();

    obstaclePool.forEach(o => o.active = false);
    particlePool.forEach(p => p.active = false);
    bgLayers.forEach(l => l.scrollX = 0);

    scoreEl.textContent = '0';
    showScreen('hud');
    state = 'PLAYING';
    
    // Reset timer to prevent jump on first frame
    lastTime = performance.now();
}

function triggerGameOver() {
    state = 'GAMEOVER';
    screenFlash = 1;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff00ff', 24);

    finalScoreEl.textContent = Math.floor(score);
    gameOverTimer = setTimeout(() => {
        gameOverTimer = null;
        showScreen('gameover');
    }, 600);
}

// ─── MAIN LOOP ───────────────────────────────────────────────────────────────
function loop(ts) {
    rafId = requestAnimationFrame(loop);

    if (lastTime === 0) lastTime = ts;
    let dt = (ts - lastTime) / 1000;
    lastTime = ts;

    // Cap dt at 100ms to prevent glitches when switching tabs
    if (dt > 0.1) dt = 0.1;

    if (state === 'INTRO') {
        bgLayers.forEach(l => l.update(dt));
        drawGame();
        return;
    }

    if (state === 'PLAYING') {
        updateGame(dt);
    }
    
    if (state === 'PLAYING' || state === 'GAMEOVER') {
        drawGame();
        if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - 2.4 * dt);
    }

    if (state === 'GAMEOVER' && screenFlash <= 0 && !particlePool.some(p => p.active)) {
        // We can optionally pause the animation loop here if we want completely static game over
    }
}

function updateGame(dt) {
    bgLayers.forEach(l => l.update(dt));

    // Obstacle Spawning
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
        const obs = obstaclePool.find(o => !o.active);
        if (obs) obs.spawn();
        spawnTimer = SPAWN_MIN + Math.random() * SPAWN_RANGE;
    }

    // Obstacles
    for (const obs of obstaclePool) {
        if (!obs.active) continue;
        obs.update(dt);

        if (boxCollide(player.hitbox, obs.hitbox)) {
            triggerGameOver();
            return;
        }

        if (!obs.passed && obs.x + obs.w < player.x) {
            obs.passed = true;
            score += 10;
            scoreEl.textContent = score;
        }
    }

    // Particles
    particlePool.forEach(p => p.update(dt));

    // Player
    player.update(dt);
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bgLayers.forEach(l => l.draw());
    obstaclePool.forEach(o => o.draw());
    particlePool.forEach(p => p.draw());
    if (player) player.draw();

    if (screenFlash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${screenFlash.toFixed(2)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
    if (e.code !== 'Space' && e.code !== 'ArrowUp') return;
    e.preventDefault();
    if (state === 'INTRO' || state === 'GAMEOVER') {
        startGame();
    } else if (state === 'PLAYING') {
        player.jump();
    }
});

startBtn.addEventListener('click',   startGame);
restartBtn.addEventListener('click', startGame);

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (state === 'INTRO' || state === 'GAMEOVER') {
        startGame();
    } else if (state === 'PLAYING') {
        player.jump();
    }
}, { passive: false });

// ─── BOOT ────────────────────────────────────────────────────────────────────
loadAssets(() => {
    bgLayers = [
        new ParallaxLayer(assets.bg,    0.15, 0,   canvas.height),
        new ParallaxLayer(assets.floor, 0.75, 300, canvas.height - 300),
    ];

    player = new Player();
    state = 'INTRO';
    showScreen('intro');
    
    // Start animation loop immediately for the animated intro screen
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
});
