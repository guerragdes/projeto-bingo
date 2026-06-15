// ============================================================
// test-card.js
//
// Testa o card.service.js em duas partes:
//
//   1. generateCardCells() — testa a lógica de sorteio
//      isoladamente, sem tocar no banco.
//
//   2. getOrCreateCard(userId, gameId) — testa a criação
//      e persistência da cartela no banco.
//
// Requer um user_id e game_id que já existam no banco
// (ajuste USER_ID e GAME_ID abaixo se necessário).
//
// Uso:
//   node test-card.js
// ============================================================

require('dotenv').config();
const { generateCardCells, getOrCreateCard } = require('./src/services/card.service');
const pool = require('./src/config/db');

const USER_ID = 1;  // admin, criado pelo seeder
const GAME_ID = 1;  // partida criada no test-game.js

const LETTER_RANGES = {
    B: [1, 15],
    I: [16, 30],
    N: [31, 45],
    G: [46, 60],
    O: [61, 75]
};

// ------------------------------------------------------------
// PARTE 1 — Testa a geração das células em memória
// ------------------------------------------------------------
function testGenerateCardCells() {
    console.log('1. Testando generateCardCells()...\n');

    const cells = generateCardCells();

    // Verifica se foram geradas exatamente 25 células
    console.log(`   Total de células: ${cells.length} (esperado: 25)`);

    // Agrupa por letra para validar cada coluna
    for (const letter of ['B', 'I', 'N', 'G', 'O']) {
        const letterCells = cells.filter(c => c.letter === letter);
        const numbers = letterCells.map(c => c.number).filter(n => n !== null);
        const [min, max] = LETTER_RANGES[letter];

        // Todos os números estão dentro do intervalo correto?
        const dentroDoIntervalo = numbers.every(n => n >= min && n <= max);

        // Não há números duplicados na mesma coluna?
        const semDuplicatas = new Set(numbers).size === numbers.length;

        console.log(
            `   ${letter}: ${letterCells.length} células | ` +
            `números: [${numbers.join(', ')}] | ` +
            `intervalo OK: ${dentroDoIntervalo} | ` +
            `sem duplicatas: ${semDuplicatas}`
        );

        if (letter === 'N') {
            const freeCell = letterCells.find(c => c.row_index === 3);
            console.log(
                `      célula livre (linha 3): number=${freeCell.number}, ` +
                `is_free=${freeCell.is_free}, is_marked=${freeCell.is_marked}`
            );
        }
    }
}

// ------------------------------------------------------------
// PARTE 2 — Testa criação e persistência no banco
// ------------------------------------------------------------
async function testGetOrCreateCard() {
    console.log('\n2. Testando getOrCreateCard() — primeira chamada (deve criar)...');
    const card1 = await getOrCreateCard(USER_ID, GAME_ID);
    console.log('   card_id:', card1.card_id);
    console.log('   cells:', JSON.stringify(card1.cells, null, 2));
    console.log('   marked.N (linha 3 deve ser true):', card1.marked.N);

    console.log('\n3. Testando getOrCreateCard() — segunda chamada (deve retornar a mesma)...');
    const card2 = await getOrCreateCard(USER_ID, GAME_ID);
    console.log('   card_id:', card2.card_id);
    console.log('   Mesma cartela retornada?', card1.card_id === card2.card_id);
}

async function main() {
    testGenerateCardCells();
    await testGetOrCreateCard();
    await pool.end();
    console.log('\nTeste concluído.');
}

main().catch(err => {
    console.error('Erro inesperado:', err);
    pool.end();
});