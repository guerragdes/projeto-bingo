<!--
  src/views/GameView.vue

  Tela principal do jogador. Integra todos os componentes da
  Fase 7: BingoCard, DrawBoard, DrawnBall e BingoButton, e
  orquestra a inicialização do socket e o ciclo de vida da
  partida (aguardando -> em andamento -> encerrada -> próxima).

  RESPONSABILIDADES DESTA TELA:
    1. Conectar ao Socket.io e registrar os listeners (uma vez)
    2. Buscar a partida ativa ao montar
    3. Se houver partida: entrar nela (cartela), entrar na sala
       do socket, e recuperar o histórico de sorteios (RNF05 —
       reconexão: se o jogador atualizar a página no meio do
       jogo, ele recupera tudo onde parou)
    4. Se NÃO houver partida: ficar em modo de espera, verificando
       periodicamente (polling) se o admin já criou uma nova

  POR QUE POLLING PARA DESCOBRIR NOVA PARTIDA?
  Os eventos em tempo real (game:started etc.) só chegam a quem
  já está na "sala" daquela partida específica (ver socket/index.js
  do backend, io.to(`game:<id>`).emit(...)). Mas para entrar numa
  sala é preciso saber o ID da partida — e enquanto nenhuma
  partida existe, não há ID algum para se inscrever. Por isso,
  quando não há partida ativa, esta tela consulta o backend a
  cada poucos segundos (GET /games/active) até encontrar uma.
  Isso é uma limitação conhecida e aceitável para o escopo do
  projeto; numa versão futura, poderia ser resolvida com uma
  "sala global" no Socket.io que avisasse todos os clientes
  conectados assim que uma partida fosse criada.
-->
<template>
  <div class="game-page">
    <header class="game-header">
      <h1 class="game-title">Bingo</h1>
      <div class="user-info">
        <span class="username">{{ authStore.user?.username }}</span>
        <Button label="Sair" text size="small" @click="handleLogout" />
      </div>
    </header>

    <main class="game-content">
      <!-- ESTADO 1: nenhuma partida ativa no momento -->
      <div v-if="!gameStore.game" class="waiting-panel">
        <ProgressSpinner style="width: 42px; height: 42px" strokeWidth="4" />
        <p>Aguardando o administrador iniciar uma nova partida...</p>
      </div>

      <!-- ESTADO 2: partida foi encerrada (mostra resultado por alguns segundos) -->
      <div v-else-if="gameStore.game.status === 'finished'" class="waiting-panel">
        <p class="finished-title">Partida encerrada!</p>

        <div v-if="sortedClaims.length > 0" class="winners-list">
          <p class="winners-label">Jogadores que completaram a cartela:</p>
          <ol>
            <li v-for="claim in sortedClaims" :key="claim.claimed_at">
              {{ claim.username }}
            </li>
          </ol>
        </div>
        <p v-else class="no-winners">Ninguém completou a cartela nesta partida.</p>

        <p class="next-game-hint">Aguardando a próxima partida...</p>
      </div>

      <!-- ESTADO 3: partida em andamento (waiting ou active) -->
      <div v-else class="game-layout">
        <Message
          v-if="gameStore.game.status === 'waiting'"
          severity="info"
          :closable="false"
          class="status-banner"
        >
          Partida criada. Aguardando o administrador iniciar o sorteio.
        </Message>

        <div class="game-columns">
          <section class="draw-section">
            <DrawnBall :latest="latestDraw" />
            <DrawBoard
              :drawn-numbers="gameStore.drawnNumbers"
              :latest-number="latestDraw?.number ?? null"
            />
          </section>

          <section class="card-section">
            <BingoCard :card="gameStore.card" />
            <BingoButton :game-id="gameStore.game.id" />
          </section>
        </div>
      </div>

      <Message v-if="loadError" severity="error" :closable="false" class="error-banner">
        {{ loadError }}
      </Message>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';

import { useAuthStore } from '../stores/auth.store';
import { useGameStore } from '../stores/game.store';
import { connectSocket, disconnectSocket } from '../services/socket';

import BingoCard from '../components/BingoCard.vue';
import DrawBoard from '../components/DrawBoard.vue';
import DrawnBall from '../components/DrawnBall.vue';
import BingoButton from '../components/BingoButton.vue';

const POLL_INTERVAL_MS = 4000;

const router = useRouter();
const authStore = useAuthStore();
const gameStore = useGameStore();

const loadError = ref('');
const pollIntervalId = ref(null);

// O sorteio mais recente, derivado do array de sorteios da
// store. Usado tanto pelo DrawnBall (a bolinha) quanto pelo
// DrawBoard (para destacar o número mais novo na tabela).
const latestDraw = computed(() => {
  if (gameStore.draws.length === 0) return null;
  return gameStore.draws[gameStore.draws.length - 1];
});

// Declarações de bingo válidas, ordenadas por claimed_at.
// Embora elas normalmente já cheguem em ordem (são processadas
// sequencialmente pelo backend), ordenar de novo aqui é uma
// proteção barata contra qualquer caso raro de eventos chegando
// fora de ordem pela rede.
const sortedClaims = computed(() => {
  return [...gameStore.bingoClaims].sort(
    (a, b) => new Date(a.claimed_at) - new Date(b.claimed_at)
  );
});

// ------------------------------------------------------------
// enterGame(gameId)
//
// Entra de fato numa partida específica: busca/gera a cartela,
// entra na sala do socket, e recupera o histórico de sorteios
// (para o caso de reconexão no meio de uma partida já iniciada).
// ------------------------------------------------------------
async function enterGame(gameId) {
  await gameStore.joinGame(gameId);
  gameStore.joinSocketRoom(gameId);
  await gameStore.fetchDrawHistory(gameId);
}

// ------------------------------------------------------------
// checkForGame()
//
// Consulta GET /games/active. Se encontrar uma partida, entra
// nela e para o polling. Se não encontrar, garante que o
// polling está rodando para tentar de novo em alguns segundos.
// ------------------------------------------------------------
async function checkForGame() {
  try {
    await gameStore.fetchActiveGame();

    if (gameStore.game) {
      stopPolling();
      await enterGame(gameStore.game.id);
    } else {
      startPolling();
    }

  } catch (err) {
    loadError.value = 'Não foi possível verificar a partida ativa. Tentando novamente...';
  }
}

function startPolling() {
  if (pollIntervalId.value) return; // já está rodando, evita duplicar
  pollIntervalId.value = setInterval(checkForGame, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollIntervalId.value) {
    clearInterval(pollIntervalId.value);
    pollIntervalId.value = null;
  }
}

// ------------------------------------------------------------
// Observa o status da partida. Quando ela é encerrada
// (status muda para 'finished'), aguarda alguns segundos
// exibindo o resultado, depois reseta o estado local e volta
// a procurar a próxima partida — completando o ciclo descrito
// na decisão de design "a cartela persiste até uma nova
// partida começar" (RF07 da documentação).
// ------------------------------------------------------------
watch(
  () => gameStore.game?.status,
  (newStatus, oldStatus) => {
    if (newStatus === 'finished' && oldStatus !== 'finished') {
      setTimeout(() => {
        gameStore.reset();
        checkForGame();
      }, 6000);
    }
  }
);

// ------------------------------------------------------------
// handleLogout()
//
// Encerra a sessão: desconecta o socket, limpa a auth.store
// e a game.store, e volta para a tela de login.
// ------------------------------------------------------------
function handleLogout() {
  stopPolling();
  disconnectSocket();
  gameStore.reset();
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  connectSocket();
  gameStore.initSocketListeners();
  checkForGame();
});

onUnmounted(() => {
  stopPolling();
});
</script>

<style scoped>
.game-page {
  min-height: 100vh;
  background: #f8fafc;
}

.game-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #1e293b;
  color: #ffffff;
}

.game-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 800;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.username {
  font-weight: 600;
  font-size: 0.9rem;
}

.game-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.waiting-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 1rem;
  text-align: center;
  color: #475569;
}

.finished-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
}

.winners-list {
  background: #ffffff;
  border-radius: 10px;
  padding: 1rem 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.winners-label {
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.no-winners {
  color: #94a3b8;
}

.next-game-hint {
  font-size: 0.85rem;
  color: #94a3b8;
}

.status-banner {
  margin-bottom: 0.5rem;
}

.game-layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.game-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: flex-start;
  justify-content: center;
}

.draw-section,
.card-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.error-banner {
  margin-top: 1rem;
}
</style>