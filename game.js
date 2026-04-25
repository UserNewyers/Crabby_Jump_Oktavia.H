const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set dimensions
canvas.width = 800;
canvas.height = 450;

// Constants
const GRAVITY = 0.8;
const JUMP_STRENGTH = -15;
const GROUND_Y = 320;
const OBSTACLE_SPEED = 6;
const SPAWN_INTERVAL = 1500;

// Assets
const assets = {
    crab: new Image(),
    rock: new Image(),
    bg: new Image(),
    floor: new Image()
};

assets.crab.src = 'assets/crab.png';
assets.rock.src = 'assets/rock.png';
assets.bg.src = 'assets/bg.png';
assets.floor.src = 'assets/floor.png';

// Parallax Layer Class
class ParallaxLayer {
    constructor(image, speedModifier, yOffset = 0, height = canvas.height) {
        this.image = image;
        this.speedModifier = speedModifier;
        this.width = canvas.width;
        this.height = height;
        this.x = 0;
        this.y = yOffset;
    }

    update() {
        this.x -= OBSTACLE_SPEED * this.speedModifier;
        if (this.x <= -this.width) {
            this.x = 0;
        }
    }

    draw() {
        ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
        ctx.drawImage(this.image, this.x + this.width, this.y, this.width, this.height);
    }
}

// Particle Class
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * -5 - 1;
        this.gravity = 0.2;
        this.color = color;
        this.alpha = 1;
        this.life = 1;
    }

    update() {
        this.speedY += this.gravity;
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= 0.02;
        this.life = this.alpha;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Game State
let gameState = 'INTRO';
let score = 0;
let animationId;
let lastSpawnTime = 0;
let obstacles = [];
let backgroundLayers = [];
let particles = [];
let screenFlash = 0;

// Initialize Layers
assets.bg.onload = () => {
    backgroundLayers.push(new ParallaxLayer(assets.bg, 0.2)); // Far ocean
};
assets.floor.onload = () => {
    backgroundLayers.push(new ParallaxLayer(assets.floor, 0.8, 300, 150)); // Foreground floor
};

// Player Class
class Player {
    constructor() {
        this.width = 100;
        this.height = 100;
        this.x = 50;
        this.y = GROUND_Y;
        this.dy = 0;
        this.jumpCount = 0;
        this.maxJumps = 1;
        this.hitbox = { x: 0, y: 0, w: 70, h: 70 };
        this.onGround = true;
    }

    jump() {
        if (this.jumpCount < this.maxJumps) {
            this.dy = JUMP_STRENGTH;
            this.jumpCount++;
            this.onGround = false;
        }
    }

    update() {
        this.dy += GRAVITY;
        this.y += this.dy;

        if (this.y > GROUND_Y) {
            if (!this.onGround) {
                // Landing Particles
                createParticles(this.x + this.width / 2, GROUND_Y + this.height - 10, '#00f3ff', 8);
            }
            this.y = GROUND_Y;
            this.dy = 0;
            this.jumpCount = 0;
            this.onGround = true;
        }

        this.hitbox.x = this.x + 15;
        this.hitbox.y = this.y + 15;
    }

    draw() {
        ctx.drawImage(assets.crab, this.x, this.y, this.width, this.height);
    }
}

// Obstacle Class
class Obstacle {
    constructor() {
        this.width = 80;
        this.height = 80;
        this.x = canvas.width;
        this.y = GROUND_Y + 20;
        this.speed = OBSTACLE_SPEED;
        this.hitbox = { x: 0, y: 0, w: 60, h: 60 };
        this.passed = false;
    }

    update() {
        this.x -= this.speed;
        this.hitbox.x = this.x + 10;
        this.hitbox.y = this.y + 10;
    }

    draw() {
        ctx.drawImage(assets.rock, this.x, this.y, this.width, this.height);
    }
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

const player = new Player();

// UI Elements
const introScreen = document.getElementById('intro-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Start Game
function init() {
    gameState = 'PLAYING';
    score = 0;
    scoreEl.textContent = '0';
    obstacles = [];
    particles = [];
    lastSpawnTime = 0;
    screenFlash = 0;
    
    introScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    player.y = GROUND_Y;
    player.dy = 0;
    player.jumpCount = 0;
    player.onGround = true;
    
    gameLoop(0);
}

function checkCollision(p, o) {
    return p.hitbox.x < o.hitbox.x + o.hitbox.w &&
           p.hitbox.x + p.hitbox.w > o.hitbox.x &&
           p.hitbox.y < o.hitbox.y + o.hitbox.h &&
           p.hitbox.y + p.hitbox.h > o.hitbox.y;
}

function gameOver() {
    gameState = 'GAMEOVER';
    screenFlash = 1;
    createParticles(player.x + 50, player.y + 50, '#ff00ff', 20);
    
    setTimeout(() => {
        gameOverScreen.classList.remove('hidden');
        finalScoreEl.textContent = Math.floor(score);
    }, 500);
}

// Game Loop
function gameLoop(timestamp) {
    if (gameState !== 'PLAYING') {
        if (gameState === 'GAMEOVER') {
             // Continue drawing for a bit to show collision effect
             draw();
             if (screenFlash > 0) screenFlash -= 0.05;
             requestAnimationFrame(gameLoop);
        }
        return;
    }
    
    update(timestamp);
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

function update(timestamp) {
    // Background Layers
    backgroundLayers.forEach(layer => layer.update());

    // Spawning
    if (timestamp - lastSpawnTime > SPAWN_INTERVAL + Math.random() * 1000) {
        obstacles.push(new Obstacle());
        lastSpawnTime = timestamp;
    }

    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.update();

        if (checkCollision(player, obs)) {
            gameOver();
            return;
        }

        if (!obs.passed && obs.x + obs.width < player.x) {
            score += 10;
            obs.passed = true;
            scoreEl.textContent = Math.floor(score);
        }

        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) {
            particles.splice(i, 1);
        }
    }

    // Player
    player.update();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    backgroundLayers.forEach(layer => layer.draw());

    obstacles.forEach(obs => obs.draw());

    particles.forEach(p => p.draw());

    player.draw();

    // Screen Flash Effect
    if (screenFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${screenFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Event Listeners
startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        if (gameState === 'INTRO') {
            init();
        } else if (gameState === 'GAMEOVER') {
            init();
        } else if (gameState === 'PLAYING') {
            player.jump();
        }
    }
});

// Initial draw to show background and crab on start screen
assets.bg.onload = () => {
    ctx.drawImage(assets.bg, 0, 0, canvas.width, canvas.height);
    assets.crab.onload = () => {
        player.draw();
    };
};
