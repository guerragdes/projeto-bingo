<!--
  src/components/DrawnBall.vue

  Componente de exibição do número sorteado.
  Mostra uma "bolinha" com o número mais recente sorteado pelo
  administrador, com uma animação de entrada toda vez que um
  novo número chega — não só na primeira renderização.

  Recebe o sorteio mais recente via prop `latest`, no mesmo
  formato emitido pelo evento number:drawn e armazenado em
  gameStore.draws (o último elemento do array):
    { number, letter, drawn_order }

  Uso:
    <DrawnBall :latest="ultimoSorteio" />

  (ultimoSorteio normalmente vem de um computed na GameView:
   gameStore.draws[gameStore.draws.length - 1] ?? null)
-->
<template>
  <div class="drawn-ball-wrapper">
    <Transition name="ball-pop" mode="out-in">
      <div
        v-if="latest"
        :key="latest.drawn_order"
        class="drawn-ball"
        :class="`letter-${latest.letter.toLowerCase()}`"
      >
        <span class="ball-letter">{{ latest.letter }}</span>
        <span class="ball-number">{{ latest.number }}</span>
      </div>

      <div v-else class="drawn-ball empty" key="empty">
        <span class="ball-placeholder">?</span>
      </div>
    </Transition>

    <p class="drawn-caption">
      {{ latest ? `Número ${latest.drawn_order}` : 'Aguardando sorteio...' }}
    </p>
  </div>
</template>

<script setup>
defineProps({
  // O sorteio mais recente, ou null se a partida ainda não
  // teve nenhum número sorteado.
  latest: {
    type: Object,
    default: null
  }
});
</script>

<style scoped>
.drawn-ball-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.drawn-ball {
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25), inset 0 -4px 0 rgba(0, 0, 0, 0.15);
}

.drawn-ball.empty {
  background: #cbd5e1;
  box-shadow: none;
}

.ball-placeholder {
  font-size: 2.2rem;
  font-weight: 800;
  color: #94a3b8;
}

.letter-b { background: #2563eb; }
.letter-i { background: #0d9488; }
.letter-n { background: #7c3aed; }
.letter-g { background: #d97706; }
.letter-o { background: #dc2626; }

.ball-letter {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  opacity: 0.85;
}

.ball-number {
  font-size: 2.4rem;
  font-weight: 800;
  line-height: 1;
}

.drawn-caption {
  margin: 0;
  font-size: 0.85rem;
  color: #64748b;
  font-weight: 500;
}

/* ------------------------------------------------------------
   Animação de entrada: a bolinha "pula" para dentro da tela
   toda vez que a `key` muda (ou seja, toda vez que um novo
   número é sorteado). O Vue trata isso como um elemento novo
   sendo inserido, então a transição de entrada dispara de novo
   a cada sorteio — não apenas na primeira renderização.
------------------------------------------------------------- */
.ball-pop-enter-active {
  animation: ball-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ball-pop-leave-active {
  animation: ball-pop-out 0.15s ease-in;
}

@keyframes ball-pop-in {
  0% {
    transform: scale(0.3) translateY(-30px);
    opacity: 0;
  }
  60% {
    transform: scale(1.1) translateY(0);
    opacity: 1;
  }
  100% {
    transform: scale(1) translateY(0);
  }
}

@keyframes ball-pop-out {
  to {
    transform: scale(0.7);
    opacity: 0;
  }
}
</style>