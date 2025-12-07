
export class MainMenu extends Phaser.Scene {
  constructor() { super({ key: 'MainMenu' }); }
  preload() {
    // Load Calimoto SVG icon
    this.load.image('calimotoIcon', 'public/images/calimoto_icon.svg');
  }
  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    const container = this.add.container(w / 2, h / 2);
    // Top-center Calimoto icon
    const icon = this.add.image(0, -h / 2 + 64, 'calimotoIcon').setOrigin(0.5, 0.5);
    // Scale down SVG if too large
    const targetWidth = Math.min(180, w * 0.22);
    const s = targetWidth / (icon.width || targetWidth);
    icon.setScale(s);
    const title = this.add.text(0, -300, 'The scenic calimoto objective hunt (BETA)', {
      fontFamily: 'Poppins, Arial, sans-serif', fontSize: '80px', color: '#CF3E3E'
    }).setOrigin(0.5);
    const accent = this.add.circle(0, -198, 7, 0xCF3D3E).setStrokeStyle(2, 0xffffff, 0.35);

    const cardW = Math.min(560, w * 0.8);
    const cardH = 280;
    const card = this.add.rectangle(0, -40, cardW, cardH, 0x0f172a).setStrokeStyle(2, 0x253052, 0.9).setOrigin(0.5);
    card.setAlpha(0.94);
    const cardHeader = this.add.text(0, card.y - cardH / 2 + 24, 'Controls', { fontSize: '18px', color: '#cfd6ec' }).setOrigin(0.5);

    const drawKey = (scene, label) => {
      const g = scene.add.graphics();
      g.fillStyle(0x182036, 1);
      g.fillRoundedRect(0, 0, 64, 28, 8);
      g.lineStyle(2, 0x2a3553, 1);
      g.strokeRoundedRect(0, 0, 64, 28, 8);
      const key = `key-${Phaser.Math.RND.uuid().slice(0, 6)}`;
      g.generateTexture(key, 64, 28);
      g.destroy();
      const img = scene.add.image(0, 0, key).setOrigin(0.5);
      const txt = scene.add.text(0, 0, label, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
      const group = scene.add.container(0, 0, [img, txt]);
      return group;
    };

    const rows = [
      { key: '→', desc: 'Accelerate forward' },
      { key: '←', desc: 'Brake / slow down' },
      { key: 'Space', desc: 'Wheelie jump + Turbo (uses 1 charge)' },
      { key: 'Enter', desc: 'Close milestone panel' },
    ];
    const rowContainers = [];
    rows.forEach((r, i) => {
      const y = card.y - cardH / 2 + 64 + i * 48;
      const keyPill = drawKey(this, r.key);
      keyPill.x = -cardW / 2 + 80;
      keyPill.y = y;
      const desc = this.add.text(-cardW / 2 + 160, y - 10, r.desc, { fontSize: '16px', color: '#eaeef6' }).setOrigin(0, 0);
      rowContainers.push(keyPill, desc);
    });

    // Extra info: Turbo charges and Ghostrider mode behavior
    const info1 = this.add.text(0, card.y + cardH / 2 + 25, 'You have max 5 Turbo Chargers. Each Space press consumes 1.', {
      fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '24px', color: '#f6ff00'
    }).setOrigin(0.5);
    const info2 = this.add.text(0, card.y + cardH / 2 + 60, 'Each white ☠️ increases Ghostrider mode and attracts more police.', {
      fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '16px', color: '#eaeef6'
    }).setOrigin(0.5);

    const info3 = this.add.text(0, card.y + cardH / 2 + 90, 'Reach 17/17 Milestones.', {
      fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '21px', color: '#eaeef6'
    }).setOrigin(0.5);

    const info4 = this.add.text(0, card.y + cardH / 2 + 120, 'Playtime at full speed: 1min 30sec', {
      fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '21px', color: '#eaeef6'
    }).setOrigin(0.5);

    const hint = this.add.text(0, card.y + cardH / 2 + 180, 'Press Space to Begin', {
      fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '32px', color: '#CF3D3E'
    }).setOrigin(0.5);

    container.add([icon, accent, card, cardHeader, ...rowContainers, info1, info2, info3, info4, hint, title]);
    this.tweens.add({ targets: hint, alpha: { from: 0.6, to: 1 }, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: card, y: { from: card.y - 2, to: card.y + 2 }, yoyo: true, repeat: -1, duration: 2000, ease: 'Sine.easeInOut' });
    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('Game'));
  }
}
