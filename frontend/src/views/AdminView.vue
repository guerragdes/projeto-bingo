<!--
  src/views/AdminView.vue

  Painel do administrador.
  Permite criar, iniciar e encerrar partidas, sortear números
  e visualizar as declarações de bingo recebidas em tempo real,
  em ordem cronológica (quem declarou primeiro aparece primeiro
  — ver decisão de design 3.4 da documentação: vence quem
  declarar primeiro).

  Reaproveita DrawBoard e DrawnBall, os mesmos componentes
  "burros" criados na Fase 7 para a tela do jogador — eles não
  sabem se estão sendo usados pelo admin ou por um jogador,
  só recebem dados via props e exibem.

  DIFERENÇA EM RELAÇÃO À GAMEVIEW: esta tela não usa polling
  para descobrir partidas criadas por OUTRO admin, pois o
  cenário do projeto assume um único administrador conduzindo
  o jogo por vez. Se isso mudar no futuro (múltiplos admins
  simultâneos), valeria reaproveitar o mesmo mecanismo de
  polling já implementado na GameView.
-->
<template>
  <div class="admin-page">
    <header class="admin-header">
      <h1 class="admin-title">Painel do Administrador</h1>
      <div class="user-info">
        <span class="username">{{ authStore.user?.username }}</span>
        <Button label="Sair" text size="small" @click="handleLogout" />
      </div>
    </header>

    <main class="admin-content">
      <!-- ------------------------------------------------------------
           Seção 1: status e controles da partida
      ------------------------------------------------------------- -->
      <section class="control-panel">
        <div class="status-row">
          <span class="status-label">Status da partida:</span>
          <span class="status-badge" :class="`status-${gameStatus}`">
            {{ statusLabel }}
          </span>
        </div>

        <div class="action-buttons">
          <Button
            label="Criar nova partida"
            :disabled="(gameStore.game && gameStore.game.status !== 'finished') || actionLoading"
            :loading="actionLoading === 'create'"
            @click="handleCreate"
          />

          <Button
            label="Iniciar sorteio"
            severity="success"
            :disabled="gameStore.game?.status !== 'waiting' || actionLoading"
            :loading="actionLoading === 'start'"
            @click="handleStart"
          />

          <Button
            label="Sortear número"
            severity="info"
            :disabled="gameStore.game?.status !== 'active' || actionLoading"
            :loading="actionLoading === 'draw'"
            @click="handleDraw"
          />

          <Button
            label="Encerrar partida"
            severity="danger"
            :disabled="!gameStore.game || gameStore.game.status === 'finished' || actionLoading"
            :loading="actionLoading === 'finish'"
            @click="handleFinish"
          />
        </div>

        <Message v-if="actionError" severity="error" :closable="true" @close="actionError = ''">
          {{ actionError }}
        </Message>
      </section>

      <!-- ------------------------------------------------------------
           Seção 2: bolinha + tabela de sorteio (mesmos componentes
           da GameView, reutilizados aqui sem nenhuma alteração)
      ------------------------------------------------------------- -->
      <section v-if="gameStore.game" class="draw-panel">
        <DrawnBall :latest="latestDraw" />
        <DrawBoard
          :drawn-numbers="gameStore.drawnNumbers"
          :latest-number="latestDraw?.number ?? null"
        />
      </section>

      <!-- ------------------------------------------------------------
           Seção 3: declarações de bingo, em ordem cronológica
           (tarefa 43) — o primeiro da lista é o vencedor, conforme
           a decisão de design documentada.
      ------------------------------------------------------------- -->
      <section class="claims-panel">
        <h2 class="claims-title">Declarações de Bingo</h2>

        <p v-if="sortedClaims.length === 0" class="claims-empty">
          Nenhuma declaração de bingo recebida ainda.
        </p>

        <ol v-else class="claims-list">
          <li
            v-for="(claim, index) in sortedClaims"
            :key="claim.claimed_at"
            class="claim-item"
            :class="{ winner: index === 0 }"
          >
            <span class="claim-position">
              {{ index === 0 ? '🏆' : `${index + 1}º` }}
            </span>
            <span class="claim-username">{{ claim.username }}</span>
            <span class="claim-time">{{ formatTime(claim.claimed_at) }}</span>
          </li>
        </ol>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';

import Button from 'primevue/button';
import Message from 'primevue/message';

import { useAuthStore } from '../stores/auth.store';
import { useGameStore } from '../stores/game.store';
import { connectSocket, disconnectSocket } from '../services/socket';

import DrawBoard from '../components/DrawBoard.vue';
import DrawnBall from '../components/DrawnBall.vue';

const router = useRouter();
const authStore = useAuthStore();
const gameStore = useGameStore();

// Controla qual ação está em andamento ('create' | 'start' | 'draw' |
// 'finish' | null), para desabilitar todos os botões durante
// qualquer requisição e mostrar o spinner só no botão certo.
const actionLoading = ref(null);
const actionError = ref('');

const gameStatus = computed(() => gameStore.game?.status ?? 'none');

const statusLabel = computed(() => {
  const labels = {
    none: 'Nenhuma partida ativa',
    waiting: 'Aguardando início',
    active: 'Em andamento',
    finished: 'Encerrada'
  };
  return labels[gameStatus.value];
});

const latestDraw = computed(() => {
  if (gameStore.draws.length === 0) return null;
  return gameStore.draws[gameStore.draws.length - 1];
});

// Mesma lógica de ordenação por claimed_at usada na GameView —
// garante que o primeiro da lista seja sempre quem declarou
// bingo primeiro, mesmo que os eventos cheguem fora de ordem
// pela rede em algum caso raro.
const sortedClaims = computed(() => {
  return [...gameStore.bingoClaims].sort(
    (a, b) => new Date(a.claimed_at) - new Date(b.claimed_at)
  );
});

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('pt-BR');
}

// ------------------------------------------------------------
// refreshGameState()
//
// Busca a partida ativa e, se houver uma, entra na sala do
// socket e recupera o histórico de sorteios. Permite que o
// admin recarregue a página no meio de uma partida sem perder
// o controle dela — mesmo princípio de reconexão (RNF05)
// já aplicado na GameView.
// ------------------------------------------------------------
async function refreshGameState() {
  await gameStore.fetchActiveGame();

  if (gameStore.game) {
    gameStore.joinSocketRoom(gameStore.game.id);
    await gameStore.fetchDrawHistory(gameStore.game.id);
  }
}

// ------------------------------------------------------------
// Handlers das quatro ações de gerenciamento da partida.
// Cada um segue o mesmo padrão: trava os botões, chama a
// action correspondente da game.store, e trata erros vindos
// do backend (por exemplo, 409 ao tentar criar uma segunda
// partida simultânea).
// ------------------------------------------------------------
async function handleCreate() {
  actionLoading.value = 'create';
  actionError.value = '';

  try {
    // Limpa sorteios/declarações da partida anterior ANTES de
    // criar a nova, para a tela não exibir dados desatualizados
    // por uma fração de segundo.
    gameStore.clearDrawsAndClaims();

    await gameStore.createGame();
    gameStore.joinSocketRoom(gameStore.game.id);

  } catch (err) {
    actionError.value = err.response?.data?.error || 'Erro ao criar partida.';
  } finally {
    actionLoading.value = null;
  }
}

async function handleStart() {
  actionLoading.value = 'start';
  actionError.value = '';

  try {
    await gameStore.startGame(gameStore.game.id);
    // Não precisa atualizar gameStore.game aqui: o próprio admin
    // está na sala da partida (joinSocketRoom já foi chamado em
    // handleCreate ou em refreshGameState), então o evento
    // 'game:started' emitido pelo backend volta para este mesmo
    // socket e atualiza o status automaticamente.
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Erro ao iniciar partida.';
  } finally {
    actionLoading.value = null;
  }
}

async function handleDraw() {
  actionLoading.value = 'draw';
  actionError.value = '';

  try {
    await gameStore.drawNumber(gameStore.game.id);
    // Mesmo raciocínio: o resultado chega via evento 'number:drawn',
    // não pela resposta desta chamada (ver comentário em game.store.js).
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Erro ao sortear número.';
  } finally {
    actionLoading.value = null;
  }
}

async function handleFinish() {
  actionLoading.value = 'finish';
  actionError.value = '';

  try {
    await gameStore.finishGame(gameStore.game.id);
  } catch (err) {
    actionError.value = err.response?.data?.error || 'Erro ao encerrar partida.';
  } finally {
    actionLoading.value = null;
  }
}

function handleLogout() {
  disconnectSocket();
  gameStore.reset();
  authStore.logout();
  router.push('/login');
}

onMounted(() => {
  connectSocket();
  gameStore.initSocketListeners();
  refreshGameState();
});
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: #f8fafc;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  background: #1e293b;
  color: #ffffff;
}

.admin-title {
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

.admin-content {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}

.control-panel,
.claims-panel {
  background: #ffffff;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.status-label {
  font-weight: 600;
  color: #475569;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #ffffff;
}

.status-none     { background: #94a3b8; }
.status-waiting  { background: #d97706; }
.status-active   { background: #16a34a; }
.status-finished { background: #475569; }

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.draw-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.claims-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.claims-empty {
  color: #94a3b8;
  margin: 0;
}

.claims-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.claim-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: #f1f5f9;
}

.claim-item.winner {
  background: #fef9c3;
  border: 1px solid #facc15;
}

.claim-position {
  font-weight: 700;
  width: 2rem;
  text-align: center;
}

.claim-username {
  flex: 1;
  font-weight: 600;
  color: #1e293b;
}

.claim-time {
  font-size: 0.85rem;
  color: #64748b;
}
</style>