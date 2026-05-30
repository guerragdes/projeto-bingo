// Contém a lógica de negócio de autenticação:
// busca o usuário no banco pelo username, compara a senha
// com o hash armazenado via bcrypt e, se válido, gera e retorna o JWT.