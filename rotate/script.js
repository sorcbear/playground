(() => {
  const ROWS = 4;
  const COLS = 7;
  const TILE_COUNT = ROWS * COLS;

  // 成功后跳转目标（从 /rotate/ 跳到 /circle/）
  const NEXT_URL = "../circle/";

  // 成功后倒计时 3、2、1
  const COUNTDOWN_SECONDS = 3;

  // ===============================
  // 剧情绑定：你只需要维护这两个东西
  // 1) STORY_KEY：这一关的“章节密钥”（可随剧情改）
  // 2) k：上一题答案（由上一页链接带入 ?k=xxxx）
  //
  // 示例：上一题跳转到本页用：
  //   location.href = "../rotate/?k=20150214";
  // 这样 seed 就由 STORY_KEY + "20150214" 决定，刷新/换设备都一致
  // ===============================
  const STORY_KEY = "chapter.rotate.find_your_origin.v1";

  const params = new URLSearchParams(location.search);
  const k = (params.get("k") || "").trim(); // 上一题答案/口令

  const board = document.getElementById("board");
  const messageEl = document.getElementById("message");

  const btnUndo = document.getElementById("btnUndo");
  const btnSubmit = document.getElementById("btnSubmit");

  let seedSteps = new Array(TILE_COUNT).fill(0);
  let curSteps  = new Array(TILE_COUNT).fill(0);
  let tileDataURLs = new Array(TILE_COUNT).fill(null);

  let locked = false;
  let countdownTimer = null;

  const normalize = (deg) => ((deg % 360) + 360) % 360;

  function setMessage(text, type = "") {
    messageEl.classList.remove("ok", "bad");
    if (type) messageEl.classList.add(type);
    messageEl.textContent = text;
  }

  function isSolved() {
    return curSteps.every(step => normalize(step * 90) === 0);
  }

  function applyRotation(i) {
    const img = board.querySelector(`.tile[data-idx="${i}"] img`);
    if (img) img.style.transform = `rotate(${curSteps[i] * 90}deg)`;
  }

  function applyAllRotations() {
    for (let i = 0; i < TILE_COUNT; i++) applyRotation(i);
  }

  function rotateOne(i) {
    if (locked) return;
    curSteps[i] = (curSteps[i] + 1) % 4;
    applyRotation(i);
  }

  function resetToSeed() {
    if (locked) return;
    curSteps = seedSteps.slice();
    applyAllRotations();
    setMessage("已重置。");
  }

  function buildBoard() {
    board.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = r * COLS + c;
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.idx = idx;

        if (c === COLS - 1) tile.dataset.lastCol = "1";
        if (r === ROWS - 1) tile.dataset.lastRow = "1";

        const img = document.createElement("img");
        img.draggable = false;
        tile.appendChild(img);

        tile.onclick = () => rotateOne(idx);
        board.appendChild(tile);
      }
    }
  }

  function setTileImages() {
    for (let i = 0; i < TILE_COUNT; i++) {
      const img = board.querySelector(`.tile[data-idx="${i}"] img`);
      if (img) img.src = tileDataURLs[i];
    }
  }

  function lockUI(on) {
    locked = on;
    btnSubmit.disabled = on;
    btnUndo.disabled = on;
  }

  function startCountdownAndRedirect() {
    lockUI(true);

    let left = COUNTDOWN_SECONDS;
    setMessage(`答案正确，即将进入下一题（${left}）`, "ok");

    countdownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        location.href = NEXT_URL;
        return;
      }
      setMessage(`答案正确，即将进入下一题（${left}）`, "ok");
    }, 1000);
  }

  // ===============================
  // 剧情绑定 seed 的核心：把字符串稳定映射成 0..3 的数组
  // 用的是轻量 hash + PRNG（稳定、跨浏览器一致）
  // ===============================
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function() {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }

  function mulberry32(a) {
    return function() {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function deriveSeed() {
    // 绑定逻辑：章节密钥 + 上一题口令
    // 若你不想依赖上一题，就把 k 固定写成某个值即可（例如 "canon"）
    const binding = `${STORY_KEY}|${k}`;

    const seedFn = xmur3(binding);
    const rand = mulberry32(seedFn());

    const steps = new Array(TILE_COUNT);
    for (let i = 0; i < TILE_COUNT; i++) {
      // 0..3：每格旋转步数
      steps[i] = Math.floor(rand() * 4);
    }

    // 可选：让绑定更“剧情化”一点——把 k 的字符影响再叠加一次（仍然稳定）
    if (k) {
      for (let i = 0; i < TILE_COUNT; i++) {
        const ch = k.charCodeAt(i % k.length);
        steps[i] = (steps[i] + (ch % 4)) % 4;
      }
    }

    return steps;
  }

  function wireButtons() {
    btnUndo.onclick = resetToSeed;

    btnSubmit.onclick = () => {
      if (locked) return;

      if (isSolved()) {
        startCountdownAndRedirect();
      } else {
        setMessage("try again", "bad");
      }
    };
  }

  async function sliceImageToTiles(url) {
    const img = new Image();
    img.src = url;

    try {
      await img.decode();
    } catch (e) {
      setMessage("图片加载失败。", "bad");
      throw e;
    }

    const tileW = img.naturalWidth / COLS;
    const tileH = img.naturalHeight / ROWS;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        canvas.width = tileW;
        canvas.height = tileH;
        ctx.clearRect(0, 0, tileW, tileH);
        ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
        tileDataURLs[i] = canvas.toDataURL();
      }
    }
  }

  async function init() {
    buildBoard();
    wireButtons();

    // 不随机、不存储：只由剧情绑定生成（刷新/换设备一致）
    seedSteps = deriveSeed();
    curSteps  = seedSteps.slice();

    await sliceImageToTiles("./image.png");
    setTileImages();
    applyAllRotations();

    setMessage("开始吧。");
  }

  init().catch(() => {});
})();
