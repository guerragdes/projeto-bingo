// ============================================================
// src/config/db.js
//
// Configura e exporta o pool de conexões com o PostgreSQL.
// Um pool mantém várias conexões abertas e as reutiliza,
// evitando abrir e fechar uma conexão nova a cada requisição.
//
// O search_path é definido como 'bingo' para que todas as
// queries encontrem as tabelas no schema correto sem precisar
// prefixá-las (ex: bingo.users vira apenas users).
//
// Uso em outros arquivos:
//   const pool = require('../config/db');
//   const result = await pool.query('SELECT * FROM users');
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host:     process.env.DB_HOST,
    port:     process.env.DB_PORT,
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options:  `-c search_path=bingo`
});

// Testa a conexão ao iniciar o servidor.
// Se as credenciais do .env estiverem erradas, o erro aparece
// imediatamente no terminal em vez de aparecer na primeira requisição.
pool.connect((err, client, release) => {
    if (err) {
        console.error('Erro ao conectar ao PostgreSQL:', err.message);
        return;
    }
    console.log('Conectado ao PostgreSQL com sucesso.');
    release();
});

module.exports = pool;