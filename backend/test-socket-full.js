// ============================================================
// test-socket-full.js
//
// Teste final da Fase 5: testa os QUATRO eventos em tempo real
// juntos, em um fluxo completo de partida:
//
//   game:started   -> ao iniciar a partida
//   number:drawn   -> a cada sorteio (testamos 3)
//   bingo:claimed  -> ao declarar bingo com cartela completa
//   game:finished  -> ao encerrar a partida
//
// Inclui uma verificação de segurança no início: encerra
// qualquer partida pendente de testes anteriores antes de
// criar uma nova, evitando o erro 409 "já existe uma partida
// em andamento" que travou o test-bingo-claimed.js.
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-socket-full.js
// ============================================================

require('dotenv').config();
const { io } = require('socket.io-client');
const pool = require('./src/config/db');

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

// Registro de quais eventos foram recebidos, para o resumo final.
const eventosRecebidos = {
    'game:started': null,
    'number:drawn': [],
    'bingo:claimed': null,
    'game:finished': null
};

async function main() {
    // ------------------------------------------------------------
    console.log('0. Verificação de segurança: encerrando partidas pendentes...');
    const pendentes = await pool.query(
        `UPDATE games SET status = 'finished', finished_at = NOW()
         WHERE status IN ('waiting', 'active')
         RETURNING id`
    );
    if (pendentes.rows.length > 0) {
        console.log(`   ${pendentes.rows.length} partida(s) pendente(s) encerrada(s):`,
            pendentes.rows.map(r => r.id));
    } else {
        console.log('   Nenhuma partida pendente.');
    }

    // ------------------------------------------------------------
    console.log('\n1. Login HTTP como admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();

    if (loginRes.status !== 200) {
        console.log('   Login falhou, abortando teste:', loginData);
        await pool.end();
        return;
    }

    const token = loginData.token;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    console.log('   token obtido com sucesso.');

    // ------------------------------------------------------------
    console.log('\n2. Criando partida (ainda em waiting)...');
    const createRes = await fetch(`${BASE_URL}/games`, { method: 'POST', headers });
    const createData = await createRes.json();
    const gameId = createData.id;
    console.log('   game_id:', gameId, '| status:', createData.status);

    // ------------------------------------------------------------
    console.log('\n3. Conectando ao Socket.io e entrando na sala...');
    const socket = io(BASE_URL);

    socket.on('connect', () => socket.emit('authenticate', { token }));

    socket.on('game:started', (data) => {
        eventosRecebidos['game:started'] = data;
        console.log('   [evento] game:started recebido:', data);
    });

    socket.on('number:drawn', (data) => {
        eventosRecebidos['number:drawn'].push(data);
        console.log('   [evento] number:drawn recebido:', data);
    });

    socket.on('bingo:claimed', (data) => {
        eventosRecebidos['bingo:claimed'] = data;
        console.log('   [evento] bingo:claimed recebido:', data);
    });

    socket.on('game:finished', (data) => {
        eventosRecebidos['game:finished'] = data;
        console.log('   [evento] game:finished recebido:', data);
    });

    socket.on('authenticated', () => {
        console.log('   Autenticado. Entrando na sala game:' + gameId + '...');
        socket.emit('join:game', { game_id: gameId });

        setTimeout(() => rodarFluxo(headers, gameId), 300);
    });

    // ------------------------------------------------------------
    async function rodarFluxo(headers, gameId) {
        console.log('\n4. Iniciando a partida (espera evento game:started)...');
        await fetch(`${BASE_URL}/games/${gameId}/start`, { method: 'PATCH', headers });
        await esperar(300);

        console.log('\n5. Entrando na partida para gerar uma cartela...');
        const joinRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers });
        const joinData = await joinRes.json();
        const cardId = joinData.card_id;
        console.log('   card_id:', cardId);

        console.log('\n6. Sorteando 3 números (espera 3x evento number:drawn)...');
        for (let i = 1; i <= 3; i++) {
            await fetch(`${BASE_URL}/games/${gameId}/draw`, { method: 'POST', headers });
            await esperar(300);
        }

        console.log('\n7. Marcando manualmente a cartela como completa...');
        await pool.query(`UPDATE card_cells SET is_marked = TRUE WHERE card_id = $1`, [cardId]);

        console.log('\n8. Declarando bingo (espera evento bingo:claimed)...');
        await fetch(`${BASE_URL}/games/${gameId}/bingo`, { method: 'POST', headers });
        await esperar(300);

        console.log('\n9. Encerrando a partida (espera evento game:finished)...');
        await fetch(`${BASE_URL}/games/${gameId}/finish`, { method: 'PATCH', headers });
        await esperar(300);

        // ------------------------------------------------------------
        console.log('\n10. Resumo final dos eventos recebidos:');
        console.log('   game:started  ->', eventosRecebidos['game:started'] ? 'recebido ✅' : 'NÃO recebido ❌');
        console.log('   number:drawn  ->', eventosRecebidos['number:drawn'].length, '/ 3 recebidos',
            eventosRecebidos['number:drawn'].length === 3 ? '✅' : '❌');
        console.log('   bingo:claimed ->', eventosRecebidos['bingo:claimed'] ? 'recebido ✅' : 'NÃO recebido ❌');
        console.log('   game:finished ->', eventosRecebidos['game:finished'] ? 'recebido ✅' : 'NÃO recebido ❌');

        socket.disconnect();
        await pool.end();
        console.log('\nTeste concluído.');
        process.exit(0);
    }

    function esperar(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

main().catch(err => {
    console.error('Erro inesperado:', err);
    pool.end();
});