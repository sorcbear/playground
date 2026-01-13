(() => {
  const ROWS = 4;
  const COLS = 7;
  const TILE_COUNT = ROWS * COLS;

  const STORAGE_KEY = "rotatePuzzle_4x7_seed";

  const params = new URLSearchParams(location.search);
  const isSetup = params.get("setup") === "1";

  const board = document.getElementById("board");
  const messageEl = document.getElementById("message");
  const hintTextEl = document.getElementById("hintText");

  const btnUndo = document.getElementById("btnUndo");
  const btnSubmit = document.getElementById("btnSubmit");

  const setupBar = document.getElementById("setupBar");
  const btnSaveSetup = document.getElementById("btnSaveSetup");
  const btnClearSetup = document.getElementById("btnClearSetup");

  // 每块的角度（0/1/2/3 → 0/90/180/270）
  let seedSteps = new Array(TILE_COUNT).fill(0);
  let curSteps  = new Array(TILE_COUNT).fill(0);

  let tileDataURLs = new Array(TILE_COUNT).fill(null);

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
    curSteps[i] = (curSteps[i] + 1) % 4;
    applyRotation(i);
  }

  function resetToSeed() {
    curSteps = seedSteps.slice();
    applyAllRotations();
    setMessage("已重置到起始状态。");
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

  function loadSeed() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === TILE_COUNT) {
          seedSteps = arr.map(v => ((v % 4) + 4) % 4);
          return;
        }
      } catch {}
    }

    seedSteps = isSetup
      ? new Array(TILE_COUNT).fill(0)
      : new Array(TILE_COUNT).fill(0).map(() => Math.floor(Math.random() * 4));
  }

  function wireButtons() {
    btnUndo.onclick = resetToSeed;

    btnSubmit.onclick = () => {
      setMessage(isSolved() ? "Success" : "Try again", isSolved() ? "ok" : "bad");
    };

    if (isSetup) {
      setupBar.style.display = "flex";

      btnSaveSetup.onclick = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(curSteps));
        seedSteps = curSteps.slice();
        setMessage("Setup 已保存。", "ok");
      };

      btnClearSetup.onclick = () => {
        localStorage.removeItem(STORAGE_KEY);
        setMessage("已清除本地 Setup。");
      };
    }
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
        ctx.drawImage(img, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
        tileDataURLs[i] = canvas.toDataURL();
      }
    }
  }

  async function init() {
    hintTextEl.textContent = isSetup
      ? "Setup 模式：点击方块设置初始角度，保存后供玩家挑战。"
      : "请点击方块旋转图像，使其恢复正确方向后提交。";

    buildBoard();
    wireButtons();

    loadSeed();
    curSteps = seedSteps.slice();

    await sliceImageToTiles("./image.png");
    setTileImages();
    applyAllRotations();

    setMessage(isSetup ? "Setup 模式。" : "开始吧。");
  }

  init();
})();
