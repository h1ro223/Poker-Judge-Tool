/**
 * =============================================================
 * Poker Judge - script.js
 * Made by hiro / ヒロ  |  https://github.com/h1ro223
 *
 * 機能:
 *   - 52枚カードボードからタップ選択式の手札入力
 *   - 全32通りのホールドパターンの期待値（EV）をシミュレーション
 *   - 役判定（Jacks or Better準拠 / Basement Poker配当）
 *   - 戦略が最適である理由のAI分析テキスト生成
 *   - ホールド後の最終手札を含むプレイ記録をlocalStorageへ保存
 *   - 統計ダッシュボード表示（グラフ付き）
 *   - データのJSONエクスポート／インポート
 * =============================================================
 */

'use strict';

// =============================================================
// § 1. 定数定義
// =============================================================

/** スーツ定義 */
const SUITS = [
    { id: 'S', symbol: '♠', name: 'スペード', color: 'black' },
    { id: 'C', symbol: '♣', name: 'クラブ',   color: 'black' },
    { id: 'D', symbol: '♦', name: 'ダイヤ',   color: 'red'   },
    { id: 'H', symbol: '♥', name: 'ハート',   color: 'red'   },
];

/** ランク定義（A, 2, 3, 4 ... K 順） */
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

/** 配当表（Basement Poker準拠） */
const PAYOUTS = {
    ROYAL_FLUSH:     5000,
    STRAIGHT_FLUSH:  1500,
    FOUR_OF_A_KIND:   600,
    FULL_HOUSE:       300,
    FLUSH:            200,
    STRAIGHT:         125,
    THREE_OF_A_KIND:   75,
    TWO_PAIR:          40,
    JACKS_OR_BETTER:   10,
    NOTHING:            0,
};

/** 役名（日本語） */
const HAND_NAMES = {
    ROYAL_FLUSH:     'ロイヤルフラッシュ',
    STRAIGHT_FLUSH:  'ストレートフラッシュ',
    FOUR_OF_A_KIND:  'フォーオブアカインド',
    FULL_HOUSE:      'フルハウス',
    FLUSH:           'フラッシュ',
    STRAIGHT:        'ストレート',
    THREE_OF_A_KIND: 'スリーオブアカインド',
    TWO_PAIR:        'ツーペア',
    JACKS_OR_BETTER: 'ジャックスオアベター',
    NOTHING:         'ハズレ',
};

/** 役の強さ順（インデックス0が最強） */
const HAND_ORDER = [
    'ROYAL_FLUSH', 'STRAIGHT_FLUSH', 'FOUR_OF_A_KIND', 'FULL_HOUSE',
    'FLUSH', 'STRAIGHT', 'THREE_OF_A_KIND', 'TWO_PAIR', 'JACKS_OR_BETTER', 'NOTHING',
];

/** localStorageキー */
const STORAGE_KEY = 'pokerJudgeHistory_v2';

// =============================================================
// § 2. アプリ状態
// =============================================================

const state = {
    hand: [null, null, null, null, null],   // 手札（最大5枚）
    calculationResults: null,               // EV計算結果
    // 記録用：最終手札
    recordFinalHand: [null, null, null, null, null],
};

// =============================================================
// § 3. デッキユーティリティ
// =============================================================

/** 52枚フルデッキ */
function generateDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ suitId: suit.id, rankId: rank.id });
        }
    }
    return deck;
}

/** 手札を除いた残りデッキ */
function getRemainingDeck(hand) {
    return generateDeck().filter(
        c => !hand.some(h => h && h.suitId === c.suitId && h.rankId === c.rankId)
    );
}

/** カードキー文字列（一意識別用） */
function cardKey(card) { return `${card.suitId}-${card.rankId}`; }

// =============================================================
// § 4. 役判定アルゴリズム
// =============================================================

/**
 * 5枚の手札から役を判定する
 * @param {{ suitId: string, rankId: number }[]} hand
 * @returns {string} HAND_ORDER内のキー
 */
function evaluateHand(hand) {
    const ranks = hand.map(c => c.rankId).sort((a, b) => a - b);
    const suits = hand.map(c => c.suitId);

    // フラッシュ判定
    const isFlush = suits.every(s => s === suits[0]);

    // ストレート判定
    let isStraight = false;
    if (new Set(ranks).size === 5) {
        // 通常ストレート
        if (ranks[4] - ranks[0] === 4) isStraight = true;
        // ホイール（A-2-3-4-5）: [2,3,4,5,14]
        if (ranks[0] === 2 && ranks[1] === 3 && ranks[2] === 4 && ranks[3] === 5 && ranks[4] === 14) {
            isStraight = true;
        }
    }

    // ロイヤルフラッシュ: 10-J-Q-K-A 同スート
    if (isFlush && isStraight && ranks[0] === 10) return 'ROYAL_FLUSH';
    if (isFlush && isStraight) return 'STRAIGHT_FLUSH';

    // ランク頻度カウント
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
    const counts = Object.values(freq).sort((a, b) => b - a);

    if (counts[0] === 4) return 'FOUR_OF_A_KIND';
    if (counts[0] === 3 && counts[1] === 2) return 'FULL_HOUSE';
    if (isFlush) return 'FLUSH';
    if (isStraight) return 'STRAIGHT';
    if (counts[0] === 3) return 'THREE_OF_A_KIND';
    if (counts[0] === 2 && counts[1] === 2) return 'TWO_PAIR';

    // ジャックスオアベター
    if (counts[0] === 2) {
        const pairRank = parseInt(Object.keys(freq).find(r => freq[r] === 2), 10);
        if (pairRank >= 11) return 'JACKS_OR_BETTER';
    }

    return 'NOTHING';
}

// =============================================================
// § 5. 手札の特徴分析（AI理由生成のため）
// =============================================================

/**
 * 5枚の手札を分析し、特徴オブジェクトを返す
 * @param {{ suitId: string, rankId: number }[]} hand
 * @returns {Object} 分析結果
 */
function analyzeHand(hand) {
    if (!hand || hand.length === 0) return null;

    const ranks = hand.map(c => c.rankId);
    const suits = hand.map(c => c.suitId);

    // ランク頻度
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;

    // スート頻度
    const suitFreq = {};
    for (const s of suits) suitFreq[s] = (suitFreq[s] || 0) + 1;

    // ペア情報
    const pairs = Object.entries(freq).filter(([, c]) => c === 2).map(([r]) => parseInt(r));
    const trips = Object.entries(freq).filter(([, c]) => c === 3).map(([r]) => parseInt(r));
    const quads = Object.entries(freq).filter(([, c]) => c === 4).map(([r]) => parseInt(r));

    // フラッシュ距離（同スート最大枚数）
    const maxSameSuit = Math.max(...Object.values(suitFreq));
    const flushSuit   = Object.entries(suitFreq).find(([, c]) => c === maxSameSuit)?.[0];

    // ストレート距離の分析
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    let bestStraightGap = 99;

    // 5枚連続のウィンドウを全パターン試す
    // ランク全体: 2,3,4,5,6,7,8,9,10,11,12,13,14
    // ホイール用: 14(=1),2,3,4,5
    for (let low = 2; low <= 10; low++) {
        const window = [low, low+1, low+2, low+3, low+4];
        const missing = window.filter(r => !uniqueRanks.includes(r)).length;
        bestStraightGap = Math.min(bestStraightGap, missing);
    }
    // ホイール
    const wheelRanks = [14, 2, 3, 4, 5];
    const wheelMissing = wheelRanks.filter(r => !uniqueRanks.includes(r)).length;
    bestStraightGap = Math.min(bestStraightGap, wheelMissing);

    // ハイカード（J以上）の数
    const highCards = ranks.filter(r => r >= 11);

    return {
        freq, suitFreq, pairs, trips, quads,
        maxSameSuit, flushSuit,
        bestStraightGap, highCards,
        uniqueRanks,
    };
}

// =============================================================
// § 6. EV計算エンジン
// =============================================================

/**
 * 組み合わせイテレーター（メモリ効率重視の辞書順インクリメント）
 */
function iterateCombinations(arr, k, callback) {
    const n = arr.length;
    if (k === 0) { callback([]); return; }
    if (k > n) return;

    const indices = Array.from({ length: k }, (_, i) => i);
    while (true) {
        callback(indices.map(i => arr[i]));
        let pos = k - 1;
        while (pos >= 0 && indices[pos] === n - k + pos) pos--;
        if (pos < 0) break;
        indices[pos]++;
        for (let j = pos + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
    }
}

/**
 * 指定ホールドパターンのEVと役分布を計算
 */
function computeEVForPattern(heldCards, remainingDeck) {
    const drawCount = 5 - heldCards.length;
    const handDist = {};
    for (const h of HAND_ORDER) handDist[h] = 0;

    if (drawCount === 0) {
        const result = evaluateHand(heldCards);
        handDist[result] = 1;
        return { ev: PAYOUTS[result], handDist, totalCombos: 1 };
    }

    let totalPayout = 0;
    let totalCombos = 0;

    iterateCombinations(remainingDeck, drawCount, (drawn) => {
        const full = [...heldCards, ...drawn];
        const result = evaluateHand(full);
        totalPayout += PAYOUTS[result];
        handDist[result]++;
        totalCombos++;
    });

    return { ev: totalPayout / totalCombos, handDist, totalCombos };
}

/**
 * 全32通りのEVを計算（非同期分割）
 */
async function calculateAllEVs(hand, onProgress) {
    const remaining = getRemainingDeck(hand);
    const results = [];

    for (let mask = 0; mask < 32; mask++) {
        if (mask % 4 === 0) {
            await new Promise(r => setTimeout(r, 0));
            onProgress((mask / 32) * 100);
        }

        const heldIndices = [];
        for (let i = 0; i < 5; i++) {
            if ((mask >> i) & 1) heldIndices.push(i);
        }
        const heldCards = heldIndices.map(i => hand[i]);
        const { ev, handDist, totalCombos } = computeEVForPattern(heldCards, remaining);
        const confirmedWin = isConfirmedWin(heldCards);

        results.push({ mask, heldIndices, heldCards, ev, handDist, totalCombos, confirmedWin });
    }

    onProgress(100);
    results.sort((a, b) => {
        const diff = b.ev - a.ev;
        if (Math.abs(diff) > 1e-9) return diff;
        return (b.confirmedWin ? 1 : 0) - (a.confirmedWin ? 1 : 0);
    });

    return results;
}

/**
 * ホールドカードだけで配当役が確定しているか
 */
function isConfirmedWin(heldCards) {
    if (heldCards.length === 5) return PAYOUTS[evaluateHand(heldCards)] > 0;
    if (heldCards.length === 4) {
        const firstRank = heldCards[0].rankId;
        if (heldCards.every(c => c.rankId === firstRank)) return true;
    }
    return false;
}

// =============================================================
// § 7. 戦略理由AI生成エンジン
// =============================================================

/**
 * 上位の計算結果と手札情報から、なぜその戦略が最適かの理由テキストを生成する
 *
 * 判定ロジック:
 *   1. ホールドカードの特徴を分析（ペア・フラッシュドロー・ストレートドロー等）
 *   2. 期待値の差異を比較して「なぜ他の選択肢より良いか」を説明
 *   3. 確率的な観点からの補足（何通り中何通りが配当役か）
 *
 * @param {Object} topResult - 1位の結果
 * @param {Object[]} allResults - 全結果（上位数件あれば十分）
 * @param {{ suitId: string, rankId: number }[]} hand - 元の5枚手札
 * @returns {string} HTML形式の理由テキスト
 */
function generateStrategyReason(topResult, allResults, hand) {
    const heldIndices = topResult.heldIndices;
    const heldCards   = heldIndices.map(i => hand[i]);
    const heldCount   = heldCards.length;
    const ev          = topResult.ev;
    const dist        = topResult.handDist;
    const total       = topResult.totalCombos;

    // ---- ヘルパー関数 ----
    const rankName = (id) => RANKS.find(r => r.id === id)?.short ?? id;
    const suitName = (id) => SUITS.find(s => s.id === id)?.symbol ?? id;
    const cardStr  = (c) => `${rankName(c.rankId)}${suitName(c.suitId)}`;
    const pct      = (count) => (count / total * 100).toFixed(2);
    const hl       = (text, cls = 'green') => `<span class="hl-${cls}">${text}</span>`;

    // 配当がつく組み合わせ数
    const winCombos   = total - (dist.NOTHING || 0);
    const winRate     = (winCombos / total * 100).toFixed(1);

    // 最もよく出る配当役
    const topPayingHand = HAND_ORDER
        .filter(h => h !== 'NOTHING' && dist[h] > 0)
        .sort((a, b) => dist[b] - dist[a])[0];

    // 現在の手札の役
    const currentHand = evaluateHand(hand);
    const currentHandName = HAND_NAMES[currentHand];
    const currentPayout = PAYOUTS[currentHand];

    // ホールドカードの特徴分析
    const heldAnalysis = heldCards.length > 0 ? analyzeHand5orLess(heldCards) : null;

    // 2位との差分
    const secondResult = allResults.length > 1 ? allResults[1] : null;
    const evDiff = secondResult ? (ev - secondResult.ev).toFixed(3) : null;

    // ---- 理由文の構築 ----
    const lines = [];

    // ▼ 全キープの場合
    if (heldCount === 5) {
        if (currentPayout > 0) {
            lines.push(`現在の手札は既に<strong>${currentHandName}</strong>（配当 ${hl('+' + currentPayout, 'gold')}）が完成しています。`);
            lines.push(`この手札を崩して引き直すよりも、確定した配当を受け取るのが最善です。`);
            if (currentHand === 'ROYAL_FLUSH' || currentHand === 'STRAIGHT_FLUSH') {
                lines.push(`${hl('最高級の役')}を引き当てました！おめでとうございます 🎉`);
            }
        } else {
            lines.push(`全枚キープの期待値が最も高い珍しいケースです。どのカードを捨てても期待値が下がります。`);
        }
    }
    // ▼ 全交換の場合
    else if (heldCount === 0) {
        lines.push(`現在の手札にはペア・フラッシュドロー・ストレートドローなどの${hl('有力な手がかりがない', 'red')}ため、5枚すべてを引き直すのが最善策です。`);
        lines.push(`全交換の場合、${total.toLocaleString()}通り中 ${hl(winCombos.toLocaleString())}通り（${hl(winRate + '%')}）が配当役となります。`);
    }
    // ▼ 部分ホールドの場合
    else {
        const heldStr = heldCards.map(c => `<strong>${cardStr(c)}</strong>`).join('・');

        // ペア系の判定
        if (heldAnalysis) {
            if (heldAnalysis.hasQuads) {
                lines.push(`${heldStr} を残すことで、${hl('フォーオブアカインド（+600）', 'gold')}が確定します。何を引いても配当が確定する最強のホールドです。`);
            }
            else if (heldAnalysis.hasTrips) {
                const tripRank = rankName(heldAnalysis.tripRank);
                lines.push(`${heldStr} には ${hl(tripRank + 'のスリーカード')}が含まれています。`);
                if (dist.FOUR_OF_A_KIND > 0) {
                    lines.push(`追加ドローで${hl('フォーオブアカインド')}に昇格する可能性が ${hl(pct(dist.FOUR_OF_A_KIND) + '%')} あります。`);
                }
                if (dist.FULL_HOUSE > 0) {
                    lines.push(`${hl('フルハウス', 'gold')}になる確率も ${hl(pct(dist.FULL_HOUSE) + '%')} あり、高い配当が期待できます。`);
                }
            }
            else if (heldAnalysis.hasTwoPair) {
                lines.push(`${heldStr} は ${hl('ツーペア')}を形成しています。1枚の引き直しで${hl('フルハウス（+300）', 'gold')}に昇格する可能性があります。`);
            }
            else if (heldAnalysis.hasPair) {
                const pairRank = rankName(heldAnalysis.pairRank);
                const isHigh = heldAnalysis.pairRank >= 11;
                if (isHigh) {
                    lines.push(`${heldStr} には ${hl(pairRank + 'のハイペア（Jacks or Better）')}が含まれています。`);
                    lines.push(`この時点で${hl('最低10の配当が保証')}されつつ、${hl('ツーペア・スリーカード・フルハウス・フォーカインド', 'gold')}への昇格チャンスもあります。`);
                } else {
                    lines.push(`${heldStr} には ${hl(pairRank + 'のローペア')}が含まれています。`);
                    lines.push(`このペア自体は配当なし（Jacks or Better未満）ですが、${hl('スリーカード・フルハウス・フォーカインド')}への発展チャンスがあります。`);
                    if (dist.TWO_PAIR > 0) {
                        lines.push(`${hl('ツーペア')}になる確率は ${hl(pct(dist.TWO_PAIR) + '%')} です。`);
                    }
                }
            }
            // フラッシュドロー
            else if (heldAnalysis.flushDraw) {
                const suitSym = suitName(heldAnalysis.flushDrawSuit);
                lines.push(`${heldStr} は ${hl(suitSym + 'の' + heldCount + '枚フラッシュドロー')}です。`);
                if (dist.FLUSH > 0) {
                    lines.push(`あと${5 - heldCount}枚を引き直すことで${hl('フラッシュ（+200）', 'gold')}になる確率は ${hl(pct(dist.FLUSH) + '%')} です。`);
                }
                if (dist.STRAIGHT_FLUSH > 0) {
                    lines.push(`さらに${hl('ストレートフラッシュ（+1500）', 'gold')}の可能性も ${hl(pct(dist.STRAIGHT_FLUSH) + '%')} あります！`);
                }
            }
            // ストレートドロー
            else if (heldAnalysis.straightDraw) {
                lines.push(`${heldStr} は ${hl('ストレートドロー')}（あと1〜2枚で完成）の形です。`);
                if (dist.STRAIGHT > 0) {
                    lines.push(`${hl('ストレート（+125）', 'gold')}になる確率は ${hl(pct(dist.STRAIGHT) + '%')} です。`);
                }
            }
            // ハイカードのみ
            else if (heldAnalysis.highCardCount > 0) {
                lines.push(`${heldStr} には ${hl(heldAnalysis.highCardCount + '枚のハイカード（J以上）')}が含まれています。`);
                lines.push(`これらを残すことで、${hl('Jacks or Better')}のペアができる確率を最大化しています。`);
            }
            // その他
            else {
                lines.push(`${heldStr} をキープすることで期待値が最大化されます。`);
            }
        }
    }

    // ▼ 共通の期待値比較コメント
    if (heldCount > 0 && heldCount < 5) {
        if (topPayingHand && topPayingHand !== 'NOTHING') {
            lines.push(`最も出現しやすい配当役は${hl(HAND_NAMES[topPayingHand], 'gold')}で、確率 ${hl(pct(dist[topPayingHand]) + '%')} です。`);
        }

        // 配当発生率
        lines.push(`全 ${total.toLocaleString()} 通りのうち ${hl(winCombos.toLocaleString())}通り（${hl(winRate + '%')}）で配当が発生します。`);
    }

    // ▼ 2位との比較
    if (secondResult && evDiff && parseFloat(evDiff) > 0) {
        const second2ndLabel = describeHoldPattern(secondResult.heldIndices);
        lines.push(`<br>2位の「${second2ndLabel}」と比較して、期待値が ${hl('+' + evDiff)} 高く、この戦略が最適です。`);
    }

    return lines.join('<br>');
}

/**
 * ホールドカード（5枚以下）の簡易特徴分析
 */
function analyzeHand5orLess(cards) {
    if (!cards || cards.length === 0) return {};

    const ranks = cards.map(c => c.rankId);
    const suits = cards.map(c => c.suitId);
    const freq = {};
    for (const r of ranks) freq[r] = (freq[r] || 0) + 1;
    const suitFreq = {};
    for (const s of suits) suitFreq[s] = (suitFreq[s] || 0) + 1;

    const result = {};

    // ペア系
    const pairRanks = Object.entries(freq).filter(([, c]) => c >= 2).map(([r]) => parseInt(r));
    const tripRanks = Object.entries(freq).filter(([, c]) => c >= 3).map(([r]) => parseInt(r));
    const quadRanks = Object.entries(freq).filter(([, c]) => c >= 4).map(([r]) => parseInt(r));

    result.hasQuads   = quadRanks.length > 0;
    result.hasTrips   = tripRanks.length > 0;
    result.hasPair    = pairRanks.length >= 1;
    result.hasTwoPair = pairRanks.length >= 2;
    result.pairRank   = pairRanks[0] ?? null;
    result.tripRank   = tripRanks[0] ?? null;

    // フラッシュドロー（同スート4枚以上、or ホールドカード全部が同スート）
    const maxSS = Math.max(...Object.values(suitFreq));
    result.flushDraw     = cards.length >= 4 && maxSS >= 4 && maxSS === cards.length;
    if (!result.flushDraw && cards.length >= 3 && maxSS === cards.length) {
        result.flushDraw = true; // 3枚以上全部同スートの場合もフラッシュドロー寄り
    }
    result.flushDrawSuit = Object.entries(suitFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

    // ストレートドロー（ユニーク4枚以上で連続に近い）
    const uniq = [...new Set(ranks)].sort((a, b) => a - b);
    result.straightDraw = false;
    if (uniq.length >= 3 && !result.hasPair) {
        for (let low = 2; low <= 10; low++) {
            const window = [low, low+1, low+2, low+3, low+4];
            const overlap = uniq.filter(r => window.includes(r)).length;
            if (overlap >= uniq.length && overlap >= 3) {
                result.straightDraw = true;
                break;
            }
        }
        // ホイールチェック
        const wheelCheck = [14, 2, 3, 4, 5];
        const wOverlap = uniq.filter(r => wheelCheck.includes(r)).length;
        if (wOverlap >= uniq.length && wOverlap >= 3) result.straightDraw = true;
    }

    // ハイカード数
    result.highCardCount = ranks.filter(r => r >= 11).length;

    return result;
}

/**
 * ホールドパターンの説明文を生成
 */
function describeHoldPattern(indices) {
    if (indices.length === 5) return '全枚キープ';
    if (indices.length === 0) return '全枚交換';
    return `${indices.length}枚キープ（${indices.map(i => i + 1).join('・')}枚目）`;
}

// =============================================================
// § 8. UI レンダリング ヘルパー
// =============================================================

const getSuitSymbol     = (id) => SUITS.find(s => s.id === id)?.symbol ?? '';
const getSuitColorClass = (id) => (SUITS.find(s => s.id === id)?.color === 'red') ? 'suit-red' : 'suit-black';
const getRankShort      = (id) => RANKS.find(r => r.id === id)?.short ?? '';

/**
 * トランプカードHTML生成
 */
function createCardHTML(card, index, { isHeld = false, isDimmed = false } = {}) {
    if (!card) {
        return `<div class="pcard empty" data-index="${index}">
            <span class="card-empty-num">${index + 1}</span>
            <span class="card-empty-hint">空き</span>
        </div>`;
    }

    const symbol     = getSuitSymbol(card.suitId);
    const colorClass = getSuitColorClass(card.suitId);
    const rankShort  = getRankShort(card.rankId);
    const heldClass  = isHeld   ? 'held'   : '';
    const dimClass   = isDimmed ? 'dimmed' : '';
    const holdBadge  = isHeld   ? '<div class="held-badge">HOLD</div>' : '';

    return `<div class="pcard ${colorClass} ${heldClass} ${dimClass}" data-index="${index}">
        <div class="card-corner top-left">
            <span class="card-rank">${rankShort}</span>
            <span class="card-suit-small">${symbol}</span>
        </div>
        <div class="card-center-suit">${symbol}</div>
        <div class="card-corner bottom-right">
            <span class="card-rank">${rankShort}</span>
            <span class="card-suit-small">${symbol}</span>
        </div>
        ${holdBadge}
    </div>`;
}

// =============================================================
// § 9. 52枚カードボード
// =============================================================

/**
 * 52枚カードボードを描画する
 * スート行ごとに「♠ A 2 3 4 5 6 7 8 9 10 J Q K」のグリッド
 */
function renderCardBoard() {
    const board = document.getElementById('cardBoard');

    // 選択中カードのキーセット
    const selectedKeys = new Set(
        state.hand.filter(c => c !== null).map(c => cardKey(c))
    );

    let html = '';

    for (const suit of SUITS) {
        // スート行ヘッダー
        const colorClass = suit.color === 'red' ? 'bsh-red' : '';
        html += `<div class="board-suit-header ${colorClass}">
            <span class="bsh-icon">${suit.symbol}</span>
            ${suit.name}
        </div>`;

        // 13枚のカード
        for (const rank of RANKS) {
            const key      = `${suit.id}-${rank.id}`;
            const isSelected = selectedKeys.has(key);
            const redClass  = suit.color === 'red' ? 'bc-red' : '';
            const selClass  = isSelected ? 'board-selected' : '';

            html += `<div class="board-card ${redClass} ${selClass}"
                          data-suit="${suit.id}" data-rank="${rank.id}" data-key="${key}">
                <span class="bc-rank">${rank.short}</span>
                <span class="bc-suit">${suit.symbol}</span>
            </div>`;
        }
    }

    board.innerHTML = html;

    // クリックイベントバインド
    board.querySelectorAll('.board-card').forEach(el => {
        el.addEventListener('click', () => {
            const suitId = el.dataset.suit;
            const rankId = parseInt(el.dataset.rank, 10);
            const key    = el.dataset.key;

            if (el.classList.contains('board-selected')) {
                // 選択解除: 手札から除去
                const idx = state.hand.findIndex(c => c && cardKey(c) === key);
                if (idx !== -1) state.hand[idx] = null;
                // 左詰めに整理
                compactHand();
                el.classList.remove('board-selected');
            } else {
                // 選択追加
                const emptyIdx = state.hand.indexOf(null);
                if (emptyIdx === -1) {
                    showToast('⚠️ 5枚すでに選択済みです', 'warning');
                    return;
                }
                state.hand[emptyIdx] = { suitId, rankId };
                el.classList.add('board-selected');
            }

            // 手札が変わったので結果をリセット
            state.calculationResults = null;
            document.getElementById('resultsArea').style.display = 'none';

            renderHandPreview();
            updateCalcButton();
        });
    });
}

/**
 * 手札を左詰めに整理（null を右に押し出す）
 */
function compactHand() {
    const filled = state.hand.filter(c => c !== null);
    state.hand = [...filled, ...Array(5 - filled.length).fill(null)];
}

/**
 * 手札プレビュー（上部5スロット）を再描画
 */
function renderHandPreview() {
    const container = document.getElementById('handPreview');
    container.innerHTML = state.hand.map((card, i) => createCardHTML(card, i)).join('');

    // カードクリックで除去
    container.querySelectorAll('.pcard:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            const card = state.hand[idx];
            if (card) {
                state.hand[idx] = null;
                compactHand();
                state.calculationResults = null;
                document.getElementById('resultsArea').style.display = 'none';
                renderHandPreview();
                renderCardBoard();
                updateCalcButton();
            }
        });
    });

    // カウンター更新
    const count = state.hand.filter(c => c !== null).length;
    const counter = document.getElementById('handCounter');
    counter.textContent = `${count} / 5`;
    counter.classList.toggle('complete', count === 5);
}

/**
 * 計算ボタンの有効/無効を切り替え
 */
function updateCalcButton() {
    const btn   = document.getElementById('calcBtn');
    const count = state.hand.filter(c => c !== null).length;
    btn.disabled = count !== 5;

    // 記録ボタンの状態も更新
    const recBtn = document.getElementById('goRecordBtn');
    if (recBtn) {
        const hasResults = !!state.calculationResults;
        recBtn.disabled = !hasResults;
        recBtn.classList.toggle('ready', hasResults);
    }
}

// =============================================================
// § 10. 計算結果のレンダリング
// =============================================================

function renderResults(results) {
    const container = document.getElementById('resultsList');
    const top5      = results.slice(0, 5);
    const medals    = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

    container.innerHTML = top5.map((result, rank) => {
        const isTop = rank === 0;
        const holdLabel = describeHoldPattern(result.heldIndices);

        // 確定勝利バッジ
        const confirmedBadge = result.confirmedWin
            ? '<span class="badge badge-confirmed">✅ 確定勝利</span>'
            : '';

        // カード表示
        const cardsHTML = state.hand.map((card, i) => {
            const isHeld   = result.heldIndices.includes(i);
            const isDimmed = !isHeld;
            return createCardHTML(card, i, { isHeld, isDimmed });
        }).join('');

        // 戦略理由（1位のみ詳細表示、2位以降は簡略）
        let reasonHTML = '';
        if (rank === 0) {
            const reasonText = generateStrategyReason(result, results, state.hand);
            reasonHTML = `<div class="strategy-reason">
                <div class="strategy-reason-title">🧠 AI分析 ─ この戦略が最適な理由</div>
                <div class="strategy-reason-text">${reasonText}</div>
            </div>`;
        }

        // 役分布
        const distHTML = HAND_ORDER
            .filter(h => result.handDist[h] > 0)
            .map(h => {
                const count  = result.handDist[h];
                const prob   = (count / result.totalCombos * 100).toFixed(2);
                const payout = PAYOUTS[h];
                const payoutClass = payout > 0 ? 'payout-positive' : '';
                const payoutText  = payout > 0 ? `+${payout}` : '—';
                const barWidth    = Math.min(parseFloat(prob), 100);
                return `<div class="hand-dist-row">
                    <span class="hand-name">${HAND_NAMES[h]}</span>
                    <span class="hand-payout ${payoutClass}">${payoutText}</span>
                    <div class="hand-prob-bar">
                        <div class="hand-prob-fill" style="width:${barWidth}%"></div>
                    </div>
                    <span class="hand-prob-text">${prob}%</span>
                </div>`;
            }).join('');

        return `<div class="result-card ${isTop ? 'result-card-top' : ''}" style="animation-delay:${rank * 0.08}s">
            <div class="result-header">
                <div class="result-rank">${medals[rank]}</div>
                <div class="result-info">
                    <div class="result-hold-label">${holdLabel} ${confirmedBadge}</div>
                    <div class="result-ev">期待値：<strong>${result.ev.toFixed(3)}</strong></div>
                </div>
            </div>
            <div class="result-cards">${cardsHTML}</div>
            ${reasonHTML}
            <div class="result-dist">
                <div class="dist-title">役の出現確率（全 ${result.totalCombos.toLocaleString()} 通り）</div>
                ${distHTML}
            </div>
        </div>`;
    }).join('');

    document.getElementById('resultsArea').style.display = 'block';

    // スクロール
    document.getElementById('resultsArea').scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 記録ボタンを有効化
    updateCalcButton();

    // 記録パネル更新
    renderRecordPanel();
}

// =============================================================
// § 11. タブ切り替え
// =============================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.dataset.tab === tabId;
        btn.classList.toggle('active', isActive);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });
    if (tabId === 'dashboard') renderDashboard();
    if (tabId === 'record' && state.calculationResults) renderRecordPanel();
}

// =============================================================
// § 12. 記録パネル（最終手札入力つき）
// =============================================================

/**
 * 記録パネルを構築
 * 改善点: 最終手札5枚もカードボード式で入力可能
 */
function renderRecordPanel() {
    if (!state.calculationResults || state.hand.some(c => c === null)) return;

    const top     = state.calculationResults[0];
    const content = document.getElementById('recordContent');

    const optEVText = describeHoldPattern(top.heldIndices);

    // ホールドチェックボックス
    const checkboxesHTML = state.hand.map((card, i) => {
        const isOptimalHold = top.heldIndices.includes(i);
        const colorClass = getSuitColorClass(card.suitId);
        return `<label class="hold-checkbox-label">
            <input type="checkbox" class="hold-checkbox" data-index="${i}"
                   id="hold-cb-${i}" ${isOptimalHold ? 'checked' : ''}>
            <span class="hold-card-mini ${colorClass}">
                ${getRankShort(card.rankId)}${getSuitSymbol(card.suitId)}
            </span>
        </label>`;
    }).join('');

    // 最終役プルダウン
    const finalHandOptions = HAND_ORDER.map(h =>
        `<option value="${h}">${HAND_NAMES[h]}（${PAYOUTS[h] > 0 ? '+' + PAYOUTS[h] : 'ハズレ'}）</option>`
    ).join('');

    // 最終手札プレビュー（初期状態ではホールドカードをプリセット）
    const heldCards = top.heldIndices.map(i => state.hand[i]);
    state.recordFinalHand = [
        ...heldCards,
        ...Array(5 - heldCards.length).fill(null),
    ];

    content.innerHTML = `
        <div class="record-section">
            <p class="record-hint">
                🏆 最適ホールド：<strong>${optEVText}</strong>
                &nbsp;（EV: <strong>${top.ev.toFixed(3)}</strong>）
            </p>
        </div>

        <div class="record-section">
            <label class="form-label">実際に選んだホールドパターン（キープするカードにチェック）</label>
            <div class="hold-checkboxes" id="holdCheckboxes">${checkboxesHTML}</div>
        </div>

        <div class="record-section">
            <label class="form-label">最終的に完成した役</label>
            <select class="form-select" id="finalHand">${finalHandOptions}</select>
        </div>

        <div class="record-section record-card-board-wrap">
            <h3 class="section-title">
                <span class="section-icon">🃏</span>
                ホールド後の最終手札（5枚）
            </h3>
            <div class="record-hand-preview" id="recordHandPreview"></div>
            <div class="record-card-board" id="recordCardBoard"></div>
        </div>

        <div class="record-actions">
            <button class="btn-primary" id="saveResultBtn">💾 結果を保存</button>
        </div>
    `;

    renderRecordFinalHand();
    renderRecordCardBoard();
    document.getElementById('saveResultBtn').addEventListener('click', savePlayResult);
}

/**
 * 記録用：最終手札プレビュー描画
 */
function renderRecordFinalHand() {
    const container = document.getElementById('recordHandPreview');
    if (!container) return;

    container.innerHTML = state.recordFinalHand.map((card, i) => createCardHTML(card, i)).join('');

    // クリックで除去（初期手札のホールドカードも除去可能）
    container.querySelectorAll('.pcard:not(.empty)').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.index, 10);
            state.recordFinalHand[idx] = null;
            compactRecordHand();
            renderRecordFinalHand();
            renderRecordCardBoard();
        });
    });
}

function compactRecordHand() {
    const filled = state.recordFinalHand.filter(c => c !== null);
    state.recordFinalHand = [...filled, ...Array(5 - filled.length).fill(null)];
}

/**
 * 記録用カードボード描画
 */
function renderRecordCardBoard() {
    const board = document.getElementById('recordCardBoard');
    if (!board) return;

    const selectedKeys = new Set(
        state.recordFinalHand.filter(c => c !== null).map(c => cardKey(c))
    );

    let html = '';
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            const key = `${suit.id}-${rank.id}`;
            const isSelected = selectedKeys.has(key);
            const redClass = suit.color === 'red' ? 'bc-red' : '';
            const selClass = isSelected ? 'board-selected' : '';

            html += `<div class="board-card ${redClass} ${selClass}"
                          data-suit="${suit.id}" data-rank="${rank.id}" data-key="${key}">
                <span class="bc-rank">${rank.short}</span>
                <span class="bc-suit">${suit.symbol}</span>
            </div>`;
        }
    }

    board.innerHTML = html;

    board.querySelectorAll('.board-card').forEach(el => {
        el.addEventListener('click', () => {
            const suitId = el.dataset.suit;
            const rankId = parseInt(el.dataset.rank, 10);
            const key = el.dataset.key;

            if (el.classList.contains('board-selected')) {
                const idx = state.recordFinalHand.findIndex(c => c && cardKey(c) === key);
                if (idx !== -1) state.recordFinalHand[idx] = null;
                compactRecordHand();
            } else {
                const emptyIdx = state.recordFinalHand.indexOf(null);
                if (emptyIdx === -1) {
                    showToast('⚠️ 5枚すでに選択済みです', 'warning');
                    return;
                }
                state.recordFinalHand[emptyIdx] = { suitId, rankId };
            }

            renderRecordFinalHand();
            renderRecordCardBoard();
        });
    });
}

// =============================================================
// § 13. localStorage操作
// =============================================================

function loadHistory() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { console.error('[PokerJudge] localStorage読み込みエラー:', e); return []; }
}

function saveHistory(history) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); }
    catch (e) {
        console.error('[PokerJudge] localStorage書き込みエラー:', e);
        showToast('❌ 保存に失敗しました', 'error');
    }
}

/**
 * プレイ結果を保存
 * 改善: 最終手札5枚も記録に含める
 */
function savePlayResult() {
    if (!state.calculationResults) return;

    const history = loadHistory();
    const top = state.calculationResults[0];

    // ホールドチェックボックスから実際のホールドインデックスを取得
    const actualHeldIndices = Array.from(
        document.querySelectorAll('.hold-checkbox:checked')
    ).map(cb => parseInt(cb.dataset.index, 10)).sort((a, b) => a - b);

    const finalHandKey = document.getElementById('finalHand').value;
    const payout = PAYOUTS[finalHandKey];

    // 最適アクションと一致？
    const optSorted = [...top.heldIndices].sort((a, b) => a - b);
    const followed = JSON.stringify(actualHeldIndices) === JSON.stringify(optSorted);

    // 最終手札データ
    const finalCards = state.recordFinalHand
        .filter(c => c !== null)
        .map(c => ({ suitId: c.suitId, rankId: c.rankId }));

    const record = {
        id:              Date.now(),
        timestamp:       new Date().toISOString(),
        initialHand:     state.hand.map(c => ({ suitId: c.suitId, rankId: c.rankId })),
        optimalHold:     { indices: top.heldIndices, ev: parseFloat(top.ev.toFixed(4)) },
        actualHold:      { indices: actualHeldIndices },
        finalHand:       finalHandKey,
        finalHandName:   HAND_NAMES[finalHandKey],
        finalCards:      finalCards,   // ← 新規: 最終手札5枚
        payout,
        followedOptimal: followed,
    };

    history.push(record);
    saveHistory(history);

    const btn = document.getElementById('saveResultBtn');
    btn.textContent = '✅ 保存しました！';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = '💾 結果を保存'; btn.disabled = false; }, 2000);

    showToast('✅ プレイ結果を保存しました', 'success');
}

// =============================================================
// § 14. 統計ダッシュボード
// =============================================================

function renderDashboard() {
    const history = loadHistory();
    const container = document.getElementById('dashboardContent');

    if (history.length === 0) {
        container.innerHTML = `<p class="hint-text">📭 まだプレイ記録がありません。<br>「⚡ 計算」→「📝 記録」タブから保存してください。</p>`;
        return;
    }

    const totalSessions = history.length;
    const totalPayout = history.reduce((sum, r) => sum + (r.payout ?? 0), 0);
    const followCount = history.filter(r => r.followedOptimal).length;
    const followRate = ((followCount / totalSessions) * 100).toFixed(1);

    const handCounts = {};
    for (const h of HAND_ORDER) handCounts[h] = 0;
    for (const r of history) {
        if (r.finalHand && handCounts[r.finalHand] !== undefined) handCounts[r.finalHand]++;
    }

    let cumulative = 0;
    const chartData = history.map(r => { cumulative += (r.payout ?? 0); return cumulative; });
    const maxHandCount = Math.max(1, ...Object.values(handCounts));

    const freqColorClass = (h) => {
        if (PAYOUTS[h] >= 600) return 'freq-gold';
        if (PAYOUTS[h] >= 125) return 'freq-green';
        return 'freq-blue';
    };

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon">🎮</div>
                <div class="stat-value">${totalSessions.toLocaleString()}</div>
                <div class="stat-label">総プレイ数</div>
            </div>
            <div class="stat-card ${totalPayout >= 0 ? 'stat-positive' : 'stat-negative'}">
                <div class="stat-icon">${totalPayout >= 0 ? '💰' : '📉'}</div>
                <div class="stat-value">${totalPayout >= 0 ? '+' : ''}${totalPayout.toLocaleString()}</div>
                <div class="stat-label">トータル収支</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🤖</div>
                <div class="stat-value">${followRate}%</div>
                <div class="stat-label">AI指示遵守率</div>
            </div>
        </div>

        <div class="chart-section">
            <h3 class="chart-title">📈 累積収支の推移</h3>
            <div class="chart-wrapper">
                <canvas id="payoutChart" height="180"></canvas>
            </div>
        </div>

        <div class="chart-section">
            <h3 class="chart-title">🃏 役の出現回数</h3>
            <div class="hand-freq-list">
                ${HAND_ORDER.filter(h => h !== 'NOTHING').map(h => {
                    const count = handCounts[h];
                    const barPct = (count / maxHandCount * 100).toFixed(1);
                    return `<div class="freq-row">
                        <span class="freq-hand-name">${HAND_NAMES[h]}</span>
                        <div class="freq-bar-bg">
                            <div class="freq-bar-fill ${freqColorClass(h)}" style="width:${barPct}%"></div>
                        </div>
                        <span class="freq-count">${count}回</span>
                        <span class="freq-payout">+${PAYOUTS[h]}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>

        <div class="chart-section">
            <h3 class="chart-title">📋 最近のプレイ履歴（直近10件）</h3>
            <div class="history-list">
                ${history.slice(-10).reverse().map(r => {
                    const dateStr = new Date(r.timestamp).toLocaleString('ja-JP', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
                    const payoutCls = r.payout > 0 ? 'payout-positive' : '';
                    const followIcon = r.followedOptimal ? '✅' : '❌';
                    return `<div class="history-row">
                        <span class="history-date">${dateStr}</span>
                        <span class="history-hand">${r.finalHandName || '—'}</span>
                        <span class="history-payout ${payoutCls}">${r.payout > 0 ? '+' : ''}${r.payout}</span>
                        <span class="history-follow" title="${r.followedOptimal ? 'AI指示通り' : 'AI指示と異なる'}">${followIcon}</span>
                    </div>`;
                }).join('')}
            </div>
        </div>
    `;

    requestAnimationFrame(() => renderPayoutChart(chartData));
}

/**
 * Canvas折れ線グラフ描画
 */
function renderPayoutChart(data) {
    const canvas = document.getElementById('payoutChart');
    if (!canvas || data.length < 2) return;

    const W = canvas.offsetWidth || 600;
    const H = 180;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    const pad = { top: 14, bottom: 34, left: 58, right: 14 };
    const cW = W - pad.left - pad.right;
    const cH = H - pad.top - pad.bottom;

    const minVal = Math.min(0, ...data);
    const maxVal = Math.max(0, ...data);
    const range = (maxVal - minVal) || 1;
    const toY = (val) => pad.top + cH * (1 - (val - minVal) / range);
    const toX = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * cW;

    ctx.clearRect(0, 0, W, H);

    // 背景グリッド
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = pad.top + (cH / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    }

    // ゼロライン
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(pad.left, zeroY); ctx.lineTo(pad.left + cW, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // グラデーション塗り
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + cH);
    gradient.addColorStop(0, 'rgba(16,185,129,0.35)');
    gradient.addColorStop(1, 'rgba(16,185,129,0.00)');

    ctx.beginPath();
    data.forEach((val, i) => { i === 0 ? ctx.moveTo(toX(i), toY(val)) : ctx.lineTo(toX(i), toY(val)); });
    ctx.lineTo(toX(data.length - 1), zeroY);
    ctx.lineTo(toX(0), zeroY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 折れ線
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    data.forEach((val, i) => { i === 0 ? ctx.moveTo(toX(i), toY(val)) : ctx.lineTo(toX(i), toY(val)); });
    ctx.stroke();

    // Y軸ラベル
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font = '12px Outfit, sans-serif';
    ctx.textAlign = 'right';
    for (const val of [maxVal, 0, minVal].filter((v, i, a) => a.indexOf(v) === i)) {
        ctx.fillText(val >= 0 ? `+${Math.round(val)}` : Math.round(val), pad.left - 8, toY(val) + 4);
    }

    // X軸ラベル
    ctx.textAlign = 'center';
    const steps = Math.min(5, data.length);
    for (let s = 0; s <= steps; s++) {
        const idx = Math.round((s / steps) * (data.length - 1));
        ctx.fillText(`#${idx + 1}`, toX(idx), H - 6);
    }
}

// =============================================================
// § 15. データ管理
// =============================================================

function downloadHistory() {
    const history = loadHistory();
    if (history.length === 0) { showToast('⚠️ 保存済みデータがありません', 'warning'); return; }
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poker-history-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('⬇️ JSONをダウンロードしました', 'success');
}

function importHistory(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!Array.isArray(data)) throw new Error('配列形式でない');
            saveHistory(data);
            renderDashboard();
            showToast(`✅ ${data.length}件のデータを読み込みました`, 'success');
        } catch (err) {
            showToast('❌ ファイルの読み込みに失敗しました', 'error');
        }
        document.getElementById('importFile').value = '';
    };
    reader.readAsText(file);
}

function clearHistory() {
    if (!confirm('⚠️ 全履歴を削除しますか？\nこの操作は元に戻せません。')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderDashboard();
    showToast('🗑️ 全履歴を削除しました', 'warning');
}

// =============================================================
// § 16. メイン計算フロー
// =============================================================

async function runCalculation() {
    if (state.hand.some(c => c === null)) {
        showToast('⚠️ 5枚すべてのカードを選択してください', 'warning');
        return;
    }

    // 重複チェック
    const keys = state.hand.map(c => cardKey(c));
    if (new Set(keys).size !== 5) {
        showToast('⚠️ 同じカードが重複しています', 'warning');
        return;
    }

    const overlay = document.getElementById('loadingOverlay');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const calcBtn = document.getElementById('calcBtn');

    overlay.style.display = 'flex';
    document.getElementById('resultsArea').style.display = 'none';
    calcBtn.disabled = true;

    try {
        state.calculationResults = await calculateAllEVs(state.hand, (pct) => {
            const rounded = Math.round(pct);
            progressFill.style.width = rounded + '%';
            progressText.textContent = rounded + '%';
        });

        renderResults(state.calculationResults);
        showToast('✅ 計算完了！結果を表示しました', 'success');
    } catch (err) {
        console.error('[PokerJudge] 計算エラー:', err);
        showToast('❌ 計算中にエラーが発生しました', 'error');
    } finally {
        overlay.style.display = 'none';
        calcBtn.disabled = false;
    }
}

// =============================================================
// § 17. ランダム手札生成
// =============================================================

function generateRandomHand() {
    const deck = generateDeck();
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    state.hand = deck.slice(0, 5);
    state.calculationResults = null;

    renderHandPreview();
    renderCardBoard();
    updateCalcButton();
    document.getElementById('resultsArea').style.display = 'none';
    showToast('🎲 ランダム手札を生成しました', 'success');
}

// =============================================================
// § 18. トースト通知
// =============================================================

function showToast(message, type = 'info') {
    document.querySelectorAll('.toast').forEach(el => el.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 350);
    }, 3000);
}

// =============================================================
// § 19. 初期化
// =============================================================

function init() {
    renderHandPreview();
    renderCardBoard();
    updateCalcButton();
    renderDashboard();

    // タブ
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 計算ボタン
    document.getElementById('calcBtn').addEventListener('click', runCalculation);

    // 記録ボタン（判定後→記録タブへ遷移）
    document.getElementById('goRecordBtn').addEventListener('click', () => {
        if (state.calculationResults) {
            switchTab('record');
        }
    });

    // クリア
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        state.hand = [null, null, null, null, null];
        state.calculationResults = null;
        renderHandPreview();
        renderCardBoard();
        updateCalcButton();
        document.getElementById('resultsArea').style.display = 'none';
        showToast('🗑️ 手札をクリアしました', 'info');
    });

    // ランダム
    document.getElementById('randomBtn').addEventListener('click', generateRandomHand);

    // データ管理
    document.getElementById('downloadBtn').addEventListener('click', downloadHistory);
    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) importHistory(file);
    });
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    console.log('[PokerJudge] 初期化完了 | Made by hiro / ヒロ | https://github.com/h1ro223');
}

document.addEventListener('DOMContentLoaded', init);
