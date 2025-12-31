// script.js：整合先前 Bingo 邏輯，並加入「拍照/上傳自動識別填入」功能（使用 Tesseract.js）
// 注意：請確保網路可載入 Tesseract CDN，或自行換成本地檔案。
// 主要流程：使用者上傳/拍照 → 將照片等分為 n×n → 對每個 cell crop 做前處理 → OCR（限制數字）→ 填回 input。

const sizeInput = document.getElementById('sizeInput');
const createBtn = document.getElementById('createBtn');
const lockBtn = document.getElementById('lockBtn');
const resetBtn = document.getElementById('resetBtn');
const boardSection = document.getElementById('boardSection');

const imageInput = document.getElementById('imageInput');
const procCanvas = document.getElementById('procCanvas');

const guessInput = document.getElementById('guessInput');
const checkBtn = document.getElementById('checkBtn');
const clearMarksBtn = document.getElementById('clearMarksBtn');
const undoBtn = document.getElementById('undoBtn');
const feedback = document.getElementById('feedback');
const linesCountEl = document.getElementById('linesCount');

let currentSize = 0;
const historyStack = [];

// ---------- 原有的建表、鎖定、檢查、Undo、clear 等程式略（保留與之前版本相同） ----------
// 為了簡潔，我保留核心函式（buildBoard、normalizeNumber、getMarkedKeys、applyMarkedKeys、updateBingoLines、updateLinesInfo、checkGuess 等）
// 並在後面加入 OCR 相關的程式碼。
// （實際使用時請把之前完整的 Bingo 邏輯與此合併；下面是已整合的實作。）

createBtn.addEventListener('click', () => {
  const n = parseInt(sizeInput.value, 10);
  if (!n || n < 1 || n > 20) {
    alert('請輸入 1~20 的整數作為大小');
    return;
  }
  currentSize = n;
  buildBoard(n);
  lockBtn.disabled = false;
  resetBtn.disabled = false;
  checkBtn.disabled = true;
  clearMarksBtn.disabled = true;
  undoBtn.disabled = true;
  historyStack.length = 0;
  feedback.textContent = '';
  updateLinesInfo(0);
});

lockBtn.addEventListener('click', () => {
  const inputs = boardSection.querySelectorAll('input.cell-input');
  for (const inp of inputs) {
    if (inp.value.trim() === '') {
      alert('請先把所有表格填滿，空白格子不可鎖定。');
      return;
    }
  }
  inputs.forEach(inp => {
    inp.readOnly = true;
    inp.classList.add('locked');
    inp.dataset.number = inp.value.trim();
  });

  lockBtn.disabled = true;
  sizeInput.disabled = true;
  createBtn.disabled = true;

  checkBtn.disabled = false;
  clearMarksBtn.disabled = false;

  historyStack.length = 0;
  undoBtn.disabled = true;

  feedback.textContent = '盤面已鎖定，可開始輸入數字進行檢查。';
  updateLinesInfo(0);
});

resetBtn.addEventListener('click', () => {
  if (!confirm('確定要重設盤面嗎？目前資料會被清除。')) return;
  boardSection.innerHTML = '';
  currentSize = 0;
  lockBtn.disabled = true;
  resetBtn.disabled = true;
  checkBtn.disabled = true;
  clearMarksBtn.disabled = true;
  undoBtn.disabled = true;
  sizeInput.disabled = false;
  createBtn.disabled = false;
  feedback.textContent = '';
  guessInput.value = '';
  historyStack.length = 0;
  updateLinesInfo(0);
});

checkBtn.addEventListener('click', checkGuess);
guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkGuess();
});

clearMarksBtn.addEventListener('click', () => {
  const currentlyMarked = boardSection.querySelectorAll('.cell-input.marked');
  if (currentlyMarked.length === 0) {
    feedback.textContent = '目前沒有任何標記。';
    return;
  }
  if (!confirm('是否確認要清除所有標記？')) {
    feedback.textContent = '已取消清除標記。';
    return;
  }
  historyStack.push(getMarkedKeys());
  undoBtn.disabled = false;

  currentlyMarked.forEach(el => el.classList.remove('marked','current','bingo-line'));
  const completedAfter = updateBingoLines();
  updateLinesInfo(completedAfter);
  feedback.textContent = '已清除所有標記。';
});

undoBtn.addEventListener('click', () => {
  if (historyStack.length === 0) {
    feedback.textContent = '沒有可回復的步驟。';
    undoBtn.disabled = true;
    return;
  }
  const prev = historyStack.pop() || [];
  applyMarkedKeys(prev, false);
  undoBtn.disabled = historyStack.length === 0;
  feedback.textContent = '已回復到上一步的標記狀態。';
});

function getMarkedKeys() {
  const marked = boardSection.querySelectorAll('input.cell-input.marked');
  return Array.from(marked).map(el => `${el.dataset.row}-${el.dataset.col}`);
}

function applyMarkedKeys(keys, setCurrent = false) {
  const allInputs = boardSection.querySelectorAll('input.cell-input');
  allInputs.forEach(el => el.classList.remove('marked','current','bingo-line'));
  keys.forEach(k => {
    const [r, c] = k.split('-');
    const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.classList.add('marked');
      if (setCurrent) el.classList.add('current');
    }
  });
  const completedCount = updateBingoLines();
  updateLinesInfo(completedCount);
  return completedCount;
}

function checkGuess() {
  const q = guessInput.value.trim();
  if (!q) {
    feedback.textContent = '請輸入數字再檢查。';
    return;
  }
  if (!currentSize) {
    feedback.textContent = '尚未建立盤面。';
    return;
  }
  const inputs = boardSection.querySelectorAll('input.cell-input.locked');
  const matchedKeys = [];
  inputs.forEach(inp => {
    if (normalizeNumber(inp.dataset.number) === normalizeNumber(q)) {
      matchedKeys.push(`${inp.dataset.row}-${inp.dataset.col}`);
    }
  });

  if (matchedKeys.length === 0) {
    feedback.textContent = '盤面中沒有找到該數字。';
    return;
  }

  historyStack.push(getMarkedKeys());
  undoBtn.disabled = false;

  const prevCurrent = boardSection.querySelectorAll('.cell-input.current');
  prevCurrent.forEach(el => el.classList.remove('current'));

  matchedKeys.forEach(k => {
    const [r, c] = k.split('-');
    const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.classList.add('marked','current');
    }
  });

  const completedCount = updateBingoLines();
  updateLinesInfo(completedCount);

  feedback.textContent = `找到 ${matchedKeys.length} 個符合的格子，已標記為綠底白字（本次命中以紅邊顯示）。`;
}

function updateBingoLines() {
  const allInputs = boardSection.querySelectorAll('input.cell-input');
  allInputs.forEach(el => el.classList.remove('bingo-line'));
  if (!currentSize) return 0;

  const markedSet = new Set(getMarkedKeys());
  const n = currentSize;
  const completedSet = new Set();

  for (let r = 0; r < n; r++) {
    let ok = true;
    for (let c = 0; c < n; c++) {
      if (!markedSet.has(`${r}-${c}`)) { ok = false; break; }
    }
    if (ok) completedSet.add(`row-${r}`);
  }

  for (let c = 0; c < n; c++) {
    let ok = true;
    for (let r = 0; r < n; r++) {
      if (!markedSet.has(`${r}-${c}`)) { ok = false; break; }
    }
    if (ok) completedSet.add(`col-${c}`);
  }

  let okMain = true;
  for (let i = 0; i < n; i++) {
    if (!markedSet.has(`${i}-${i}`)) { okMain = false; break; }
  }
  if (okMain) completedSet.add('diag-main');

  let okAnti = true;
  for (let i = 0; i < n; i++) {
    const r = i, c = n - 1 - i;
    if (!markedSet.has(`${r}-${c}`)) { okAnti = false; break; }
  }
  if (okAnti) completedSet.add('diag-anti');

  completedSet.forEach(key => {
    if (key.startsWith('row-')) {
      const idx = parseInt(key.split('-')[1], 10);
      for (let c = 0; c < n; c++) {
        const el = boardSection.querySelector(`input.cell-input[data-row="${idx}"][data-col="${c}"]`);
        if (el) el.classList.add('bingo-line');
      }
    } else if (key.startsWith('col-')) {
      const idx = parseInt(key.split('-')[1], 10);
      for (let r = 0; r < n; r++) {
        const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${idx}"]`);
        if (el) el.classList.add('bingo-line');
      }
    } else if (key === 'diag-main') {
      for (let i = 0; i < n; i++) {
        const el = boardSection.querySelector(`input.cell-input[data-row="${i}"][data-col="${i}"]`);
        if (el) el.classList.add('bingo-line');
      }
    } else if (key === 'diag-anti') {
      for (let i = 0; i < n; i++) {
        const r = i, c = n - 1 - i;
        const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${c}"]`);
        if (el) el.classList.add('bingo-line');
      }
    }
  });

  return completedSet.size;
}

function updateLinesInfo(count) {
  linesCountEl.textContent = `已達成行數：${count}`;
}

function normalizeNumber(s) {
  if (s === undefined || s === null) return '';
  s = String(s).trim();
  const m = s.match(/^[-+]?\d+$/);
  if (m) {
    const num = Number(s);
    return String(num);
  }
  return s;
}

function buildBoard(n) {
  boardSection.innerHTML = '';
  const table = document.createElement('table');
  table.className = 'bingo';
  for (let r = 0; r < n; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < n; c++) {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-input';
      input.inputMode = 'numeric';
      input.placeholder = '';
      input.autocomplete = 'off';
      input.dataset.row = r;
      input.dataset.col = c;
      input.addEventListener('focus', e => e.target.select());
      input.addEventListener('input', e => {
        const v = e.target.value;
        if (v.length > 6) e.target.value = v.slice(0,6);
      });
      td.appendChild(input);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  boardSection.appendChild(table);
}

// ---------- OCR 功能：拍照/上傳並自動填入 ----------
// 使用 Tesseract.js createWorker
let tesseractWorker = null;
let tesseractReady = false;

async function ensureTesseract() {
  if (tesseractReady) return;
  if (!('Tesseract' in window)) {
    throw new Error('Tesseract.js 未載入');
  }
  tesseractWorker = Tesseract.createWorker({
    logger: m => { /* 可以印 progress: console.log(m) */ }
  });
  await tesseractWorker.load();
  await tesseractWorker.loadLanguage('eng');
  await tesseractWorker.initialize('eng');
  // 只允許數字
  await tesseractWorker.setParameters({
    tessedit_char_whitelist: '0123456789',
    user_defined_dpi: '150'
  });
  tesseractReady = true;
}

// 點選上傳檔案
imageInput.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!currentSize) {
    alert('請先建立盤面（設定 n×n）再上傳圖片以自動填入。');
    imageInput.value = '';
    return;
  }
  feedback.textContent = '開始處理影像並識別，請稍候……';
  try {
    await ensureTesseract();
    const img = await loadImageFromFile(file);
    // 把照片等比縮放到 canvas（不超過 1600px）
    const maxW = 1600;
    const scale = Math.min(1, maxW / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    procCanvas.width = w;
    procCanvas.height = h;
    const ctx = procCanvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    // 簡單做：直接把畫面等分成 n x n，對每個 cell crop 並 OCR
    const results = [];
    for (let r = 0; r < currentSize; r++) {
      for (let c = 0; c < currentSize; c++) {
        const cellRect = computeCellRect(w, h, currentSize, r, c);
        // 擴一點 margin，避免裁切邊界漏字
        const pad = Math.ceil(Math.min(cellRect.w, cellRect.h) * 0.12);
        const sx = Math.max(0, cellRect.x - pad);
        const sy = Math.max(0, cellRect.y - pad);
        const sw = Math.min(w - sx, cellRect.w + pad * 2);
        const sh = Math.min(h - sy, cellRect.h + pad * 2);
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sw;
        cropCanvas.height = sh;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.drawImage(procCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

        // 前處理：灰階 + 簡單二值化（自適應閾值簡化為固定）
        const imgData = cropCtx.getImageData(0,0,sw,sh);
        const data = imgData.data;
        // grayscale
        for (let i = 0; i < data.length; i += 4) {
          const gray = (data[i]*0.3 + data[i+1]*0.59 + data[i+2]*0.11);
          data[i] = data[i+1] = data[i+2] = gray;
        }
        // naive threshold
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i];
        const avg = sum / (data.length/4);
        const threshold = Math.max(100, avg * 0.9);
        for (let i = 0; i < data.length; i += 4) {
          const v = data[i] > threshold ? 255 : 0;
          data[i] = data[i+1] = data[i+2] = v;
        }
        cropCtx.putImageData(imgData, 0, 0);

        // OCR 該 crop（把 canvas 直接傳給 Tesseract）
        const { data: ocrData } = await tesseractWorker.recognize(cropCanvas);
        let text = (ocrData && ocrData.text) ? ocrData.text.replace(/\s+/g, '') : '';
        // 清理，只取數字
        text = (text.match(/[0-9]+/) || [''])[0];
        results.push({ r, c, text });
      }
    }

    // 把辨識結果填回表格（如果辨識為空就保留原值）
    let filled = 0;
    results.forEach(item => {
      const el = boardSection.querySelector(`input.cell-input[data-row="${item.r}"][data-col="${item.c}"]`);
      if (el) {
        if (item.text) {
          el.value = item.text;
          el.dataset.number = item.text;
          filled++;
        }
      }
    });

    feedback.textContent = `已完成 OCR，自動填入 ${filled} 個格子（若某些格子辨識不到會保留原值）。請檢查並視需要微調，然後按「鎖定為唯讀」。`;
    // 啟用鎖定按鈕（若尚未鎖定）
    lockBtn.disabled = false;
    // 啟用清除按鈕（讓使用者可以清除/undo）
    clearMarksBtn.disabled = false;
  } catch (err) {
    console.error(err);
    feedback.textContent = 'OCR 發生錯誤：' + (err.message || err);
  } finally {
    imageInput.value = '';
  }
});

// 幫助函式：從 File 讀成 Image
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error('無法載入圖片'));
    };
    img.src = url;
  });
}

// 計算某個 cell 在畫布上的座標與大小（等分方式）
function computeCellRect(canvasW, canvasH, n, r, c) {
  // 以寬或高為主？我們以寬或高的等分都行（直接在兩方向等分）
  const cellW = canvasW / n;
  const cellH = canvasH / n;
  const x = Math.round(c * cellW);
  const y = Math.round(r * cellH);
  return { x, y, w: Math.round(cellW), h: Math.round(cellH) };
}

// 在離開/關閉時釋放 worker
window.addEventListener('beforeunload', async () => {
  try {
    if (tesseractWorker) {
      await tesseractWorker.terminate();
      tesseractWorker = null;
    }
  } catch (e) { /* ignore */ }
});