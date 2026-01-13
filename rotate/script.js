(() => {
    const ROWS = 4;
    const COLS = 7;
    const TILE_COUNT = ROWS * COLS; // 28
    const CLICK_LIMIT = 27;
  
    const STORAGE_KEY = "rotatePuzzle_4x7_seed";
  
    const params = new URLSearchParams(location.search);
    const isSetup = params.get("setup") === "1";
  
    const board = document.getElementById("board");
    const clickCountEl = document.getElementById("clickCount");
    const clickLimitEl = document.getElementById("clickLimit");
    const messageEl = document.getElementById("message");
    const hintTextEl = document.getElementById("hintText");
  
    const btnUndo = document.getElementById("btnUndo");
    const btnSubmit = document.getElementById("btnSubmit");
  
    const setupBar = document.getElementById("setupBar");
    const btnSaveSetup = document.getElementById("btnSaveSetup");
    const btnClearSetup = document.getElementById("btnClearSetup");
  
    clickLimitEl.textContent = String(CLICK_LIMIT);
  
    // 0/90/180/270
    const normalize = (deg) => ((deg % 360) + 360) % 360;
    const toSteps = (deg) => normalize(deg) / 90; // 0..3
  
    let clickCount = 0;
  
    // 初始角度（你设置的/或默认随机）
    let seedSteps = new Array(TILE_COUNT).fill(0);
    // 当前角度（玩家操作后）
    let curSteps = new Array(TILE_COUNT).fill(0);
  
    // 每块对应一张切图 dataURL
    let tileDataURLs = new Array(TILE_COUNT).fill(null);
  
    function setMessage(text, type = "") {
      messageEl.classList.remove("ok", "bad");
      if (type === "ok") messageEl.classList.add("ok");
      if (type === "bad") messageEl.classList.add("bad");
      messageEl.textContent = text;
    }
  
    function updateHUD() {
      clickCountEl.textContent = String(clickCount);
    }
  
    function canClick() {
      return isSetup ? true : clickCount < CLICK_LIMIT;
    }
  
    function isSolved() {
      // “与原图一致” = 所有块角度为 0
      for (let i = 0; i < TILE_COUNT; i++) {
        if (normalize(curSteps[i] * 90) !== 0) return false;
      }
      return true;
    }
  
    function applyRotation(tileIndex) {
      const tile = board.querySelector(`.tile[data-idx="${tileIndex}"]`);
      if (!tile) return;
      const img = tile.querySelector("img");
      const deg = curSteps[tileIndex] * 90;
      img.style.transform = `rotate(${deg}deg)`;
    }
  
    function applyAllRotations() {
      for (let i = 0; i < TILE_COUNT; i++) applyRotation(i);
    }
  
    function resetToSeed() {
      curSteps = seedSteps.slice();
      clickCount = 0;
      updateHUD();
      applyAllRotations();
      setMessage("已重置到起始状态。", "");
    }
  
    function rotateOne(tileIndex) {
      if (!canClick()) {
        setMessage(`已达到最大点击次数 ${CLICK_LIMIT}。可使用 Undo 回到起始状态后重新尝试。`, "bad");
        return;
      }
      curSteps[tileIndex] = (curSteps[tileIndex] + 1) % 4;
      applyRotation(tileIndex);
  
      if (!isSetup) {
        clickCount += 1;
        updateHUD();
        if (clickCount >= CLICK_LIMIT) {
          setMessage(`已达到最大点击次数 ${CLICK_LIMIT}。请提交或使用 Undo 重试。`, "");
        }
      }
    }
  
    function buildBoard() {
      board.innerHTML = "";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
  
          const tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.idx = String(idx);
  
          if (c === COLS - 1) tile.dataset.lastCol = "1";
          if (r === ROWS - 1) tile.dataset.lastRow = "1";
  
          const img = document.createElement("img");
          img.alt = `tile ${idx + 1}`;
          img.draggable = false;
  
          tile.appendChild(img);
          board.appendChild(tile);
  
          tile.addEventListener("click", () => {
            rotateOne(idx);
          });
        }
      }
    }
  
    function setTileImages() {
      for (let i = 0; i < TILE_COUNT; i++) {
        const tile = board.querySelector(`.tile[data-idx="${i}"] img`);
        if (tile) tile.src = tileDataURLs[i];
      }
    }
  
    function generateSeedFromStorageOrDefault() {
      // Setup 模式：优先读取已有 seed；没有就全部 0（你自己点着设置）
      // 普通模式：优先读取 seed；没有就随机生成一个（避免空关卡）
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.length === TILE_COUNT) {
            seedSteps = arr.map((x) => {
              const v = Number(x);
              if (!Number.isFinite(v)) return 0;
              return ((Math.round(v) % 4) + 4) % 4;
            });
            return;
          }
        } catch (_) {}
      }
  
      if (isSetup) {
        seedSteps = new Array(TILE_COUNT).fill(0);
      } else {
        // 默认随机（0..3），但确保至少有一个不是 0，避免开局就已成功
        seedSteps = new Array(TILE_COUNT).fill(0).map(() => Math.floor(Math.random() * 4));
        if (seedSteps.every(v => v === 0)) seedSteps[0] = 1;
      }
    }
  
    function wireButtons() {
      btnUndo.addEventListener("click", () => {
        resetToSeed();
      });
  
      btnSubmit.addEventListener("click", () => {
        if (isSolved()) {
          setMessage("Success", "ok");
        } else {
          setMessage("Try again", "bad");
        }
      });
  
      if (isSetup) {
        setupBar.style.display = "flex";
  
        btnSaveSetup.addEventListener("click", () => {
          // 在 setup 模式下，你通过点击改变的是 curSteps，我们保存它作为 seed
          localStorage.setItem(STORAGE_KEY, JSON.stringify(curSteps));
          seedSteps = curSteps.slice();
          setMessage("已保存 Setup（本地生效）。现在用不带 ?setup=1 的链接打开即可让玩家玩。", "ok");
        });
  
        btnClearSetup.addEventListener("click", () => {
          localStorage.removeItem(STORAGE_KEY);
          setMessage("已清除本地保存的 Setup。", "");
        });
      }
    }
  
    async function sliceImageToTiles(imageURL) {
      const img = new Image();
      img.src = imageURL;
      img.crossOrigin = "anonymous";
  
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
  
      const w = img.naturalWidth;
      const h = img.naturalHeight;
  
      const tileW = w / COLS;
      const tileH = h / ROWS;
  
      // 用一个 canvas 逐块裁切为 dataURL
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { willReadFrequently: false });
  
      tileDataURLs = new Array(TILE_COUNT);
  
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
  
          canvas.width = Math.round(tileW);
          canvas.height = Math.round(tileH);
  
          ctx.clearRect(0, 0, canvas.width, canvas.height);
  
          // 源图裁切区域（允许非整数，drawImage 会处理）
          const sx = c * tileW;
          const sy = r * tileH;
          const sw = tileW;
          const sh = tileH;
  
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  
          tileDataURLs[idx] = canvas.toDataURL("image/png");
        }
      }
    }
  
    async function init() {
      clickCount = 0;
      updateHUD();
  
      hintTextEl.textContent = isSetup
        ? "Setup 模式：点击方块设置起始角度，设置完成后保存。普通模式用于玩家挑战。"
        : "请点击方格使画面恢复正确方向，然后提交。";
  
      buildBoard();
      wireButtons();
  
      // 1) 读 seed（本地/默认）
      generateSeedFromStorageOrDefault();
      curSteps = seedSteps.slice();
  
      // 2) 切图
      try {
        await sliceImageToTiles("image.png");
      } catch (e) {
        setMessage("图片加载失败：请确认 image.png 与 index.html 同目录，并已正确上传到 GitHub。", "bad");
        return;
      }
  
      // 3) 填充切图并应用角度
      setTileImages();
      applyAllRotations();
  
      if (!isSetup) {
        setMessage("提示：点击任意方块顺时针旋转 90°。最多允许 27 次点击。Undo 会回到起始状态。", "");
      } else {
        setMessage("Setup：逐块点击设置初始角度。设置完点 Save Setup 保存。", "");
      }
    }
  
    init();
  })();
  
