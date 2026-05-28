/**
 * =============================================================
 * Poker Judge Tool - script.js
 * Made by hiro / ヒロ  |  https://github.com/h1ro223
 * =============================================================
 */

'use strict';

// =============================================================
// § 1. 定数
// =============================================================

const SUITS = [
    { id: 'S', symbol: '♠', name: 'スペード', color: 'black' },
    { id: 'C', symbol: '♣', name: 'クラブ',   color: 'black' },
    { id: 'D', symbol: '♦', name: 'ダイヤ',   color: 'red'   },
    { id: 'H', symbol: '♥', name: 'ハート',   color: 'red'   },
];

const RANKS = [
    { id: 14, short: 'A'  },
    { id: 2,  short: '2'  },
    { id: 3,  short: '3'  },
    { id: 4,  short: '4'  },
    { id: 5,  short: '5'  },
    { id: 6,  short: '6'  },
    { id: 7,  short: '7'  },
    { id: 8,  short: '8'  },
    { id: 9,  short: '9'  },
    { id: 10, short: '10' },
    { id: 11, short: 'J'  },
    { id: 12, short: 'Q'  },
    { id: 13, short: 'K'  },
];

const PAYOUTS = {
    ROYAL_FLUSH: 5000, STRAIGHT_FLUSH: 1500, FOUR_OF_A_KIND: 600,
    FULL_HOUSE: 300, FLUSH: 200, STRAIGHT: 125,
    THREE_OF_A_KIND: 75, TWO_PAIR: 40, JACKS_OR_BETTER: 10, NOTHING: 0,
};

const HAND_NAMES = {
    ROYAL_FLUSH: 'Royal Flush', STRAIGHT_FLUSH: 'Straight Flush',
    FOUR_OF_A_KIND: 'Four of a Kind', FULL_HOUSE: 'Full House',
    FLUSH: 'Flush', STRAIGHT: 'Straight',
    THREE_OF_A_KIND: 'Three of a Kind', TWO_PAIR: 'Two Pair',
    JACKS_OR_BETTER: 'Jacks or Better', NOTHING: 'Nothing',
};

const HAND_ORDER = [
    'ROYAL_FLUSH', 'STRAIGHT_FLUSH', 'FOUR_OF_A_KIND', 'FULL_HOUSE',
    'FLUSH', 'STRAIGHT', 'THREE_OF_A_KIND', 'TWO_PAIR', 'JACKS_OR_BETTER', 'NOTHING',
];

const STORAGE_KEY = 'pokerJudgeHistory_v2';

// =============================================================
// § 2. アプリ状態
// =============================================================

const state = {
    hand: [null, null, null, null, null],
    calculationResults: null,
    // ピッカー
    pickerTarget: 'main', // 'main' or 'record'
    pickerIndex: null,
    pickerSuit: null,
    pickerRank: null,
    // 記録用
    recordFinalHand: [null, null, null, null, null],
    // 編集用
    editingRecordId: null,
};

// =============================================================
// § 3. デッキユーティリティ
// =============================================================

function generateDeck() {
    const deck = [];
    for (const suit of SUITS) for (const rank of RANKS) deck.push({ suitId: suit.id, rankId: rank.id });
    return deck;
}

function getRemainingDeck(hand) {
    return generateDeck().filter(c => !hand.some(h => h && h.suitId === c.suitId && h.rankId === c.rankId));
}

function cardKey(c) { return `${c.suitId}-${c.rankId}`; }

// =============================================================
// § 4. 役判定
// =============================================================

function evaluateHand(hand) {
    const ranks = hand.map(c => c.rankId).sort((a, b) => a - b);
    const suits = hand.map(c => c.suitId);
    const isFlush = suits.every(s => s === suits[0]);
    let isStraight = false;
    if (new Set(ranks).size === 5) {
        if (ranks[4] - ranks[0] === 4) isStraight = true;
        if (ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14) isStraight = true;
    }
    if (isFlush && isStraight && ranks[0] === 10) return 'ROYAL_FLUSH';
    if (isFlush && isStraight) return 'STRAIGHT_FLUSH';
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
    const counts = Object.values(freq).sort((a, b) => b - a);
    if (counts[0] === 4) return 'FOUR_OF_A_KIND';
    if (counts[0] === 3 && counts[1] === 2) return 'FULL_HOUSE';
    if (isFlush) return 'FLUSH';
    if (isStraight) return 'STRAIGHT';
    if (counts[0] === 3) return 'THREE_OF_A_KIND';
    if (counts[0] === 2 && counts[1] === 2) return 'TWO_PAIR';
    if (counts[0] === 2) {
        const pairRank = parseInt(Object.keys(freq).find(r => freq[r] === 2), 10);
        if (pairRank >= 11) return 'JACKS_OR_BETTER';
    }
    return 'NOTHING';
}

// =============================================================
// § 5. 手札分析（AI理由用）
// =============================================================

function analyzeHand5orLess(cards) {
    if (!cards || cards.length === 0) return {};
    const ranks = cards.map(c => c.rankId);
    const suits = cards.map(c => c.suitId);
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
    const suitFreq = {};
    for (const s of suits) suitFreq[s] = (suitFreq[s] || 0) + 1;
    const result = {};
    const pairRanks = Object.entries(freq).filter(([, c]) => c >= 2).map(([r]) => parseInt(r));
    const tripRanks = Object.entries(freq).filter(([, c]) => c >= 3).map(([r]) => parseInt(r));
    const quadRanks = Object.entries(freq).filter(([, c]) => c >= 4).map(([r]) => parseInt(r));
    result.hasQuads   = quadRanks.length > 0;
    result.hasTrips   = tripRanks.length > 0;
    result.hasPair    = pairRanks.length >= 1;
    result.hasTwoPair = pairRanks.length >= 2;
    result.pairRank   = pairRanks[0] ?? null;
    result.tripRank   = tripRanks[0] ?? null;
    const maxSS = Math.max(...Object.values(suitFreq));
    result.flushDraw = cards.length >= 3 && maxSS === cards.length;
    result.flushDrawSuit = Object.entries(suitFreq).sort((a, b) => b[1] - a[1])[0]?.[0];
    const uniq = [...new Set(ranks)].sort((a, b) => a - b);
    result.straightDraw = false;
    if (uniq.length >= 3 && !result.hasPair) {
        for (let low = 2; low <= 10; low++) {
            const w = [low, low+1, low+2, low+3, low+4];
            if (uniq.filter(r => w.includes(r)).length >= uniq.length) { result.straightDraw = true; break; }
        }
        if (uniq.filter(r => [14,2,3,4,5].includes(r)).length >= uniq.length) result.straightDraw = true;
    }
    result.highCardCount = ranks.filter(r => r >= 11).length;
    return result;
}

// =============================================================
// § 6. EV計算エンジン
// =============================================================

function iterateCombinations(arr, k, cb) {
    const n = arr.length;
    if (k === 0) { cb([]); return; }
    if (k > n) return;
    const idx = Array.from({ length: k }, (_, i) => i);
    while (true) {
        cb(idx.map(i => arr[i]));
        let p = k - 1;
        while (p >= 0 && idx[p] === n - k + p) p--;
        if (p < 0) break;
        idx[p]++;
        for (let j = p + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
    }
}

function computeEVForPattern(held, remaining) {
    const draw = 5 - held.length;
    const dist = {};
    for (const h of HAND_ORDER) dist[h] = 0;
    if (draw === 0) { const r = evaluateHand(held); dist[r] = 1; return { ev: PAYOUTS[r], handDist: dist, totalCombos: 1 }; }
    let total = 0, combos = 0;
    iterateCombinations(remaining, draw, (d) => { const r = evaluateHand([...held, ...d]); total += PAYOUTS[r]; dist[r]++; combos++; });
    return { ev: total / combos, handDist: dist, totalCombos: combos };
}

async function calculateAllEVs(hand, onProgress) {
    const remaining = getRemainingDeck(hand);
    const results = [];
    for (let mask = 0; mask < 32; mask++) {
        if (mask % 4 === 0) { await new Promise(r => setTimeout(r, 0)); onProgress((mask / 32) * 100); }
        const hi = [];
        for (let i = 0; i < 5; i++) if ((mask >> i) & 1) hi.push(i);
        const hc = hi.map(i => hand[i]);
        const { ev, handDist, totalCombos } = computeEVForPattern(hc, remaining);
        results.push({ mask, heldIndices: hi, heldCards: hc, ev, handDist, totalCombos, confirmedWin: isConfirmedWin(hc) });
    }
    onProgress(100);
    results.sort((a, b) => { const d = b.ev - a.ev; return Math.abs(d) > 1e-9 ? d : (b.confirmedWin ? 1 : 0) - (a.confirmedWin ? 1 : 0); });
    return results;
}

function isConfirmedWin(held) {
    if (held.length === 5) return PAYOUTS[evaluateHand(held)] > 0;
    if (held.length === 4) return held.every(c => c.rankId === held[0].rankId);
    return false;
}

// =============================================================
// § 7. 戦略理由AI
// =============================================================

function generateStrategyReason(top, all, hand) {
    const hi = top.heldIndices, hc = hi.map(i => hand[i]), n = hc.length;
    const dist = top.handDist, total = top.totalCombos;
    const rn = (id) => RANKS.find(r => r.id === id)?.short ?? id;
    const sn = (id) => SUITS.find(s => s.id === id)?.symbol ?? id;
    const cs = (c) => `${rn(c.rankId)}${sn(c.suitId)}`;
    const pct = (c) => (c / total * 100).toFixed(2);
    const hl = (t, cls = 'green') => `<span class="hl-${cls}">${t}</span>`;
    const wins = total - (dist.NOTHING || 0), wr = (wins / total * 100).toFixed(1);
    const topPay = HAND_ORDER.filter(h => h !== 'NOTHING' && dist[h] > 0).sort((a, b) => dist[b] - dist[a])[0];
    const curHand = evaluateHand(hand), curPay = PAYOUTS[curHand];
    const ana = hc.length > 0 ? analyzeHand5orLess(hc) : null;
    const sec = all.length > 1 ? all[1] : null;
    const evD = sec ? (top.ev - sec.ev).toFixed(3) : null;
    const lines = [];

    if (n === 5) {
        if (curPay > 0) {
            lines.push(`現在の手札は既に<strong>${HAND_NAMES[curHand]}</strong>（配当 ${hl('+' + curPay, 'gold')}）が完成しています。`);
            lines.push(`確定した配当を受け取るのが最善です。`);
        } else { lines.push(`全枚キープが最高EVとなる珍しいケースです。`); }
    } else if (n === 0) {
        lines.push(`手札に${hl('有力な手がかりがない', 'red')}ため、全交換が最善です。`);
        lines.push(`${total.toLocaleString()}通り中 ${hl(wins.toLocaleString())}通り（${hl(wr + '%')}）で配当が発生します。`);
    } else {
        const hs = hc.map(c => `<strong>${cs(c)}</strong>`).join('・');
        if (ana) {
            if (ana.hasQuads) { lines.push(`${hs} で${hl('Four of a Kind (+600)', 'gold')}が確定します。`); }
            else if (ana.hasTrips) {
                lines.push(`${hs} は ${hl(rn(ana.tripRank) + 'のThree of a Kind')}です。`);
                if (dist.FOUR_OF_A_KIND > 0) lines.push(`${hl('Four of a Kind')}に昇格する確率: ${hl(pct(dist.FOUR_OF_A_KIND) + '%')}`);
                if (dist.FULL_HOUSE > 0) lines.push(`${hl('Full House', 'gold')}の確率: ${hl(pct(dist.FULL_HOUSE) + '%')}`);
            }
            else if (ana.hasTwoPair) { lines.push(`${hs} は${hl('Two Pair')}。${hl('Full House (+300)', 'gold')}への昇格チャンスがあります。`); }
            else if (ana.hasPair) {
                const pr = rn(ana.pairRank), isH = ana.pairRank >= 11;
                if (isH) { lines.push(`${hs} は${hl(pr + 'のHigh Pair')}。${hl('最低10の配当保証')}＋上位役への昇格チャンスがあります。`); }
                else { lines.push(`${hs} は${hl(pr + 'のLow Pair')}。配当なしですが${hl('Three of a Kind / Full House')}への発展チャンスがあります。`); }
            }
            else if (ana.flushDraw) {
                lines.push(`${hs} は ${hl(sn(ana.flushDrawSuit) + 'の' + n + '枚Flush Draw')}です。`);
                if (dist.FLUSH > 0) lines.push(`${hl('Flush (+200)', 'gold')}の確率: ${hl(pct(dist.FLUSH) + '%')}`);
            }
            else if (ana.straightDraw) {
                lines.push(`${hs} は${hl('Straight Draw')}です。`);
                if (dist.STRAIGHT > 0) lines.push(`${hl('Straight (+125)', 'gold')}の確率: ${hl(pct(dist.STRAIGHT) + '%')}`);
            }
            else if (ana.highCardCount > 0) { lines.push(`${hs} の${hl(ana.highCardCount + '枚のハイカード')}を残し、${hl('Jacks or Better')}ペアの確率を最大化。`); }
            else { lines.push(`${hs} をキープすることで期待値が最大化されます。`); }
        }
    }
    if (n > 0 && n < 5) {
        if (topPay) lines.push(`最頻配当役: ${hl(HAND_NAMES[topPay], 'gold')}（${hl(pct(dist[topPay]) + '%')}）`);
        lines.push(`配当発生率: ${hl(wins.toLocaleString())}/${total.toLocaleString()}通り（${hl(wr + '%')}）`);
    }
    if (sec && evD && parseFloat(evD) > 0) { lines.push(`<br>2位との差: 期待値 ${hl('+' + evD)} 高く、この戦略が最適です。`); }
    return lines.join('<br>');
}

function describeHoldPattern(indices) {
    if (indices.length === 5) return '全枚キープ';
    if (indices.length === 0) return '全枚交換';
    return `${indices.length}枚キープ（${indices.map(i => i + 1).join('・')}枚目）`;
}

// =============================================================
// § 8. UI ヘルパー
// =============================================================

const getSuitSymbol     = (id) => SUITS.find(s => s.id === id)?.symbol ?? '';
const getSuitColorClass = (id) => (SUITS.find(s => s.id === id)?.color === 'red') ? 'suit-red' : 'suit-black';
const getRankShort      = (id) => RANKS.find(r => r.id === id)?.short ?? '';

function createCardHTML(card, index, { isHeld = false, isDimmed = false } = {}) {
    if (!card) {
        return `<div class="pcard empty" data-index="${index}">
            <span class="card-empty-num">${index + 1}</span>
            <span class="card-empty-hint">タップ</span>
        </div>`;
    }
    const sym = getSuitSymbol(card.suitId), col = getSuitColorClass(card.suitId), rk = getRankShort(card.rankId);
    const hC = isHeld ? 'held' : '', dC = isDimmed ? 'dimmed' : '';
    const hB = isHeld ? '<div class="held-badge">HOLD</div>' : '';
    return `<div class="pcard ${col} ${hC} ${dC}" data-index="${index}">
        <div class="card-corner top-left"><span class="card-rank">${rk}</span><span class="card-suit-small">${sym}</span></div>
        <div class="card-center-suit">${sym}</div>
        <div class="card-corner bottom-right"><span class="card-rank">${rk}</span><span class="card-suit-small">${sym}</span></div>
        ${hB}
    </div>`;
}

// =============================================================
// § 9. カードピッカー（スート→ランク 2段階ポップアップ）
// =============================================================

/**
 * ピッカーを開く
 * @param {number} index - 手札のインデックス(0-4)
 * @param {'main'|'record'} target - どちらの手札用か
 */
function openPicker(index, target = 'main') {
    state.pickerTarget = target;
    state.pickerIndex  = index;
    state.pickerSuit   = null;
    state.pickerRank   = null;

    const existing = target === 'main' ? state.hand[index] : state.recordFinalHand[index];
    if (existing) {
        state.pickerSuit = existing.suitId;
        state.pickerRank = existing.rankId;
    }

    document.getElementById('pickerTitle').textContent = `カード ${index + 1} を選択`;
    renderPickerSuits();
    renderPickerRanks();

    document.getElementById('pickerStepRank').style.display = state.pickerSuit ? 'block' : 'none';
    document.getElementById('pickerOverlay').style.display = 'flex';
}

function closePicker() {
    document.getElementById('pickerOverlay').style.display = 'none';
    state.pickerIndex = null;
    state.pickerSuit  = null;
    state.pickerRank  = null;
}

/** 使用中のカードキーセット取得（ピッカー対象のインデックスを除く） */
function getUsedKeys() {
    const hand = state.pickerTarget === 'main' ? state.hand : state.recordFinalHand;
    return new Set(
        hand.filter((c, i) => c !== null && i !== state.pickerIndex).map(c => cardKey(c))
    );
}

function renderPickerSuits() {
    const container = document.getElementById('pickerSuitRow');
    container.innerHTML = SUITS.map(suit => {
        const sel = state.pickerSuit === suit.id ? 'selected' : '';
        const col = suit.color === 'red' ? 'spb-red' : 'spb-black';
        return `<button class="suit-pick-btn ${col} ${sel}" data-suit="${suit.id}">
            <span class="spb-icon">${suit.symbol}</span>
            <span class="spb-name">${suit.name}</span>
        </button>`;
    }).join('');

    container.querySelectorAll('.suit-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.pickerSuit = btn.dataset.suit;
            state.pickerRank = null; // スート変えたらランクリセット
            renderPickerSuits();
            renderPickerRanks();
            document.getElementById('pickerStepRank').style.display = 'block';
        });
    });
}

function renderPickerRanks() {
    const container = document.getElementById('pickerRankGrid');
    if (!state.pickerSuit) { container.innerHTML = ''; return; }

    const usedKeys = getUsedKeys();

    container.innerHTML = RANKS.map(rank => {
        const key = `${state.pickerSuit}-${rank.id}`;
        const isUsed = usedKeys.has(key);
        const isSel  = state.pickerRank === rank.id;
        return `<button class="rank-pick-btn ${isSel ? 'selected' : ''}"
                    data-rank="${rank.id}" ${isUsed ? 'disabled' : ''}>
            ${rank.short}
        </button>`;
    }).join('');

    container.querySelectorAll('.rank-pick-btn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            state.pickerRank = parseInt(btn.dataset.rank, 10);
            // 自動登録
            confirmPicker();
        });
    });
}

/** ピッカーで選択を確定 */
function confirmPicker() {
    if (!state.pickerSuit || state.pickerRank === null) return;
    const card = { suitId: state.pickerSuit, rankId: state.pickerRank };

    if (state.pickerTarget === 'main') {
        state.hand[state.pickerIndex] = card;
        state.calculationResults = null;
        document.getElementById('resultsArea').style.display = 'none';
        renderHandPreview();
        updateCalcButton();
    } else {
        state.recordFinalHand[state.pickerIndex] = card;
        renderRecordFinalHand();
    }

    closePicker();
}

/** ピッカー上のクリアボタン */
function clearPickerCard() {
    if (state.pickerTarget === 'main') {
        state.hand[state.pickerIndex] = null;
        compactHand();
        state.calculationResults = null;
        document.getElementById('resultsArea').style.display = 'none';
        renderHandPreview();
        updateCalcButton();
    } else {
        state.recordFinalHand[state.pickerIndex] = null;
        compactRecordHand();
        renderRecordFinalHand();
    }
    closePicker();
}

// =============================================================
// § 10. 手札プレビュー
// =============================================================

function renderHandPreview() {
    const container = document.getElementById('handPreview');
    container.innerHTML = state.hand.map((card, i) => createCardHTML(card, i)).join('');

    // 空スロット → ピッカーを開く
    container.querySelectorAll('.pcard.empty').forEach(el => {
        el.addEventListener('click', () => openPicker(parseInt(el.dataset.index, 10), 'main'));
    });

    // 入力済みカード → タップでピッカー（変更/除去）
    container.querySelectorAll('.pcard:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            // 長押しなら除去、普通タップならピッカーで変更
            state.hand[idx] = null;
            compactHand();
            state.calculationResults = null;
            document.getElementById('resultsArea').style.display = 'none';
            renderHandPreview();
            updateCalcButton();
        });
    });

    const count = state.hand.filter(c => c !== null).length;
    const counter = document.getElementById('handCounter');
    counter.textContent = `${count} / 5`;
    counter.classList.toggle('complete', count === 5);
}

function compactHand() {
    const filled = state.hand.filter(c => c !== null);
    state.hand = [...filled, ...Array(5 - filled.length).fill(null)];
}

function updateCalcButton() {
    const btn = document.getElementById('calcBtn');
    btn.disabled = state.hand.filter(c => c !== null).length !== 5;
    const recBtn = document.getElementById('goRecordBtn');
    if (recBtn) {
        const has = !!state.calculationResults;
        recBtn.disabled = !has;
        recBtn.classList.toggle('ready', has);
    }
}

// =============================================================
// § 11. 計算結果レンダリング
// =============================================================

function renderResults(results) {
    const container = document.getElementById('resultsList');
    const top5 = results.slice(0, 5);
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    container.innerHTML = top5.map((result, rank) => {
        const isTop = rank === 0;
        const holdLabel = describeHoldPattern(result.heldIndices);
        const badge = result.confirmedWin ? '<span class="badge badge-confirmed">✅ 確定勝利</span>' : '';
        const cards = state.hand.map((c, i) => createCardHTML(c, i, { isHeld: result.heldIndices.includes(i), isDimmed: !result.heldIndices.includes(i) })).join('');

        let reason = '';
        if (rank === 0) {
            reason = `<div class="strategy-reason">
                <div class="strategy-reason-title">🧠 AI分析 ─ この戦略が最適な理由</div>
                <div class="strategy-reason-text">${generateStrategyReason(result, results, state.hand)}</div>
            </div>`;
        }

        const dist = HAND_ORDER.filter(h => result.handDist[h] > 0).map(h => {
            const cnt = result.handDist[h], prob = (cnt / result.totalCombos * 100).toFixed(2);
            const pay = PAYOUTS[h], pCls = pay > 0 ? 'payout-positive' : '', pTxt = pay > 0 ? `+${pay}` : '—';
            return `<div class="hand-dist-row">
                <span class="hand-name">${HAND_NAMES[h]}</span>
                <span class="hand-payout ${pCls}">${pTxt}</span>
                <div class="hand-prob-bar"><div class="hand-prob-fill" style="width:${Math.min(parseFloat(prob), 100)}%"></div></div>
                <span class="hand-prob-text">${prob}%</span>
            </div>`;
        }).join('');

        return `<div class="result-card ${isTop ? 'result-card-top' : ''}" style="animation-delay:${rank * 0.08}s">
            <div class="result-header">
                <div class="result-rank">${medals[rank]}</div>
                <div class="result-info">
                    <div class="result-hold-label">${holdLabel} ${badge}</div>
                    <div class="result-ev">期待値：<strong>${result.ev.toFixed(3)}</strong></div>
                </div>
            </div>
            <div class="result-cards">${cards}</div>
            ${reason}
            <div class="result-dist">
                <div class="dist-title">役の出現確率（全 ${result.totalCombos.toLocaleString()} 通り）</div>
                ${dist}
            </div>
        </div>`;
    }).join('');

    document.getElementById('resultsArea').style.display = 'block';
    document.getElementById('resultsArea').scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateCalcButton();
    renderRecordPanel();
}

// =============================================================
// § 12. タブ切り替え
// =============================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.toggle('active', b.dataset.tab === tabId); });
    document.querySelectorAll('.tab-panel').forEach(p => { p.classList.toggle('active', p.id === tabId); });
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'record' && state.calculationResults) renderRecordPanel();
}

// =============================================================
// § 13. 記録パネル
// =============================================================

function renderRecordPanel() {
    if (!state.calculationResults || state.hand.some(c => c === null)) return;
    const top = state.calculationResults[0];
    const content = document.getElementById('recordContent');
    const optText = describeHoldPattern(top.heldIndices);

    const cbs = state.hand.map((card, i) => {
        const opt = top.heldIndices.includes(i);
        const col = getSuitColorClass(card.suitId);
        return `<label class="hold-checkbox-label">
            <input type="checkbox" class="hold-checkbox" data-index="${i}" ${opt ? 'checked' : ''}>
            <span class="hold-card-mini ${col}">${getRankShort(card.rankId)}${getSuitSymbol(card.suitId)}</span>
        </label>`;
    }).join('');

    const opts = `<option value="" selected disabled>選択してください</option>` +
        HAND_ORDER.map(h => `<option value="${h}">${HAND_NAMES[h]}（${PAYOUTS[h] > 0 ? '+' + PAYOUTS[h] : 'ハズレ'}）</option>`).join('');

    // 記録用最終手札プリセット（ホールドカードは元の位置に固定）
    state.recordFinalHand = state.hand.map((card, i) =>
        top.heldIndices.includes(i) ? { ...card } : null
    );

    content.innerHTML = `
        <div class="record-section">
            <p class="record-hint">🏆 最適ホールド：<strong>${optText}</strong>&nbsp;（EV: <strong>${top.ev.toFixed(3)}</strong>）</p>
        </div>
        <div class="record-section">
            <label class="form-label">実際に選んだホールドパターン</label>
            <div class="hold-checkboxes">${cbs}</div>
        </div>
        <div class="record-section record-row-2col">
            <div>
                <label class="form-label" for="finalHand">最終的に完成した役</label>
                <select class="form-select" id="finalHand">${opts}</select>
                <p class="form-warning" id="finalHandWarning">⚠️ 完成した役を選択してください</p>
            </div>
            <div>
                <label class="form-label" for="betAmount">BET数</label>
                <select class="form-select" id="betAmount">
                    <option value="1" selected>1 BET</option>
                    <option value="2">2 BET</option>
                    <option value="3">3 BET</option>
                    <option value="4">4 BET</option>
                    <option value="5">5 BET</option>
                    <option value="10">10 BET</option>
                </select>
            </div>
        </div>
        <div class="record-section record-card-board-wrap">
            <div class="hand-title-row">
                <label class="form-label" style="margin-bottom:0">ホールド後の最終手札</label>
                <button class="btn-ghost btn-sm btn-scan" id="recordScanBtn" title="スクショから入力">📷</button>
            </div>
            <div class="record-hand-preview" id="recordHandPreview"></div>
        </div>
        <div class="record-actions">
            <button class="btn-primary" id="saveResultBtn">💾 結果を保存</button>
        </div>
    `;

    renderRecordFinalHand();
    document.getElementById('saveResultBtn').addEventListener('click', savePlayResult);
    document.getElementById('recordScanBtn').addEventListener('click', () => {
        scanState.target = 'record';
        document.getElementById('scanFileInput').click();
    });
    // バリデーション: 選択変更時に警告を消す
    document.getElementById('finalHand').addEventListener('change', () => {
        document.getElementById('finalHand').classList.remove('invalid');
        document.getElementById('finalHandWarning').classList.remove('show');
    });
}

function renderRecordFinalHand() {
    const container = document.getElementById('recordHandPreview');
    if (!container) return;
    container.innerHTML = state.recordFinalHand.map((card, i) => createCardHTML(card, i)).join('');

    // 空スロット → ピッカーで追加
    container.querySelectorAll('.pcard.empty').forEach(el => {
        el.addEventListener('click', () => openPicker(parseInt(el.dataset.index, 10), 'record'));
    });

    // 入力済み → タップで除去
    container.querySelectorAll('.pcard:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            state.recordFinalHand[idx] = null;
            renderRecordFinalHand();
        });
    });
}

function compactRecordHand() {
    const filled = state.recordFinalHand.filter(c => c !== null);
    state.recordFinalHand = [...filled, ...Array(5 - filled.length).fill(null)];
}

// =============================================================
// § 14. localStorage
// =============================================================

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
}

function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
    catch (e) { showToast('❌ 保存に失敗しました', 'error'); }
}

function savePlayResult() {
    if (!state.calculationResults) return;

    // バリデーション: 役が未選択
    const finalHandKey = document.getElementById('finalHand').value;
    if (!finalHandKey) {
        document.getElementById('finalHand').classList.add('invalid');
        document.getElementById('finalHandWarning').classList.add('show');
        showToast('⚠️ 完成した役を選択してください', 'warning');
        return;
    }

    const history = loadHistory();
    const top = state.calculationResults[0];
    const actualHeld = Array.from(document.querySelectorAll('.hold-checkbox:checked'))
        .map(cb => parseInt(cb.dataset.index, 10)).sort((a, b) => a - b);
    const optSorted = [...top.heldIndices].sort((a, b) => a - b);
    const followed = JSON.stringify(actualHeld) === JSON.stringify(optSorted);
    const finalCards = state.recordFinalHand.filter(c => c !== null).map(c => ({ suitId: c.suitId, rankId: c.rankId }));

    const bet = parseInt(document.getElementById('betAmount')?.value || '1', 10);

    history.push({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        initialHand: state.hand.map(c => ({ suitId: c.suitId, rankId: c.rankId })),
        optimalHold: { indices: top.heldIndices, ev: parseFloat(top.ev.toFixed(4)) },
        actualHold: { indices: actualHeld },
        finalHand: finalHandKey,
        finalHandName: HAND_NAMES[finalHandKey],
        finalCards,
        payout: PAYOUTS[finalHandKey],
        bet,
        followedOptimal: followed,
    });

    saveHistory(history);
    const btn = document.getElementById('saveResultBtn');
    btn.textContent = '✅ 保存しました！';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '💾 結果を保存'; btn.disabled = false; }, 2000);
    showToast('✅ プレイ結果を保存しました', 'success');
}

// =============================================================
// § 15. 統計ダッシュボード
// =============================================================

function renderDashboard() {
    const history = loadHistory();
    const container = document.getElementById('dashboardContent');

    if (history.length === 0) {
        container.innerHTML = `<p class="hint-text">📭 まだプレイ記録がありません。<br>「⚡ 計算」→「📝 記録」タブから保存してください。</p>`;
        return;
    }

    const total = history.length;
    const totalPay = history.reduce((s, r) => s + (r.payout ?? 0), 0);
    const followCnt = history.filter(r => r.followedOptimal).length;
    const followRate = ((followCnt / total) * 100).toFixed(1);

    const handCounts = {};
    for (const h of HAND_ORDER) handCounts[h] = 0;
    for (const r of history) if (r.finalHand && handCounts[r.finalHand] !== undefined) handCounts[r.finalHand]++;

    let cum = 0;
    const chartData = history.map(r => { cum += (r.payout ?? 0); return cum; });
    const maxHC = Math.max(1, ...Object.values(handCounts));
    const fc = (h) => PAYOUTS[h] >= 600 ? 'freq-gold' : PAYOUTS[h] >= 125 ? 'freq-green' : 'freq-blue';

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-icon">🎮</div><div class="stat-value">${total}</div><div class="stat-label">総プレイ数</div></div>
            <div class="stat-card ${totalPay >= 0 ? 'stat-positive' : 'stat-negative'}"><div class="stat-icon">${totalPay >= 0 ? '💰' : '📉'}</div><div class="stat-value">${totalPay >= 0 ? '+' : ''}${totalPay.toLocaleString()}</div><div class="stat-label">トータル収支</div></div>
            <div class="stat-card"><div class="stat-icon">🤖</div><div class="stat-value">${followRate}%</div><div class="stat-label">AI指示遵守率</div></div>
        </div>
        <div class="chart-section"><h3 class="chart-title">📈 累積収支の推移</h3><div class="chart-wrapper"><canvas id="payoutChart" height="160"></canvas></div></div>
        <div class="chart-section"><h3 class="chart-title">🃏 役の出現回数</h3><div class="hand-freq-list">
            ${HAND_ORDER.filter(h => h !== 'NOTHING').map(h => `<div class="freq-row"><span class="freq-hand-name">${HAND_NAMES[h]}</span><div class="freq-bar-bg"><div class="freq-bar-fill ${fc(h)}" style="width:${(handCounts[h] / maxHC * 100).toFixed(1)}%"></div></div><span class="freq-count">${handCounts[h]}回</span><span class="freq-payout">+${PAYOUTS[h]}</span></div>`).join('')}
        </div></div>
        <div class="chart-section">
            <h3 class="chart-title">📋 最近のプレイ履歴（タップで編集）</h3>
            <div class="history-list" id="historyList">
                ${history.slice(-15).reverse().map(r => {
                    const d = new Date(r.timestamp).toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                    const pC = r.payout > 0 ? 'payout-positive' : '';
                    const fI = r.followedOptimal ? '✅' : '❌';
                    return `<div class="history-row" data-id="${r.id}">
                        <span class="history-date">${d}</span>
                        <span class="history-hand">${r.finalHandName || '—'}</span>
                        <span class="history-bet">${r.bet || 1}B</span>
                        <span class="history-payout ${pC}">${r.payout > 0 ? '+' : ''}${r.payout}</span>
                        <span class="history-follow">${fI}</span>
                    </div>`;
                }).join('')}
            </div>
            <p class="history-tap-hint">💡 タップすると編集・削除できます</p>
        </div>
    `;

    // 履歴行のクリックイベント
    document.querySelectorAll('#historyList .history-row').forEach(row => {
        row.addEventListener('click', () => {
            const id = parseInt(row.dataset.id, 10);
            openEditModal(id);
        });
    });

    requestAnimationFrame(() => renderPayoutChart(chartData));
}

// =============================================================
// § 16. 履歴編集モーダル
// =============================================================

function openEditModal(recordId) {
    const history = loadHistory();
    const record = history.find(r => r.id === recordId);
    if (!record) return;

    state.editingRecordId = recordId;
    const content = document.getElementById('editContent');
    const dateStr = new Date(record.timestamp).toLocaleString('ja-JP');

    // 初期手札文字列
    const initialStr = (record.initialHand || []).map(c => `${getRankShort(c.rankId)}${getSuitSymbol(c.suitId)}`).join(' ');

    // 最終手札文字列
    const finalStr = (record.finalCards || []).map(c => `${getRankShort(c.rankId)}${getSuitSymbol(c.suitId)}`).join(' ');

    // 最適ホールド
    const optText = record.optimalHold ? describeHoldPattern(record.optimalHold.indices) : '—';

    // 役の選択肢
    const opts = HAND_ORDER.map(h =>
        `<option value="${h}" ${record.finalHand === h ? 'selected' : ''}>${HAND_NAMES[h]}（${PAYOUTS[h] > 0 ? '+' + PAYOUTS[h] : 'ハズレ'}）</option>`
    ).join('');

    content.innerHTML = `
        <div class="edit-field"><div class="edit-field-label">日時</div><div class="edit-field-value">${dateStr}</div></div>
        <div class="edit-field"><div class="edit-field-label">初期手札</div><div class="edit-field-value">${initialStr || '—'}</div></div>
        <div class="edit-field"><div class="edit-field-label">最適ホールド</div><div class="edit-field-value">${optText}（EV: ${record.optimalHold?.ev?.toFixed(3) ?? '—'}）</div></div>
        <div class="edit-field"><div class="edit-field-label">AI指示遵守</div><div class="edit-field-value">${record.followedOptimal ? '✅ はい' : '❌ いいえ'}</div></div>
        <div class="edit-field"><div class="edit-field-label">最終手札</div><div class="edit-field-value">${finalStr || '—'}</div></div>
        <div class="edit-field">
            <div class="edit-field-label">完成した役（変更可能）</div>
            <select class="form-select" id="editFinalHand">${opts}</select>
        </div>
        <div class="edit-actions">
            <button class="btn-danger" id="editDeleteBtn">🗑️ 削除</button>
            <button class="btn-primary" id="editSaveBtn">💾 保存</button>
        </div>
    `;

    document.getElementById('editOverlay').style.display = 'flex';

    document.getElementById('editSaveBtn').addEventListener('click', () => {
        const newHand = document.getElementById('editFinalHand').value;
        const hist = loadHistory();
        const idx = hist.findIndex(r => r.id === recordId);
        if (idx !== -1) {
            hist[idx].finalHand = newHand;
            hist[idx].finalHandName = HAND_NAMES[newHand];
            hist[idx].payout = PAYOUTS[newHand];
            saveHistory(hist);
            showToast('✅ 記録を更新しました', 'success');
        }
        closeEditModal();
        renderDashboard();
    });

    document.getElementById('editDeleteBtn').addEventListener('click', () => {
        if (!confirm('この記録を削除しますか？')) return;
        const hist = loadHistory();
        const filtered = hist.filter(r => r.id !== recordId);
        saveHistory(filtered);
        showToast('🗑️ 記録を削除しました', 'warning');
        closeEditModal();
        renderDashboard();
    });
}

function closeEditModal() {
    document.getElementById('editOverlay').style.display = 'none';
    state.editingRecordId = null;
}

// =============================================================
// § 17. Canvas グラフ
// =============================================================

function renderPayoutChart(data) {
    const canvas = document.getElementById('payoutChart');
    if (!canvas || data.length < 2) return;
    const W = canvas.offsetWidth || 600, H = 160;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pad = { top: 12, bottom: 30, left: 52, right: 12 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
    const mn = Math.min(0, ...data), mx = Math.max(0, ...data), rng = (mx - mn) || 1;
    const toY = v => pad.top + cH * (1 - (v - mn) / rng);
    const toX = i => pad.left + (i / Math.max(data.length - 1, 1)) * cW;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = pad.top + (cH / 4) * i; ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke(); }
    const zy = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, zy); ctx.lineTo(pad.left + cW, zy); ctx.stroke(); ctx.setLineDash([]);
    const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    grad.addColorStop(0, 'rgba(16,185,129,0.35)'); grad.addColorStop(1, 'rgba(16,185,129,0)');
    ctx.beginPath();
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
    ctx.lineTo(toX(data.length - 1), zy); ctx.lineTo(toX(0), zy); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    data.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)); });
    ctx.stroke();
    ctx.fillStyle = 'rgba(148,163,184,0.7)'; ctx.font = '11px Outfit, sans-serif'; ctx.textAlign = 'right';
    for (const v of [mx, 0, mn].filter((v, i, a) => a.indexOf(v) === i)) ctx.fillText(v >= 0 ? `+${Math.round(v)}` : Math.round(v), pad.left - 6, toY(v) + 4);
    ctx.textAlign = 'center';
    const steps = Math.min(5, data.length);
    for (let s = 0; s <= steps; s++) { const idx = Math.round((s / steps) * (data.length - 1)); ctx.fillText(`#${idx + 1}`, toX(idx), H - 4); }
}

// =============================================================
// § 18. データ管理
// =============================================================

function downloadHistory() {
    const h = loadHistory();
    if (!h.length) { showToast('⚠️ データがありません', 'warning'); return; }
    const blob = new Blob([JSON.stringify(h, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `poker-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('⬇️ ダウンロードしました', 'success');
}

function importHistory(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error();
            saveHistory(data); renderDashboard();
            showToast(`✅ ${data.length}件読み込みました`, 'success');
        } catch { showToast('❌ 読み込み失敗', 'error'); }
        document.getElementById('importFile').value = '';
    };
    reader.readAsText(file);
}

function clearHistory() {
    if (!confirm('⚠️ 全履歴を削除しますか？')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderDashboard();
    showToast('🗑️ 全履歴を削除しました', 'warning');
}

// =============================================================
// § 19. メイン計算
// =============================================================

async function runCalculation() {
    if (state.hand.some(c => c === null)) { showToast('⚠️ 5枚選択してください', 'warning'); return; }
    if (new Set(state.hand.map(c => cardKey(c))).size !== 5) { showToast('⚠️ カードが重複しています', 'warning'); return; }
    const overlay = document.getElementById('loadingOverlay');
    const pFill = document.getElementById('progressFill'), pText = document.getElementById('progressText');
    overlay.style.display = 'flex';
    document.getElementById('resultsArea').style.display = 'none';
    document.getElementById('calcBtn').disabled = true;
    try {
        state.calculationResults = await calculateAllEVs(state.hand, (p) => { const r = Math.round(p); pFill.style.width = r + '%'; pText.textContent = r + '%'; });
        renderResults(state.calculationResults);
        showToast('✅ 計算完了！', 'success');
    } catch (err) { console.error(err); showToast('❌ 計算エラー', 'error'); }
    finally { overlay.style.display = 'none'; document.getElementById('calcBtn').disabled = false; }
}

// =============================================================
// § 20. ランダム手札
// =============================================================

function generateRandomHand() {
    const deck = generateDeck();
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    state.hand = deck.slice(0, 5);
    state.calculationResults = null;
    renderHandPreview();
    updateCalcButton();
    document.getElementById('resultsArea').style.display = 'none';
    showToast('🎲 ランダム手札を生成しました', 'success');
}

// =============================================================
// § 21. トースト
// =============================================================

function showToast(message, type = 'info') {
    document.querySelectorAll('.toast').forEach(el => el.remove());
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3000);
}

// =============================================================
// § 22. スクショ参照＋クイック5枚入力
// =============================================================

const scanState = { cards: [null,null,null,null,null], activeSlot: 0, selectedRank: null, target: 'main' };

function openScanInput() {
    scanState.target = 'main';
    document.getElementById('scanFileInput').click();
}

function closeScanModal() {
    document.getElementById('scanOverlay').style.display = 'none';
    scanState.cards = [null,null,null,null,null];
    scanState.activeSlot = 0;
    scanState.selectedRank = null;
}

function handleScanFile(file) {
    if (!file) return;
    scanState.cards = [null,null,null,null,null];
    scanState.activeSlot = 0;
    scanState.selectedRank = null;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // カード部分だけ切り出し（カード5枚にフォーカス）
            const cropW = Math.round(img.width * 0.80);
            const cropH = Math.round(img.width * 0.35);
            const sx = Math.round((img.width - cropW) / 2);
            const sy = Math.round((img.height - cropH) / 2 + img.height * 0.06);
            const cv = document.createElement('canvas');
            cv.width = cropW; cv.height = cropH;
            const ctx = cv.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
            const croppedUrl = cv.toDataURL('image/jpeg', 0.85);

            document.getElementById('scanOverlay').style.display = 'flex';
            renderScanUI(croppedUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function renderScanUI(imgUrl) {
    const content = document.getElementById('scanContent');
    const cards = scanState.cards;
    const active = scanState.activeSlot;

    // スロット表示
    const slotsHTML = cards.map((c, i) => {
        const isFilled = c !== null;
        const isActive = i === active;
        const cls = `scan-slot ${isActive ? 'scan-slot-active' : ''} ${isFilled ? 'scan-slot-filled' : ''}`;
        if (isFilled) {
            const sym = getSuitSymbol(c.suitId);
            const rk = getRankShort(c.rankId);
            const col = getSuitColorClass(c.suitId);
            return `<div class="${cls}" data-slot="${i}">
                <span class="scan-slot-rank ${col}">${rk}</span>
                <span class="scan-slot-suit ${col}">${sym}</span>
            </div>`;
        }
        return `<div class="${cls}" data-slot="${i}">
            <span class="scan-slot-num">${i + 1}</span>
        </div>`;
    }).join('');

    // ランクボタン（先に数字を選ぶ）
    const ranksHTML = RANKS.map(r => {
        const sel = scanState.selectedRank === r.id ? 'scan-rbtn-active' : '';
        return `<button class="scan-rbtn ${sel}" data-rank="${r.id}">${r.short}</button>`;
    }).join('');

    // スートボタン（数字選択後に表示）
    let suitsHTML = '';
    if (scanState.selectedRank) {
        const usedKeys = new Set(cards.filter((c, i) => c !== null && i !== active).map(c => cardKey(c)));
        suitsHTML = SUITS.map(s => {
            const key = `${s.id}-${scanState.selectedRank}`;
            const isUsed = usedKeys.has(key);
            const col = s.color === 'red' ? 'scan-sbtn-red' : 'scan-sbtn-black';
            return `<button class="scan-sbtn ${col}" data-suit="${s.id}" ${isUsed ? 'disabled' : ''}>${s.symbol}</button>`;
        }).join('');
    }

    const filledCount = cards.filter(c => c !== null).length;
    const canApply = filledCount === 5;

    content.innerHTML = `
        <img src="${imgUrl}" class="scan-preview" id="scanImg">

        <p class="scan-instruction">🎯 スクショを見ながら5枚入力（カード <strong>${active + 1}</strong> / 5）</p>
        <div class="scan-slots">${slotsHTML}</div>
        <div class="scan-input-area">
            <div class="scan-rank-row">${ranksHTML}</div>
            ${scanState.selectedRank ? `<div class="scan-suit-row">${suitsHTML}</div>` : '<p class="scan-hint">↑ 数字を選んでください</p>'}
        </div>
        <div class="scan-actions">
            <button class="btn-ghost" id="scanCancelBtn">キャンセル</button>
            <button class="btn-primary ${canApply ? '' : 'disabled'}" id="scanApplyBtn" ${canApply ? '' : 'disabled'}>${canApply && scanState.target === 'main' ? '⚡ 期待値を計算' : `✅ 適用する（${filledCount}/5）`}</button>
        </div>
    `;

    // イベント：スロットタップ
    content.querySelectorAll('.scan-slot').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.slot, 10);
            if (cards[idx]) {
                scanState.cards[idx] = null;
                scanState.activeSlot = idx;
                scanState.selectedRank = null;
            } else {
                scanState.activeSlot = idx;
                scanState.selectedRank = null;
            }
            renderScanUI(document.getElementById('scanImg').src);
        });
    });

    // イベント：ランクタップ
    content.querySelectorAll('.scan-rbtn').forEach(btn => {
        btn.addEventListener('click', () => {
            scanState.selectedRank = parseInt(btn.dataset.rank, 10);
            renderScanUI(document.getElementById('scanImg').src);
        });
    });

    // イベント：スートタップ → 即登録 & 次のスロットへ
    content.querySelectorAll('.scan-sbtn:not(:disabled)').forEach(btn => {
        btn.addEventListener('click', () => {
            const suitId = btn.dataset.suit;
            scanState.cards[active] = { suitId, rankId: scanState.selectedRank };
            // 次の空きスロットに進む
            let next = -1;
            for (let i = 1; i <= 5; i++) {
                const ni = (active + i) % 5;
                if (!scanState.cards[ni]) { next = ni; break; }
            }
            scanState.activeSlot = next >= 0 ? next : active;
            scanState.selectedRank = null;
            renderScanUI(document.getElementById('scanImg').src);
        });
    });

    // キャンセル/適用
    document.getElementById('scanCancelBtn').addEventListener('click', closeScanModal);
    if (canApply) {
        const isMain = scanState.target === 'main';
        const applyBtn = document.getElementById('scanApplyBtn');
        applyBtn.addEventListener('click', () => {
            // 重複チェック
            const keys = scanState.cards.map(c => cardKey(c));
            if (new Set(keys).size !== 5) {
                showToast('⚠️ カードが重複しています', 'warning');
                return;
            }
            if (isMain) {
                // メイン手札に適用して即計算
                state.hand = scanState.cards.map(c => ({ ...c }));
                state.calculationResults = null;
                document.getElementById('resultsArea').style.display = 'none';
                renderHandPreview();
                updateCalcButton();
                closeScanModal();
                runCalculation();
            } else {
                // 記録用最終手札に適用
                state.recordFinalHand = scanState.cards.map(c => ({ ...c }));
                renderRecordFinalHand();
                closeScanModal();
                showToast('📷 最終手札を適用しました', 'success');
            }
        });
    }
}

// =============================================================
// § 23. 初期化
// =============================================================

function init() {
    renderHandPreview();
    updateCalcButton();
    renderDashboard();

    // タブ
    document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // 計算ボタン
    document.getElementById('calcBtn').addEventListener('click', runCalculation);

    // 記録ボタン
    document.getElementById('goRecordBtn').addEventListener('click', () => {
        if (state.calculationResults) switchTab('record');
    });

    // クリア
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        state.hand = [null, null, null, null, null];
        state.calculationResults = null;
        renderHandPreview();
        updateCalcButton();
        document.getElementById('resultsArea').style.display = 'none';
        showToast('🗑️ クリアしました', 'info');
    });

    // ランダム
    document.getElementById('randomBtn').addEventListener('click', generateRandomHand);

    // ピッカー
    document.getElementById('pickerClose').addEventListener('click', closePicker);
    document.getElementById('pickerClearBtn').addEventListener('click', clearPickerCard);
    document.getElementById('pickerOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('pickerOverlay')) closePicker();
    });

    // 編集モーダル
    document.getElementById('editClose').addEventListener('click', closeEditModal);
    document.getElementById('editOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('editOverlay')) closeEditModal();
    });

    // Escape キー
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closePicker(); closeEditModal(); closeScanModal(); }
    });

    // スキャン
    document.getElementById('scanBtn').addEventListener('click', openScanInput);
    document.getElementById('scanFileInput').addEventListener('change', (e) => {
        const f = e.target.files?.[0]; if (f) handleScanFile(f);
        e.target.value = '';
    });
    document.getElementById('scanClose').addEventListener('click', closeScanModal);
    document.getElementById('scanOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('scanOverlay')) closeScanModal();
    });

    // データ管理
    document.getElementById('downloadBtn').addEventListener('click', downloadHistory);
    document.getElementById('importFile').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) importHistory(f); });
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    console.log('[PokerJudgeTool] 初期化完了 | Made by hiro / ヒロ | https://github.com/h1ro223');
}

document.addEventListener('DOMContentLoaded', init);
