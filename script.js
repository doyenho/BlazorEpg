// 簡單的數字 Bingo 實作
const sizeInput = document.getElementById('sizeInput');
const createBtn = document.getElementById('createBtn');
const lockBtn = document.getElementById('lockBtn');
const resetBtn = document.getElementById('resetBtn');
const boardSection = document.getElementById('boardSection');

const guessInput = document.getElementById('guessInput');
const checkBtn = document.getElementById('checkBtn');
const clearMarksBtn = document.getElementById('clearMarksBtn');
const feedback = document.getElementById('feedback');

let currentSize = 0;

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
  sizeInput.disabled = false;
  createBtn.disabled = false;
  feedback.textContent = '';
  guessInput.value = '';
});

checkBtn.addEventListener('click', checkGuess);
guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkGuess();
});

clearMarksBtn.addEventListener('click', () => {
  const marked = boardSection.querySelectorAll('.cell-input.marked');
  marked.forEach(el => el.classList.remove('marked'));
  feedback.textContent = '已清除所有標記。';
});

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
  let found = 0;
  inputs.forEach(inp => {
    if (normalizeNumber(inp.dataset.number) === normalizeNumber(q)) {
      inp.classList.add('marked');
      found++;
    }
  });
  if (found > 0) {
    feedback.textContent = `找到 ${found} 個符合的格子，已標記為綠底白字。`;
  } else {
    feedback.textContent = '盤面中沒有找到該數字。';
  }
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