// ============================================================
// src/socket/index.js
//
// Configura o servidor Socket.io e expõe a instância para
// que outros arquivos (services, rotas) possam emitir eventos
// em tempo real, sem precisar receber `io` como parâmetro em
// toda chamada de função (padrão singleton).
//
// Uso em outros arquivos:
//   const { getIO } = require('../socket');
//   getIO().to(`game:${gameId}`).emit('number:drawn', { ... });
//
// Fluxo de conexão de um cliente:
//   1. Cliente conecta ao Socket.io (após já ter feito login via HTTP)
//   2. Cliente emite 'authenticate' com o token JWT
//   3. Servidor valida o token e anexa os dados do usuário ao socket
//   4. Cliente emite 'join:game' com o ID da partida
//   5. Servidor coloca o socket numa "sala" exclusiva da partida
//      (todas as emissões de eventos daquela partida vão só
//      para quem está nessa sala — não para todo mundo conectado)
// ============================================================

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Variável de módulo: guarda a única instância do Socket.io
// depois que initSocket() for chamado uma vez no app.js.
let io = null;

// ------------------------------------------------------------
// initSocket(server)
//
// Inicializa o servidor Socket.io acoplado ao servidor HTTP
// do Express (o mesmo `server` criado em app.js com
// http.createServer). Deve ser chamado uma única vez,
// na inicialização da aplicação.
// ------------------------------------------------------------
function initSocket(server) {
    io = new Server(server, {
        cors: {
            // Em desenvolvimento, libera qualquer origem.
            // Em produção, restrinja ao domínio real do frontend.
            origin: '*'
        }
    });

    io.on('connection', (socket) => {
        console.log('Cliente conectado via Socket.io:', socket.id);

        // ------------------------------------------------------------
        // Evento: authenticate
        //
        // O cliente envia o token JWT (o mesmo obtido no login HTTP).
        // Se válido, os dados do usuário ficam disponíveis em
        // socket.user para uso em eventos futuros deste mesmo socket.
        // ------------------------------------------------------------
        socket.on('authenticate', ({ token }) => {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.user = decoded;
                socket.emit('authenticated', { username: decoded.username });
            } catch (err) {
                socket.emit('error', { message: 'Token inválido ou expirado.' });
            }
        });

        // ------------------------------------------------------------
        // Evento: join:game
        //
        // Coloca este socket numa "sala" (room) exclusiva da partida.
        // Exige que o socket já tenha sido autenticado antes.
        //
        // socket.join() é um recurso nativo do Socket.io: cada sala
        // é identificada por uma string qualquer (aqui usamos
        // "game:<id>"). Eventos emitidos com io.to('game:5').emit()
        // só chegam aos sockets que estão dentro dessa sala.
        // ------------------------------------------------------------
        socket.on('join:game', ({ game_id }) => {
            if (!socket.user) {
                socket.emit('error', { message: 'Autentique-se antes de entrar na partida.' });
                return;
            }

            socket.join(`game:${game_id}`);
            console.log(`Usuário ${socket.user.username} entrou na sala game:${game_id}`);
        });

        socket.on('disconnect', () => {
            console.log('Cliente desconectado:', socket.id);
        });
    });

    return io;
}

// ------------------------------------------------------------
// getIO()
//
// Retorna a instância do Socket.io já inicializada.
// Lança erro se for chamado antes de initSocket() —
// isso evita um bug silencioso onde um service tentaria
// emitir um evento para um `io` que ainda não existe.
// ------------------------------------------------------------
function getIO() {
    if (!io) {
        throw new Error('Socket.io ainda não foi inicializado. Chame initSocket(server) primeiro.');
    }
    return io;
}

module.exports = { initSocket, getIO };