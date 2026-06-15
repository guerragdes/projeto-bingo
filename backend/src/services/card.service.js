// ============================================================
// src/services/card.service.js
//
// Contém a lógica de geração e leitura de cartelas.
//
// Geração: sorteia aleatoriamente os números de cada coluna
// respeitando os intervalos (B:1-15, I:16-30, N:31-45, G:46-60,
// O:61-75), define a célula livre no centro da coluna N
// e insere as 25 células no banco.
//
// Leitura: busca e formata a cartela de um jogador em uma partida.
//
// Este arquivo não lida com HTTP — apenas recebe IDs,
// processa e retorna dados. A rota (game.routes.js) o utiliza.
// ============================================================

const pool = require('../config/db');

// Intervalo de números válidos para cada letra do bingo.
const LETTER_RANGES = {
    B: [1, 15],
    I: [16, 30],
    N: [31, 45],
    G: [46, 60],
    O: [61, 75]
};

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

// ------------------------------------------------------------
// pickRandomNumbers(min, max, count)
//
// Retorna `count` números únicos e aleatórios dentro do
// intervalo [min, max] (inclusivo).
//
// Estratégia: cria um array com todos os números do intervalo,
// embaralha (algoritmo de Fisher-Yates) e pega os primeiros
// `count` elementos. Isso garante números únicos sem precisar
// verificar duplicatas manualmente.
// ------------------------------------------------------------
function pickRandomNumbers(min, max, count) {
    const numbers = [];
    for (let n = min; n <= max; n++) {
        numbers.push(n);
    }

    // Fisher-Yates: percorre o array de trás para frente,
    // trocando cada posição com uma posição aleatória anterior.
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return numbers.slice(0, count);
}

// ------------------------------------------------------------
// generateCardCells()
//
// Gera as 25 células de uma cartela nova.
//
// Para B, I, G, O: sorteia 5 números do intervalo da letra,
// um para cada linha (1 a 5).
//
// Para N: sorteia apenas 4 números (linhas 1, 2, 4 e 5).
// A linha 3 (centro) é a célula livre: number = null,
// is_free = true, is_marked = true desde a criação.
//
// Retorna um array de 25 objetos:
//   { letter, row_index, number, is_marked, is_free }
// ------------------------------------------------------------
function generateCardCells() {
    const cells = [];

    for (const letter of LETTERS) {
        const [min, max] = LETTER_RANGES[letter];

        if (letter === 'N') {
            const numbers = pickRandomNumbers(min, max, 4);
            let numberIndex = 0;

            for (let row = 1; row <= 5; row++) {
                if (row === 3) {
                    // Célula livre: já nasce marcada.
                    cells.push({
                        letter,
                        row_index: row,
                        number: null,
                        is_marked: true,
                        is_free: true
                    });
                } else {
                    cells.push({
                        letter,
                        row_index: row,
                        number: numbers[numberIndex],
                        is_marked: false,
                        is_free: false
                    });
                    numberIndex++;
                }
            }

        } else {
            const numbers = pickRandomNumbers(min, max, 5);

            for (let row = 1; row <= 5; row++) {
                cells.push({
                    letter,
                    row_index: row,
                    number: numbers[row - 1],
                    is_marked: false,
                    is_free: false
                });
            }
        }
    }

    return cells;
}

// ------------------------------------------------------------
// formatCard(card, cells)
//
// Transforma a cartela (linha de `cards`) e suas 25 células
// (linhas de `card_cells`) no formato de resposta da API,
// já documentado na seção 7:
//
//   {
//     card_id, game_id, is_complete,
//     cells:  { B: [n,n,n,n,n], I: [...], N: [n,n,null,n,n], ... },
//     marked: { B: [bool x5], I: [...], ... }
//   }
//
// O índice do array corresponde ao row_index - 1 (linha 1 = índice 0).
// ------------------------------------------------------------
function formatCard(card, cells) {
    const cellsByLetter  = {};
    const markedByLetter = {};

    for (const letter of LETTERS) {
        const letterCells = cells
            .filter(c => c.letter === letter)
            .sort((a, b) => a.row_index - b.row_index);

        cellsByLetter[letter]  = letterCells.map(c => c.number);
        markedByLetter[letter] = letterCells.map(c => c.is_marked);
    }

    return {
        card_id:     card.id,
        game_id:     card.game_id,
        is_complete: card.is_complete,
        cells:  cellsByLetter,
        marked: markedByLetter
    };
}

// ------------------------------------------------------------
// createCard(userId, gameId)
//
// Cria uma nova cartela para o jogador na partida, com 25
// células geradas aleatoriamente.
//
// Usa uma TRANSAÇÃO: o INSERT em `cards` e os 26 INSERTs em
// `card_cells` (1 + 25... na verdade 25) precisam acontecer
// juntos. Se qualquer um falhar (ex: número fora do intervalo
// permitido pela constraint), a transação inteira é desfeita
// com ROLLBACK — não fica uma cartela "pela metade" no banco.
//
// Retorna a cartela já formatada (ver formatCard).
// ------------------------------------------------------------
async function createCard(userId, gameId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const cardResult = await client.query(
            `INSERT INTO cards (user_id, game_id)
             VALUES ($1, $2)
             RETURNING id, user_id, game_id, is_complete`,
            [userId, gameId]
        );
        const card = cardResult.rows[0];

        const cells = generateCardCells();

        for (const cell of cells) {
            await client.query(
                `INSERT INTO card_cells (card_id, letter, row_index, number, is_marked, is_free)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [card.id, cell.letter, cell.row_index, cell.number, cell.is_marked, cell.is_free]
            );
        }

        await client.query('COMMIT');

        return formatCard(card, cells);

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;

    } finally {
        // Devolve a conexão ao pool, esteja com sucesso ou erro.
        client.release();
    }
}

// ------------------------------------------------------------
// getCard(userId, gameId)
//
// Busca a cartela existente de um jogador em uma partida.
// Retorna null se o jogador ainda não tiver cartela nessa partida.
// ------------------------------------------------------------
async function getCard(userId, gameId) {
    const cardResult = await pool.query(
        `SELECT id, user_id, game_id, is_complete
         FROM cards
         WHERE user_id = $1 AND game_id = $2`,
        [userId, gameId]
    );

    if (cardResult.rows.length === 0) {
        return null;
    }

    const card = cardResult.rows[0];

    const cellsResult = await pool.query(
        `SELECT letter, row_index, number, is_marked, is_free
         FROM card_cells
         WHERE card_id = $1
         ORDER BY letter, row_index`,
        [card.id]
    );

    return formatCard(card, cellsResult.rows);
}

// ------------------------------------------------------------
// getOrCreateCard(userId, gameId)
//
// Retorna a cartela existente do jogador na partida, ou cria
// uma nova caso ele ainda não tenha uma. É esta função que a
// rota POST /games/:id/join vai chamar.
// ------------------------------------------------------------
async function getOrCreateCard(userId, gameId) {
    const existing = await getCard(userId, gameId);

    if (existing) {
        return existing;
    }

    return await createCard(userId, gameId);
}

module.exports = {
    getOrCreateCard,
    getCard,
    createCard,
    generateCardCells  // exportado para permitir teste isolado da geração
};