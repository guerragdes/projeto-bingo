// Configura e exporta o pool de conexões com o PostgreSQL.
// Um pool mantém várias conexões abertas e as reutiliza,
// evitando abrir e fechar uma conexão nova a cada requisição.
// Usa as variáveis DB_HOST, DB_PORT, DB_NAME, DB_USER e DB_PASSWORD do .env.