<!--
  src/components/BingoCard.vue

  Componente da cartela do jogador.
  Recebe os dados da cartela via prop `card` (o mesmo formato
  retornado pelo backend em POST/GET /games/:id/card e mantido
  reativo pela game.store) e exibe as 25 células organizadas
  em colunas B/I/N/G/O, destacando visualmente as células
  marcadas e a célula livre central.

  Este componente é "burro" de propósito: não acessa a store
  nem faz requisições — só recebe dados prontos e os exibe.
  Isso facilita reutilizá-lo (por exemplo, futuramente, numa
  tela de admin mostrando a cartela de qualquer jogador) e
  testá-lo isoladamente.

  Uso:
    <BingoCard :card="gameStore.card" />
-->
<template>
  <div class="bingo-card">
    <div class="bingo-header">
      <span
        v-for="letter in LETTERS"
        :key="letter"
        class="header-letter"
        :class="`letter-${letter.toLowerCase()}`"
      >
        {{ letter }}
      </span>
    </div>

    <div v-if="card" class="bingo-grid">
      <template v-for="(row, rowIndex) in rows" :key="rowIndex">
        <div
          v-for="cell in row"
          :key="`${cell.letter}-${rowIndex}`"
          class="bingo-cell"
          :class="{
            marked: cell.marked,
            free: cell.free
          }"
        >
          <span v-if="cell.free" class="free-star">★</span>
          <span v-else>{{ cell.number }}</span>
        </div>
      </template>
    </div>

    <div v-else class="bingo-empty">
      Aguardando cartela...
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

const props = defineProps({
  card: {
    type: Object,
    default: null
  }
});

// ------------------------------------------------------------
// rows
//
// O backend retorna a cartela organizada por COLUNA:
//   cells:  { B: [n,n,n,n,n], I: [...], N: [n,n,null,n,n], ... }
//   marked: { B: [bool,bool,...], ... }
//
// Para desenhar a cartela como uma grade visual, precisamos
// reorganizar isso por LINHA: a linha 0 é composta pelo
// primeiro elemento de cada coluna (B[0], I[0], N[0], G[0], O[0]),
// a linha 1 pelo segundo elemento de cada coluna, e assim por diante.
//
// Resultado: um array de 5 linhas, cada uma com 5 objetos
// { letter, number, marked, free }.
// ------------------------------------------------------------
const rows = computed(() => {
  if (!props.card) return [];

  const result = [];

  for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
    const row = LETTERS.map((letter) => {
      const number = props.card.cells[letter][rowIndex];
      return {
        letter,
        number,
        marked: props.card.marked[letter][rowIndex],
        free: number === null
      };
    });
    result.push(row);
  }

  return result;
});
</script>

<style scoped>
.bingo-card {
  display: inline-flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 14px;
  padding: 1rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.bingo-header {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.header-letter {
  text-align: center;
  font-weight: 800;
  font-size: 1.4rem;
  border-radius: 8px;
  padding: 0.4rem 0;
  color: #ffffff;
}

/* Cada coluna do bingo ganha sua própria cor de identidade,
   reforçando visualmente o agrupamento B-I-N-G-O. */
.letter-b { background: #2563eb; }
.letter-i { background: #0d9488; }
.letter-n { background: #7c3aed; }
.letter-g { background: #d97706; }
.letter-o { background: #dc2626; }

.bingo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
}

.bingo-cell {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 600;
  background: #f1f5f9;
  border-radius: 8px;
  color: #1e293b;
  transition: background-color 0.25s ease, transform 0.2s ease;
}

.bingo-cell.marked {
  background: #16a34a;
  color: #ffffff;
  transform: scale(1.04);
}

.bingo-cell.free {
  background: #1e293b;
  color: #fbbf24;
}

.free-star {
  font-size: 1.3rem;
}

.bingo-empty {
  padding: 2rem 1rem;
  text-align: center;
  color: #64748b;
  font-size: 0.95rem;
}

/* Telas pequenas: reduz um pouco o tamanho das células,
   mantendo a cartela inteira visível sem rolagem horizontal. */
@media (max-width: 420px) {
  .bingo-cell {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1rem;
  }

  .header-letter {
    font-size: 1.1rem;
  }
}
</style>