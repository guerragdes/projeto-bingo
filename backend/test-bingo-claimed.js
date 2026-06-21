// ============================================================
// test-bingo-claimed.js
//
// Testa se o evento 'bingo:claimed' é emitido corretamente
// quando uma declaração de bingo válida é processada via
// POST /games/:id/bingo.
//
// Fluxo:
//   1. Login HTTP como admin
//   2. Criar, iniciar partida e entrar nela (gera cartela)
//   3. Conectar ao Socket.io, autenticar e entrar na sala da partida
//   4. Registrar um listener para 'bingo:claimed'
//   5. Marcar manualmente a cartela como completa (direto no banco,
//      simulando que todos os números já saíram no sorteio)
//   6. Disparar POST /games/:id/bingo via HTTP
//   7. Verificar se o listener recebeu o evento, e se os dados
//      batem com a resposta HTTP
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-bingo-claimed.js
// ============================================================

require('dotenv').config();
const { io } = require('socket.io-client');
const pool = require('./src/config/db');

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

async function main() {
    // ------------------------------------------------------------
    console.log('1. Login HTTP como admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();

    if (loginRes.status !== 200) {
        console.log('   Login falhou, abortando teste:', loginData);
        return;
    }

    const token = loginData.token;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    console.log('   token obtido com sucesso.');

    // ------------------------------------------------------------
    console.log('\n2. Criando partida, iniciando e entrando nela...');
    const createRes = await fetch(`${BASE_URL}/games`, { method: 'POST', headers });
    const createData = await createRes.json();
    const gameId = createData.id;

    await fetch(`${BASE_URL}/games/${gameId}/start`, { method: 'PATCH', headers });

    const joinRes = await fetch(`${BASE_URL}/games/${gameId}/join`, { method: 'POST', headers });
    const joinData = await joinRes.json();
    const cardId = joinData.card_id;
    console.log('   game_id:', gameId, '| card_id:', cardId);

    // ------------------------------------------------------------
    console.log('\n3. Conectando ao Socket.io...');
    const socket = io(BASE_URL);

    let eventoRecebido = null;

    socket.on('connect', () => {
        socket.emit('authenticate', { token });
    });

    socket.on('authenticated', () => {
        console.log('   Autenticado. Entrando na sala game:' + gameId + '...');
        socket.emit('join:game', { game_id: gameId });

        setTimeout(() => prepararEDeclarar(headers, gameId, cardId), 300);
    });

    socket.on('bingo:claimed', (data) => {
        eventoRecebido = data;
        console.log('\n5. Evento "bingo:claimed" recebido via WebSocket:', data);
    });

    // ------------------------------------------------------------
    async function prepararEDeclarar(headers, gameId, cardId) {
        console.log('\n4. Marcando manualmente todas as células da cartela...');
        await pool.query(
            `UPDATE card_cells SET is_marked = TRUE WHERE card_id = $1`,
            [cardId]
        );
        console.log('   Cartela marcada por completo.');

        console.log('\n   Disparando POST /games/' + gameId + '/bingo via HTTP...');
        const bingoRes = await fetch(`${BASE_URL}/games/${gameId}/bingo`, {
            method: 'POST',
            headers
        });
        const bingoData = await bingoRes.json();
        console.log('   Resposta HTTP do bingo:', bingoData);

        setTimeout(() => {
            console.log('\n6. Comparando resposta HTTP com evento recebido via socket...');

            if (!eventoRecebido) {
                console.log('   FALHA: nenhum evento "bingo:claimed" foi recebido.');
            } else {
                const bateUsername  = eventoRecebido.username === ADMIN_USERNAME;
                const bateCardId    = eventoRecebido.card_id === cardId;
                const bateClaimedAt = eventoRecebido.claimed_at === bingoData.claimed_at;

                console.log('   username bate:', bateUsername);
                console.log('   card_id bate:', bateCardId);
                console.log('   claimed_at bate:', bateClaimedAt);
            }

            socket.disconnect();
            pool.end();
            console.log('\nTeste concluído.');
            process.exit(0);
        }, 500);
    }
}

main();
