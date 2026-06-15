// ============================================================
// test-join.js
//
// Testa o fluxo completo da Fase 3:
//   criar partida -> entrar na partida -> consultar cartela
//
// Também testa os casos de erro:
//   - GET /card antes de fazer join (404)
//   - POST /join numa partida finished (409)
//   - POST /join chamado duas vezes (mesma cartela)
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-join.js
// ============================================================

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
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
    console.log('\n2. Criar nova partida...');
    const createRes = await fetch(`${BASE_URL}/games`, { method: 'POST', headers });
    const createData = await createRes.json();
    console.log('   status:', createRes.status, '| id:', createData.id, '| status:', createData.status);

    const gameId = createData.id;

    // ------------------------------------------------------------
    console.log('\n3. Consultar cartela ANTES de entrar (espera 404)...');
    const cardBeforeRes = await fetch(`${BASE_URL}/games/${gameId}/card`, { headers });
    const cardBeforeData = await cardBeforeRes.json();
    console.log('   status:', cardBeforeRes.status, '| resposta:', cardBeforeData);

    // ------------------------------------------------------------
    console.log('\n4. Entrar na partida (POST /join, espera 200)...');
    const joinRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers });
    const joinData = await joinRes.json();
    console.log('   status:', joinRes.status, '| card_id:', joinData.card_id);
    console.log('   cells.N:', joinData.cells.N);
    console.log('   marked.N:', joinData.marked.N);

    // ------------------------------------------------------------
    console.log('\n5. Entrar de novo (espera mesma cartela)...');
    const joinAgainRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers });
    const joinAgainData = await joinAgainRes.json();
    console.log('   status:', joinAgainRes.status, '| card_id:', joinAgainData.card_id);
    console.log('   Mesma cartela?', joinData.card_id === joinAgainData.card_id);

    // ------------------------------------------------------------
    console.log('\n6. Consultar cartela DEPOIS de entrar (espera 200)...');
    const cardAfterRes = await fetch(`${BASE_URL}/games/${gameId}/card`, { headers });
    const cardAfterData = await cardAfterRes.json();
    console.log('   status:', cardAfterRes.status, '| card_id:', cardAfterData.card_id);

    // ------------------------------------------------------------
    console.log('\n7. Encerrar a partida...');
    const finishRes = await fetch(`${BASE_URL}/games/${gameId}/finish`, { method: 'PATCH', headers });
    const finishData = await finishRes.json();
    console.log('   status:', finishRes.status, '| status da partida:', finishData.status);

    // ------------------------------------------------------------
    console.log('\n8. Tentar entrar em partida encerrada (espera 409)...');
    const joinFinishedRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers });
    const joinFinishedData = await joinFinishedRes.json();
    console.log('   status:', joinFinishedRes.status, '| resposta:', joinFinishedData);

    console.log('\nTeste concluído.');
}

main().catch(err => console.error('Erro inesperado:', err));