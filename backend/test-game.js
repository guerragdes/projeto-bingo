// ============================================================
// test-game.js
//
// Testa as rotas de gerenciamento de partida:
//   GET   /games/active
//   POST  /games
//   PATCH /games/:id/start
//   PATCH /games/:id/finish
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-game.js
// ============================================================

const BASE_URL = 'http://localhost:3000';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

async function main() {
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

    const token = loginData.token;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    // ------------------------------------------------------------
    console.log('\n2. Consultar partida ativa (espera 204, nenhuma ainda)...');
    const activeRes1 = await fetch(`${BASE_URL}/games/active`, { headers });
    console.log('   status:', activeRes1.status);

    // ------------------------------------------------------------
    console.log('\n3. Criar nova partida (espera 201)...');
    const createRes = await fetch(`${BASE_URL}/games`, {
        method: 'POST',
        headers
    });
    const createData = await createRes.json();
    console.log('   status:', createRes.status, '| resposta:', createData);

    const gameId = createData.id;

    // ------------------------------------------------------------
    console.log('\n4. Consultar partida ativa (espera 200, status waiting)...');
    const activeRes2 = await fetch(`${BASE_URL}/games/active`, { headers });
    const activeData2 = await activeRes2.json();
    console.log('   status:', activeRes2.status, '| resposta:', activeData2);

    // ------------------------------------------------------------
    console.log('\n5. Criar segunda partida (espera 409, já existe uma)...');
    const dupRes = await fetch(`${BASE_URL}/games`, {
        method: 'POST',
        headers
    });
    const dupData = await dupRes.json();
    console.log('   status:', dupRes.status, '| resposta:', dupData);

    // ------------------------------------------------------------
    console.log('\n6. Iniciar a partida (espera 200, status active)...');
    const startRes = await fetch(`${BASE_URL}/games/${gameId}/start`, {
        method: 'PATCH',
        headers
    });
    const startData = await startRes.json();
    console.log('   status:', startRes.status, '| resposta:', startData);

    // ------------------------------------------------------------
    console.log('\n7. Tentar iniciar de novo (espera 409, já está active)...');
    const startAgainRes = await fetch(`${BASE_URL}/games/${gameId}/start`, {
        method: 'PATCH',
        headers
    });
    const startAgainData = await startAgainRes.json();
    console.log('   status:', startAgainRes.status, '| resposta:', startAgainData);

    // ------------------------------------------------------------
    console.log('\n8. Encerrar a partida (espera 200, status finished)...');
    const finishRes = await fetch(`${BASE_URL}/games/${gameId}/finish`, {
        method: 'PATCH',
        headers
    });
    const finishData = await finishRes.json();
    console.log('   status:', finishRes.status, '| resposta:', finishData);

    // ------------------------------------------------------------
    console.log('\n9. Tentar encerrar de novo (espera 409, já finished)...');
    const finishAgainRes = await fetch(`${BASE_URL}/games/${gameId}/finish`, {
        method: 'PATCH',
        headers
    });
    const finishAgainData = await finishAgainRes.json();
    console.log('   status:', finishAgainRes.status, '| resposta:', finishAgainData);

    // ------------------------------------------------------------
    console.log('\n10. Consultar partida ativa (espera 204, nenhuma agora)...');
    const activeRes3 = await fetch(`${BASE_URL}/games/active`, { headers });
    console.log('   status:', activeRes3.status);

    console.log('\nTeste concluído.');
}

main().catch(err => console.error('Erro inesperado:', err));