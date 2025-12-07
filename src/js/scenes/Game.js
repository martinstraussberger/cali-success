import { SoundManager } from '../audio/soundManager.js';
import { MILESTONES, Util } from '../utils/util.js';

export class Game extends Phaser.Scene {
    constructor() { super({ key: 'Game' }); }
    preload() {
        this.load.image('motorcycle', 'public/images/motorcycle-ducati-small.png');
        this.load.image('policeCar', 'public/images/cop-car-suv.png');
        // Night city highway background (replace parallax)
        this.load.image('cityBg', 'public/images/night-city-highway/scenic-night-route.jpg');
        // Ghost overlay image shown at 6 skulls
        this.load.image('ghostriderS', 'public/images/ghostrider-s.png');
        // Create a small flame particle texture
        const flameG = this.add.graphics();
        flameG.clear();
        flameG.fillStyle(0xffa600, 1);
        flameG.fillCircle(16, 16, 16);
        flameG.fillStyle(0xff4500, 0.9);
        flameG.fillCircle(16, 20, 6);
        flameG.fillStyle(0xffffff, 0.8);
        flameG.fillCircle(16, 22, 2);
        flameG.generateTexture('flameParticle', 32, 32);
        flameG.destroy();
        // Audio for skull activation on speedcam trigger
        this.load.audio('ghostWhisper', 'src/js/audio/creepy-ghost-whisper-see-you.mp3');
        // Ghostrider mode activation sound (plays once upon reaching 6 skulls)
        this.load.audio('ghostriderMode', 'src/js/audio/ghostridermode.mp3');
        // Wheelie/jump sound effect
        this.load.audio('wheelie', 'src/js/audio/motorcycle-wheelie-speeding-sound.mp3');
        // Background music
        this.load.audio('bgMusic', 'src/js/audio/racing-road-bg-audio.mp3');
    }

    init() {
        this.speed = 0;
        this.maxSpeed = 322;
        this.accel = 220;
        this.brake = 320;
        this.milestoneIndex = 0;
        this.distance = 0;
        // Shorten the distance between milestones for denser pacing
        this.nextMilestoneAt = 620;
        this.isPausedForPanel = false;
        this.gameOver = false;
        this.lives = 10; // legacy lives (not used for skulls)
        this.skulls = 0; // skulls increase when speedcam triggers
        this.invulnTimer = 0;
        this.keys = null;
        this.SFX = new SoundManager();
        // Extended jump/wheelie hold configuration
        this.maxJumpHold = 0.6; // seconds the player can hold SPACE to sustain jump/wheelie
        // Track SPACE key state for audio transitions
        this.spaceWasDown = false;
        // Pair tracking for police cars to synchronize despawn
        // Turbo chargers: player has 5, triggered on SPACE press
        this.turboCount = 5;
        this.isTurbo = false;
        this.turboElapsed = 0;
        this.turboRampDuration = 1.0; // seconds to ramp to 400
        this.turboHoldDuration = 3.0; // total turbo duration before restore
        this.turboMaxSpeed = 400;
        // Ghostrider turbo speed when 6+ skulls
        this.turboPosBiasGhostriderSpeed = 600;
        // Smooth slowdown from turbo back to base speed
        this.isTurboSlowing = false;
        this.turboSlowElapsed = 0;
        this.turboSlowDuration = 1.2; // seconds to reduce from current to base cap
        this.turboSlowStartSpeed = 0;
        this.policeBatch = [];
        this.policeSpawnCount = 0;
        this.finalPolice = null;
        this.finalZoomRecover = false;
        // Control final police disappearance timing after Ghostrider activation
        this.finalPoliceCanDisappearAfterGhostrider = false;
        this.finalPoliceGhostriderTimer = null;
        // Ghostrider mode subtle shake controller
        this.ghostShakeEvent = null;
        // Run timer
        this.elapsedTime = 0; // seconds
        this.timerText = null;
        // Player X bias when turbo is active (moves towards center)
        this.turboPosBias = 0; // pixels added to targetX
        this.turboPosBiasTarget = 0; // target bias value to lerp towards
        this.turboPosBiasMax = 220; // max pixels to move towards center (normal turbo)
        this.turboPosBiasGhostriderMax = 340; // max pixels towards center in Ghostrider mode (6+ skulls)
        this.turboPosBiasSpeed = 120; // pixels/sec for bias change
        // Flag to show end-of-run continuation message once
        this.continuedShown = false;
    }

    create() {
        const { width: W, height: H } = this.scale;
        this.cameras.main.setZoom(1);
        this.speedLineGroup = this.add.group();

        // Legacy DOM HUD removed; cockpit HUD handles UI
        this.hudEl = null;
        this.sidepanelEl = document.getElementById('sidepanel');
        this.panelTitleEl = document.getElementById('panelTitle');
        this.panelTextEl = document.getElementById('panelText');
        this.panelImageEl = document.getElementById('panelImage');

        this.keys = this.input.keyboard.addKeys({
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            enter: Phaser.Input.Keyboard.KeyCodes.ENTER,
        });

        this.physics.world.setBounds(0, 0, W, H);

        // Build parallax with city background + clouds/birds
        this.layers = this.createParallax(W, H);
        // Realistic highway for bottom 1/3 of the screen
        this.createHighwayRoad(W, H);

        this.player = this.physics.add.sprite(160, H - 120, 'motorcycle');
        this.player.setCollideWorldBounds(true);
        this.player.setBounce(0);
        this.player.setDrag(200, 0);
        this.player.body.setSize(this.player.width * 0.55, this.player.height * 0.35).setOffset(this.player.width * 0.2, this.player.height * 0.5);

        // Overlay sprite (hidden initially) that appears when 6 skulls reached
        this.ghostOverlay = this.add.image(this.player.x, this.player.y - (this.player.height * 0.35), 'ghostriderS')
            .setDepth(5)
            .setVisible(false);
        // Scale down slightly if needed to fit over bike
        this.ghostOverlay.setScale(0.9);

        // Fire effect (sprite-based, no ParticleEmitter to match Phaser version)
        this.fireGroup = this.add.group();
        this.fireDepth = 6;
        this.fireLoopEvent = null; // continuous flames when >=6 skulls
        this.skullFireLoopEvent = null; // small flames near skull UI when >=6

        this.groundY = H - 120;

        this.speedcams = this.add.group();
        this.time.addEvent({ delay: 9000, loop: true, callback: () => this.spawnSpeedcam(W, H) });

        // Police cars group
        this.policeCars = this.physics.add.group();

        this.milestonePins = this.physics.add.group();
        this.currentPinSpawned = false;

        // Legacy HUD no longer used

        // Cockpit HUD (semicircle gauge in front of motorcycle)
        this.createCockpitHUD();
        // Fixed lives UI at top-left
        this.createLivesUI();
        // Create timer UI in top-right corner
        this.createTimerUI();

        // Prepare ghost whisper SFX
        this.ghostSfx = this.sound.add('ghostWhisper', { volume: 0.8 });
        // Prepare ghostrider mode SFX
        this.ghostriderModeSfx = this.sound.add('ghostriderMode', { volume: 0.9 });
        // Prepare wheelie/jump SFX
        this.wheelieSfx = this.sound.add('wheelie', { volume: 0.9 });

        // Background music: loop continuously
        this.bgMusic = this.sound.add('bgMusic', { volume: 0.5, loop: true });
        this.bgMusic.play();

        // Play initial motorcycle wheelie speeding sound once at game start
        if (this.wheelieSfx) {
            this.wheelieSfx.play({ loop: false });
        }

        // Simple player volume control (DOM range slider)
        let volSlider = document.getElementById('bgVolume');
        if (!volSlider) {
            volSlider = document.createElement('input');
            volSlider.type = 'range';
            volSlider.min = '0';
            volSlider.max = '100';
            volSlider.value = '40';
            volSlider.id = 'bgVolume';
            volSlider.style.position = 'fixed';
            volSlider.style.right = '16px';
            volSlider.style.bottom = '16px';
            volSlider.style.zIndex = '10000';
            volSlider.style.width = '180px';
            volSlider.title = 'Background Music Volume';
            document.body.appendChild(volSlider);
        }
        volSlider.addEventListener('input', () => {
            const v = Number(volSlider.value) / 100;
            if (this.bgMusic) this.bgMusic.setVolume(v);
        });
    }

    // Create a more realistic highway street at the bottom third of the screen, keeping green lines
    createHighwayRoad(W, H) {
        const roadHeight = Math.floor(H / 3);
        const texKey = 'highwayRoadTex';
        const g = this.add.graphics();
        // Asphalt gradient
        g.fillGradientStyle(0x1b1f29, 1, 0x1b1f29, 1, 0x252b38, 1, 0x252b38, 1, 1);
        g.fillRect(0, 0, W, roadHeight);
        // Side green lines (kept from before) but dashed for high-speed effect
        g.fillStyle(0x8fb57b, 1);
        const greenSegW = 64, greenGapW = 36;
        let gx = 0;
        while (gx < W) {
            const w = Math.min(greenSegW, W - gx);
            g.fillRect(gx, 0, w, 8);
            g.fillRect(gx, roadHeight - 8, w, 8);
            gx += greenSegW + greenGapW;
        }
        // Lane edge lines
        g.fillStyle(0xbfc6d8, 0.6);
        g.fillRect(0, 12, W, 2);
        g.fillRect(0, roadHeight - 14, W, 2);
        // Center dashed line
        const centerY = Math.floor(roadHeight / 2);
        g.fillStyle(0xffffff, 0.85);
        const dashW = 38, gapW = 28;
        let x = 0;
        while (x < W) {
            g.fillRect(x, centerY - 2, dashW, 4);
            x += dashW + gapW;
        }
        // Speckle noise for texture
        g.fillStyle(0x000000, 0.04);
        for (let i = 0; i < 160; i++) {
            const nx = Phaser.Math.Between(0, W - 2);
            const ny = Phaser.Math.Between(0, roadHeight - 2);
            g.fillRect(nx, ny, 2, 2);
        }
        g.generateTexture(texKey, W, roadHeight);
        g.destroy();
        // Place image at bottom third
        const roadImg = this.add.image(W / 2, H - roadHeight / 2, texKey)
            .setDepth(-1)
            .setOrigin(0.5, 0.5);
        this.road = roadImg;

        // Roadside markers group to enhance motion perception
        this.roadPostGroup = this.add.group();
        // Pre-spawn a few markers
        for (let i = 0; i < 6; i++) {
            this.spawnRoadPost(W, H, roadHeight);
        }
    }

    // Spawn a small roadside marker on either edge of the road bottom third
    spawnRoadPost(W, H, roadHeight) {
        const isTopEdge = Math.random() < 0.5;
        const y = H - (isTopEdge ? roadHeight - 18 : 18);
        const x = Phaser.Math.Between(0, W);
        const key = `roadpost-${Phaser.Math.RND.uuid().slice(0,5)}`;
        const g = this.add.graphics();
        g.fillStyle(0x8fb57b, 1);
        g.fillRoundedRect(0, 0, 8, 22, 3);
        g.lineStyle(2, 0x2a3553, 0.8);
        g.strokeRoundedRect(0, 0, 8, 22, 3);
        g.generateTexture(key, 12, 24);
        g.destroy();
        const post = this.add.image(x, y, key).setDepth(0);
        post.speedFactor = Phaser.Math.FloatBetween(0.9, 1.3);
        this.roadPostGroup.add(post);
    }

    createParallax(W, H) {
        // City background occupying top 2/3, plus clouds and birds for motion
        const layers = [];
        const topHeight = Math.floor(H * 2 / 3);
        const bg = this.add.image(W / 2, topHeight / 2, 'cityBg').setDepth(-10);
        const scaleX = W / bg.width;
        const scaleY = topHeight / bg.height;
        bg.setScale(Math.max(scaleX, scaleY));
        layers.push({ sprite: bg, scrollFactor: 0 });

        // Clouds group
        const clouds = this.add.group();
        for (let i = 0; i < 10; i++) clouds.add(this.makeCloud(W, topHeight));
        layers.push({ sprite: clouds, scrollFactor: 0.6, isGroup: true });

        // Birds group
        const birds = this.add.group();
        for (let i = 0; i < 6; i++) birds.add(this.makeBird(W, topHeight));
        layers.push({ sprite: birds, scrollFactor: 0.8, isGroup: true });

        return layers;
    }

    makeCloud(W, H) {
        const key = `cloud-${Phaser.Math.RND.uuid().slice(0, 6)}`;
        const g = this.add.graphics();
        g.fillStyle(0xffffff, 1);
        const blobCount = Util.randInt(4, 7);
        for (let i = 0; i < blobCount; i++) {
            const bx = i * Util.randRange(16, 26);
            const by = Util.randRange(-4, 6);
            const br = Util.randRange(14, 24);
            g.fillCircle(bx, by, br);
        }
        g.fillStyle(0xe9eef9, 0.85);
        g.fillEllipse(Util.randRange(24, 48), Util.randRange(10, 14), Util.randRange(40, 70), Util.randRange(12, 18));
        g.generateTexture(key, 140, 60);
        g.destroy();
        const cloud = this.add.image(Util.randRange(0, W), Util.randRange(40, H / 2 - 30), key).setDepth(-4);
        cloud.setAlpha(Util.randRange(0.85, 1));
        cloud.speed = Util.randRange(10, 22);
        return cloud;
    }

    makeBird(W, H) {
        const key = `bird-${Phaser.Math.RND.uuid().slice(0, 6)}`;
        const g = this.add.graphics();
        g.fillStyle(0xcfd6ec, 1);
        g.fillTriangle(0, 8, 10, 0, 20, 8);
        g.generateTexture(key, 24, 12);
        g.destroy();
        const bird = this.add.image(Util.randRange(0, W), Util.randRange(80, H / 2 - 40), key).setDepth(-2);
        bird.speed = Util.randRange(24, 60);
        bird.dir = Math.random() < 0.5 ? 1 : -1;
        bird.setScale(Phaser.Math.FloatBetween(0.6, 1));
        return bird;
    }

    spawnSpeedcam(W, H) {
        const x = W + 60;
        // Position speedcams near the top green line of the road (bottom third)
        const roadHeight = Math.floor(H / 3);
        const y = H - roadHeight - 6; // slightly above the green line for visibility
        const key = `speedcam-${Phaser.Math.RND.uuid().slice(0, 5)}`;
        const g = this.add.graphics();
        g.fillStyle(0x3a4666, 1);
        g.fillRect(8, 0, 10, 70);
        g.fillStyle(0x2b3452, 1);
        g.fillRoundedRect(0, -12, 28, 24, 4);
        g.fillStyle(0xfff799, 0.9);
        g.fillCircle(8, 0, 4);
        g.generateTexture(key, 36, 70);
        g.destroy();
        const cam = this.add.image(x, y, key).setDepth(2);
        cam.triggered = false;
        this.speedcams.add(cam);
    }

    takeHit() {
        this.lives = Math.max(0, this.lives - 1);
        this.invulnTimer = 1.2;
        this.player.setTint(0xffaaaa);
        this.player.setVelocityY(-200);
        this.player.setVelocityX(-60);
        this.time.delayedCall(200, () => this.player.clearTint());
        if (this.lives <= 0) {
            this.respawnAtCheckpoint();
        }
    }

    respawnAtCheckpoint() {
        this.lives = 10;
        this.speed = 0;
        this.player.x = 160;
        this.player.y = this.groundY;
        this.player.setVelocity(0, 0);
        this.distance = this.milestoneIndex * this.nextMilestoneAt;
    }

    handleCrash() {
        this.gameOver = true;
        this.speed = 0;
        this.player.setTint(0xCF3D3E);
        const blocker = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0x000000).setAlpha(0).setDepth(999);
        this.tweens.add({ targets: blocker, alpha: { from: 0, to: 1 }, duration: 500, ease: 'Quad.easeOut' });
        this.time.delayedCall(600, () => this.showOutro(false));
    }

    showMilestonePanel(ms) {
        this.isPausedForPanel = true;
        this.physics.world.pause();
        // Stop motorcycle wheelie/jump loop while panel is open
        if (this.wheelieSfx && this.wheelieSfx.isPlaying) {
            this.wheelieSfx.stop();
        }
        // Increase title and text font sizes for better readability
        if (this.panelTitleEl) {
            this.panelTitleEl.style.fontSize = '36px';
        }
        if (this.panelTextEl) {
            this.panelTextEl.style.fontSize = '22px';
            this.panelTextEl.style.lineHeight = '1.4';
        }
        this.panelTitleEl.textContent = `${ms.title}`;
        this.panelTextEl.textContent = `${ms.text}`;
        this.sidepanelEl.classList.add('open');
    }

    spawnMilestonePin(W, H) {
        const brandColor = 0xCF3D3E;
        const key = `pin-${Phaser.Math.RND.uuid().slice(0, 6)}`;
        const g = this.add.graphics();
        g.fillStyle(brandColor, 1);
        g.beginPath();
        g.moveTo(20, 6);
        g.arc(20, 20, 14, Math.PI * 1.0, Math.PI * 3.0);
        g.lineTo(20, 46);
        g.closePath();
        g.fillPath();
        g.fillStyle(0xffffff, 0.95);
        g.fillCircle(20, 20, 8);
        g.generateTexture(key, 40, 52);
        g.destroy();
        const pin = this.milestonePins.create(W + 60, H - 120, key);
        // Increase pin size for better visibility
        pin.setScale(1.3);
        pin.setDepth(3);
        pin.body.setAllowGravity(false);
        pin.setVelocityX(0);
        pin.setImmovable(true);
        this.physics.add.overlap(this.player, pin, () => {
            if (!this.isPausedForPanel) {
                const ms = MILESTONES[this.milestoneIndex];
                this.milestoneIndex = Math.min(this.milestoneIndex + 1, MILESTONES.length);
                pin.destroy();
                this.currentPinSpawned = false;
                // Grant extra turbo charges at specific milestones (4th, 7th, 10th, 13th)
                if ([4, 7, 10, 13].includes(this.milestoneIndex)) {
                    const before = this.turboCount;
                    this.turboCount = Math.min(5, this.turboCount + 3);
                    // Small center note to inform the player
                    const W = this.scale.width, H = this.scale.height;
                    const msg = this.add.text(W / 2, H / 2 - 120, `Turbo recharged: +${this.turboCount - before} (max 5)`, {
                        fontSize: '22px', color: '#f6ff00'
                    }).setOrigin(0.5).setDepth(1000);
                    this.tweens.add({ targets: msg, alpha: { from: 1, to: 0 }, duration: 1200, delay: 600, onComplete: () => msg.destroy() });
                }
                this.showMilestonePanel(ms);
            }
        });
    }

    closeMilestonePanel() {
        this.sidepanelEl.classList.remove('open');
        this.isPausedForPanel = false;
        this.physics.world.resume();
    }

    showOutro(success) {
        const { width: W, height: H } = this.scale;
        const panel = this.add.container(W / 2, H / 2).setDepth(1000);
        const bg = this.add.rectangle(0, 0, W * 0.8, H * 0.6, 0x121a2f).setStrokeStyle(2, 0x253052, 0.8);
        const title = this.add.text(0, -H * 0.18, success ? 'Journey Complete' : 'Game Over', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);
        const brand = this.add.text(0, -H * 0.26, 'The Scenic Moto Run', { fontSize: '18px', color: '#CF3D3E' }).setOrigin(0.5);
        const msgText = success ? 'You reached all 17 milestones. Scenic memories unlocked.' : 'The ride paused. Try again for the views.';
        const msg = this.add.text(0, -20, msgText, { fontSize: '18px', color: '#cfd6ec' }).setOrigin(0.5);
        const hint = this.add.text(0, 40, 'Press Space to Restart', { fontSize: '18px', color: '#cfd6ec' }).setOrigin(0.5);
        panel.add([bg, brand, title, msg, hint]);
        this.tweens.add({ targets: panel, alpha: { from: 0, to: 1 }, duration: 220, ease: 'Quad.easeOut' });
        this.input.keyboard.once('keydown-SPACE', () => this.scene.start('MainMenu'));
    }

    makeSkyCycleTexture(W, H, p) {
        const sunriseTop = 0x284a7a, sunriseBottom = 0xffbd7a;
        const noonTop = 0x87c9ff, noonBottom = 0xcde6ff;
        const duskTop = 0x16284a, duskBottom = 0x2a4a7a;
        let top, bottom;
        if (p <= 0.6) {
            const t = p / 0.6;
            top = Util.lerpColor(sunriseTop, noonTop, t);
            bottom = Util.lerpColor(sunriseBottom, noonBottom, t);
        } else {
            const t = (p - 0.6) / 0.4;
            top = Util.lerpColor(noonTop, duskTop, t);
            bottom = Util.lerpColor(noonBottom, duskBottom, t);
        }
        const g = this.add.graphics();
        g.fillGradientStyle(top, 1, top, 1, bottom, 1, bottom, 1, 1);
        g.fillRect(0, 0, W, H);
        const key = `skyCycleTex-${Math.floor(p * 1000)}`;
        g.generateTexture(key, W, H);
        g.destroy();
        return key;
    }

    update(time, delta) {
        const dt = delta / 1000;
        if (this.gameOver) return;
        const sp = this.speed / this.maxSpeed;
        // Default zoom behavior based on player speed; may be overridden during police slowdown
        let targetZoom = 1 + sp * 0.08;
        // Extra zoom punch in Ghostrider turbo (600 km/h)
        if (this.isTurbo && this.skulls >= 6) {
            targetZoom += 0.06; // subtle add-on zoom during 600 turbo
        }
        // ! TODO - Rethink: Anchor motorcycle bottom to viewport bottom regardless of zoom 
        {
            const z = this.cameras.main.zoom || 1;
            const spriteHalfH = this.player.height * 0.3;
            const bottomPad = 10; // small visual padding from bottom edge
            this.groundY = (this.scale.height - bottomPad - spriteHalfH) / z;
        }
        if (sp > 0.6) {
            // Slightly stronger shake when in Ghostrider mode
            const extra = this.skulls >= 6 ? 0.002 : 0;
            this.cameras.main.shake(60, 0.002 + sp * 0.004 + extra, true);
        }
        // Ensure background shaking appears during Ghostrider turbo (600 km/h)
        if (this.skulls >= 6 && this.isTurbo) {
            this.cameras.main.shake(90, 0.004, true);
        }

        if (sp > 0.55) {
            this.lastLineSpawn += dt;
            if (this.lastLineSpawn > 0.06) {
                this.lastLineSpawn = 0;
                const key = `line-${Phaser.Math.RND.uuid().slice(0, 5)}`;
                const g = this.add.graphics();
                g.fillStyle(0xffffff, 0.18 + sp * 0.25);
                g.fillRoundedRect(0, 0, Phaser.Math.Between(18, 42), Phaser.Math.Between(2, 3), 2);
                g.generateTexture(key, 44, 6);
                g.destroy();
                const y = Phaser.Math.Between(this.groundY - 80, this.groundY - 10);
                const line = this.add.image(this.player.x + 40, y, key).setDepth(4);
                line.alpha = 0.0;
                this.speedLineGroup.add(line);
                this.tweens.add({ targets: line, alpha: { from: 0, to: 1 }, duration: 60, yoyo: true, onComplete: () => line.destroy() });
            }
        }

        if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

        if (this.isPausedForPanel) {
            if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) this.closeMilestonePanel();
            return;
        }

        // During turbo slowdown phase, let the interpolator control speed (avoid immediate clamp to base max)
        if (!this.isTurboSlowing) {
            if (this.keys.right.isDown) this.speed = Util.clamp(this.speed + this.accel * dt, 0, this.maxSpeed);
            else if (this.keys.left.isDown) this.speed = Util.clamp(this.speed - this.brake * dt, 0, this.maxSpeed);
            else this.speed = Util.clamp(this.speed - 40 * dt, 0, this.maxSpeed);
        }

        // Start jump/wheelie on initial press: start looping sound while held
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            if (this.wheelieSfx) this.wheelieSfx.play({ loop: true });
            if (this.player.y >= this.groundY - 2) {
                this.player.setVelocityY(-420);
                this.isJumping = true;
                this.jumpHoldTime = 0;
            }
            // Trigger turbo on SPACE press
            // Ghostrider mode (6+ skulls): infinite turbo while SPACE is held (no charge consumption)
            // Otherwise: consume a charge if available
            if (!this.isTurbo && ((this.skulls >= 6) || this.turboCount > 0)) {
                this.isTurbo = true;
                this.turboElapsed = 0;
                this.maxSpeedPrev = this.maxSpeed;
                // If 6+ skulls, use Ghostrider turbo speed; otherwise normal turbo speed
                this.maxSpeed = (this.skulls >= 6) ? this.turboPosBiasGhostriderSpeed : this.turboMaxSpeed;
                this.turboStartSpeed = this.speed;
                // Consume one charge on press only if not in Ghostrider mode
                if (this.skulls < 6) {
                    this.turboCount = Math.max(0, Math.min(5, this.turboCount - 1));
                }
            }
        }

        // Sustain jump/wheelie while SPACE is held, for a consistent feel
        if (this.keys.space.isDown) {
            if (this.isJumping) {
                // Allow sustained upward acceleration while within max hold window
                if (this.jumpHoldTime < this.maxJumpHold) {
                    this.jumpHoldTime += dt;
                    // Apply a gentler upward acceleration to prevent infinite lift
                    this.player.setVelocityY(Math.min(this.player.body.velocity.y + 300 * dt, -60));
                }
            } else if (this.player.y >= this.groundY - 2) {
                // If on ground and holding SPACE, keep a slight wheelie posture
                this.isJumping = true;
                this.jumpHoldTime = 0;
                this.player.setVelocityY(-280);
            }
            // Keep the bike tilted while holding SPACE
            this.player.setAngle(-12);
        } else {
            // On release, stop sustaining and ease angle back when grounded
            if (this.player.y >= this.groundY - 2) {
                this.player.setAngle(0);
                this.isJumping = false;
                this.jumpHoldTime = 0;
            }
        }

        // Handle SPACE release audio: stop loop, no extra play
        if (this.spaceWasDown && !this.keys.space.isDown) {
            // Stop wheelie/jump sound loop on release
            if (this.wheelieSfx) {
                this.wheelieSfx.stop();
            }
            // End turbo on release and revert speed cap (charge already consumed on press)
            if (this.isTurbo) {
                this.isTurbo = false;
                // Restore max speed to base and start smooth slowdown to base cap over 1.2s
                this.maxSpeed = this.maxSpeedPrev ?? 322;
                this.isTurboSlowing = true;
                this.turboSlowElapsed = 0;
                this.turboSlowStartSpeed = this.speed;
            }
        }
        // Update tracked state
        this.spaceWasDown = this.keys.space.isDown;

        // Auto-end turbo if it exceeds max duration (3 seconds), except in Ghostrider mode (6+ skulls)
        if (this.isTurbo && this.skulls < 6) {
            this.turboElapsed += dt;
            if (this.turboElapsed >= this.turboHoldDuration) {
                // End turbo but do not stop wheelie sound (still may be held)
                this.isTurbo = false;
                this.maxSpeed = this.maxSpeedPrev ?? 322;
                this.isTurboSlowing = true;
                this.turboSlowElapsed = 0;
                this.turboSlowStartSpeed = this.speed;
            }
        }

        // Speed up background parallax when turbo is active or in slowdown phase
        // In Ghostrider turbo (600 km/h), boost parallax even more for intensity
        const parallaxMultiplier = (this.isTurbo || this.isTurboSlowing)
            ? (this.skulls >= 6 ? 3.2 : 2.4)
            : 1.8;
        const scrollX = this.speed * dt * parallaxMultiplier;
        for (const layer of this.layers) {
            if (layer.isGroup) {
                layer.sprite.getChildren().forEach((s) => {
                    s.x -= scrollX * layer.scrollFactor;
                    if (this.speed > 0) {
                        if (s.texture && s.texture.key.startsWith('cloud')) {
                            if (s.x < -80) s.x = this.scale.width + Util.randRange(0, 120);
                        } else if (s.texture && s.texture.key.startsWith('bird')) {
                            if (s.x < -40 || s.x > this.scale.width + 40) {
                                s.x = s.dir > 0 ? -20 : this.scale.width + 20;
                                s.y = Util.randRange(80, this.scale.height / 2 - 40);
                            }
                        }
                    }
                });
            } else {
                layer.sprite.x -= scrollX * (layer.scrollFactor * 1.3);
                if (layer.sprite.x < -this.scale.width / 2) layer.sprite.x = this.scale.width / 2;
            }
        }

        // Move roadside markers to enhance speed feel; recycle when off-screen
        if (this.roadPostGroup) {
            this.roadPostGroup.getChildren().forEach((post) => {
                post.x -= scrollX * 1.4 * (post.speedFactor || 1);
                if (post.x < -20) {
                    post.x = this.scale.width + Phaser.Math.Between(0, 60);
                    // Randomly choose top/bottom edge of the road
                    const roadHeight = Math.floor(this.scale.height / 3);
                    const isTopEdge = Math.random() < 0.5;
                    post.y = this.scale.height - (isTopEdge ? roadHeight - 18 : 18);
                }
            });
        }

        if (this.player.y < this.groundY) {
            this.player.setVelocityY(this.player.body.velocity.y + 580 * dt);
        } else {
            this.player.y = this.groundY;
            this.player.setVelocityY(0);
            this.isJumping = false;
        }

        const baseX = 140;
        const maxAdvance = this.scale.width * 0.25;
        // Update turbo position bias target depending on state and Ghostrider mode
        if (this.isTurbo || this.isTurboSlowing) {
            this.turboPosBiasTarget = (this.skulls >= 6) ? this.turboPosBiasGhostriderMax : this.turboPosBiasMax;
        } else {
            this.turboPosBiasTarget = 0;
        }
        // Smoothly move bias towards target
        const biasDelta = this.turboPosBiasTarget - this.turboPosBias;
        const biasStep = Phaser.Math.Clamp(biasDelta, -this.turboPosBiasSpeed * dt, this.turboPosBiasSpeed * dt);
        this.turboPosBias += biasStep;
        // Compute base target X and apply bias towards screen center (positive bias pushes right)
        const targetX = baseX + (maxAdvance - baseX) * (this.speed / this.maxSpeed) + this.turboPosBias;
        // Clamp within safe horizontal bounds
        const safeMinX = 60;
        const safeMaxX = this.scale.width - 60;
        const clampedTargetX = Phaser.Math.Clamp(targetX, safeMinX, safeMaxX);
        this.player.x += (clampedTargetX - this.player.x) * Math.min(1, 4 * dt);

        // Track if any police car is in slowing phase to adjust camera zoom
        let anyPoliceSlowing = false;

        // Update police car AI: move towards player with current speed
        if (this.policeCars) {
            this.policeCars.getChildren().forEach((car) => {
                // Drift left as world scrolls
                car.x += -this.speed * dt * 0.7;
                if (car.isChasing) {
                    // Move car forward based on its own speed
                    car.x -= (car.speed * dt * 0.7);
                    // Slight steering towards player x with dynamic trailing based on player's speed
                    let trailBehind = 60;
                    // When player is in turbo, increase trailing distance; even more in Ghostrider (600 km/h)
                    if (this.isTurbo || this.isTurboSlowing) {
                        if (this.skulls >= 6) {
                            // In Ghostrider mode, trail even further as speed approaches 600
                            const speedFactor = Phaser.Math.Clamp((this.speed - 400) / 200, 0, 1); // 0 at 400, 1 at 600
                            trailBehind = 240 + 120 * speedFactor; // up to ~360px behind at 600
                        } else {
                            trailBehind = 180; // moderate trailing at 400 km/h
                        }
                    }
                    const targetX = this.player.x - trailBehind;
                    car.x += (targetX - car.x) * Math.min(1, 2.5 * dt);
                    // Visual tilt depending on chase state
                    car.setAngle(Phaser.Math.Clamp((car.speed - car.maxSpeed) * 0.05, 0, 8));
                    // Handle deceleration phase after turbo ends
                    if (car.isSlowing) {
                        anyPoliceSlowing = true;
                        // Linear deceleration over slowDuration seconds
                        car.slowElapsed = (car.slowElapsed || 0) + dt;
                        const tSlow = car.slowDuration ? car.slowElapsed / car.slowDuration : 1;
                        const tClamped = Phaser.Math.Clamp(tSlow, 0, 1);
                        car.speed = Phaser.Math.Linear(car.slowStartSpeed || car.speed, car.maxSpeed, tClamped);
                        // Update HUD to reflect current speed
                        if (car.hud) {
                            car.hud.setText(`${Math.round(car.speed)} km/h`);
                            car.hud.x = car.x;
                            car.hud.y = car.y - 40;
                        }
                        if (tClamped >= 1) {
                            car.isSlowing = false;
                            car.reachedCap = true;
                        }
                    } else {
                        // Ensure speed doesn't  e
                        //  xceed maxSpeed outside slowdown logic
                        car.speed = Math.min(car.speed, car.maxSpeed);
                        // Keep HUD positioned
                        if (car.hud) {
                            car.hud.x = car.x;
                            car.hud.y = car.y - 40;
                        }
                    }
                }
                // Cleanup if far off left
                if (car.x < -120) {
                    if (car.hud) car.hud.destroy();
                    car.destroy();
                    if (this.finalPolice === car) this.finalPolice = null;
                }
            });
        }

        // During police slowdown, reduce zoom proportionally to police speed; restore afterward
        if (anyPoliceSlowing) {
            let maxPoliceSpeed = 0;
            this.policeCars.getChildren().forEach((car) => {
                if (car.isSlowing) maxPoliceSpeed = Math.max(maxPoliceSpeed, car.speed || 0);
            });
            // Map speed 428..280 -> zoom 0.95..0.90
            const zOut = Phaser.Math.Linear(0.95, 0.90, Phaser.Math.Clamp((428 - maxPoliceSpeed) / (428 - 280), 0, 1));
            targetZoom = Math.min(targetZoom, zOut);
        }

        // If the final (3rd) police car is active, progressively zoom out further each second
        if (this.finalPolice && this.finalPolice.active) {
            const t = Phaser.Math.Clamp((this.finalPolice.finalElapsed || 0) / 15.0, 0, 1);
            const zFinal = Phaser.Math.Linear(0.92, 0.85, t);
            targetZoom = Math.min(targetZoom, zFinal);
            // In Ghostrider turbo, push third car rapidly left until it disappears
            if (this.isTurbo && this.skulls >= 6) {
                // Push final police rapidly left; accelerate push at top speed
                const pushFactor = 2.2 + Phaser.Math.Clamp((this.speed - 500) / 100, 0, 1) * 1.2; // up to ~3.4x at 600
                this.finalPolice.x -= this.speed * dt * pushFactor;
                // If player reaches 600 and grace period passed, despawn immediately
                const atTopSpeed = this.speed >= this.turboPosBiasGhostriderSpeed - 0.1;
                if ((atTopSpeed && this.finalPoliceCanDisappearAfterGhostrider) || this.finalPolice.x < -200) {
                    if (this.finalPoliceCanDisappearAfterGhostrider) {
                        if (this.finalPolice.hud) this.finalPolice.hud.destroy();
                        this.finalPolice.destroy();
                        this.finalPolice = null;
                        this.finalZoomRecover = true;
                    } else {
                        // Hold near edge until grace period ends
                        this.finalPolice.x = -200;
                    }
                }
            }
        }

        // Smooth zooming: gently interpolate current zoom towards target with safe bounds
        const currentZoom = this.cameras.main.zoom || 1;
        const smooth = 0.06; // smoothing factor for zoom transitions
        // Clamp target zoom to prevent extreme values hiding sprites
        const clampedTargetZoom = Phaser.Math.Clamp(targetZoom, 0.9, this.skulls >= 6 && this.isTurbo ? 1.12 : 1.06);
        const nextZoom = Phaser.Math.Linear(currentZoom, clampedTargetZoom, smooth);
        this.cameras.main.setZoom(nextZoom);

        // Synchronized despawn: first police car disappears together with the second
        if (this.policeBatch && this.policeBatch.length === 2) {
            const [c1, c2] = this.policeBatch;
            if (c1 && c2 && c1.active && c2.active && c1.reachedCap && c2.reachedCap) {
                if (c1.hud) c1.hud.destroy();
                if (c2.hud) c2.hud.destroy();
                c1.destroy();
                c2.destroy();
                this.policeBatch = [];
            }
        }

        // After final police disappears, smoothly recover zoom towards player-top-speed zoom
        if (this.finalZoomRecover && !this.finalPolice) {
            const topSpeedZoom = 1 + sp * 0.08;
            const cz = this.cameras.main.zoom || 1;
            const recover = Phaser.Math.Linear(cz, topSpeedZoom, 0.04);
            this.cameras.main.setZoom(recover);
            if (Math.abs(recover - topSpeedZoom) < 0.003) {
                this.finalZoomRecover = false;
            }
        }

        this.speedcams.getChildren().forEach((cam) => {
            cam.x += -this.speed * dt * 0.7;
            // Keep any flash effect tethered to the camera position
            if (cam.flash && cam.flash.active) {
                cam.flash.x = cam.x;
                cam.flash.y = cam.y - 46;
            }
            if (cam.x < -80) cam.destroy();
            if (!this.gameOver && !this.isPausedForPanel && !cam.triggered && this.player.x > cam.x + 10) {
                cam.triggered = true;
                this.SFX.playSpeedcam();
                // Flashing light effect: small white strobe on camera and brief fullscreen white flash
                const flashKey = `flash-${Phaser.Math.RND.uuid().slice(0,5)}`;
                const fg = this.add.graphics();
                fg.fillStyle(0xffffff, 0.98);
                fg.fillCircle(10, 10, 10);
                fg.generateTexture(flashKey, 20, 20);
                fg.destroy();
                const flash = this.add.image(cam.x, cam.y - 46, flashKey).setDepth(3);
                flash.setAlpha(0);
                // Tether flash to the speedcam so it moves with it until destroyed
                cam.flash = flash;
                this.tweens.add({
                    targets: flash,
                    alpha: { from: 0, to: 1 },
                    duration: 70,
                    yoyo: true,
                    repeat: 1,
                    onComplete: () => {
                        if (cam.flash === flash) cam.flash = null;
                        flash.destroy();
                    }
                });
                // Fullscreen white flash overlay (very brief)
                const overlay = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xffffff)
                    .setDepth(999)
                    .setAlpha(0);
                this.tweens.add({
                    targets: overlay,
                    alpha: { from: 0, to: 0.6 },
                    duration: 60,
                    yoyo: true,
                    onComplete: () => overlay.destroy()
                });
                // Spooky center text on speedcam trigger (only before the 5th skull)
                let ghostMsg = null;
                if (this.skulls < 5) {
                    const W = this.scale.width, H = this.scale.height;
                    ghostMsg = this.add.text(W / 2, H / 2, 'I see you GHOSTRIDER ☠️', {
                        fontSize: '64px',
                        fontFamily: 'Papyrus, Creepster, Georgia, serif',
                        color: '#ffffff'
                    }).setOrigin(0.5).setDepth(1000);
                    // Shake effect
                    this.tweens.add({
                        targets: ghostMsg,
                        x: { from: ghostMsg.x - 6, to: ghostMsg.x + 6 },
                        y: { from: ghostMsg.y - 4, to: ghostMsg.y + 4 },
                        duration: 80,
                        yoyo: true,
                        repeat: 15,
                        ease: 'Sine.easeInOut'
                    });
                    // Fade out and destroy
                    this.tweens.add({
                        targets: ghostMsg,
                        alpha: { from: 1, to: 0 },
                        delay: 1400,
                        duration: 400,
                        onComplete: () => ghostMsg.destroy()
                    });
                }
                // Increase skulls on each speedcam trigger (cap at 10)
                const before = this.skulls;
                this.skulls = Math.min(this.skulls + 1, 10);
                // Play creepy ghost whisper only on first and fifth skull
                if (this.skulls > before && (this.skulls === 1 || this.skulls === 5) && this.ghostSfx) {
                    this.ghostSfx.play();
                }
                // On crossing into Ghostrider mode (exact moment of reaching 6 skulls)
                if (before < 6 && this.skulls >= 6) {
                    // Stop whisper if it is still playing
                    if (this.ghostSfx && this.ghostSfx.isPlaying) this.ghostSfx.stop();
                    // Play ghostrider mode activation SFX once, slightly louder than bg
                    if (this.ghostriderModeSfx) this.ghostriderModeSfx.play({ loop: false, volume: 0.95 });
                    // Adjust background music during Ghostrider mode (set to 0.20)
                    if (this.bgMusic) this.bgMusic.setVolume(0.20);
                    // Start subtle periodic camera shake to emphasize Ghostrider mode
                    if (!this.ghostShakeEvent) {
                        this.ghostShakeEvent = this.time.addEvent({
                            delay: 900,
                            loop: true,
                            callback: () => {
                                // Stronger periodic shake to emphasize Ghostrider mode
                                this.cameras.main.shake(180, 0.005, true);
                            }
                        });
                    }
                    // Schedule final police disappearance 3.5s after Ghostrider starts
                    if (this.finalPolice && !this.finalPoliceGhostriderTimer) {
                        this.finalPoliceCanDisappearAfterGhostrider = false;
                        this.finalPoliceGhostriderTimer = this.time.delayedCall(3500, () => {
                            this.finalPoliceCanDisappearAfterGhostrider = true;
                        });
                    }
                }

                // Show overlay when player reaches 6 skulls
                if (!this.ghostOverlay.visible && this.skulls >= 6) {
                    this.ghostOverlay.setVisible(true);
                }

                // On skull change, burst a ring of fire around the player (sprite-based)
                if (this.skulls > before) {
                    this.spawnFireBurst();
                }

                // On third skull turning white, change center text to WANTED
                if (ghostMsg && before < 3 && this.skulls >= 3) {
                    ghostMsg.setText('GHOSTRIDER WANTED 🚓');
                }

                // After second skull turns white, show yellow warning text
                if (before < 2 && this.skulls >= 2) {
                    const W = this.scale.width, H = this.scale.height;
                    const warn = this.add.text(W / 2, H / 2 + 70, 'GHOSTRIDER be aware your are WANTED soon 🚨!', {
                        fontSize: '32px',
                        fontFamily: 'Papyrus, Creepster, Georgia, serif',
                        color: '#f6ff00'
                    }).setOrigin(0.5).setDepth(1000);
                    this.tweens.add({
                        targets: warn,
                        x: { from: warn.x - 4, to: warn.x + 4 },
                        duration: 90,
                        yoyo: true,
                        repeat: 12,
                        ease: 'Sine.easeInOut'
                    });
                    this.tweens.add({
                        targets: warn,
                        alpha: { from: 1, to: 0 },
                        delay: 1400,
                        duration: 450,
                        onComplete: () => warn.destroy()
                    });
                }

                // After 3rd, 4th, and 5th speedcam, spawn police and start chase
                if ((before < 3 && this.skulls >= 3) || (before < 4 && this.skulls >= 4) || (before < 5 && this.skulls >= 5)) {
                    this.spawnPoliceAndChase(this.scale.width, this.scale.height);
                }
            }
        });

        this.milestonePins.getChildren().forEach((pin) => {
            pin.x += -this.speed * dt * 0.6;
            if (pin.x < -80) pin.destroy();
        });

        this.distance += this.speed * dt;
        const target = (this.milestoneIndex + 1) * this.nextMilestoneAt;
        if (!this.currentPinSpawned && this.milestoneIndex < MILESTONES.length && this.distance >= target - 100) {
            this.spawnMilestonePin(this.scale.width, this.scale.height);
            this.currentPinSpawned = true;
        }

        const progress = Math.min(this.milestoneIndex / MILESTONES.length, 1);
        // Time-of-day overlay removed; keep static city background

        if (this.milestoneIndex >= MILESTONES.length && !this.gameOver) {
            // Show a large center message once the last milestone is reached
            if (!this.continuedShown) {
                this.continuedShown = true;
                const W = this.scale.width, H = this.scale.height;
                const msg = this.add.text(W / 2, H / 2, 'TO BE CONTINUED', {
                    fontSize: '72px',
                    color: '#f6ff00',
                    fontFamily: 'Georgia, serif'
                }).setOrigin(0.5).setDepth(1000);
                // Gentle pulse to draw attention
                this.tweens.add({
                    targets: msg,
                    scale: { from: 1.0, to: 1.06 },
                    yoyo: true,
                    repeat: -1,
                    duration: 600,
                    ease: 'Sine.easeInOut'
                });
            }
            this.input.keyboard.once('keydown-ENTER', () => {
                this.closeMilestonePanel();
                this.time.delayedCall(600, () => this.showOutro(true));
            });
        }

        this.updateHUD();
        this.updateCockpitHUD();
        this.updateTimerUI(dt);

        // Handle smooth slowdown from turbo: linearly reduce speed to base cap over configured duration
        if (this.isTurboSlowing) {
            this.turboSlowElapsed += dt;
            const t = Phaser.Math.Clamp(this.turboSlowElapsed / this.turboSlowDuration, 0, 1);
            const targetSpeed = Math.min(this.turboSlowStartSpeed, this.maxSpeed);
            // Interpolate from start speed to target capped speed
            this.speed = Phaser.Math.Linear(this.turboSlowStartSpeed, targetSpeed, t);
            if (t >= 1) {
                this.isTurboSlowing = false;
                // Ensure final clamp
                this.speed = Math.min(this.speed, this.maxSpeed);
            }
        }
    }

    spawnPoliceAndChase(W, H) {
        const car = this.physics.add.sprite(W + 80, this.groundY, 'policeCar').setDepth(3);
        car.body.setAllowGravity(false);
        car.setCollideWorldBounds(false);
        car.setScale(0.85);
        car.maxSpeed = 280; // steady chase cap
        car.turboSpeed = 428; // initial turbo burst
        car.speed = 0;
        car.isChasing = false;
        car.isSlowing = false; // indicates post-turbo deceleration phase
        car.isFinal = false;
        car.reachedCap = false;
        // HUD displaying police speed
        const hud = this.add.text(0, 0, '428 km/h', { fontSize: '18px', color: '#eaeef6' }).setDepth(4).setOrigin(0.5);
        car.hud = hud;
        this.policeCars.add(car);

        // Start chase 0.5s after trigger
        this.time.delayedCall(500, () => {
            if (!car.active) return;
            car.isChasing = true;
            car.speed = car.turboSpeed;
            // Count spawns and mark 3rd car as final
            this.policeSpawnCount += 1;
            if (this.policeSpawnCount === 3) {
                car.isFinal = true;
                this.finalPolice = car;
                car.finalElapsed = 0;
                // Each second accumulate elapsed for progressive zoom
                car.finalTick = this.time.addEvent({ delay: 1000, loop: true, callback: () => {
                    if (!car.active) return;
                    car.finalElapsed += 1;
                }});
                // Despawn after 15s regardless of speed
                this.time.delayedCall(15000, () => {
                    if (!car.active) return;
                    if (car.hud) car.hud.destroy();
                    car.destroy();
                    this.finalPolice = null;
                    this.finalZoomRecover = true;
                });
            }
            // Pair cars: first car only disappears together with second
            if (!this.policeBatch || this.policeBatch.length >= 2) this.policeBatch = [];
            car.batchId = this.policeBatch.batchId || Phaser.Math.RND.uuid();
            this.policeBatch.batchId = car.batchId;
            this.policeBatch.push(car);
            // End turbo after 1.5s, then start slowing down towards maxSpeed
            this.time.delayedCall(1500, () => {
                if (!car.active) return;
                // Begin controlled slowdown phase until reaching maxSpeed (280)
                car.isSlowing = true;
                car.slowStartSpeed = car.speed;
                car.slowElapsed = 0;
                car.slowDuration = 2.5; // seconds for linear slowdown
            });
        });
    }

    updateHUD() {
                // Legacy HUD removed; no-op
                return;
    }

    // Create a semicircular cockpit HUD rendered with Phaser graphics
    createCockpitHUD() {
        const radius = 120;
        this.cockpit = this.add.container(0, 0).setDepth(10);

        const g = this.add.graphics();
        g.fillStyle(0x0f172a, 0.92);
        g.lineStyle(2, 0x253052, 0.9);
        // Semicircle arc (bottom half open)
        g.beginPath();
        g.arc(0, 0, radius, Math.PI, 2 * Math.PI);
        g.lineTo(0, 0);
        g.closePath();
        g.fillPath();
        g.strokePath();

        // Tick marks for speed segments
        const ticks = 7;
        for (let i = 0; i <= ticks; i++) {
            const t = i / ticks;
            const ang = Math.PI + t * Math.PI; // π..2π
            const r1 = radius - 18;
            const r2 = radius - 6;
            const x1 = Math.cos(ang) * r1;
            const y1 = Math.sin(ang) * r1;
            const x2 = Math.cos(ang) * r2;
            const y2 = Math.sin(ang) * r2;
            g.lineStyle(2, 0x2a3553, 1);
            g.beginPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.strokePath();
        }

        // Speed text (neon yellow)
        const speedLabel = this.add.text(0, -34, '0', { fontSize: '28px', color: '#f6ff00' }).setOrigin(0.5);
        const kmh = this.add.text(0, -10, 'km/h', { fontSize: '12px', color: '#cfd6ec' }).setOrigin(0.5);

        // Milestones counter (bottom-right of HUD)
        const milestoneText = this.add.text(70, -20, '0/17', { fontSize: '14px', color: '#eaeef6' }).setOrigin(0.5);
        // Turbo counter (top-right of HUD)
        const turboText = this.add.text(70, -46, 'Turbo: 5/5', { fontSize: '12px', color: '#eaeef6' }).setOrigin(0.5);

        // Speed needle
        const needle = this.add.graphics();
        needle.lineStyle(3, 0xCF3D3E, 1);
        needle.beginPath();
        needle.moveTo(0, 0);
        needle.lineTo(radius - 26, 0);
        needle.strokePath();

        this.cockpit.add([g, speedLabel, kmh, milestoneText, turboText, needle]);
        this.cockpitRadius = radius;
        this.cockpitNeedle = needle;
        this.cockpitSpeedLabel = speedLabel;
        this.cockpitMilestoneText = milestoneText;
        this.cockpitTurboText = turboText;

        // Hide legacy DOM HUD once cockpit is visible
        if (this.hudEl) this.hudEl.style.display = 'none';
    }

    // Update cockpit position and values (placed slightly in front of motorcycle)
    updateCockpitHUD() {
        if (!this.cockpit) return;
        const offsetX = 20;
        // position above the upper corner of the motorcycle (~ -120px from the top of sprite)
        const playerTopY = this.player.y - (this.player.height / 2);
        const offsetY = -16;
        this.cockpit.x = this.player.x + offsetX;
        this.cockpit.y = playerTopY + offsetY;

        // Keep ghost overlay following the motorcycle
        if (this.ghostOverlay) {
            const tilt = this.player.angle || 0;
            const offsetX = tilt < 0 ? 6 : 12; // more to the right when not wheelie
            const offsetY = tilt < 0 ? -(this.player.height * 0.35) : -(this.player.height * 0.35);
            this.ghostOverlay.x = this.player.x + offsetX;
            this.ghostOverlay.y = this.player.y + offsetY;
        }

        // Update numeric speed
        const speedVal = Math.round(this.speed);
        this.cockpitSpeedLabel.setText(String(speedVal));

        // Update milestones
        const msVal = `${Math.min(this.milestoneIndex, 17)}/17`;
        this.cockpitMilestoneText.setText(msVal);
        // Update turbo counter UI (max 5)
        if (this.cockpitTurboText) {
            if (this.skulls >= 6) {
                // In Ghostrider mode, show infinite turbo
                this.cockpitTurboText.setText('Turbo: ∞');
            } else {
                const tLeft = Math.max(0, Math.min(5, this.turboCount));
                this.cockpitTurboText.setText(`Turbo: ${tLeft}/5`);
            }
            // Slight highlight when turbo is active
            this.cockpitTurboText.setColor(this.isTurbo ? '#f6ff00' : '#eaeef6');
        } 


        // Needle angle based on speed (map 0..maxSpeed to π..2π)
        const t = Phaser.Math.Clamp(this.speed / this.maxSpeed, 0, 1);
        const ang = Math.PI + t * Math.PI; // π..2π
        this.cockpitNeedle.setRotation(ang);

        // Update fixed skulls UI
        this.updateLivesUI();

        // For 6+ skulls, keep a subtle continuous flame using timed bursts
        if (this.skulls >= 6) {
            if (!this.fireLoopEvent) {
                this.fireLoopEvent = this.time.addEvent({
                    delay: 90,
                    loop: true,
                    callback: () => this.spawnSmallFlame()
                });
                // Start flames near skull UI
                if (!this.skullFireLoopEvent) {
                    this.skullFireLoopEvent = this.time.addEvent({
                        delay: 160,
                        loop: true,
                        callback: () => this.spawnSkullFlame()
                    });
                }
            }
        } else {
            if (this.fireLoopEvent) {
                this.fireLoopEvent.remove(false);
                this.fireLoopEvent = null;
            }
            if (this.skullFireLoopEvent) {
                this.skullFireLoopEvent.remove(false);
                this.skullFireLoopEvent = null;
            }
        }
    }

    // Spawn a quick burst of flames around the player
    spawnFireBurst() {
        const positions = [
            { x: 26, y: -18 },
            { x: 36, y: -22 },
            { x: 16, y: -24 },
            { x: 28, y: -10 },
            { x: 40, y: -12 },
            { x: 20, y: -16 },
        ];
        positions.forEach((p, i) => {
            this.spawnFlameSprite(this.player.x + p.x, this.player.y + p.y, 1.0 - i * 0.06);
        });
        // Extra random sparks for intensity
        for (let i = 0; i < 6; i++) {
            const rx = this.player.x + Phaser.Math.Between(18, 44);
            const ry = this.player.y + Phaser.Math.Between(-28, -8);
            this.spawnFlameSprite(rx, ry, Phaser.Math.FloatBetween(0.6, 0.9));
        }
    }

    // Spawn a single subtle flame for continuous effect
    spawnSmallFlame() {
        const jitterX = Phaser.Math.Between(18, 40); // in front of the player
        const jitterY = Phaser.Math.Between(-28, -14);
        this.spawnFlameSprite(this.player.x + jitterX, this.player.y + jitterY, Phaser.Math.FloatBetween(0.7, 1.0));
    }

    // Helper to create and animate a flame sprite (fade and shrink, then destroy)
    spawnFlameSprite(x, y, startScale = 0.8) {
        const s = this.add.image(x, y, 'flameParticle').setDepth(this.fireDepth);
        s.setScale(startScale);
        s.setAlpha(0.95);
        this.fireGroup.add(s);
        // Upward drift and fade
        this.tweens.add({
            targets: s,
            y: y - Phaser.Math.Between(10, 22),
            alpha: { from: 0.95, to: 0 },
            scale: { from: startScale, to: Math.max(0.2, startScale * 0.4) },
            duration: Phaser.Math.Between(380, 620),
            ease: 'Quad.easeOut',
            onComplete: () => s.destroy()
        });
    }

    // Flames appearing next to the skull UI (top-left)
    spawnSkullFlame() {
        if (!this.skullContainer) return;
        const z = this.cameras.main.zoom || 1;
        const baseX = this.skullContainer.x;
        const baseY = this.skullContainer.y;
        // Position near the right side of the skull bar
        const uiX = baseX * z + 16 * z + 22 * (Math.min(this.skulls, 10) - 1) * z + Phaser.Math.Between(-6, 10) * z;
        const uiY = baseY * z + 16 * z + Phaser.Math.Between(-4, 6) * z;
        const s = this.add.image(uiX, uiY, 'flameParticle').setDepth(1000);
        s.setScale(0.8 / z);
        s.setAlpha(0.95);
        this.tweens.add({
            targets: s,
            y: uiY - 16 / z,
            alpha: { from: 0.95, to: 0 },
            scale: { from: 0.8 / z, to: 0.3 / z },
            duration: 420,
            ease: 'Quad.easeOut',
            onComplete: () => s.destroy()
        });
    }

    // Fixed lives UI at top-left of the canvas, larger size
    createLivesUI() {
        // Top-left skull bar: 10 skulls, reached skulls in default color, unreached in red
        this.skullContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(20);
        this.skullTexts = [];
        const startX = 16;
        const startY = 16;
        const spacing = 22;
        for (let i = 0; i < 10; i++) {
            // Use '☠' (skull and crossbones) which respects text color
            const t = this.add.text(startX + i * spacing, startY, '☠', { fontSize: '36px', color: '#f6ff00' });
            this.skullContainer.add(t);
            this.skullTexts.push(t);
        }
        this.updateLivesUI();
    }

    updateLivesUI() {
        if (!this.skullContainer || !this.skullTexts) return;
        // Color skulls: reached -> white, unreached -> neon yellow
        for (let i = 0; i < this.skullTexts.length; i++) {
            const reached = i < this.skulls;
            this.skullTexts[i].setColor(reached ? '#fff' : '#f6ff00');
        }
        // Keep comfortably inside viewport even when camera zooms
        const pad = 80;
        const z = this.cameras.main.zoom || 1;
        this.skullContainer.setScale(1 / z);
        this.skullContainer.x = pad / z;
        this.skullContainer.y = pad / z;
    }

    // Create a simple timer text in the top-right of the canvas
    createTimerUI() {
        const pad = 80;
        this.timerText = this.add.text(0, 0, '00:00', { fontSize: '20px', color: '#eaeef6' })
            .setScrollFactor(0)
            .setDepth(20);
        const z = this.cameras.main.zoom || 1;
        this.timerText.setScale(1 / z);
        this.timerText.x = (this.scale.width - pad) / z;
        this.timerText.y = pad / z;
        this.timerText.setOrigin(1, 0); // top-right alignment
    }

    // Update timer text each frame and keep position stable against zoom
    updateTimerUI(dt) {
        if (!this.timerText) return;
        this.elapsedTime += dt;
        const total = Math.floor(this.elapsedTime);
        const mm = String(Math.floor(total / 60)).padStart(2, '0');
        const ss = String(total % 60).padStart(2, '0');
        this.timerText.setText(`${mm}:${ss}`);
        // Maintain top-right position relative to zoom
        const pad = 80;
        const z = this.cameras.main.zoom || 1;
        this.timerText.setScale(1 / z);
        this.timerText.x = (this.scale.width - pad) / z;
        this.timerText.y = pad / z;
        this.timerText.setOrigin(1, 0);
    }
} 