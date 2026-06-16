// ============================================================
// src/services/draw.service.js
//
// Contém a lógica de sorteio de números.
//
// Busca os números já sorteados na partida, escolhe
// aleatoriamente um dos restantes, registra no banco,
// atualiza as marcações em todas as cartelas que contêm
// esse número e verifica se alguma cartela ficou completa.
//
// Também expõe getDrawHistory, usado pela rota
// GET /games/:id/draws.
// ============================================================

const pool = require('../config/db');

// ------------------------------------------------------------
// getLetterForNumber(number)
//
// Retorna a letra (B, I, N, G ou O) correspondente a um número
// de 1 a 75, com base nos intervalos fixos do bingo.
// ------------------------------------------------------------
function getLetterForNumber(number) {
    if (number >= 1  && number <= 15) return 'B';
    if (number >= 16 && number <= 30) return 'I';
    if (number >= 31 && number <= 45) return 'N';
    if (number >= 46 && number <= 60) return 'G';
    if (number >= 61 && number <= 75) return 'O';
}

// ------------------------------------------------------------
// drawNumber(gameId)
//
// Sorteia o próximo número para a partida.
//
// Passos (todos dentro de uma TRANSAÇÃO):
//   1. Busca os números já sorteados nesta partida.
//   2. Monta a lista de candidatos (1-75 menos os já sorteados).
//   3. Se não houver candidatos, lança erro (partida esgotada).
//   4. Sorteia um número aleatório da lista de candidatos.
//   5. Insere o registro em drawn_numbers.
//   6. Marca is_marked = TRUE em todas as card_cells desta
//      partida que contêm esse número.
//   7. Marca is_complete = TRUE nas cartelas que não possuem
//      mais nenhuma célula desmarcada.
//
// Retorna: { number, letter, drawn_order }
//
// Lança erro se todos os 75 números já tiverem sido sorteados.
// ------------------------------------------------------------
async function drawNumber(gameId) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Passo 1: números já sorteados nesta partida.
        const drawnResult = await client.query(
            'SELECT number FROM drawn_numbers WHERE game_id = $1',
            [gameId]
        );
        const drawnNumbers = drawnResult.rows.map(row => row.number);

        // Passo 3: verifica se ainda há números disponíveis.
        if (drawnNumbers.length >= 75) {
            throw new Error('Todos os números já foram sorteados nesta partida.');
        }

        // Passo 2: monta a lista de candidatos (1 a 75, exceto os já sorteados).
        const drawnSet = new Set(drawnNumbers);
        const candidates = [];
        for (let n = 1; n <= 75; n++) {
            if (!drawnSet.has(n)) {
                candidates.push(n);
            }
        }

        // Passo 4: sorteia um número aleatório entre os candidatos.
        const number = candidates[Math.floor(Math.random() * candidates.length)];
        const letter = getLetterForNumber(number);
        const drawnOrder = drawnNumbers.length + 1;

        // Passo 5: registra o sorteio.
        await client.query(
            `INSERT INTO drawn_numbers (game_id, number, letter, drawn_order)
             VALUES ($1, $2, $3, $4)`,
            [gameId, number, letter, drawnOrder]
        );

        // Passo 6: marca a célula correspondente em todas as cartelas
        // desta partida que contêm o número sorteado.
        await client.query(
            `UPDATE card_cells
             SET is_marked = TRUE
             WHERE number = $1
               AND card_id IN (SELECT id FROM cards WHERE game_id = $2)`,
            [number, gameId]
        );

        // Passo 7: marca como completa qualquer cartela desta partida
        // que não tenha mais nenhuma célula com is_marked = FALSE.
        //
        // A subquery encontra os IDs de cartelas que AINDA possuem
        // alguma célula desmarcada. O UPDATE então afeta apenas
        // as cartelas que NÃO estão nessa lista — ou seja,
        // as que estão 100% marcadas.
        await client.query(
            `UPDATE cards
             SET is_complete = TRUE
             WHERE game_id = $1
               AND is_complete = FALSE
               AND id NOT IN (
                   SELECT DISTINCT card_id FROM card_cells WHERE is_marked = FALSE
               )`,
            [gameId]
        );

        await client.query('COMMIT');

        return { number, letter, drawn_order: drawnOrder };

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;

    } finally {
        client.release();
    }
}

// ------------------------------------------------------------
// getDrawHistory(gameId)
//
// Retorna o histórico de números sorteados na partida,
// em ordem de sorteio.
//
// Retorna um array de objetos:
//   { drawn_order, letter, number, drawn_at }
// ------------------------------------------------------------
async function getDrawHistory(gameId) {
    const result = await pool.query(
        `SELECT drawn_order, letter, number, drawn_at
         FROM drawn_numbers
         WHERE game_id = $1
         ORDER BY drawn_order`,
        [gameId]
    );

    return result.rows;
}

module.exports = {
    drawNumber,
    getDrawHistory,
    getLetterForNumber  // exportado para permitir teste isolado
};