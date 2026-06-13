// ============================================================
// src/routes/game.routes.js
//
// Define as rotas relacionadas às partidas de bingo.
//
// Esta primeira parte cobre o gerenciamento da partida em si:
//   GET   /games/active        — retorna a partida em andamento (waiting ou active)
//   POST  /games                — cria nova partida (admin)
//   PATCH /games/:id/start      — inicia a partida (admin)
//   PATCH /games/:id/finish     — encerra a partida (admin)
//
// As rotas de cartela (join, card) serão adicionadas neste
// mesmo arquivo na próxima etapa, após o card.service.js
// estar implementado.
//
// Segue o mesmo padrão do admin.routes.js: acesso direto ao
// pool, sem service separado, pois a lógica de CRUD é simples.
// ============================================================

const express = require('express');
const pool    = require('../config/db');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas de partida exigem usuário autenticado.
// requireAdmin é aplicado individualmente apenas nas rotas
// que alteram o estado da partida.
router.use(authenticate);

// ------------------------------------------------------------
// GET /games/active
//
// Retorna a partida mais recente que ainda não foi encerrada
// (status 'waiting' ou 'active'). Qualquer usuário logado
// pode consultar — é assim que o jogador sabe se há uma
// partida para entrar.
//
// Resposta de sucesso (200):
//   { "id": 1, "status": "waiting", "created_by": 1, ... }
//
// Se não houver nenhuma partida em andamento (204):
//   sem corpo de resposta
// ------------------------------------------------------------
router.get('/active', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, status, created_by, started_at, finished_at, created_at
             FROM games
             WHERE status IN ('waiting', 'active')
             ORDER BY created_at DESC
             LIMIT 1`
        );

        if (result.rows.length === 0) {
            // 204 No Content: requisição válida, mas não há dados para retornar.
            return res.status(204).send();
        }

        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao buscar partida ativa.' });
    }
});

// ------------------------------------------------------------
// POST /games
//
// Cria uma nova partida com status 'waiting'.
// Apenas admin.
//
// Regra de negócio: só pode existir uma partida em 'waiting'
// ou 'active' por vez. Se já existir, a criação é rejeitada —
// o admin precisa encerrar a partida atual primeiro.
//
// Resposta de sucesso (201):
//   { "id": 2, "status": "waiting", "created_by": 1, ... }
//
// Erro (409):
//   { "error": "Já existe uma partida em andamento. Encerre-a antes de criar outra." }
// ------------------------------------------------------------
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const existing = await pool.query(
            `SELECT id FROM games WHERE status IN ('waiting', 'active')`
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'Já existe uma partida em andamento. Encerre-a antes de criar outra.'
            });
        }

        const result = await pool.query(
            `INSERT INTO games (status, created_by)
             VALUES ('waiting', $1)
             RETURNING id, status, created_by, started_at, finished_at, created_at`,
            [req.user.id]
        );

        return res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao criar partida.' });
    }
});

// ------------------------------------------------------------
// PATCH /games/:id/start
//
// Transiciona a partida de 'waiting' para 'active' e registra
// started_at. Apenas admin.
//
// Resposta de sucesso (200):
//   { "id": 1, "status": "active", "started_at": "...", ... }
//
// Erros possíveis:
//   404 — partida não encontrada
//   409 — partida não está em 'waiting' (já foi iniciada ou encerrada)
// ------------------------------------------------------------
router.patch('/:id/start', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const game = await pool.query('SELECT status FROM games WHERE id = $1', [id]);

        if (game.rows.length === 0) {
            return res.status(404).json({ error: 'Partida não encontrada.' });
        }

        if (game.rows[0].status !== 'waiting') {
            return res.status(409).json({
                error: `Partida não pode ser iniciada (status atual: ${game.rows[0].status}).`
            });
        }

        const result = await pool.query(
            `UPDATE games
             SET status = 'active', started_at = NOW()
             WHERE id = $1
             RETURNING id, status, created_by, started_at, finished_at, created_at`,
            [id]
        );

        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao iniciar partida.' });
    }
});

// ------------------------------------------------------------
// PATCH /games/:id/finish
//
// Transiciona a partida para 'finished' e registra finished_at.
// Pode ser chamada a partir de 'waiting' ou 'active'.
// Apenas admin.
//
// Resposta de sucesso (200):
//   { "id": 1, "status": "finished", "finished_at": "...", ... }
//
// Erros possíveis:
//   404 — partida não encontrada
//   409 — partida já está encerrada
// ------------------------------------------------------------
router.patch('/:id/finish', authenticate, requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const game = await pool.query('SELECT status FROM games WHERE id = $1', [id]);

        if (game.rows.length === 0) {
            return res.status(404).json({ error: 'Partida não encontrada.' });
        }

        if (game.rows[0].status === 'finished') {
            return res.status(409).json({ error: 'Partida já está encerrada.' });
        }

        const result = await pool.query(
            `UPDATE games
             SET status = 'finished', finished_at = NOW()
             WHERE id = $1
             RETURNING id, status, created_by, started_at, finished_at, created_at`,
            [id]
        );

        return res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao encerrar partida.' });
    }
});

module.exports = router;