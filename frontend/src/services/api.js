// Instância configurada do Axios para requisições HTTP ao backend.
// Define a URL base do servidor e adiciona um interceptor que
// inclui automaticamente o token JWT no cabeçalho Authorization
// de todas as requisições, lendo-o do auth.store.