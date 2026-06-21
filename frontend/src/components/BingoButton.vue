<!--
  src/components/BingoButton.vue

  Componente do botão de declaração de bingo.
  Fica desabilitado enquanto a cartela não estiver completa
  (RF14). Ao ser pressionado, envia a declaração ao servidor
  e exibe o resultado da validação — que é sempre feita pelo
  backend, nunca confiando apenas no estado local (RF15).

  Diferente do BingoCard e do DrawBoard (que só recebem dados
  via props e exibem), este componente conversa diretamente
  com a game.store, porque sua única responsabilidade é
  disparar uma ação específica do jogo atual — não faz sentido
  reutilizá-lo fora desse contexto, então o acoplamento direto
  à store é uma escolha deliberada, não um descuido.

  Uso:
    <BingoButton :game-id="gameStore.game.id" />
-->
<template>
  <div class="bingo-button-wrapper">
    <Button
      label="BINGO!"
      class="bingo-button"
      :class="{ pulsing: isCardComplete && !loading }"
      :disabled="!isCardComplete || loading || gameFinished"
      :loading="loading"
      @click="handleClick"
    />

    <p v-if="!isCardComplete && !gameFinished" class="hint-text">
      Marque todos os números da sua cartela para habilitar o botão.
    </p>

    <Message
      v-if="feedbackMessage"
      :severity="feedbackSeverity"
      :closable="true"
      class="feedback-message"
      @close="feedbackMessage = ''"
    >
      {{ feedbackMessage }}
    </Message>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import Button from 'primevue/button';
import Message from 'primevue/message';
import { useGameStore } from '../stores/game.store';

const props = defineProps({
  // ID da partida atual. Embora a game.store já guarde a
  // partida em gameStore.game, exigir o ID explicitamente
  // como prop deixa claro, na própria assinatura do
  // componente, do que ele depende para funcionar.
  gameId: {
    type: Number,
    required: true
  }
});

const gameStore = useGameStore();

const loading = ref(false);
const feedbackMessage = ref('');
const feedbackSeverity = ref('info'); // 'success' | 'warn' | 'error'

// Reflete o getter da store: true quando as 25 células da
// cartela local estão marcadas. Este é só um indicador para
// HABILITAR o botão — quem decide se o bingo é válido de
// verdade é sempre o backend, na chamada claimBingo() abaixo.
const isCardComplete = computed(() => gameStore.isCardComplete);

// Trava extra de segurança: se a partida já foi encerrada
// pelo admin (game:finished chegou via socket), não faz
// sentido permitir novas declarações.
const gameFinished = computed(() => gameStore.game?.status === 'finished');

// ------------------------------------------------------------
// handleClick()
//
// Chama gameStore.claimBingo(), que faz POST /games/:id/bingo.
// O resultado pode ser:
//   is_valid: true  -> declaração aceita, exibe mensagem de sucesso
//   is_valid: false -> cartela incompleta (não deveria acontecer
//                       já que o botão só habilita com a cartela
//                       completa, mas o servidor é a fonte da
//                       verdade — pode haver alguma divergência
//                       de estado, daí a importância de tratar
//                       este caso mesmo assim)
//
// Em caso de erro de rede ou outro problema, exibe a mensagem
// de erro retornada pelo backend.
// ------------------------------------------------------------
async function handleClick() {
  loading.value = true;
  feedbackMessage.value = '';

  try {
    const result = await gameStore.claimBingo(props.gameId);

    if (result.is_valid) {
      feedbackSeverity.value = 'success';
      feedbackMessage.value =
        'BINGO confirmado! Aguarde o administrador anunciar o vencedor.';
    } else {
      feedbackSeverity.value = 'warn';
      feedbackMessage.value =
        `Sua cartela ainda não está completa (${result.marked_cells}/${result.total_cells} números marcados).`;
    }

  } catch (err) {
    feedbackSeverity.value = 'error';
    feedbackMessage.value =
      err.response?.data?.error || 'Erro ao declarar bingo. Tente novamente.';

  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.bingo-button-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 280px;
}

.bingo-button {
  width: 100%;
  font-size: 1.3rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 0.9rem 0;
  background: #16a34a;
  border-color: #16a34a;
}

/* Pequeno pulso contínuo quando o botão está habilitado,
   chamando a atenção do jogador no momento em que sua
   cartela acabou de ficar completa. */
.bingo-button.pulsing {
  animation: bingo-pulse 1.6s ease-in-out infinite;
}

@keyframes bingo-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
  }
}

.hint-text {
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
  text-align: center;
}

.feedback-message {
  width: 100%;
}
</style>