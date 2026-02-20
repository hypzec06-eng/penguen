const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const keyWIndicator = document.getElementById('key-w');
const keySIndicator = document.getElementById('key-s');

canvas.width = 1000;
canvas.height = 400;
canvas.setAttribute('tabindex', '0'); // make canvas focusable
canvas.focus();                        // grab keyboard focus immediately

let score = 0;
let gameSpeed = 1.5;
let isGameOver = false;
let gravity = 0.7;
let frames = 0;
let lastObstacleType = 1;

// ─── LIVES & FISH ─────────────────────────────────────────────────────
let lives = 3;
let fishCollected = 0;        // counts toward next life (resets at 10)
let totalFishEver = 0;        // total ever collected (for HUD display)
let isInvincible = false;     // brief invincibility after taking a hit
let invincibleTimer = 0;
const INVINCIBLE_FRAMES = 150; // 2.5 seconds at 60fps

const penguenImg = new Image(); penguenImg.src = 'penguen.png';
const comImg     = new Image(); comImg.src     = 'com.png';
const skor1Img   = new Image(); skor1Img.src   = 'skor1.png';
const skor2Img   = new Image(); skor2Img.src   = 'skor2.png';

// (No audio — sound removed per request)

// ─── SNOWFLAKES ───────────────────────────────────────────────────────
const snowflakes = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    r: Math.random() * 3 + 0.5,
    speed: Math.random() * 1.2 + 0.3,
    drift: (Math.random() - 0.5) * 0.4,
    opacity: Math.random() * 0.6 + 0.3
}));

// ─── GROUND SNOW BUMPS ────────────────────────────────────────────────
const groundSnow = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    size: Math.random() * 5 + 2
}));

// ─── IGLOO POSITIONS (parallax) ───────────────────────────────────────
const igloos = [
    { x: 820,  speed: 0.45 },
    { x: 380,  speed: 0.28 },
    { x: 1320, speed: 0.45 },
    { x: 600,  speed: 0.28 },
];

// ─── SNOW PARTICLES (jump / run) ─────────────────────────────────────
const snowParticles = [];
function spawnSnowParticle(x, y, type) {
    const count = type === 'jump' ? 10 : 2;
    for (let i = 0; i < count; i++) {
        snowParticles.push({
            x, y,
            vx: (Math.random() - 0.5) * (type === 'jump' ? 4 : 2),
            vy: type === 'jump' ? -(Math.random() * 4 + 1) : -(Math.random() * 1.5 + 0.5),
            life: 1,
            decay: Math.random() * 0.04 + 0.025,
            r: Math.random() * 4 + 2,
            type
        });
    }
}
function updateSnowParticles() {
    for (let i = snowParticles.length - 1; i >= 0; i--) {
        const p = snowParticles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life -= p.decay;
        if (p.life <= 0) { snowParticles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life * 0.85;
        ctx.fillStyle = p.type === 'run' ? 'rgba(200,235,255,0.9)' : 'white';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─── FISH ─────────────────────────────────────────────────────────────
// One fish at a time, spawned at a random interval. Reachable heights only.
const fishList = [];
let fishSpawnTimer = 0;
let nextFishInterval = 260; // randomised after each spawn

function spawnSingleFish() {
    const yMin = canvas.height - 130;
    const yMax = canvas.height - 85;
    fishList.push({
        x: canvas.width + 40,
        y: yMin + Math.random() * (yMax - yMin),
        w: 52, h: 32,
        collected: false,
        bobOffset: Math.random() * Math.PI * 2
    });
    // Randomise the next gap (180–420 frames)
    nextFishInterval = 180 + Math.floor(Math.random() * 240);
}

function drawFish(fish) {
    if (fish.collected) return;
    const x = fish.x;
    const y = fish.y + Math.sin(frames * 0.07 + fish.bobOffset) * 4; // gentle bob

    ctx.save();
    // Glow
    ctx.shadowColor = 'rgba(80,220,255,0.8)';
    ctx.shadowBlur = 10;

    // Body
    ctx.fillStyle = '#29b6f6';
    ctx.beginPath();
    ctx.ellipse(x, y, fish.w / 2, fish.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(x - fish.w * 0.08, y - fish.h * 0.12, fish.w * 0.28, fish.h * 0.22, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Tail fin (left side — fish faces right to left, so tail is on right)
    ctx.fillStyle = '#0288d1';
    ctx.beginPath();
    ctx.moveTo(x + fish.w * 0.45, y);
    ctx.lineTo(x + fish.w * 0.80, y - fish.h * 0.55);
    ctx.lineTo(x + fish.w * 0.80, y + fish.h * 0.55);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x - fish.w * 0.28, y - fish.h * 0.08, fish.h * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#01579b';
    ctx.beginPath();
    ctx.arc(x - fish.w * 0.28, y - fish.h * 0.08, fish.h * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal fin
    ctx.fillStyle = '#0288d1';
    ctx.beginPath();
    ctx.moveTo(x - fish.w * 0.10, y - fish.h * 0.50);
    ctx.lineTo(x + fish.w * 0.20, y - fish.h * 0.50);
    ctx.lineTo(x + fish.w * 0.10, y - fish.h * 0.10);
    ctx.lineTo(x - fish.w * 0.20, y - fish.h * 0.10);
    ctx.closePath();
    ctx.fill();

    // Sparkle on top
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - fish.w * 0.18, y - fish.h * 0.28, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Collect animation sparks
const collectSparks = [];
function spawnCollectSparks(x, y) {
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        collectSparks.push({
            x, y,
            vx: Math.cos(angle) * (Math.random() * 3 + 1.5),
            vy: Math.sin(angle) * (Math.random() * 3 + 1.5),
            life: 1,
            decay: 0.05 + Math.random() * 0.03,
            r: Math.random() * 3 + 1.5
        });
    }
}
function updateCollectSparks() {
    for (let i = collectSparks.length - 1; i >= 0; i--) {
        const p = collectSparks[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay;
        if (p.life <= 0) { collectSparks.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = `hsl(${190 + p.life * 30}, 100%, 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function handleFish() {
    // Spawn one fish at a time at a random interval
    fishSpawnTimer++;
    if (fishSpawnTimer >= nextFishInterval && fishList.filter(f => !f.collected).length === 0) {
        fishSpawnTimer = 0;
        spawnSingleFish();
    }

    for (let i = fishList.length - 1; i >= 0; i--) {
        const fish = fishList[i];
        fish.x -= gameSpeed * 0.45; // slow enough to be catchable

        if (!fish.collected) {
            drawFish(fish);

            // Collect check (generous hitbox — reward, not punishment)
            const fL = fish.x - fish.w * 1.4, fR = fish.x + fish.w * 1.4;
            const fT = fish.y - fish.h * 1.4, fB = fish.y + fish.h * 1.4;
            const pCx = player.x + player.width / 2;
            const pCy = player.y + player.height / 2;

            if (pCx > fL && pCx < fR && pCy > fT && pCy < fB) {
                fish.collected = true;
                spawnCollectSparks(fish.x, fish.y);
                fishCollected++;
                totalFishEver++;
                score += 15; // bonus score per fish

                if (fishCollected >= 10) {
                    fishCollected = 0;
                    lives++;
                    // Flash a "+1 ❤" popup
                    lifePopups.push({ x: player.x + player.width / 2, y: player.y, life: 1 });
                }
            }
        }

        // Remove fish that have scrolled off screen
        if (fish.x + fish.w < 0) fishList.splice(i, 1);
    }
}

// Life gain popup text
const lifePopups = [];
function updateLifePopups() {
    for (let i = lifePopups.length - 1; i >= 0; i--) {
        const p = lifePopups[i];
        p.y -= 1.5;
        p.life -= 0.018;
        if (p.life <= 0) { lifePopups.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.font = 'bold 26px Nunito';
        ctx.fillStyle = '#ff6b6b';
        ctx.textAlign = 'center';
        ctx.fillText('+1 ❤', p.x, p.y);
        ctx.textAlign = 'start';
        ctx.restore();
    }
}

const player = {
    x: 60, y: 310,
    standWidth: 80, standHeight: 90,
    crouchWidth: 95, crouchHeight: 50,
    width: 80, height: 90,
    dy: 0, jumpForce: 16,
    grounded: false, isCrouching: false,
    currentImage: penguenImg,
    runTimer: 0,

    draw: function() {
        // Flash white during invincibility
        if (isInvincible && Math.floor(invincibleTimer / 6) % 2 === 0) {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.drawImage(this.currentImage, this.x, this.y, this.width, this.height);
            ctx.restore();
        } else {
            ctx.drawImage(this.currentImage, this.x, this.y, this.width, this.height);
        }
    },

    update: function() {
        this.dy += gravity;
        this.y += this.dy;

        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            if (!this.grounded) {
                spawnSnowParticle(this.x + this.width / 2, canvas.height, 'jump');
            }
            this.dy = 0;
            this.grounded = true;
        }

        if (this.isCrouching) {
            this.currentImage = comImg;
            this.width = this.crouchWidth;
            this.height = this.crouchHeight;
            if (!this.grounded) this.dy += 1;
        } else {
            this.currentImage = penguenImg;
            this.width = this.standWidth;
            if (this.grounded) {
                this.height = this.standHeight;
                this.y = canvas.height - this.height;
            } else {
                this.height = this.standHeight;
            }
        }

        // Run snow puffs
        if (this.grounded && !this.isCrouching) {
            this.runTimer++;
            if (this.runTimer % 8 === 0) {
                spawnSnowParticle(this.x + this.width * 0.3, canvas.height - 4, 'run');
            }
        }
    }
};

const obstacles = [];

function handleKeyDown(e) {
    // Prevent arrow/space from scrolling the page
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
    }

    if (isGameOver && (e.code === 'Space' || e.code === 'Enter')) location.reload();

    // JUMP — W, ArrowUp, or Space
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') {
        keyWIndicator.classList.add('key-active');
        if (player.grounded && !player.isCrouching) {
            player.dy = -player.jumpForce;
            player.grounded = false;
            spawnSnowParticle(player.x + player.width / 2, player.y + player.height, 'jump');
        }
    }

    // CROUCH — S or ArrowDown
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keySIndicator.classList.add('key-active');
        player.isCrouching = true;
    }
}

function handleKeyUp(e) {
    if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'Space') keyWIndicator.classList.remove('key-active');
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        keySIndicator.classList.remove('key-active');
        player.isCrouching = false;
    }
}

// Listen on BOTH window and canvas — covers all focus scenarios
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup',   handleKeyUp);
canvas.addEventListener('keydown', handleKeyDown);
canvas.addEventListener('keyup',   handleKeyUp);

// Re-focus canvas if anything else steals focus
document.addEventListener('click', () => canvas.focus());

// Touch support for mobile / touchscreen users
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const canvasRect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - canvasRect.left;
    // Left half = crouch, right half = jump
    if (touchX < canvas.width / 2) {
        keySIndicator.classList.add('key-active');
        player.isCrouching = true;
    } else {
        keyWIndicator.classList.add('key-active');
        if (player.grounded && !player.isCrouching) {
            player.dy = -player.jumpForce;
            player.grounded = false;
            spawnSnowParticle(player.x + player.width / 2, player.y + player.height, 'jump');
        }
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    keyWIndicator.classList.remove('key-active');
    keySIndicator.classList.remove('key-active');
    player.isCrouching = false;
}, { passive: false });

function handleObstacles() {
    // Obstacle spawn: starts at 180 frames, decreases with score for difficulty
    const spawnInterval = Math.max(120, 220 - Math.floor(score / 10));
    if (frames % spawnInterval === 0) {
        let threshold = 0.5;
        if (lastObstacleType === 2) threshold = 0.8;
        let type = Math.random() < threshold ? 1 : 2;
        lastObstacleType = type;

        if (type === 1) {
            obstacles.push({
                x: canvas.width, y: canvas.height - 45,
                width: 25, height: 45, img: skor1Img,
                tolX: 5, tolY: 5
            });
        } else {
            obstacles.push({
                x: canvas.width, y: canvas.height - 95,
                width: 55, height: 35, img: skor2Img,
                tolX: 10, tolY: 3
            });
        }
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;

        ctx.drawImage(obs.img, obs.x, obs.y, obs.width, obs.height);

        // Percentage-based hitbox collision
        let pL = player.x + player.width  * 0.30;
        let pR = player.x + player.width  * 0.70;
        let pT = player.y + player.height * 0.15;
        let pB = player.y + player.height * 0.90;

        let oL = obs.x + obs.width  * 0.20;
        let oR = obs.x + obs.width  * 0.80;
        let oT = obs.y + obs.height * 0.10;
        let oB = obs.y + obs.height * 0.90;

        if (pR > oL && pL < oR && pB > oT && pT < oB) {
            if (!isInvincible) {
                lives--;
                if (lives <= 0) {
                    lives = 0;
                    isGameOver = true;
                } else {
                    // Lost a life — invincibility window
                    isInvincible = true;
                    invincibleTimer = INVINCIBLE_FRAMES;
                    // Remove the obstacle that hit us
                    obstacles.splice(i, 1);
                    i--;
                    continue;
                }
            }
        }

        if (obs.x + obs.width < 0) { obstacles.splice(i, 1); i--; }
    }
}

// ─── IGLOO DRAW ───────────────────────────────────────────────────────
function drawIgloo(x, scale) {
    const bW = 110 * scale;
    const bY = canvas.height;

    ctx.fillStyle = 'rgba(150,210,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(x, bY, bW * 0.72, bW * 0.14, 0, Math.PI, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(x - bW * 0.1, bY - bW * 0.4, 2, x, bY, bW * 0.6);
    grad.addColorStop(0, 'rgba(240,250,255,0.40)');
    grad.addColorStop(1, 'rgba(140,200,245,0.14)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(x, bY, bW * 0.55, Math.PI, 0); ctx.fill();

    ctx.strokeStyle = 'rgba(200,235,255,0.35)';
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath(); ctx.arc(x, bY, bW * 0.55, Math.PI, 0); ctx.stroke();

    ctx.strokeStyle = 'rgba(180,220,250,0.18)';
    ctx.lineWidth = 1;
    [0.78, 0.56, 0.34].forEach(f => {
        ctx.beginPath(); ctx.arc(x, bY, bW * 0.55 * f, Math.PI, 0); ctx.stroke();
    });

    ctx.fillStyle = 'rgba(60,120,190,0.45)';
    ctx.beginPath();
    ctx.arc(x, bY, bW * 0.15, Math.PI, 0);
    ctx.rect(x - bW * 0.15, bY - bW * 0.06, bW * 0.30, bW * 0.06);
    ctx.fill();

    ctx.fillStyle = 'rgba(245,252,255,0.45)';
    ctx.beginPath(); ctx.arc(x, bY - bW * 0.44, bW * 0.16, 0, Math.PI * 2); ctx.fill();
}

// ─── HUD ─────────────────────────────────────────────────────────────
function drawHUD() {
    // Score & title (top-right, original positions)
    ctx.fillStyle = '#00838f';
    ctx.font = 'bold 28px Nunito';
    ctx.fillText('HalilGame', canvas.width - 180, 50);

    ctx.fillStyle = '#455a64';
    ctx.font = '24px Nunito';
    ctx.fillText('Skor: ' + Math.floor(score), canvas.width - 180, 90);

    // Lives (hearts, top-left)
    ctx.font = '22px Nunito';
    let heartsStr = '';
    for (let i = 0; i < lives; i++) heartsStr += '❤ ';
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(heartsStr.trim(), 14, 36);

    // Fish progress bar (below hearts)
    // Background pill
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.roundRect(14, 46, 130, 14, 7);
    ctx.fill();

    // Fill
    const fishPct = fishCollected / 10;
    ctx.fillStyle = '#29b6f6';
    ctx.beginPath();
    ctx.roundRect(14, 46, 130 * fishPct, 14, 7);
    ctx.fill();

    // Fish label
    ctx.fillStyle = 'white';
    ctx.font = '12px Nunito';
    ctx.fillText(`🐟 ${fishCollected}/10  (+1❤)`, 16, 58);

    // Speed (below fish bar)
    ctx.fillStyle = '#455a64';
    ctx.font = '14px Nunito';
    ctx.fillText(`Hız: ${gameSpeed.toFixed(1)}`, 14, 78);
}

function drawBackground() {
    let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0d2147');
    gradient.addColorStop(0.5, '#1a3a6e');
    gradient.addColorStop(1, '#2a5298');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Twinkling stars
    [[50,30],[120,15],[200,50],[340,20],[480,38],[670,10],[800,35],[930,55],[140,70],[560,18]].forEach(([sx, sy]) => {
        ctx.save();
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(frames * 0.02 + sx));
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(sx, sy, 1.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });

    // Aurora ribbons
    for (let r = 0; r < 3; r++) {
        const aY  = 55 + r * 28;
        const off = Math.sin(frames * 0.008 + r * 2) * 28;
        const cols = ['80,200,120', '60,150,220', '120,80,200'];
        const ag = ctx.createLinearGradient(0, aY, 0, aY + 22);
        ag.addColorStop(0,   `rgba(${cols[r]},0.0)`);
        ag.addColorStop(0.5, `rgba(${cols[r]},0.13)`);
        ag.addColorStop(1,   `rgba(${cols[r]},0.0)`);
        ctx.fillStyle = ag;
        ctx.beginPath(); ctx.moveTo(0, aY + off);
        for (let xi = 0; xi <= canvas.width; xi += 60)
            ctx.lineTo(xi, aY + off + Math.sin(xi * 0.015 + frames * 0.01 + r) * 18);
        ctx.lineTo(canvas.width, aY + 22 + off);
        ctx.lineTo(0, aY + 22 + off);
        ctx.closePath(); ctx.fill();
    }

    // Mountain silhouettes
    ctx.fillStyle = 'rgba(18,45,95,0.65)';
    ctx.beginPath(); ctx.moveTo(0, canvas.height);
    [[80,90],[160,50],[260,130],[380,60],[500,115],[620,68],[730,140],[850,80],[960,118],[1000,55]].forEach(([mx, mh]) => {
        ctx.lineTo(mx, canvas.height - mh);
    });
    ctx.lineTo(1000, canvas.height); ctx.closePath(); ctx.fill();

    // Snow caps on mountains
    ctx.fillStyle = 'rgba(210,238,255,0.45)';
    [[80,90],[260,130],[500,115],[730,140],[960,118]].forEach(([px, ph]) => {
        ctx.beginPath();
        ctx.moveTo(px, canvas.height - ph);
        ctx.lineTo(px + 28, canvas.height - ph + 38);
        ctx.lineTo(px - 28, canvas.height - ph + 38);
        ctx.closePath(); ctx.fill();
    });

    // Parallax igloos
    for (const ig of igloos) {
        ig.x -= ig.speed;
        if (ig.x < -130) ig.x = canvas.width + 130;
        ctx.save();
        ctx.globalAlpha = ig.speed > 0.35 ? 0.58 : 0.38;
        drawIgloo(ig.x, ig.speed > 0.35 ? 1 : 0.72);
        ctx.restore();
    }

    // Ground
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, canvas.height - 10, canvas.width, 10);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 10);
    ctx.lineTo(canvas.width, canvas.height - 10);
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Scrolling snow bumps
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const gs of groundSnow) {
        gs.x -= gameSpeed * 0.5;
        if (gs.x < -10) gs.x = canvas.width + 10;
        ctx.beginPath(); ctx.arc(gs.x, canvas.height - 10, gs.size, Math.PI, 0); ctx.fill();
    }

    // Falling snowflakes
    for (const s of snowflakes) {
        s.x += s.drift + gameSpeed * 0.12;
        s.y += s.speed;
        if (s.y > canvas.height + 5) { s.y = -5; s.x = Math.random() * canvas.width; }
        if (s.x > canvas.width  + 5) s.x = -5;
        ctx.save();
        ctx.globalAlpha = s.opacity;
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

function animate() {
    // Always schedule next frame first — loop never dies
    requestAnimationFrame(animate);

    if (isGameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 40px Nunito';
        ctx.fillText('Oyun Bitti!', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '30px Nunito';
        ctx.fillText('Skor: ' + Math.floor(score), canvas.width / 2, canvas.height / 2 + 30);
        ctx.font = '22px Nunito';
        ctx.fillText('🐟 Toplanan balık: ' + totalFishEver, canvas.width / 2, canvas.height / 2 + 70);
        ctx.font = '20px Nunito';
        ctx.fillText('Tekrar oynamak için SPACE tuşuna bas', canvas.width / 2, canvas.height / 2 + 110);
        ctx.textAlign = 'start';
        return;
    }

    drawBackground();

    frames++;
    score += gameSpeed * 0.05;

    // Invincibility countdown
    if (isInvincible) {
        invincibleTimer--;
        if (invincibleTimer <= 0) isInvincible = false;
    }

    handleFish();
    handleObstacles();
    player.update();
    player.draw();

    updateSnowParticles();
    updateCollectSparks();
    updateLifePopups();

    drawHUD();

    // Difficulty ramp: faster speed increase over time
    if (frames % 350 === 0) gameSpeed += 0.25;
}

let loadedImages = 0;
function imageLoaded() {
    loadedImages++;
    if (loadedImages === 4) requestAnimationFrame(animate);
}
penguenImg.onload = imageLoaded; comImg.onload = imageLoaded;
skor1Img.onload   = imageLoaded; skor2Img.onload = imageLoaded;
