// ============================================================
// src/stores/auth.store.js
//
// Store Pinia de autenticação.
//
// Armazena o token JWT e os dados do usuário logado
// (id, username, is_admin). Expõe ações de login (chama o
// backend e salva o token) e logout (limpa o estado).
//
// PERSISTÊNCIA: o token e o usuário são salvos no localStorage
// do navegador, além de ficarem na store em memória. Isso é
// necessário porque o Pinia, sozinho, perde todo o estado
// quando a página é recarregada (F5) — sem o localStorage,
// o usuário seria deslogado a cada atualização da página.
// Ao criar a store, ela tenta restaurar esses valores de volta.
//
// Por que esta store usa fetch() em vez do api.js (Axios)?
// O api.js (tarefa 28) vai importar esta store para anexar o
// token automaticamente em requisições futuras — se esta store
// importasse o api.js de volta, criaríamos uma dependência
// circular entre os dois arquivos. Por isso o login usa fetch
// nativo diretamente, e só as rotas protegidas (que vêm depois
// do login) usam o api.js.
// ============================================================

import { defineStore } from 'pinia';

const BASE_URL = 'http://localhost:3000';

export const useAuthStore = defineStore('auth', {

    state: () => ({
        // Tenta restaurar do localStorage ao criar a store.
        // Se não houver nada salvo, começa como null.
        token: localStorage.getItem('bingo_token') || null,
        user: JSON.parse(localStorage.getItem('bingo_user') || 'null')
    }),

    getters: {
        // Getter de conveniência: true se houver um usuário logado.
        isAuthenticated: (state) => !!state.token,

        // Getter de conveniência: true se o usuário logado for admin.
        // Optional chaining (?.) evita erro caso user seja null.
        isAdmin: (state) => state.user?.is_admin === true
    },

    actions: {
        // ------------------------------------------------------------
        // login(username, password)
        //
        // Chama POST /auth/login no backend. Se as credenciais
        // forem válidas, salva o token e os dados do usuário
        // tanto na store quanto no localStorage.
        //
        // Lança um erro com a mensagem vinda do backend em caso
        // de falha (credenciais inválidas, campos ausentes, etc.),
        // para que o componente que chamou possa exibi-la.
        // ------------------------------------------------------------
        async login(username, password) {
            const response = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // O backend retorna { error: '...' } em caso de falha.
                throw new Error(data.error || 'Erro ao fazer login.');
            }

            this.token = data.token;
            this.user = data.user;

            localStorage.setItem('bingo_token', data.token);
            localStorage.setItem('bingo_user', JSON.stringify(data.user));
        },

        // ------------------------------------------------------------
        // logout()
        //
        // Limpa o token e os dados do usuário, tanto da store
        // quanto do localStorage. Não chama o backend — o JWT
        // não tem conceito de "invalidação" no lado do servidor
        // neste projeto, ele simplesmente expira sozinho após
        // o tempo definido em JWT_EXPIRES_IN.
        // ------------------------------------------------------------
        logout() {
            this.token = null;
            this.user = null;

            localStorage.removeItem('bingo_token');
            localStorage.removeItem('bingo_user');
        }
    }
});