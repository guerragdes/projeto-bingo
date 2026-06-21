<!--
  src/views/LoginView.vue

  Tela de login. Exibe o formulário de username e senha,
  chama authStore.login() e, em caso de sucesso, redireciona
  o usuário para a tela correta conforme seu papel:
    admin    -> /admin
    jogador  -> /game

  Em caso de erro (credenciais inválidas, campos ausentes),
  exibe a mensagem retornada pelo backend através da store.
-->
<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleLogin">
      <h1 class="login-title">Bingo</h1>
      <p class="login-subtitle">Entre com suas credenciais para continuar</p>

      <div class="field">
        <label for="username">Usuário</label>
        <InputText
          id="username"
          v-model="username"
          placeholder="Digite seu usuário"
          autocomplete="username"
          :disabled="loading"
        />
      </div>

      <div class="field">
        <label for="password">Senha</label>
        <Password
          id="password"
          v-model="password"
          placeholder="Digite sua senha"
          :feedback="false"
          toggleMask
          autocomplete="current-password"
          :disabled="loading"
          inputClass="login-password-input"
        />
      </div>

      <Message v-if="errorMessage" severity="error" :closable="false">
        {{ errorMessage }}
      </Message>

      <Button
        type="submit"
        label="Entrar"
        class="login-button"
        :loading="loading"
      />
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.store';

import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Button from 'primevue/button';
import Message from 'primevue/message';

const username = ref('');
const password = ref('');
const errorMessage = ref('');
const loading = ref(false);

const authStore = useAuthStore();
const router = useRouter();

// ------------------------------------------------------------
// handleLogin()
//
// Chama a action login() da auth.store. Se for bem-sucedida,
// redireciona conforme o papel do usuário. Se falhar, exibe
// a mensagem de erro vinda do backend (ex: "Credenciais inválidas.").
// ------------------------------------------------------------
async function handleLogin() {
  errorMessage.value = '';
  loading.value = true;

  try {
    await authStore.login(username.value, password.value);

    // authStore.isAdmin é um getter (ver auth.store.js) que
    // verifica user?.is_admin === true. Decide o redirecionamento
    // com base no papel retornado pelo backend no login.
    router.push(authStore.isAdmin ? '/admin' : '/game');

  } catch (err) {
    errorMessage.value = err.message;

  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1e3a8a 0%, #1e293b 100%);
  padding: 1rem;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border-radius: 12px;
  padding: 2.5rem 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 700;
  text-align: center;
  margin: 0;
  color: #1e293b;
}

.login-subtitle {
  text-align: center;
  margin: -0.75rem 0 0.25rem;
  color: #64748b;
  font-size: 0.9rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #334155;
}

.field :deep(input) {
  width: 100%;
}

.login-password-input {
  width: 100%;
}

.login-button {
  margin-top: 0.5rem;
  width: 100%;
}
</style>