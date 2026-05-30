// Define as rotas relacionadas às partidas e ao jogo:
//   GET   /games/active        — retorna a partida em andamento
//   POST  /games               — cria nova partida (admin)
//   PATCH /games/:id/start     — inicia a partida (admin)
//   PATCH /games/:id/finish    — encerra a partida (admin)
//   POST  /games/:id/join      — jogador entra na partida e recebe sua cartela
//   GET   /games/:id/card      — retorna a cartela do jogador na partida
//   GET   /games/:id/draws     — retorna o histórico de números sorteados
//   POST  /games/:id/draw      — sorteia o próximo número (admin)
//   POST  /games/:id/bingo     — jogador declara bingo