// ============================================================
// src/main.js
//
// Ponto de entrada da aplicação Vue.
// Inicializa o app e registra os três plugins globais:
//   Pinia    -> gerenciamento de estado (auth.store, game.store)
//   Router   -> navegação entre as telas (login, jogo, admin)
//   PrimeVue -> componentes de UI prontos (botões, tabelas, etc.)
//
// A ORDEM do app.use() importa: o Pinia precisa ser registrado
// ANTES do router, porque o router/index.js usa useAuthStore()
// dentro do navigation guard (beforeEach) — se o Pinia ainda
// não estiver ativo nesse momento, o app quebra com um erro
// "getActivePinia() was called but there was no active Pinia".
// ============================================================

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())   // 1º: Pinia, para a store já existir antes do router
app.use(router)          // 2º: Router, que depende do Pinia (via auth.store)
app.use(PrimeVue, {      // 3º: PrimeVue, independente dos outros dois
    theme: {
        preset: Aura
    }
})

app.mount('#app')