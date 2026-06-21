// ============================================================
// src/stores/game.store.js
//
// Store Pinia do estado da partida.
//
// Armazena os dados da partida atual, a cartela do jogador,
// os números já sorteados e as declarações de bingo recebidas.
//
// É atualizada de DUAS formas diferentes:
//   - Requisições HTTP (via api.js) -> ações como joinGame,
//     drawNumber, claimBingo, que conversam com o backend.
//   - Eventos Socket.io (via socket.js) -> a função
//     initSocketListeners() escuta os 4 eventos em tempo real
//     (game:started, number:drawn, bingo:claimed, game:finished)
//     e atualiza o estado automaticamente quando QUALQUER
//     jogador conectado dispara uma ação — inclusive o próprio
//     usuário local, já que o backend emite para toda a sala,
//     incluindo quem originou a ação.
//
// Por isso as ações HTTP de sorteio/bingo NÃO atualizam o
// estado diretamente a partir da resposta da requisição —
// a atualização chega de qualquer forma pelo socket, e confiar
// só nele evita atualizar o estado duas vezes (uma pela
// resposta HTTP, outra pelo evento).
// ============================================================

import { defineStore } from 'pinia';
import api from '../services/api';
import { getSocket } from '../services/socket';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

export const useGameStore = defineStore('game', {

    state: () => ({
        game: null,          // { id, status, created_by, started_at, finished_at, created_at }
        card: null,          // { card_id, game_id, is_complete, cells: {...}, marked: {...} }
        draws: [],           // [ { drawn_order, letter, number, drawn_at } ]
        bingoClaims: [],     // [ { username, card_id, claimed_at } ] — apenas declarações válidas
        listenersReady: false // evita registrar os listeners do socket mais de uma vez
    }),

    getters: {
        // Números já sorteados, como array simples — útil para
        // o DrawBoard destacar quais números já saíram.
        drawnNumbers: (state) => state.draws.map(d => d.number),

        // true se a cartela local está com todas as 25 células
        // marcadas. É um indicador VISUAL para habilitar o botão
        // de bingo mais cedo — a validação real e definitiva
        // sempre acontece no servidor, em claimBingo().
        isCardComplete: (state) => {
            if (!state.card) return false;

            return LETTERS.every(letter =>
                state.card.marked[letter].every(isMarked => isMarked === true)
            );
        }
    },

    actions: {
        // ------------------------------------------------------------
        // fetchActiveGame()
        //
        // Busca a partida em andamento (status waiting ou active).
        // Se não houver nenhuma, define game como null —
        // o backend responde 204 (sem corpo) nesse caso.
        // ------------------------------------------------------------
        async fetchActiveGame() {
            try {
                const response = await api.get('/games/active');
                this.game = response.data;
            } catch (err) {
                if (err.response?.status === 204) {
                    this.game = null;
                } else {
                    throw err;
                }
            }
        },

        // ------------------------------------------------------------
        // joinGame(gameId)
        //
        // Entra na partida e recebe a cartela (nova ou existente).
        // Guarda o resultado em this.card.
        // ------------------------------------------------------------
        async joinGame(gameId) {
            const response = await api.post(`/games/${gameId}/join`);
            this.card = response.data;
        },

        // ------------------------------------------------------------
        // fetchDrawHistory(gameId)
        //
        // Busca o histórico completo de sorteios da partida.
        // Útil ao entrar numa partida já em andamento, para
        // recuperar os números que já saíram antes da conexão
        // deste jogador (ver RNF05 da documentação — reconexão).
        // ------------------------------------------------------------
        async fetchDrawHistory(gameId) {
            const response = await api.get(`/games/${gameId}/draws`);
            this.draws = response.data;
        },

        // ------------------------------------------------------------
        // drawNumber(gameId)
        //
        // Solicita ao backend que sorteie o próximo número.
        // Usada apenas pelo admin (AdminView). NÃO atualiza o
        // estado diretamente — a atualização chega pelo evento
        // 'number:drawn' (ver initSocketListeners), que dispara
        // para todos os conectados, incluindo o próprio admin.
        // ------------------------------------------------------------
        async drawNumber(gameId) {
            await api.post(`/games/${gameId}/draw`);
        },

        // ------------------------------------------------------------
        // claimBingo(gameId)
        //
        // Declara bingo na partida atual. Retorna o resultado
        // ({ is_valid, marked_cells, total_cells, claimed_at? })
        // para que o componente que chamou (BingoButton) possa
        // dar feedback imediato ao jogador — por exemplo, avisar
        // "sua cartela ainda não está completa" se is_valid for false.
        // ------------------------------------------------------------
        async claimBingo(gameId) {
            const response = await api.post(`/games/${gameId}/bingo`);
            return response.data;
        },

        // ------------------------------------------------------------
        // createGame() / startGame(gameId) / finishGame(gameId)
        //
        // Ações exclusivas do admin para gerenciar o ciclo de
        // vida da partida. createGame() atualiza o estado
        // diretamente (não existe evento de socket para criação,
        // só para início e encerramento). startGame/finishGame
        // não precisam atualizar o estado na resposta — os
        // eventos 'game:started'/'game:finished' cuidam disso.
        // ------------------------------------------------------------
        async createGame() {
            const response = await api.post('/games');
            this.game = response.data;
        },

        async startGame(gameId) {
            await api.patch(`/games/${gameId}/start`);
        },

        async finishGame(gameId) {
            await api.patch(`/games/${gameId}/finish`);
        },

        // ------------------------------------------------------------
        // joinSocketRoom(gameId)
        //
        // Emite 'join:game' para o servidor, colocando este socket
        // na sala da partida. Sem isso, os eventos em tempo real
        // (number:drawn, bingo:claimed, etc.) nunca chegariam até
        // este cliente, mesmo estando conectado ao Socket.io.
        // ------------------------------------------------------------
        joinSocketRoom(gameId) {
            getSocket().emit('join:game', { game_id: gameId });
        },

        // ------------------------------------------------------------
        // initSocketListeners()
        //
        // Registra os 4 listeners de eventos em tempo real.
        // Deve ser chamada uma vez, depois de connectSocket(),
        // normalmente no onMounted() da GameView ou AdminView.
        //
        // O guard `listenersReady` evita registrar os mesmos
        // listeners várias vezes caso o componente seja remontado
        // (o que duplicaria os efeitos — por exemplo, cada número
        // sorteado apareceria duas vezes na lista de draws).
        // ------------------------------------------------------------
        initSocketListeners() {
            if (this.listenersReady) return;

            const socket = getSocket();

            socket.on('game:started', () => {
                if (this.game) {
                    this.game.status = 'active';
                }
            });

            socket.on('number:drawn', (data) => {
                this.draws.push(data);
                this._markNumberOnCard(data.number);
            });

            socket.on('bingo:claimed', (data) => {
                this.bingoClaims.push(data);
            });

            socket.on('game:finished', () => {
                if (this.game) {
                    this.game.status = 'finished';
                }
            });

            this.listenersReady = true;
        },

        // ------------------------------------------------------------
        // _markNumberOnCard(number) — função auxiliar interna
        //
        // Procura o número sorteado nas 5 colunas da cartela local
        // e marca a posição correspondente em card.marked, se
        // encontrado. O prefixo "_" indica que é de uso interno
        // da store, não chamada diretamente pelos componentes.
        //
        // Esta marcação é só para refletir o estado visualmente
        // mais rápido; a marcação OFICIAL já aconteceu no banco,
        // no momento do sorteio (ver draw.service.js no backend).
        // ------------------------------------------------------------
        _markNumberOnCard(number) {
            if (!this.card) return;

            for (const letter of LETTERS) {
                const index = this.card.cells[letter].indexOf(number);
                if (index !== -1) {
                    this.card.marked[letter][index] = true;
                }
            }
        },

        // ------------------------------------------------------------
        // clearDrawsAndClaims()
        //
        // Limpa apenas o histórico de sorteios e as declarações de
        // bingo, SEM mexer em game, card ou listenersReady.
        //
        // Usada pelo AdminView ao criar uma nova partida: os
        // arrays de draws/bingoClaims da partida anterior (já
        // encerrada) ainda estão na store e precisam ser zerados
        // para não exibir dados antigos junto da partida nova.
        //
        // Por que não usar reset() para isso? reset() também
        // zera listenersReady, mas os listeners continuam de
        // fato registrados no socket (o objeto socket não foi
        // recriado) — zerar a flag sem recriar o socket faria
        // initSocketListeners() registrar os mesmos listeners
        // de novo, duplicando o processamento de cada evento.
        // ------------------------------------------------------------
        clearDrawsAndClaims() {
            this.draws = [];
            this.bingoClaims = [];
        },

        // ------------------------------------------------------------
        // reset()
        //
        // Limpa todo o estado da partida. Chamada ao sair da
        // tela do jogo ou ao fazer logout, para que o próximo
        // jogador (ou a próxima partida) comece com estado limpo.
        // ------------------------------------------------------------
        reset() {
            this.game = null;
            this.card = null;
            this.draws = [];
            this.bingoClaims = [];
            this.listenersReady = false;
        }
    }
});