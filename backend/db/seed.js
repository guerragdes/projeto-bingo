// Script de inicialização do banco de dados.
// Lê ADMIN_USERNAME e ADMIN_PASSWORD do .env, aplica bcrypt na senha
// e insere o primeiro usuário administrador na tabela users.
// Deve ser executado uma única vez após o schema:
//   npm run seed