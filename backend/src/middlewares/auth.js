// Middleware de autenticação JWT.
// Intercepta requisições antes que cheguem às rotas protegidas.
// Lê o token do cabeçalho Authorization, verifica se é válido
// e, se for, anexa os dados do usuário (id, is_admin) à requisição.
// Se o token estiver ausente ou inválido, rejeita com erro 401.