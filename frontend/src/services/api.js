// ============================================================
// src/services/api.js
//
// Instância configurada do Axios para requisições HTTP ao
// backend. Define a URL base do servidor e adiciona um
// interceptor que inclui automaticamente o token JWT no
// cabeçalho Authorization de TODAS as requisições feitas
// através desta instância.
//
// Por que um interceptor em vez de adicionar o header
// manualmente em cada chamada?
// Sem isso, todo componente que faz uma requisição protegida
// precisaria lembrar de escrever:
//   headers: { Authorization: `Bearer ${token}` }
// em todo lugar. Esquecer uma vez gera um bug de 401 difícil
// de notar. Com o interceptor, isso acontece automaticamente
// para qualquer chamada feita com `api.get(...)`, `api.post(...)`
// etc — só o login (que ainda não tem token) usa fetch puro,
// como já vimos no auth.store.js.
//
// Uso em outros arquivos:
//   import api from '../services/api';
//   const response = await api.get('/games/active');
//   const response = await api.post('/games/1/draw');
// ============================================================

import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const api = axios.create({
    baseURL: 'http://localhost:3000'
});

// ------------------------------------------------------------
// Interceptor de requisição.
//
// Roda ANTES de toda requisição sair pela instância `api`.
// Lê o token atual da auth.store e, se existir, anexa o
// cabeçalho Authorization no formato que o middleware do
// backend espera: "Bearer <token>".
//
// useAuthStore() só pode ser chamado AQUI dentro da função
// (não no topo do arquivo), porque o Pinia só fica disponível
// depois que app.use(createPinia()) rodar no main.js. Chamar
// useAuthStore() no topo do módulo aconteceria cedo demais.
// ------------------------------------------------------------
api.interceptors.request.use((config) => {
    const authStore = useAuthStore();

    if (authStore.token) {
        config.headers.Authorization = `Bearer ${authStore.token}`;
    }

    return config;
});

// ------------------------------------------------------------
// Interceptor de resposta.
//
// Roda quando uma resposta chega. Se o backend retornar 401
// (token inválido ou expirado), desloga o usuário automaticamente
// e o redireciona para o login — evita que ele fique "preso"
// numa tela protegida com um token que não funciona mais.
// ------------------------------------------------------------
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const authStore = useAuthStore();
            authStore.logout();
            window.location.href = '/login';
        }

        return Promise.reject(error);
    }
);

export default api;