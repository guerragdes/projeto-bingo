// ============================================================
// src/router/index.js
//
// Configuração do Vue Router.
//
// Define as três rotas da aplicação e os navigation guards:
// funções que rodam ANTES de cada navegação e podem permitir,
// bloquear ou redirecionar o acesso, dependendo se o usuário
// está logado e qual é o seu papel (jogador ou admin).
//
// Rotas:
//   /login  — pública
//   /game   — qualquer usuário autenticado (jogador ou admin)
//   /admin  — exclusiva de administradores
//
// Depende de src/stores/auth.store.js (tarefa 27) para saber
// se há um usuário logado e se ele é admin.
// ============================================================

import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

import LoginView from '../views/LoginView.vue';
import GameView  from '../views/GameView.vue';
import AdminView from '../views/AdminView.vue';

const routes = [
    {
        path: '/login',
        name: 'login',
        component: LoginView,
        // meta.public marca rotas que NÃO exigem autenticação.
        // Rotas sem essa marcação são protegidas por padrão.
        meta: { public: true }
    },
    {
        path: '/game',
        name: 'game',
        component: GameView
        // Sem meta.public: exige autenticação (qualquer papel).
    },
    {
        path: '/admin',
        name: 'admin',
        component: AdminView,
        // requiresAdmin: além de autenticado, precisa ser admin.
        meta: { requiresAdmin: true }
    },
    {
        // Qualquer rota não mapeada redireciona para o login.
        // Isso evita que o usuário veja uma tela em branco
        // ao digitar uma URL inválida.
        path: '/:pathMatch(.*)*',
        redirect: '/login'
    }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// ------------------------------------------------------------
// Navigation Guard global (tarefa 30)
//
// Roda antes de CADA navegação. Decide se ela pode prosseguir,
// com base em três perguntas:
//
//   1. O usuário está logado? (existe token na store)
//   2. A rota de destino exige autenticação?
//   3. A rota de destino exige privilégio de admin?
//
// Regras de redirecionamento:
//   - Tentando acessar rota protegida sem login -> /login
//   - Já logado tentando acessar /login -> /game ou /admin
//     (não faz sentido ver a tela de login estando logado)
//   - Jogador comum tentando acessar /admin -> /game
//     (acesso negado, redireciona para a área dele)
// ------------------------------------------------------------
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    const isLoggedIn = !!authStore.token;
    const isAdmin = authStore.user?.is_admin === true;

    // Caso 1: rota protegida, usuário não logado.
    if (!to.meta.public && !isLoggedIn) {
        return next('/login');
    }

    // Caso 2: usuário já logado tentando acessar /login.
    if (to.meta.public && isLoggedIn) {
        return next(isAdmin ? '/admin' : '/game');
    }

    // Caso 3: rota exige admin, mas o usuário logado não é admin.
    if (to.meta.requiresAdmin && !isAdmin) {
        return next('/game');
    }

    // Nenhuma restrição bloqueou a navegação: permite.
    next();
});

export default router;