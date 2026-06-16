// ============================================================
// test-draw.js
//
// Testa o draw.service.js de ponta a ponta, sem precisar do
// servidor HTTP rodando — chama o service diretamente.
//
// Passos:
//   1. Cria uma nova partida (direto no banco)
//   2. Gera uma cartela para o admin nessa partida
//   3. Sorteia 10 números e verifica: letra correta,
//      sem duplicatas, marcação automática na cartela
//   4. Sorteia os 65 números restantes (esgotando os 75)
//   5. Tenta sortear o 76º número (espera erro)
//   6. Consulta o histórico de sorteios
//   7. Encerra a partida de teste
//
// Uso:
//   node test-draw.js
// ============================================================

require('dotenv').config();
const pool        = require('./src/config/db');
const cardService = require('./src/services/card.service');
const drawService = require('./src/services/draw.service');

const USER_ID = 1; // admin, criado pelo seeder

async function main() {
    // ------------------------------------------------------------
    console.log('1. Criando nova partida de teste...');
    const gameResult = await pool.query(
        `INSERT INTO games (status, created_by) VALUES ('active', $1) RETURNING id`,
        [USER_ID]
    );
    const gameId = gameResult.rows[0].id;
    console.log('   game_id:', gameId);

    // ------------------------------------------------------------
    console.log('\n2. Gerando cartela para o admin...');
    const card = await cardService.getOrCreateCard(USER_ID, gameId);
    console.log('   card_id:', card.card_id);
    console.log('   cells:', JSON.stringify(card.cells));

    // Junta todos os números da cartela em um Set para consulta rápida.
    const cardNumbers = new Set();
    for (const letter of ['B', 'I', 'N', 'G', 'O']) {
        for (const n of card.cells[letter]) {
            if (n !== null) cardNumbers.add(n);
        }
    }

    // ------------------------------------------------------------
    console.log('\n3. Sorteando 10 números e verificando...');
    const drawnSoFar = new Set();

    for (let i = 1; i <= 10; i++) {
        const result = await drawService.drawNumber(gameId);

        const letraOk = drawService.getLetterForNumber(result.number) === result.letter;
        const semDuplicata = !drawnSoFar.has(result.number);
        drawnSoFar.add(result.number);

        let marcacao = 'não está na cartela';
        if (cardNumbers.has(result.number)) {
            const cellResult = await pool.query(
                `SELECT is_marked FROM card_cells WHERE card_id = $1 AND number = $2`,
                [card.card_id, result.number]
            );
            marcacao = cellResult.rows[0].is_marked
                ? 'está na cartela e foi marcada ✅'
                : 'está na cartela mas NÃO foi marcada ❌';
        }

        console.log(
            `   sorteio ${result.drawn_order}: número ${result.number} (${result.letter}) | ` +
            `letra OK: ${letraOk} | sem duplicata: ${semDuplicata} | ${marcacao}`
        );
    }

    // ------------------------------------------------------------
    console.log('\n4. Sorteando os 65 números restantes (esgotando os 75)...');
    for (let i = 11; i <= 75; i++) {
        await drawService.drawNumber(gameId);
    }
    console.log('   75 números sorteados.');

    // ------------------------------------------------------------
    console.log('\n5. Tentando sortear o 76º número (espera erro)...');
    try {
        await drawService.drawNumber(gameId);
        console.log('   ERRO: não lançou exceção (esperado que lançasse)');
    } catch (err) {
        console.log('   Erro lançado corretamente:', err.message);
    }

    // ------------------------------------------------------------
    console.log('\n6. Consultando histórico de sorteios...');
    const history = await drawService.getDrawHistory(gameId);
    console.log('   total de sorteios:', history.length, '(esperado: 75)');

    const orders = history.map(h => h.drawn_order);
    const ordenado = orders.every((o, idx) => o === idx + 1);
    console.log('   ordem sequencial (1 a 75):', ordenado);

    const numeros = history.map(h => h.number);
    const semDuplicatasGeral = new Set(numeros).size === numeros.length;
    console.log('   sem números duplicados:', semDuplicatasGeral);

    // ------------------------------------------------------------
    console.log('\n7. Encerrando partida de teste...');
    await pool.query(
        `UPDATE games SET status = 'finished', finished_at = NOW() WHERE id = $1`,
        [gameId]
    );

    await pool.end();
    console.log('\nTeste concluído.');
}

main().catch(err => {
    console.error('Erro inesperado:', err);
    pool.end();
});