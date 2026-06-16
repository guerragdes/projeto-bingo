// ============================================================
// test-socket.js
//
// Teste rápido de "handshake" do Socket.io — confirma que:
//   1. O servidor aceita conexões WebSocket
//   2. O evento 'authenticate' valida o token JWT corretamente
//   3. O evento 'join:game' coloca o socket na sala da partida
//
// Este teste NÃO verifica number:drawn nem bingo:claimed —
// esses eventos ainda não foram implementados nos services.
// Esse teste mais completo vem na tarefa 25, ao final da Fase 5.
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-socket.js
// ============================================================

const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

async function main() {
    // ------------------------------------------------------------
    console.log('1. Login HTTP como admin (para obter o token)...');
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
    console.log('   token obtido com sucesso.');

    // ------------------------------------------------------------
    console.log('\n2. Conectando ao servidor via WebSocket...');
    const socket = io(BASE_URL);

    socket.on('connect', () => {
        console.log('   Conectado! socket.id:', socket.id);

        // ------------------------------------------------------------
        console.log('\n3. Enviando evento "authenticate" com o token...');
        socket.emit('authenticate', { token });
    });

    // ------------------------------------------------------------
    // Resposta esperada do servidor após autenticação válida
    // ------------------------------------------------------------
    socket.on('authenticated', (data) => {
        console.log('   Autenticado com sucesso:', data);

        // ------------------------------------------------------------
        console.log('\n4. Enviando evento "join:game" para a partida de teste (game_id: 1)...');
        socket.emit('join:game', { game_id: 1 });

        // Aguarda um instante e finaliza o teste.
        // (join:game não emite uma resposta de confirmação ao cliente,
        // mas o terminal do servidor deve mostrar a mensagem de log
        // "Usuário admin entrou na sala game:1")
        setTimeout(() => {
            console.log('\n5. Encerrando conexão de teste.');
            socket.disconnect();
            console.log('\nTeste concluído. Verifique o terminal do servidor');
            console.log('para confirmar a mensagem de log do join:game.');
            process.exit(0);
        }, 1000);
    });

    // ------------------------------------------------------------
    // Caso o token seja rejeitado (não deveria acontecer neste teste)
    // ------------------------------------------------------------
    socket.on('error', (data) => {
        console.log('   Erro retornado pelo servidor:', data);
        socket.disconnect();
        process.exit(1);
    });

    socket.on('connect_error', (err) => {
        console.log('   Erro ao conectar:', err.message);
        process.exit(1);
    });
}

main();