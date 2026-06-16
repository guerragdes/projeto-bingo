// ============================================================
// src/services/bingo.service.js
//
// Contém a lógica de validação de declarações de bingo.
//
// Busca todas as células da cartela do jogador e verifica
// se todas estão marcadas. Registra o resultado (válido ou
// inválido) em bingo_claims com o timestamp gerado pelo
// servidor (NOW() do PostgreSQL) — nunca um valor vindo do
// cliente, pois claimed_at é o critério de desempate entre
// declarações válidas simultâneas (ver documentação, seção 3.4).
//
// Um bingo válido NÃO encerra a partida automaticamente —
// essa decisão é sempre do administrador (ver RF17a).
// ============================================================

const pool = require('../config/db');

// ------------------------------------------------------------
// claimBingo(userId, gameId)
//
// Processa a declaração de bingo de um jogador em uma partida.
//
// Passos:
//   1. Busca a cartela do jogador na partida. Se não existir,
//      lança erro (jogador nunca entrou na partida).
//   2. Conta quantas das 25 células estão marcadas.
//   3. Se todas estiverem marcadas, a declaração é válida:
//      registra em bingo_claims com is_valid = TRUE e
//      claimed_at = NOW(), gerado pelo servidor.
//   4. Se não, registra como inválida (is_valid = FALSE).
//
// Retorna:
//   { is_valid: true,  claimed_at: '...', marked_cells: 25, total_cells: 25 }
//   { is_valid: false, marked_cells: 18, total_cells: 25 }
//
// Lança erro se o jogador não tiver cartela na partida.
// ------------------------------------------------------------
async function claimBingo(userId, gameId) {
    // Passo 1: busca a cartela do jogador nesta partida.
    const cardResult = await pool.query(
        `SELECT id FROM cards WHERE user_id = $1 AND game_id = $2`,
        [userId, gameId]
    );

    if (cardResult.rows.length === 0) {
        throw new Error('Você não possui cartela nesta partida.');
    }

    const cardId = cardResult.rows[0].id;

    // Passo 2: conta o total de células e quantas estão marcadas.
    const countResult = await pool.query(
        `SELECT
            COUNT(*) AS total_cells,
            SUM(CASE WHEN is_marked THEN 1 ELSE 0 END) AS marked_cells
         FROM card_cells
         WHERE card_id = $1`,
        [cardId]
    );

    // COUNT e SUM retornam strings no node-postgres por padrão
    // (para números grandes não perderem precisão), então
    // convertemos explicitamente para number.
    const totalCells  = Number(countResult.rows[0].total_cells);
    const markedCells = Number(countResult.rows[0].marked_cells);

    const isValid = markedCells === totalCells;

    if (isValid) {
        // Passo 3: declaração válida.
        // claimed_at usa NOW() do PostgreSQL — o timestamp é
        // gerado no momento em que o servidor processa a query,
        // nunca um valor enviado pelo cliente.
        const claimResult = await pool.query(
            `INSERT INTO bingo_claims (user_id, game_id, card_id, is_valid, claimed_at)
             VALUES ($1, $2, $3, TRUE, NOW())
             RETURNING claimed_at`,
            [userId, gameId, cardId]
        );

        // Atualiza is_complete na cartela, caso ainda não estivesse marcado
        // (normalmente já estaria, marcado pelo draw.service.js).
        await pool.query(
            `UPDATE cards SET is_complete = TRUE WHERE id = $1`,
            [cardId]
        );

        return {
            is_valid: true,
            claimed_at: claimResult.rows[0].claimed_at,
            marked_cells: markedCells,
            total_cells: totalCells
        };

    } else {
        // Passo 4: declaração inválida — registra a tentativa,
        // mas não interrompe o jogo nem altera a cartela.
        await pool.query(
            `INSERT INTO bingo_claims (user_id, game_id, card_id, is_valid)
             VALUES ($1, $2, $3, FALSE)`,
            [userId, gameId, cardId]
        );

        return {
            is_valid: false,
            marked_cells: markedCells,
            total_cells: totalCells
        };
    }
}

// ------------------------------------------------------------
// getClaimsForGame(gameId)
//
// Retorna todas as declarações de bingo válidas de uma partida,
// em ordem cronológica — quem declarou primeiro aparece primeiro.
// Útil para o admin decidir quem venceu (ver decisão de design 3.4).
//
// Retorna um array de objetos:
//   { username, card_id, claimed_at }
// ------------------------------------------------------------
async function getClaimsForGame(gameId) {
    const result = await pool.query(
        `SELECT u.username, bc.card_id, bc.claimed_at
         FROM bingo_claims bc
         JOIN users u ON u.id = bc.user_id
         WHERE bc.game_id = $1 AND bc.is_valid = TRUE
         ORDER BY bc.claimed_at ASC`,
        [gameId]
    );

    return result.rows;
}

module.exports = { claimBingo, getClaimsForGame };