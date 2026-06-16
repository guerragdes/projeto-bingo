// ============================================================
// src/routes/admin.routes.js
//
// Define as rotas de gerenciamento de usuários,
// acessíveis apenas por administradores autenticados:
//
//   POST   /admin/users      — cria um novo usuário (jogador ou admin)
//   GET    /admin/users      — lista todos os usuários cadastrados
//   DELETE /admin/users/:id  — remove um usuário pelo ID
//
// Todas as rotas passam por dois middlewares em sequência:
//   authenticate  → verifica se o token JWT é válido
//   requireAdmin  → verifica se o usuário logado é admin
//
// Este arquivo acessa o banco diretamente via pool, sem um
// service separado — a lógica aqui é simples o suficiente
// (inserir, listar e remover) para não justificar uma camada extra.
// ============================================================

const express = require('express');
const bcrypt  = require('bcrypt');
const pool    = require('../config/db');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Aplica os dois middlewares a TODAS as rotas deste arquivo.
// Qualquer requisição que chegar aqui já passou pela verificação
// de token e de permissão de admin antes de chegar nos handlers abaixo.
router.use(authenticate, requireAdmin);

// ------------------------------------------------------------
// POST /admin/users
//
// Cria um novo usuário (jogador ou admin).
//
// Body esperado:
//   { "username": "joao123", "password": "minhasenha", "is_admin": false }
//
// is_admin é opcional; se omitido, assume false (jogador comum).
//
// Resposta de sucesso (201):
//   { "id": 3, "username": "joao123", "is_admin": false }
//
// Erros possíveis:
//   400 — campos obrigatórios ausentes
//   409 — username já existe
// ------------------------------------------------------------
router.post('/users', async (req, res) => {
    const { username, password, is_admin } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Username e password são obrigatórios.'
        });
    }

    // is_admin é opcional. Se não vier no body, assume false.
    // O "!!" converte o valor para um booleano explícito,
    // garantindo que valores como undefined se tornem false.
    const isAdmin = !!is_admin;

    try {
        // Verifica se o username já está em uso antes de inserir.
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Este nome de usuário já está em uso.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (username, password_hash, is_admin)
             VALUES ($1, $2, $3)
             RETURNING id, username, is_admin`,
            [username, passwordHash, isAdmin]
        );

        // RETURNING faz o INSERT já devolver a linha criada,
        // evitando uma segunda consulta para buscar o usuário recém-criado.
        return res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

// ------------------------------------------------------------
// GET /admin/users
//
// Lista todos os usuários cadastrados.
// Não retorna password_hash, por segurança.
//
// Resposta de sucesso (200):
//   [
//     { "id": 1, "username": "admin", "is_admin": true,  "created_at": "..." },
//     { "id": 2, "username": "joao123", "is_admin": false, "created_at": "..." }
//   ]
// ------------------------------------------------------------
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, is_admin, created_at FROM users ORDER BY id'
        );

        return res.status(200).json(result.rows);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
});

// ------------------------------------------------------------
// DELETE /admin/users/:id
//
// Remove um usuário pelo ID.
//
// Resposta de sucesso (200):
//   { "message": "Usuário removido com sucesso." }
//
// Erros possíveis:
//   404 — usuário não encontrado
//   409 — usuário possui cartelas ou declarações vinculadas
//         (a constraint de chave estrangeira do banco impede a remoção)
// ------------------------------------------------------------
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        return res.status(200).json({ message: 'Usuário removido com sucesso.' });

    } catch (err) {
        // Código 23503 = violação de chave estrangeira no PostgreSQL.
        // Acontece se o usuário já tiver cartelas ou bingo_claims vinculados.
        if (err.code === '23503') {
            return res.status(409).json({
                error: 'Não é possível remover: usuário possui dados vinculados a partidas.'
            });
        }

        console.error(err);
        return res.status(500).json({ error: 'Erro ao remover usuário.' });
    }
});

module.exports = router;