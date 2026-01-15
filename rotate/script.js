(() => {
  "use strict";

  // ===== 基本配置 =====
  const ROWS = 4;
  const COLS = 7;

  // 点击次数限制（从 HTML 里读）
  const elClickLimit = document.getElementById("clickLimit");
  const MAX_CLICKS = parseInt(elClickLimit?.textContent || "27", 10);

  // success 后跳转目标（相对于 /playground/rotate/）
  const NEXT_URL = "../circle/";

  // 你的拼图原图文件名如果不同，请加在这里
  const CANDIDATE_IMAGES = [
    "puzzle.jpg",
    "puzzle.png",
    "map.png",
    "image.jpg",
    "image.png",
    "bg.jpg",
    "bg.png",
    "main.jpg",
    "main.png"
  ];

  // 允许通过 ?img=xxx.png 指定图片（可选）
  const urlParams = new URLSearchParams(location.search);
  const imgFromQuery = urlParams.get("img");
  if (imgFromQuery) CANDIDATE_IMAGES.unshift(imgFromQuery);

  // ===== DOM =====
  const board = document.getElementById("board");
  const message = document.getElementById("message");
  const btnUndo = document.getElementById("btnUndo");
  const btnSubmit = document.getElementById("btnSubmit");
  const elClickCount = document.getElementById("clickCount");

  // ===== 状态 =====
  // rotations[i] = 0/90/180/270
  const rotations = new Array(ROWS * COLS).fill(0);
  const history = []; // { idx, prevRot }
  let clickCount = 0;
  let locked = false;

  function setMsg(text, type = "") {
    message.className = "msg" + (type ? ` ${type}` : "");
    message.textContent = text || "";
  }

  function setButtonsEnabled(enabled) {
    btnUndo.disabled = !enabled;
    btnSubmit.disabled = !enabled;
  }

  function updateClickCountUI() {
    if (elClickCount) elClickCount.textContent = String(clickCount);
  }

  function normalizeDeg(deg) {
    let d = deg % 360;
    if (d < 0) d += 360;
    // 只允许 0/90/180/270
    return ((Math.round(d / 90) * 90) % 360);
  }

  function applyRotationToTile(tileImg, deg) {
    tileImg.style.transform = `rotate(${deg}deg)`;
  }

  function tileIndex(r, c) {
    return r * COLS + c;
  }

  function isSolved() {
    // 规则：全部转到 0 度为成功
    for (let i = 0; i < rotations.length; i++) {
      if (normalizeDeg(rotations[i]) !== 0) return false;
    }
    return true;
  }

  function lockGame() {
    locked = true;
    setButtonsEnabled(false);
    board.style.pointerEvents = "none";
  }

  function unlockGame() {
    locked = false;
    setButtonsEnabled(true);
    board.style.pointerEvents = "auto";
  }

  function enforceClickLimit() {
    if (clickCount >= MAX_CLICKS) {
      // 到上限后不让再点，但仍允许 Undo
      board.style.pointerEvents = "none";
      btnSubmit.disabled = false; // 还允许提交
      btnUndo.disabled = history.length === 0;
      setMsg(`已达到点击上限（${MAX_CLICKS}）。可 Undo 或 Submit。`, "bad");
      return true;
    } else {
      board.style.pointerEvents = "auto";
      btnUndo.disabled = history.length === 0;
      btnSubmit.disabled = false;
      return false;
    }
  }

  function rotateAt(idx, tileImg) {
    if (locked) return;

    // 达到上限则禁止旋转
    if (clickCount >= MAX_CLICKS) {
      enforceClickLimit();
      return;
    }

    const prev = rotations[idx];
    const next = normalizeDeg(prev + 90);

    history.push({ idx, prevRot: prev });

    rotations[idx] = next;
    applyRotationToTile(tileImg, next);

    clickCount += 1;
    updateClickCountUI();

    btnUndo.disabled = history.length === 0;

    // 清空提示
    setMsg("");

    enforceClickLimit();
  }

  function undoOne() {
    if (locked) return;
    if (history.length === 0) return;

    const last = history.pop();
    const idx = last.idx;
    rotations[idx] = last.prevRot;

    const tile = board.querySelector(`.tile[data-idx="${idx}"] img`);
    if (tile) applyRotationToTile(tile, rotations[idx]);

    // Undo 不回退 clickCount（更符合“操作次数”含义）
    // 如果你希望 Undo 回退点击次数，把下面两行取消注释即可：
    // clickCount = Math.max(0, clickCount - 1);
    // updateClickCountUI();

    btnUndo.disabled = history.length === 0;

    // 恢复可点击
    board.style.pointerEvents = "auto";
    setMsg("");

    enforceClickLimit();
  }

  function submitCheck() {
    if (locked) return;

    if (isSolved()) {
      setMsg("success", "ok");
      lockGame();

      // 给玩家 600ms 看到 success 再跳转
      setTimeout(() => {
        location.href = NEXT_URL;
      }, 600);
    } else {
      setMsg("try again", "bad");
    }
  }

  // ===== 图片加载：按候选顺序尝试 =====
  function loadFirstWorkingImage(candidates) {
    return new Promise((resolve, reject) => {
      let i = 0;

      const tryNext = () => {
        if (i >= candidates.length) {
          reject(new Error("No image found. Please add your image file or update CANDIDATE_IMAGES."));
          return;
        }
        const src = candidates[i++];
        const img = new Image();
        img.onload = () => resolve({ img, src });
        img.onerror = () => tryNext();
        img.src = src + (src.includes("?") ? "" : `?v=${Date.now()}`);
      };

      tryNext();
    });
  }

  function buildBoard(imageSrc) {
    // 清空
    board.innerHTML = "";

    // 生成 tile
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const idx = tileIndex(r, c);

        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.idx = String(idx);
        if (c === COLS - 1) tile.dataset.lastCol = "1";
        if (r === ROWS - 1) tile.dataset.lastRow = "1";

        const img = document.createElement("img");
        img.alt = "";

        // 关键：用 background-position 思路切图
        // 用 CSS object-fit 不能切分，所以我们用“超大图 + 位移”的方式：
        // 这里通过设置 img 的尺寸为 (COLS*100%, ROWS*100%)，再用 translate 定位到对应块
        img.style.width = `${COLS * 100}%`;
        img.style.height = `${ROWS * 100}%`;
        img.style.objectFit = "cover";

        // 使用 transform 需要同时包含位移与旋转，所以我们用 wrapper 方式会更复杂；
        // 这里采用：img 外再包一层 inner，旋转作用在 img 上，位移作用在 inner 上。
        // 但你 HTML/CSS 已固定 .tile img transform 旋转，所以我们改成：用 CSS variables 控制位移。
        // 最简单：直接用 position 绝对定位切图（更可靠）。

        // 改用绝对定位切图：
        const inner = document.createElement("div");
        inner.style.position = "relative";
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.overflow = "hidden";

        img.style.position = "absolute";
        img.style.left = `${(-c * 100)}%`;
        img.style.top = `${(-r * 100)}%`;
        img.style.width = `${COLS * 100}%`;
        img.style.height = `${ROWS * 100}%`;

        // 初始随机旋转
        const initial = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
        rotations[idx] = initial;
        applyRotationToTile(img, initial);

        img.src = imageSrc;

        inner.appendChild(img);
        tile.appendChild(inner);

        tile.addEventListener("click", () => rotateAt(idx, img), { passive: true });

        board.appendChild(tile);
      }
    }

    // 初始 UI
    clickCount = 0;
    updateClickCountUI();
    history.length = 0;
    btnUndo.disabled = true;
    btnSubmit.disabled = false;
    unlockGame();
    setMsg("");
    enforceClickLimit();
  }

  // ===== 绑定按钮 =====
  btnUndo.addEventListener("click", undoOne);
  btnSubmit.addEventListener("click", submitCheck);

  // ===== 启动 =====
  setMsg("加载中…");
  setButtonsEnabled(false);

  loadFirstWorkingImage(CANDIDATE_IMAGES)
    .then(({ src }) => {
      setButtonsEnabled(true);
      setMsg("");
      buildBoard(src);
    })
    .catch((err) => {
      setButtonsEnabled(false);
      setMsg("未找到拼图原图文件。请把图片放在 rotate/ 目录，或在 script.js 里更新 CANDIDATE_IMAGES。", "bad");
      // 控制台输出方便你排查
      console.error(err);
    });
})();
