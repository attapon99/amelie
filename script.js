const root = document.documentElement;
const views = Array.from(document.querySelectorAll(".view"));
const openButton = document.querySelector(".js-open-gift");
const notOpenButton = document.querySelector(".js-not-open");
const introActions = document.querySelector(".intro-actions");
const treeStage = document.querySelector(".js-tree-stage");
const treeCard = document.querySelector(".tree-demo-card");
const treeCanvas = document.querySelector(".js-tree-canvas");
const refCode = document.querySelector(".js-ref-code");
const revealFlower = document.querySelector(".js-reveal-flower");
const revealMessage = document.querySelector(".js-reveal-message");
const revealSlideshow = document.querySelector(".js-reveal-slideshow");
const giftView = document.querySelector('[data-view="gift"]');
const giftText = document.querySelector(".js-gift-text");
const giftArrow = document.querySelector(".js-gift-arrow");
const audio = document.querySelector(".js-audio");
const slides = Array.from(document.querySelectorAll(".slide"));
const slideImages = Array.from(document.querySelectorAll(".slide img"));
const slideCounter = document.querySelector(".js-slide-counter");
const slideshow = document.querySelector(".js-slideshow");
const slideshowNote = document.querySelector(".js-slideshow-note");

let currentView = "intro";
let notOpenShift = 0;
let openStretch = 1;
let treeSequenceStarted = false;
let treeSequenceReadyForSwipe = false;
let giftSequenceStarted = false;
let currentSlide = 0;
let slideAutoFinished = false;
let slideAutoStarted = false;
let slideAutoTimer = null;
let touchStartY = 0;
let touchStartX = 0;
let treeJumpStarted = false;
let slideshowObserver = null;

function updateViewportHeight() {
  root.style.setProperty("--viewport-height", `${window.innerHeight}px`);
}

function unlockIntroButtons() {
  openButton?.removeAttribute("disabled");
  notOpenButton?.removeAttribute("disabled");
}

function switchView(nextView) {
  currentView = nextView;

  views.forEach((view) => {
    view.classList.toggle("view--active", view.dataset.view === nextView);
  });

  if (nextView === "gift") {
    giftView?.scrollTo(0, 0);
  }

  if (nextView === "letter" && !treeSequenceStarted) {
    treeSequenceStarted = true;
    treeSequenceReadyForSwipe = false;
    startTreeSequence();
  }

  if (nextView === "gift" && !giftSequenceStarted) {
    giftSequenceStarted = true;
    runGiftSequence();
  }
}

function buildImageFallback(label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f7efe5" />
          <stop offset="100%" stop-color="#e7d1bf" />
        </linearGradient>
      </defs>
      <rect width="800" height="1000" fill="url(#bg)" />
      <circle cx="400" cy="300" r="120" fill="#f5e5d7" />
      <text x="400" y="520" text-anchor="middle" font-size="42" fill="#7f6553" font-family="Arial, sans-serif">
        ${label}
      </text>
      <text x="400" y="580" text-anchor="middle" font-size="26" fill="#a3826b" font-family="Arial, sans-serif">
        Foto hier einsetzen
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function attachImageFallbacks() {
  slideImages.forEach((image) => {
    image.addEventListener("error", () => {
      const label = image.dataset.fallbackLabel || "Bild";
      image.src = buildImageFallback(label);
    });
  });
}

function handleNotOpenClick() {
  openStretch += 0.18;
  notOpenShift += 34;

  const openWidth = Math.min(50 + (openStretch - 1) * 50, 100);
  openButton.style.flexBasis = `calc(${openWidth}% - 6px)`;
  notOpenButton.style.transform = `translateX(${notOpenShift}px)`;
  notOpenButton.style.opacity = `${Math.max(1 - notOpenShift / 180, 0)}`;

  if (notOpenShift >= 170) {
    notOpenButton.style.pointerEvents = "none";
    notOpenButton.style.visibility = "hidden";
  }
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function positionFlowerAtViewportCenter() {
  if (!revealFlower || !giftView) {
    return;
  }

  const flowerRect = revealFlower.getBoundingClientRect();
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  const flowerCenterX = flowerRect.left + flowerRect.width / 2;
  const flowerCenterY = flowerRect.top + flowerRect.height / 2;
  const offsetX = viewportCenterX - flowerCenterX;
  const offsetY = viewportCenterY - flowerCenterY;

  revealFlower.style.setProperty("--flower-intro-offset-x", `${offsetX}px`);
  revealFlower.style.setProperty("--flower-intro-offset-y", `${offsetY}px`);
}

function random(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

class Point {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone() {
    return new Point(this.x, this.y);
  }

  add(other) {
    const point = this.clone();
    point.x += other.x;
    point.y += other.y;
    return point;
  }

  sub(other) {
    const point = this.clone();
    point.x -= other.x;
    point.y -= other.y;
    return point;
  }

  div(value) {
    const point = this.clone();
    point.x /= value;
    point.y /= value;
    return point;
  }

  mul(value) {
    const point = this.clone();
    point.x *= value;
    point.y *= value;
    return point;
  }
}

function bezier(cp, t) {
  const p1 = cp[0].mul((1 - t) * (1 - t));
  const p2 = cp[1].mul(2 * t * (1 - t));
  const p3 = cp[2].mul(t * t);
  return p1.add(p2).add(p3);
}

function inHeart(x, y, r) {
  const normalized = ((x / r) ** 2 + (y / r) ** 2 - 1) ** 3 - ((x / r) ** 2) * ((y / r) ** 3);
  return normalized < 0;
}

class HeartFigure {
  constructor() {
    this.points = [];

    for (let i = 10; i < 30; i += 0.2) {
      const t = i / Math.PI;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      this.points.push(new Point(x, y));
    }
  }

  get length() {
    return this.points.length;
  }

  get(index, scale = 1) {
    return this.points[index].mul(scale);
  }
}

class Seed {
  constructor(tree, point, scale, color) {
    this.tree = tree;
    this.heart = {
      point,
      scale,
      color,
      figure: new HeartFigure()
    };
    this.circle = {
      point,
      scale,
      color,
      radius: 5
    };
  }

  draw() {
    this.drawHeart();
  }

  canScale() {
    return this.heart.scale > 0.2;
  }

  scale(value) {
    this.clear();
    this.drawCircle();
    this.drawHeart();
    this.heart.scale *= value;
  }

  canMove() {
    return this.circle.point.y < this.tree.height + 20;
  }

  move(x, y) {
    this.clear();
    this.drawCircle();
    this.circle.point = this.circle.point.add(new Point(x, y));
  }

  drawHeart() {
    const { ctx } = this.tree;
    const { point, color, scale, figure } = this.heart;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);

    for (let index = 0; index < figure.length; index += 1) {
      const p = figure.get(index, scale);
      ctx.lineTo(p.x, -p.y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawCircle() {
    const { ctx } = this.tree;
    const { point, color, scale, radius } = this.circle;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(point.x, point.y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  clear() {
    const { ctx } = this.tree;
    const { point, scale } = this.circle;
    const radius = 26;
    const size = radius * scale;
    ctx.clearRect(point.x - size, point.y - size, size * 4, size * 4);
  }
}

class Footer {
  constructor(tree, width, height, speed) {
    this.tree = tree;
    this.point = new Point(tree.seed.heart.point.x, tree.height - height / 2);
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.length = 0;
  }

  draw() {
    const { ctx } = this.tree;
    const len = this.length / 2;
    ctx.save();
    ctx.strokeStyle = "rgb(35, 31, 32)";
    ctx.lineWidth = this.height;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.translate(this.point.x, this.point.y);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(-len, 0);
    ctx.stroke();
    ctx.restore();

    if (this.length < this.width) {
      this.length += this.speed;
    }
  }
}

class Branch {
  constructor(tree, point1, point2, point3, radius, length, branchs) {
    this.tree = tree;
    this.point1 = point1;
    this.point2 = point2;
    this.point3 = point3;
    this.radius = radius;
    this.length = length;
    this.len = 0;
    this.t = 1 / (length - 1);
    this.branchs = branchs || [];
  }

  grow() {
    if (this.len <= this.length) {
      const point = bezier([this.point1, this.point2, this.point3], this.len * this.t);
      this.draw(point);
      this.len += 1;
      this.radius *= 0.97;
      return;
    }

    this.tree.removeBranch(this);
    this.tree.addBranchs(this.branchs);
  }

  draw(point) {
    const { ctx } = this.tree;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "rgb(139, 69, 19)";
    ctx.shadowColor = "rgb(60, 30, 10)";
    ctx.shadowBlur = 2;
    ctx.arc(point.x, point.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Bloom {
  constructor(tree, point, figure, color, alpha, angle, scale, place, speed) {
    this.tree = tree;
    this.point = point;
    const palette = [
      [160, 200, 0, 10],
      [255, 255, 0, 50],
      [255, 255, 100, 180]
    ];

    const colorType = random(1, 3);
    let r;
    let g;
    let b;

    if (colorType === 1) {
      [r, g, b] = [random(160, 200), 0, random(0, 10)];
    } else if (colorType === 2) {
      [r, g, b] = [255, random(0, 50), random(0, 50)];
    } else {
      [r, g, b] = [255, random(100, 180), random(120, 180)];
    }

    this.color = color || `rgb(${r},${g},${b})`;
    this.alpha = alpha || random(3, 10) / 10;
    this.angle = angle || random(0, 360);
    this.scale = scale || 0.1;
    this.place = place;
    this.speed = speed;
    this.figure = figure;
  }

  flower() {
    this.draw();
    this.scale += 0.1;
    if (this.scale > 1) {
      this.tree.removeBloom(this);
    }
  }

  draw() {
    const { ctx } = this.tree;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.point.x, this.point.y);
    ctx.scale(this.scale, this.scale);
    ctx.rotate(this.angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);

    for (let index = 0; index < this.figure.length; index += 1) {
      const p = this.figure.get(index);
      ctx.lineTo(p.x, -p.y);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  jump() {
    const height = this.tree.height;

    if (this.point.x < -20 || this.point.y > height + 20) {
      this.tree.removeBloom(this);
      return;
    }

    this.draw();
    this.point = this.place.sub(this.point).div(this.speed * 1.1).add(this.point);
    this.angle += 0.05;
    this.speed -= 1;
  }
}

class Tree {
  constructor(canvas, width, height, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = width;
    this.height = height;
    this.options = options;
    this.record = {};
    this.initSeed();
    this.initFooter();
    this.initBranch();
    this.initBloom();
  }

  initSeed() {
    const { seed } = this.options;
    const point = new Point(seed.x || this.width / 2, seed.y || this.height / 2);
    this.seed = new Seed(this, point, seed.scale || 1, seed.color || "#FF0000");
  }

  initFooter() {
    const footer = this.options.footer || {};
    this.footer = new Footer(this, footer.width || this.width, footer.height || 5, footer.speed || 2);
  }

  initBranch() {
    this.branchs = [];
    this.addBranchs(this.options.branch || []);
  }

  initBloom() {
    const bloom = this.options.bloom || {};
    const num = bloom.num || 500;
    const width = bloom.width || this.width;
    const height = bloom.height || this.height;
    const figure = this.seed.heart.figure;
    const radius = 240;
    this.blooms = [];
    this.bloomsCache = [];

    for (let index = 0; index < num; index += 1) {
      this.bloomsCache.push(this.createBloom(width, height, radius, figure));
    }
  }

  addBranch(branch) {
    this.branchs.push(branch);
  }

  addBranchs(branchs) {
    branchs.forEach((item) => {
      const branch = new Branch(
        this,
        new Point(item[0], item[1]),
        new Point(item[2], item[3]),
        new Point(item[4], item[5]),
        item[6],
        item[7],
        item[8]
      );
      this.addBranch(branch);
    });
  }

  removeBranch(branch) {
    this.branchs = this.branchs.filter((item) => item !== branch);
  }

  canGrow() {
    return this.branchs.length > 0;
  }

  grow() {
    this.branchs.slice().forEach((branch) => branch.grow());
  }

  addBloom(bloom) {
    this.blooms.push(bloom);
  }

  removeBloom(bloom) {
    this.blooms = this.blooms.filter((item) => item !== bloom);
  }

  createBloom(width, height, radius, figure, color, alpha, angle, scale, place, speed) {
    while (true) {
      const x = random(20, width - 20);
      const y = random(20, height - 20);
      if (inHeart(x - width / 2, height - (height - 40) / 2 - y, radius)) {
        return new Bloom(this, new Point(x, y), figure, color, alpha, angle, scale, place, speed);
      }
    }
  }

  canFlower() {
    return this.blooms.length > 0 || this.bloomsCache.length > 0;
  }

  flower(num) {
    const incoming = this.bloomsCache.splice(0, num);
    incoming.forEach((bloom) => this.addBloom(bloom));
    this.blooms.slice().forEach((bloom) => bloom.flower());
  }

  snapshot(key, x, y, width, height) {
    const image = this.ctx.getImageData(x, y, width, height);
    this.record[key] = {
      image,
      point: new Point(x, y),
      width,
      height
    };
  }

  move(key, x, y) {
    const record = this.record[key];
    const speed = record.speed || 10;
    const nextX = record.point.x + speed < x ? record.point.x + speed : x;
    const nextY = record.point.y + speed < y ? record.point.y + speed : y;

    this.ctx.save();
    this.ctx.clearRect(record.point.x, record.point.y, record.width, record.height);
    this.ctx.putImageData(record.image, nextX, nextY);
    this.ctx.restore();

    record.point = new Point(nextX, nextY);
    record.speed = Math.max(speed * 0.95, 2);
    return nextX < x || nextY < y;
  }

  jump() {
    if (this.staticScene) {
      this.ctx.putImageData(this.staticScene, 0, 0);
    } else {
      this.ctx.clearRect(0, 0, this.width, this.height);
    }

    this.blooms.slice().forEach((bloom) => bloom.jump());

    if ((this.blooms.length && this.blooms.length < 15) || !this.blooms.length) {
      const bloom = this.options.bloom || {};
      const width = bloom.width || this.width;
      const height = bloom.height || this.height;
      const figure = this.seed.heart.figure;

      for (let index = 0; index < random(1, 2); index += 1) {
        this.blooms.push(
          this.createBloom(
            width / 2 + width,
            height,
            240,
            figure,
            null,
            1,
            null,
            1,
            new Point(random(-100, 600), 720),
            random(200, 300)
          )
        );
      }
    }
  }
}

function typewriterHTML(element, speed = 75) {
  if (!element) {
    return Promise.resolve();
  }

  const original = element.innerHTML;
  let progress = 0;
  element.innerHTML = "";
  element.style.display = "block";
  element.classList.add("type-caret");

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      const current = original.substr(progress, 1);
      if (current === "<") {
        progress = original.indexOf(">", progress) + 1;
      } else {
        progress += 1;
      }

      element.innerHTML = `${original.substring(0, progress)}${progress & 1 ? "_" : ""}`;

      if (progress >= original.length) {
        window.clearInterval(timer);
        element.innerHTML = original;
        element.classList.remove("type-caret");
        resolve();
      }
    }, speed);
  });
}

function typewriterText(element, speed = 75) {
  if (!element) {
    return Promise.resolve();
  }

  const original = element.dataset.text || element.textContent || "";
  let progress = 0;
  element.textContent = "";
  element.classList.add("type-caret");

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      progress += 1;
      element.textContent = `${original.substring(0, progress)}${progress < original.length && progress % 2 ? "_" : ""}`;

      if (progress >= original.length) {
        window.clearInterval(timer);
        element.textContent = original;
        element.classList.remove("type-caret");
        resolve();
      }
    }, speed);
  });
}

async function startTreeSequence() {
  if (!treeCanvas) {
    return;
  }

  const tree = new Tree(treeCanvas, 1100, 680, {
    seed: {
      x: 530,
      color: "rgb(190, 26, 37)",
      scale: 4
    },
    branch: [
      [535, 680, 570, 250, 500, 200, 30, 100, [
        [540, 500, 455, 417, 340, 400, 13, 100, [
          [450, 435, 434, 430, 394, 395, 2, 40]
        ]],
        [550, 445, 600, 356, 680, 345, 12, 100, [
          [578, 400, 648, 409, 661, 426, 3, 80]
        ]],
        [539, 281, 537, 248, 534, 217, 3, 40],
        [546, 397, 413, 247, 328, 244, 9, 80, [
          [427, 286, 383, 253, 371, 205, 2, 40],
          [498, 345, 435, 315, 395, 330, 4, 60]
        ]],
        [546, 357, 608, 252, 678, 221, 6, 100, [
          [590, 293, 646, 277, 648, 271, 2, 80]
        ]]
      ]]
    ],
    bloom: {
      num: 700,
      width: 1080,
      height: 650
    },
    footer: {
      width: 1200,
      height: 5,
      speed: 10
    }
  });

  const { seed, footer } = tree;
  seed.draw();

  while (seed.canScale()) {
    seed.scale(0.95);
    await sleep(10);
  }

  while (seed.canMove()) {
    seed.move(0, 2);
    footer.draw();
    await sleep(10);
  }

  while (tree.canGrow()) {
    tree.grow();
    await sleep(10);
  }

  while (tree.canFlower()) {
    tree.flower(2);
    await sleep(10);
  }

  tree.snapshot("p1", 240, 0, 610, 680);
  while (tree.move("p1", 500, 0)) {
    footer.draw();
    await sleep(10);
  }
  footer.draw();
  tree.staticScene = tree.ctx.getImageData(0, 0, tree.width, tree.height);
  treeJumpStarted = true;
  startTreeJumpLoop(tree);

  await typewriterHTML(refCode, 75);

  treeCard?.classList.add("is-swipe-visible");
  treeSequenceReadyForSwipe = true;
}

async function startTreeJumpLoop(tree) {
  while (currentView === "letter" && treeJumpStarted) {
    tree.jump();
    tree.footer.draw();
    await sleep(25);
  }
}

function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("is-active", slideIndex === currentSlide);
  });

  if (slideCounter) {
    slideCounter.textContent = `${currentSlide + 1} / ${slides.length}`;
  }
}

function startSlideshowWhenVisible() {
  if (!revealSlideshow || slideAutoStarted) {
    return;
  }

  const startIfVisible = () => {
    if (slideAutoStarted || currentView !== "gift") {
      return;
    }

    const rect = revealSlideshow.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const visibilityRatio = rect.height > 0 ? visibleHeight / rect.height : 0;

    if (visibilityRatio >= 0.82 || (rect.top >= 0 && rect.bottom <= viewportHeight)) {
      slideAutoStarted = true;
      startAutoSlideshow();
      slideshowObserver?.disconnect();
      slideshowObserver = null;
    }
  };

  if ("IntersectionObserver" in window) {
    slideshowObserver?.disconnect();
    slideshowObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (!visibleEntry) {
          return;
        }

        if (visibleEntry.intersectionRatio >= 0.82) {
          startIfVisible();
        }
      },
      {
        root: giftView,
        threshold: [0.82, 0.95]
      }
    );

    slideshowObserver.observe(revealSlideshow);
  }

  startIfVisible();
}

function startAutoSlideshow() {
  slideAutoFinished = false;
  slideshowNote?.classList.remove("is-visible");
  showSlide(0);

  let step = 1;
  slideAutoTimer = window.setInterval(() => {
    showSlide(step);
    step += 1;

    if (step >= slides.length) {
      window.clearInterval(slideAutoTimer);
      slideAutoFinished = true;
      slideshowNote?.classList.add("is-visible");
    }
  }, 3200);
}

function tryPlayAudio() {
  if (!audio) {
    return;
  }

  audio.volume = 0.65;
  const playAttempt = audio.play();

  if (playAttempt && typeof playAttempt.catch === "function") {
    playAttempt.catch(() => {
      document.body.addEventListener(
        "click",
        () => {
          audio.play().catch(() => {});
        },
        { once: true }
      );
    });
  }
}

function runGiftSequence() {
  positionFlowerAtViewportCenter();

  window.setTimeout(() => {
    revealFlower?.classList.add("is-visible");
  }, 500);

  window.setTimeout(() => {
    revealFlower?.classList.remove("flower-card--intro");
  }, 1200);

  window.setTimeout(() => {
    revealMessage?.classList.add("is-visible");
    giftArrow?.classList.remove("is-visible");
    typewriterText(giftText, 82).then(() => {
      giftArrow?.classList.add("is-visible");
      revealSlideshow?.classList.add("is-visible");
      startSlideshowWhenVisible();
    });
  }, 2300);

}

function handleVerticalSwipe(event) {
  touchStartY = event.changedTouches[0].clientY;
}

function handleVerticalSwipeEnd(event) {
  const endY = event.changedTouches[0].clientY;
  const deltaY = touchStartY - endY;

  if (currentView === "letter" && treeSequenceReadyForSwipe && deltaY > 70) {
    switchView("gift");
  }
}

function handleSlideshowTouchStart(event) {
  if (!slideAutoFinished) {
    return;
  }

  touchStartX = event.changedTouches[0].clientX;
}

function handleSlideshowTouchEnd(event) {
  if (!slideAutoFinished) {
    return;
  }

  const endX = event.changedTouches[0].clientX;
  const deltaX = touchStartX - endX;

  if (Math.abs(deltaX) < 35) {
    return;
  }

  if (deltaX > 0) {
    showSlide(currentSlide + 1);
  } else {
    showSlide(currentSlide - 1);
  }
}

updateViewportHeight();
attachImageFallbacks();
showSlide(0);

window.addEventListener("resize", updateViewportHeight);
introActions?.addEventListener("animationend", unlockIntroButtons, { once: true });
window.setTimeout(unlockIntroButtons, 5600);
openButton?.addEventListener("click", () => {
  tryPlayAudio();
  switchView("letter");
});
notOpenButton?.addEventListener("click", handleNotOpenClick);
document.querySelector('[data-view="letter"]')?.addEventListener("touchstart", handleVerticalSwipe, { passive: true });
document.querySelector('[data-view="letter"]')?.addEventListener("touchend", handleVerticalSwipeEnd, { passive: true });
slideshow?.addEventListener("touchstart", handleSlideshowTouchStart, { passive: true });
slideshow?.addEventListener("touchend", handleSlideshowTouchEnd, { passive: true });
