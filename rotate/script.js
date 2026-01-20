(() => {
  const ROWS = 4;
  const COLS = 7;
  const TILE_COUNT = ROWS * COLS;

  const NEXT_URL = "../circle/";
  const COUNTDOWN_SECONDS = 3;

  const STORY_KEY = "chapter.rotate.find_your_origin.v1";
  const DEFAULT_K = "canon";

  // 仅用于“返回时恢复正确样子”
  const SOLVED_KEY = "rotate_find_origin_solved_back_only_v1";

  const params = new URLSearchParams(location.search);
  const k = (params.get("k") || DEFAULT_K).trim();

  const board = document.getElementById("board");
  const btnSubmit = document.getElementById("btnSubmit");

  const ansRoad = document.getElementById("ansRoad");
  const ansNo = document.getElementById("ansNo");

  const ANSWER_ROAD = "天平";
  const ANSWER_NO = "41";

  let seedSteps = new Array(TILE_COUNT).fill(0);
  let curSteps  = new Array(TILE_COUNT).fill(0);
  let tileDataURLs = new Array(TILE_COUNT).fill(null);

  let locked = false;
  let countdownTimer = null;

  const normalize = (deg) => ((deg % 360) + 360) % 360;

  // ====== 用按钮文字做状态提示（代替 message 框）======
  const BTN_TEXT_DEFAULT = "提交答案";
  let btnTextTimer = null;

  function clearBtnHint() {
    if (btnTextTimer) {
      clearTimeout(btnTextTimer);
      btnTextTimer = null;
    }
  }

  function setBtnText(text, ms = 900) {
    if (!btnSubmit) return;
    clearBtnHint();
    btnSubmit.textContent = text;
    if (ms > 0) {
      btnTextTimer = setTimeout(() => {
        btnSubmit.textContent = BTN_TEXT_DEFAULT;
        btnTextTimer = null;
      }, ms);
    }
  }

  function clearCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function setDisabledAll(on) {
    btnSubmit.disabled = on;
    ansRoad.disabled = on;
    ansNo.disabled = on;
  }

  function unlockUI() {
    locked = false;
    clearCountdown();
    setDisabledAll(false);
  }

  function getNavType() {
    // 'navigate' | 'reload' | 'back_forward' | 'prerender'
    try {
      const nav = performance.getEntriesByType("navigation");
      if (nav && nav[0] && nav[0].type) return nav[0].type;
    } catch {}
    // 兜底（老浏览器）
    if (performance && performance.navigation) {
      const t = performance.navigation.type;
      if (t === 1) return "reload";
      if (t === 2) return "back_forward";
      return "navigate";
    }
    return "navigate";
  }

  function isPuzzleSolved() {
    return curSteps.every(step => normalize(step * 90) === 0);
  }

  function isAnswerSolved() {
    const a1 = (ansRoad.value || "").trim();
    const a2 = (ansNo.value || "").trim();
    return a1 === ANSWER_ROAD && a2 === ANSWER_NO;
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

  function resetAllToInitial() {
    unlockUI();
    curSteps = seedSteps.slice();
    applyAllRotations();
    ansRoad.value = "";
    ansNo.value = "";
    btnSubmit.textContent = BTN_TEXT_DEFAULT;
    clearBtnHint();
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

  function restoreSolvedUI() {
    // 恢复“正确提交后的样子”，不倒计时、不锁按钮
    unlockUI();
    clearBtnHint();

    curSteps = new Array(TILE_COUNT).fill(0);
    applyAllRotations();

    ansRoad.value = ANSWER_ROAD;
    ansNo.value = ANSWER_NO;

    // 提示一下即可（不需要常驻状态框）
    setBtnText("答案已确认", 900);
  }

  function startCountdownAndRedirect() {
    // 记住已完成：只用于“从下一页返回时恢复”
    sessionStorage.setItem(SOLVED_KEY, "1");

    locked = true;
    setDisabledAll(true);
    clearBtnHint();

    let left = COUNTDOWN_SECONDS;
    btnSubmit.textContent = `答案正确（${left}）`;

    clearCountdown();
    countdownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        clearCountdown();
        location.href = NEXT_URL;
        return;
      }
      btnSubmit.textContent = `答案正确（${left}）`;
    }, 1000);
  }

  // 稳定 hash + PRNG（跨设备一致）
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
    const binding = `${STORY_KEY}|${k}`;
    const seedFn = xmur3(binding);
    const rand = mulberry32(seedFn());

    const steps = new Array(TILE_COUNT);
    for (let i = 0; i < TILE_COUNT; i++) steps[i] = Math.floor(rand() * 4);

    for (let i = 0; i < TILE_COUNT; i++) {
      const ch = k.charCodeAt(i % k.length);
      steps[i] = (steps[i] + (ch % 4)) % 4;
    }
    return steps;
  }

  function wireButtons() {
    // 回车提交
    [ansRoad, ansNo].forEach(el => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") btnSubmit.click();
      });
    });

    btnSubmit.onclick = () => {
      if (locked) return;

      const okPuzzle = isPuzzleSolved();
      const okAns = isAnswerSolved();

      if (okPuzzle && okAns) {
        startCountdownAndRedirect();
      } else {
        // 失败提示：只在按钮上短暂显示
        // 你也可以改成更短：setBtnText("错误", 700);
        setBtnText("不正确，再试一次", 900);
      }
    };
  }

  async function sliceImageToTiles(url) {
    const img = new Image();
    img.src = url;
    await img.decode();

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

    seedSteps = deriveSeed();
    curSteps  = seedSteps.slice();

    await sliceImageToTiles("./image.png");
    setTileImages();
    applyAllRotations();

    // 刷新/正常进入：回初始，并清除“已完成标记”
    // 返回：恢复“正确提交后的样子”
    const navType = getNavType();
    if (navType === "back_forward" && sessionStorage.getItem(SOLVED_KEY) === "1") {
      restoreSolvedUI();
    } else {
      sessionStorage.removeItem(SOLVED_KEY);
      resetAllToInitial();
    }
  }

  // iOS Safari 返回时 init 可能不运行（bfcache），但 pageshow 一定会触发
  window.addEventListener("pageshow", (e) => {
    const navType = getNavType();

    // 返回（含 bfcache）：恢复正确样子
    if ((e.persisted || navType === "back_forward") && sessionStorage.getItem(SOLVED_KEY) === "1") {
      restoreSolvedUI();
      return;
    }

    // 刷新/正常进入：清标记并回初始
    if (navType === "reload" || navType === "navigate") {
      sessionStorage.removeItem(SOLVED_KEY);
      resetAllToInitial();
    }
  });

  init().catch(() => {
    // 图片失败：按钮提示即可
    setBtnText("图片加载失败", 1500);
  });
})();
