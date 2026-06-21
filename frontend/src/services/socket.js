// ============================================================
// src/services/socket.js
//
// Gerencia a conexão com o servidor de WebSocket (Socket.io).
//
// Segue o mesmo padrão "singleton" usado no backend
// (src/socket/index.js): uma única instância de socket é
// criada e reutilizada por toda a aplicação, em vez de cada
// componente abrir sua própria conexão.
//
// Por que não conectar automaticamente ao carregar o arquivo?
// O socket só deve conectar DEPOIS do login, porque a
// autenticação do socket depende do token JWT, que só existe
// na auth.store após authStore.login() ser chamado. Por isso
// a conexão é manual, via connectSocket(), chamada pela
// GameView ao montar (ver tarefa 38).
//
// Uso em outros arquivos:
//   import { connectSocket, getSocket, disconnectSocket } from '../services/socket';
//
//   connectSocket();                          // ao entrar na tela do jogo
//   getSocket().emit('join:game', { game_id }); // entrar na sala da partida
//   getSocket().on('number:drawn', (data) => { ... });
//   disconnectSocket();                       // ao sair da tela / logout
// ============================================================

import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/auth.store';

const BASE_URL = 'http://localhost:3000';

let socket = null;

// ------------------------------------------------------------
// connectSocket()
//
// Cria a conexão (se ainda não existir) e autentica
// automaticamente assim que ela abrir, usando o token JWT
// atual da auth.store.
//
// Retorna a instância do socket, já com os listeners de
// conexão e autenticação configurados.
//
// Chamar esta função mais de uma vez não cria conexões
// duplicadas — se já existir um socket conectado, ele é
// reaproveitado.
// ------------------------------------------------------------
function connectSocket() {
    if (socket && socket.connected) {
        return socket;
    }

    const authStore = useAuthStore();

    socket = io(BASE_URL);

    socket.on('connect', () => {
        console.log('[socket] Conectado:', socket.id);

        // Autentica assim que a conexão abre, usando o token
        // atual da store. Sem isso, o servidor rejeitaria
        // qualquer tentativa de 'join:game' (ver socket/index.js
        // do backend, que exige socket.user antes de aceitar).
        socket.emit('authenticate', { token: authStore.token });
    });

    socket.on('authenticated', (data) => {
        console.log('[socket] Autenticado como:', data.username);
    });

    socket.on('error', (data) => {
        console.error('[socket] Erro retornado pelo servidor:', data.message);
    });

    socket.on('disconnect', () => {
        console.log('[socket] Desconectado.');
    });

    return socket;
}

// ------------------------------------------------------------
// getSocket()
//
// Retorna a instância já conectada do socket.
// Lança erro se chamado antes de connectSocket() — isso evita
// um bug silencioso onde um componente tentaria escutar ou
// emitir eventos num socket que ainda não existe.
// ------------------------------------------------------------
function getSocket() {
    if (!socket) {
        throw new Error('Socket ainda não foi conectado. Chame connectSocket() primeiro.');
    }
    return socket;
}

// ------------------------------------------------------------
// disconnectSocket()
//
// Encerra a conexão e libera a referência, para que uma
// próxima chamada a connectSocket() crie uma conexão nova
// (com um socket.id diferente). Deve ser chamada ao sair da
// tela do jogo ou ao fazer logout, evitando que o socket
// continue recebendo eventos de uma partida que o usuário
// já não está mais acompanhando.
// ------------------------------------------------------------
function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}

export { connectSocket, getSocket, disconnectSocket };