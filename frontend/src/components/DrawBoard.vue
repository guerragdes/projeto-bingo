<!--
  src/components/DrawBoard.vue

  Componente da tabela de sorteio.
  Exibe todos os 75 números organizados por letra (B:1-15,
  I:16-30, N:31-45, G:46-60, O:61-75), destacando os que já
  foram sorteados na partida atual.

  Assim como o BingoCard, este componente é "burro": recebe
  os números já sorteados via prop e apenas os exibe. Quem
  alimenta essa prop é a GameView, lendo gameStore.drawnNumbers
  (o getter que já fizemos na game.store).

  Uso:
    <DrawBoard :drawn-numbers="gameStore.drawnNumbers" />
-->
<template>
  <div class="draw-board">
    <div
      v-for="letter in LETTERS"
      :key="letter"
      class="board-row"
    >
      <span class="row-letter" :class="`letter-${letter.toLowerCase()}`">
        {{ letter }}
      </span>

      <div class="row-numbers">
        <span
          v-for="number in RANGES[letter]"
          :key="number"
          class="board-number"
          :class="{
            drawn: drawnSet.has(number),
            latest: number === latestNumber
          }"
        >
          {{ number }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

// Gera o intervalo fixo de números de cada letra, uma única
// vez (fora do componente, já que nunca muda):
//   B: [1..15], I: [16..30], N: [31..45], G: [46..60], O: [61..75]
const RANGES = {};
LETTERS.forEach((letter, index) => {
  const start = index * 15 + 1;
  RANGES[letter] = Array.from({ length: 15 }, (_, i) => start + i);
});

const props = defineProps({
  // Array simples de números já sorteados, ex: [4, 23, 67, ...].
  // Corresponde ao getter gameStore.drawnNumbers.
  drawnNumbers: {
    type: Array,
    default: () => []
  },
  // Número do sorteio mais recente, opcional — recebe um
  // destaque visual extra (anel pulsante), para chamar atenção
  // do jogador para a última bola que saiu, mesmo que ele não
  // estivesse olhando no momento exato do sorteio.
  latestNumber: {
    type: Number,
    default: null
  }
});

// Usar um Set em vez de Array.includes() torna a verificação
// "este número já saiu?" muito mais rápida — O(1) em vez de
// O(n) — o que importa aqui porque essa checagem roda 75 vezes
// (uma por número da tabela) a cada nova renderização.
const drawnSet = computed(() => new Set(props.drawnNumbers));
</script>

<style scoped>
.draw-board {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #ffffff;
  border-radius: 14px;
  padding: 1rem 1.25rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.board-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.row-letter {
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-weight: 800;
  color: #ffffff;
}

.letter-b { background: #2563eb; }
.letter-i { background: #0d9488; }
.letter-n { background: #7c3aed; }
.letter-g { background: #d97706; }
.letter-o { background: #dc2626; }

.row-numbers {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 0.3rem;
  flex: 1;
}

.board-number {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 600;
  background: #f1f5f9;
  color: #94a3b8;
  transition: background-color 0.25s ease, color 0.25s ease, transform 0.2s ease;
}

.board-number.drawn {
  background: #16a34a;
  color: #ffffff;
}

.board-number.latest {
  transform: scale(1.25);
  box-shadow: 0 0 0 3px #fbbf24;
}

/* Telas pequenas: a tabela inteira passa a rolar horizontalmente
   dentro de cada linha, em vez de espremer os números a ponto
   de ficarem ilegíveis. */
@media (max-width: 600px) {
  .row-numbers {
    overflow-x: auto;
    grid-auto-flow: column;
    grid-auto-columns: 1.8rem;
    grid-template-columns: none;
  }

  .board-number {
    width: 1.8rem;
  }
}
</style>