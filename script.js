// 簡單的數字 Bingo 實作（含「本次命中紅邊框」與 Undo 功能）
const sizeInput = document.getElementById('sizeInput');
const createBtn = document.getElementById('createBtn');
const lockBtn = document.getElementById('lockBtn');
const resetBtn = document.getElementById('resetBtn');
const boardSection = document.getElementById('boardSection');

const guessInput = document.getElementById('guessInput');
const checkBtn = document.getElementById('checkBtn');
const clearMarksBtn = document.getElementById('clearMarksBtn');
const undoBtn = document.getElementById('undoBtn');
const feedback = document.getElementById('feedback');

let currentSize = 0;
// 歷史堆疊：每個項目是 array of "r-c" keys，代表當時被標記的格子
const historyStack = [];

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
});

lockBtn.addEventListener('click', () => {
  // 確認所有格子都有填值
  const inputs = boardSection.querySelectorAll('input.cell-input');
  for (const inp of inputs) {
    if (inp.value.trim() === '') {
      alert('請先把所有表格填滿，空白格子不可鎖定。');
      return;
    }
  }
  // 設為唯讀
  inputs.forEach(inp => {
    inp.readOnly = true;
    inp.classList.add('locked');
    // 為方便搜尋，把值標準化儲在 dataset
    inp.dataset.number = inp.value.trim();
  });

  lockBtn.disabled = true;
  sizeInput.disabled = true;
  createBtn.disabled = true;

  checkBtn.disabled = false;
  clearMarksBtn.disabled = false;

  // 清空歷史（從鎖定開始）
  historyStack.length = 0;
  undoBtn.disabled = true;

  feedback.textContent = '盤面已鎖定，可開始輸入數字進行檢查。';
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
  // 儲存歷史以便 Undo
  historyStack.push(getMarkedKeys());
  undoBtn.disabled = false;

  currentlyMarked.forEach(el => el.classList.remove('marked','current'));
  feedback.textContent = '已清除所有標記。';
});

undoBtn.addEventListener('click', () => {
  if (historyStack.length === 0) {
    feedback.textContent = '沒有可回復的步驟。';
    undoBtn.disabled = true;
    return;
  }
  const prev = historyStack.pop() || [];
  applyMarkedKeys(prev, false); // 回復到上一個狀態（回復的狀態視為先前的標記，不是本次命中）
  undoBtn.disabled = historyStack.length === 0;
  feedback.textContent = '已回復到上一步的標記狀態。';
});

/** 取得目前被標記的格子 keys */
function getMarkedKeys() {
  const marked = boardSection.querySelectorAll('input.cell-input.marked');
  return Array.from(marked).map(el => `${el.dataset.row}-${el.dataset.col}`);
}

/** 根據 keys 設定標記（先清空再標示）
 *  setCurrent 若為 true，會同時把這些格子標為 current（紅邊），否則只有綠底（無紅邊）
 */
function applyMarkedKeys(keys, setCurrent = false) {
  // 清空所有標記類別
  const allInputs = boardSection.querySelectorAll('input.cell-input');
  allInputs.forEach(el => el.classList.remove('marked','current'));

  // 再標示
  keys.forEach(k => {
    const [r, c] = k.split('-');
    const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.classList.add('marked');
      if (setCurrent) el.classList.add('current');
    }
  });
}

/** 檢查猜的數字，找出盤面內相符的格子並標記 */
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
  // 找出所有 locked 格子的 dataset.number 與輸入比對（精確比對）
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

  // 在變更之前，儲存當前標記狀態（用於 Undo）
  historyStack.push(getMarkedKeys());
  undoBtn.disabled = false;

  // 現有的 current（上次的本次命中）轉為普通 marked（移除紅邊）
  const prevCurrent = boardSection.querySelectorAll('.cell-input.current');
  prevCurrent.forEach(el => el.classList.remove('current'));

  // 新的 matched keys 標示為 marked + current（綠底白字 + 紅邊）
  matchedKeys.forEach(k => {
    const [r, c] = k.split('-');
    const el = boardSection.querySelector(`input.cell-input[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.classList.add('marked','current');
    }
  });

  feedback.textContent = `找到 ${matchedKeys.length} 個符合的格子，已標記為綠底白字（本次命中以紅邊顯示）。`;
}

/** 簡單數字標準化：去除前後空白、去掉前導零（保留 0 本身） */
function normalizeNumber(s) {
  if (s === undefined || s === null) return '';
  s = String(s).trim();
  // 如果是純數字，移除前導零
  const m = s.match(/^[-+]?\d+$/);
  if (m) {
    // 轉數字再回字串（保留符號）
    const num = Number(s);
    return String(num);
  }
  // 否則回傳原始文字（trim）
  return s;
}

/** 建立表格 */
function buildBoard(n) {
  boardSection.innerHTML = ''; // 清空
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
      // 允許快速輸入時自動選取方便覆寫
      input.addEventListener('focus', e => e.target.select());
      // 防止輸入太長
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