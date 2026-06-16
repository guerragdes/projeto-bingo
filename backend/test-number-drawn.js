// ============================================================
// test-number-drawn.js
//
// Testa se o evento 'number:drawn' é emitido corretamente
// quando um número é sorteado via POST /games/:id/draw.
//
// Fluxo:
//   1. Login HTTP como admin
//   2. Criar e iniciar uma nova partida
//   3. Conectar ao Socket.io, autenticar e entrar na sala da partida
//   4. Registrar um listener para 'number:drawn'
//   5. Disparar POST /games/:id/draw via HTTP (fetch comum)
//   6. Verificar se o listener recebeu o evento, e se os dados
//      batem com a resposta HTTP da requisição de sorteio
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-number-drawn.js
// ============================================================

const { io } = require('socket.io-client');

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
    console.log('\n2. Criando e iniciando nova partida...');
    const createRes = await fetch(`${BASE_URL}/games`, { method: 'POST', headers });
    const createData = await createRes.json();
    const gameId = createData.id;

    await fetch(`${BASE_URL}/games/${gameId}/start`, { method: 'PATCH', headers });
    console.log('   game_id:', gameId, '(partida ativa)');

    // ------------------------------------------------------------
    console.log('\n3. Conectando ao Socket.io...');
    const socket = io(BASE_URL);

    socket.on('connect', () => {
        console.log('   Conectado. Autenticando...');
        socket.emit('authenticate', { token });
    });

    socket.on('authenticated', () => {
        console.log('   Autenticado. Entrando na sala game:' + gameId + '...');
        socket.emit('join:game', { game_id: gameId });

        // Pequeno delay para garantir que o servidor processou o
        // join:game antes de disparar o sorteio via HTTP.
        setTimeout(() => dispararSorteio(headers, gameId), 300);
    });

    // ------------------------------------------------------------
    // Listener do evento que estamos testando.
    // ------------------------------------------------------------
    let eventoRecebido = null;

    socket.on('number:drawn', (data) => {
        eventoRecebido = data;
        console.log('\n4. Evento "number:drawn" recebido via WebSocket:', data);
    });

    // ------------------------------------------------------------
    async function dispararSorteio(headers, gameId) {
        console.log('\n5. Disparando POST /games/' + gameId + '/draw via HTTP...');
        const drawRes = await fetch(`${BASE_URL}/games/${gameId}/draw`, {
            method: 'POST',
            headers
        });
        const drawData = await drawRes.json();
        console.log('   Resposta HTTP do sorteio:', drawData);

        // Dá um tempo para o evento WebSocket chegar antes de comparar.
        setTimeout(() => {
            console.log('\n6. Comparando resposta HTTP com evento recebido via socket...');

            if (!eventoRecebido) {
                console.log('   FALHA: nenhum evento "number:drawn" foi recebido.');
            } else {
                const bateNumero = eventoRecebido.number === drawData.number;
                const bateLetra  = eventoRecebido.letter === drawData.letter;
                const bateOrdem  = eventoRecebido.drawn_order === drawData.drawn_order;

                console.log('   número bate:', bateNumero);
                console.log('   letra bate:', bateLetra);
                console.log('   drawn_order bate:', bateOrdem);
            }

            socket.disconnect();
            console.log('\nTeste concluído.');
            process.exit(0);
        }, 500);
    }
}

main();