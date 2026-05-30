// Define as rotas de gerenciamento de usuários, acessíveis apenas por admins:
//   POST   /admin/users     — cria um novo usuário (jogador ou admin)
//   GET    /admin/users     — lista todos os usuários cadastrados
//   DELETE /admin/users/:id — remove um usuário pelo ID
// Todas as rotas passam pelo middleware de autenticação antes de serem executadas.