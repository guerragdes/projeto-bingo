// ============================================================
// test-bingo.js
//
// Testa o bingo.service.js de ponta a ponta, sem precisar do
// servidor HTTP — chama o service diretamente.
//
// Passos:
//   1. Cria uma nova partida e gera uma cartela para o admin
//   2. Tenta declarar bingo sem ter cartela em outra partida (espera erro)
//   3. Declara bingo com a cartela incompleta (espera is_valid: false)
//   4. Marca manualmente todas as células da cartela
//   5. Declara bingo novamente, agora completa (espera is_valid: true)
//   6. Declara bingo uma segunda vez (simula segundo jogador
//      chegando depois, para testar a ordem cronológica)
//   7. Consulta getClaimsForGame e verifica a ordem
//
// Uso:
//   node test-bingo.js
//
// Pode ser deletado após o teste.
// ============================================================

require('dotenv').config();
const pool        = require('./src/config/db');
const cardService = require('./src/services/card.service');
const bingoService = require('./src/services/bingo.service');

const USER_ID = 1; // admin, criado pelo seeder

async function main() {
    // ------------------------------------------------------------
    console.log('1. Criando nova partida e gerando cartela...');
    const gameResult = await pool.query(
        `INSERT INTO games (status, created_by) VALUES ('active', $1) RETURNING id`,
        [USER_ID]
    );
    const gameId = gameResult.rows[0].id;
    console.log('   game_id:', gameId);

    const card = await cardService.getOrCreateCard(USER_ID, gameId);
    console.log('   card_id:', card.card_id);

    // ------------------------------------------------------------
    console.log('\n2. Tentando declarar bingo em partida SEM cartela (espera erro)...');
    const gameSemCartelaResult = await pool.query(
        `INSERT INTO games (status, created_by) VALUES ('active', $1) RETURNING id`,
        [USER_ID]
    );
    const gameSemCartelaId = gameSemCartelaResult.rows[0].id;

    try {
        await bingoService.claimBingo(USER_ID, gameSemCartelaId);
        console.log('   ERRO: não lançou exceção (esperado que lançasse)');
    } catch (err) {
        console.log('   Erro lançado corretamente:', err.message);
    }

    // ------------------------------------------------------------
    console.log('\n3. Declarando bingo com a cartela incompleta...');
    const claim1 = await bingoService.claimBingo(USER_ID, gameId);
    console.log('   is_valid:', claim1.is_valid, '(esperado: false)');
    console.log('   marked_cells:', claim1.marked_cells, '/', claim1.total_cells, '(esperado: 1/25, célula livre)');

    // ------------------------------------------------------------
    console.log('\n4. Marcando manualmente todas as células da cartela...');
    await pool.query(
        `UPDATE card_cells SET is_marked = TRUE WHERE card_id = $1`,
        [card.card_id]
    );
    console.log('   Todas as 25 células marcadas.');

    // ------------------------------------------------------------
    console.log('\n5. Declarando bingo com a cartela completa...');
    const claim2 = await bingoService.claimBingo(USER_ID, gameId);
    console.log('   is_valid:', claim2.is_valid, '(esperado: true)');
    console.log('   marked_cells:', claim2.marked_cells, '/', claim2.total_cells, '(esperado: 25/25)');
    console.log('   claimed_at:', claim2.claimed_at);

    // Confirma que a cartela foi marcada como completa no banco.
    const cardCheck = await pool.query('SELECT is_complete FROM cards WHERE id = $1', [card.card_id]);
    console.log('   cards.is_complete no banco:', cardCheck.rows[0].is_complete, '(esperado: true)');

    // ------------------------------------------------------------
    console.log('\n6. Declarando bingo uma segunda vez (simula 2º jogador chegando depois)...');
    // Pequena espera para garantir um timestamp diferente do primeiro.
    await new Promise(resolve => setTimeout(resolve, 1100));
    const claim3 = await bingoService.claimBingo(USER_ID, gameId);
    console.log('   is_valid:', claim3.is_valid);
    console.log('   claimed_at:', claim3.claimed_at);

    // ------------------------------------------------------------
    console.log('\n7. Consultando getClaimsForGame...');
    const claims = await bingoService.getClaimsForGame(gameId);
    console.log('   total de declarações válidas:', claims.length, '(esperado: 2)');

    claims.forEach((c, i) => {
        console.log(`   #${i + 1}: ${c.username} | card_id: ${c.card_id} | claimed_at: ${c.claimed_at}`);
    });

    const ordemCronologica = new Date(claims[0].claimed_at) <= new Date(claims[1].claimed_at);
    console.log('   está em ordem cronológica (mais antiga primeiro):', ordemCronologica);

    // ------------------------------------------------------------
    console.log('\n8. Encerrando partidas de teste...');
    await pool.query(
        `UPDATE games SET status = 'finished', finished_at = NOW() WHERE id IN ($1, $2)`,
        [gameId, gameSemCartelaId]
    );

    await pool.end();
    console.log('\nTeste concluído.');
}

main().catch(err => {
    console.error('Erro inesperado:', err);
    pool.end();
});