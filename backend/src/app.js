// ============================================================
// src/app.js
//
// Ponto de entrada do servidor Express.
// Inicializa o app, registra os middlewares globais,
// conecta as rotas e sobe o servidor HTTP na porta definida
// no .env. É o arquivo que o nodemon monitora com npm run dev.
//
// As importações de rotas e do Socket.io estão comentadas
// e serão descomentadas conforme cada parte for implementada.
// ============================================================

require('dotenv').config();

const express = require('express');
const http    = require('http');
const cors    = require('cors');

const app    = express();
const server = http.createServer(app);

// ------------------------------------------------------------
// Middlewares globais
//
// cors()         → permite que o frontend (porta 5173) se
//                  comunique com o backend (porta 3000)
// express.json() → interpreta o corpo das requisições como JSON
// ------------------------------------------------------------
app.use(cors());
app.use(express.json());

// ------------------------------------------------------------
// Rotas
// Cada linha será descomentada quando o arquivo correspondente
// estiver implementado.
// ------------------------------------------------------------

const authRoutes = require('./routes/auth.routes');
// const adminRoutes = require('./routes/admin.routes');
// const gameRoutes  = require('./routes/game.routes');

app.use('/auth', authRoutes);
// app.use('/admin', adminRoutes);
// app.use('/games', gameRoutes);

// ------------------------------------------------------------
// Rota de teste
// Confirma que o servidor está respondendo.
// Pode ser removida quando as rotas reais estiverem prontas.
// ------------------------------------------------------------
app.get('/', (req, res) => {
    res.json({ message: 'Servidor Bingo funcionando.' });
});

// ------------------------------------------------------------
// Socket.io
// Será descomentado quando src/socket/index.js estiver pronto.
// ------------------------------------------------------------

// const initSocket = require('./socket');
// initSocket(server);

// ------------------------------------------------------------
// Inicialização do servidor
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = { app, server };