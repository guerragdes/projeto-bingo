// ============================================================
// test-full-game.js
//
// Teste de integração completo da Fase 4, via HTTP real
// (não chama os services diretamente — simula exatamente
// o que o frontend vai fazer).
//
// Fluxo testado:
//   1. Login como admin
//   2. Criar e iniciar uma partida
//   3. Admin entra na partida (vira jogador também)
//   4. Sortear 5 números e verificar o histórico
//   5. Criar um jogador comum e testar que ELE não pode sortear (403)
//   6. Jogador comum entra na partida (recebe sua própria cartela)
//   7. Admin declara bingo com a cartela incompleta (espera false)
//   8. Marca manualmente a cartela do admin como completa
//   9. Admin declara bingo novamente (espera true)
//   10. Encerra a partida
//   11. Tenta sortear em partida encerrada (espera 409)
//   12. Remove o jogador de teste criado no passo 5
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-full-game.js
// ============================================================

require('dotenv').config();
const pool = require('./src/config/db');

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

async function main() {
    // ------------------------------------------------------------
    console.log('1. Login como admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    console.log('   status:', loginRes.status);

    if (loginRes.status !== 200) {
        console.log('   Login falhou, abortando teste:', loginData);
        return;
    }

    const adminToken = loginData.token;
    const adminHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };

    // ------------------------------------------------------------
    console.log('\n2. Criar e iniciar partida...');
    const createRes = await fetch(`${BASE_URL}/games`, { method: 'POST', headers: adminHeaders });
    const createData = await createRes.json();
    const gameId = createData.id;
    console.log('   game_id:', gameId, '| status:', createData.status);

    const startRes = await fetch(`${BASE_URL}/games/${gameId}/start`, { method: 'PATCH', headers: adminHeaders });
    const startData = await startRes.json();
    console.log('   status após start:', startData.status);

    // ------------------------------------------------------------
    console.log('\n3. Admin entra na partida (também é jogador)...');
    const joinRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers: adminHeaders });
    const joinData = await joinRes.json();
    console.log('   card_id:', joinData.card_id);

    // ------------------------------------------------------------
    console.log('\n4. Sortear 5 números...');
    for (let i = 1; i <= 5; i++) {
        const drawRes = await fetch(`${BASE_URL}/games/${gameId}/draw`, { method: 'POST', headers: adminHeaders });
        const drawData = await drawRes.json();
        console.log(`   sorteio ${i}: status ${drawRes.status} |`, drawData);
    }

    const drawsRes = await fetch(`${BASE_URL}/games/${gameId}/draws`, { headers: adminHeaders });
    const drawsData = await drawsRes.json();
    console.log('   total no histórico:', drawsData.length, '(esperado: 5)');

    // ------------------------------------------------------------
    console.log('\n5. Criar jogador comum e testar bloqueio de sorteio (403)...');
    const createUserRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ username: 'jogador_fase4', password: 'senha123', is_admin: false })
    });
    const createUserData = await createUserRes.json();
    const jogadorId = createUserData.id;
    console.log('   jogador criado, id:', jogadorId);

    const loginJogadorRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'jogador_fase4', password: 'senha123' })
    });
    const loginJogadorData = await loginJogadorRes.json();
    const jogadorToken = loginJogadorData.token;
    const jogadorHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jogadorToken}`
    };

    const drawBloqueadoRes = await fetch(`${BASE_URL}/games/${gameId}/draw`, { method: 'POST', headers: jogadorHeaders });
    const drawBloqueadoData = await drawBloqueadoRes.json();
    console.log('   jogador tentando sortear -> status:', drawBloqueadoRes.status, '| resposta:', drawBloqueadoData);

    // ------------------------------------------------------------
    console.log('\n6. Jogador comum entra na partida...');
    const joinJogadorRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers: jogadorHeaders });
    const joinJogadorData = await joinJogadorRes.json();
    console.log('   card_id do jogador:', joinJogadorData.card_id);

    // ------------------------------------------------------------
    console.log('\n7. Admin declara bingo com cartela incompleta...');
    const bingoIncompletoRes = await fetch(`${BASE_URL}/games/${gameId}/bingo`, { method: 'POST', headers: adminHeaders });
    const bingoIncompletoData = await bingoIncompletoRes.json();
    console.log('   status:', bingoIncompletoRes.status, '| is_valid:', bingoIncompletoData.is_valid,
                '| marked:', bingoIncompletoData.marked_cells, '/', bingoIncompletoData.total_cells);

    // ------------------------------------------------------------
    console.log('\n8. Marcando manualmente a cartela do admin como completa...');
    await pool.query(
        `UPDATE card_cells SET is_marked = TRUE WHERE card_id = $1`,
        [joinData.card_id]
    );
    console.log('   cartela do admin marcada por completo.');

    // ------------------------------------------------------------
    console.log('\n9. Admin declara bingo novamente (espera válido)...');
    const bingoValidoRes = await fetch(`${BASE_URL}/games/${gameId}/bingo`, { method: 'POST', headers: adminHeaders });
    const bingoValidoData = await bingoValidoRes.json();
    console.log('   status:', bingoValidoRes.status, '| is_valid:', bingoValidoData.is_valid,
                '| claimed_at:', bingoValidoData.claimed_at);

    // ------------------------------------------------------------
    console.log('\n10. Encerrando a partida...');
    const finishRes = await fetch(`${BASE_URL}/games/${gameId}/finish`, { method: 'PATCH', headers: adminHeaders });
    const finishData = await finishRes.json();
    console.log('   status da partida:', finishData.status);

    // ------------------------------------------------------------
    console.log('\n11. Tentando sortear em partida encerrada (espera 409)...');
    const drawFinishedRes = await fetch(`${BASE_URL}/games/${gameId}/draw`, { method: 'POST', headers: adminHeaders });
    const drawFinishedData = await drawFinishedRes.json();
    console.log('   status:', drawFinishedRes.status, '| resposta:', drawFinishedData);

    // ------------------------------------------------------------
    console.log('\n12. Removendo jogador de teste...');
    const deleteRes = await fetch(`${BASE_URL}/admin/users/${jogadorId}`, {
        method: 'DELETE',
        headers: adminHeaders
    });
    const deleteData = await deleteRes.json();
    console.log('   status:', deleteRes.status, '| resposta:', deleteData);

    await pool.end();
    console.log('\nTeste concluído.');
}

main().catch(err => {
    console.error('Erro inesperado:', err);
    pool.end();
});