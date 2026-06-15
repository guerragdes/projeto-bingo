// ============================================================
// src/routes/game.routes.js
//
// Define as rotas relacionadas às partidas de bingo.
//
// Gerenciamento da partida:
//   GET   /games/active        — retorna a partida em andamento (waiting ou active)
//   POST  /games                — cria nova partida (admin)
//   PATCH /games/:id/start      — inicia a partida (admin)
//   PATCH /games/:id/finish     — encerra a partida (admin)
//
// Cartela do jogador:
//   POST  /games/:id/join       — jogador entra na partida (gera cartela se necessário)
//   GET   /games/:id/card       — retorna a cartela do jogador na partida
//
// As rotas de gerenciamento seguem o mesmo padrão do
// admin.routes.js: acesso direto ao pool, sem service separado.
// As rotas de cartela delegam para card.service.js.
// ============================================================

const express     = require('express');
const pool        = require('../config/db');
const cardService = require('../services/card.service');
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

// ------------------------------------------------------------
// POST /games/:id/join
//
// O jogador entra na partida :id. Se ele ainda não tiver
// uma cartela nessa partida, uma é gerada aleatoriamente.
// Se já tiver, a mesma cartela é retornada (idempotente —
// chamar várias vezes não cria cartelas novas).
//
// Qualquer usuário autenticado pode chamar esta rota,
// inclusive o admin (caso ele também queira jogar).
//
// Resposta de sucesso (200):
//   { "card_id": 1, "game_id": 1, "is_complete": false,
//     "cells": { "B": [...], "I": [...], ... },
//     "marked": { "B": [...], "I": [...], ... } }
//
// Erros possíveis:
//   404 — partida não encontrada
//   409 — partida já está encerrada (status 'finished')
// ------------------------------------------------------------
router.post('/:id/join', async (req, res) => {
    const { id } = req.params;

    try {
        const game = await pool.query('SELECT status FROM games WHERE id = $1', [id]);

        if (game.rows.length === 0) {
            return res.status(404).json({ error: 'Partida não encontrada.' });
        }

        if (game.rows[0].status === 'finished') {
            return res.status(409).json({
                error: 'Esta partida já foi encerrada. Aguarde uma nova partida começar.'
            });
        }

        const card = await cardService.getOrCreateCard(req.user.id, id);

        return res.status(200).json(card);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao entrar na partida.' });
    }
});

// ------------------------------------------------------------
// GET /games/:id/card
//
// Retorna a cartela do jogador autenticado na partida :id.
//
// Resposta de sucesso (200):
//   { "card_id": 1, "game_id": 1, "is_complete": false,
//     "cells": { ... }, "marked": { ... } }
//
// Erros possíveis:
//   404 — partida não encontrada
//   404 — jogador ainda não possui cartela nesta partida
//         (precisa chamar POST /games/:id/join primeiro)
// ------------------------------------------------------------
router.get('/:id/card', async (req, res) => {
    const { id } = req.params;

    try {
        const game = await pool.query('SELECT id FROM games WHERE id = $1', [id]);

        if (game.rows.length === 0) {
            return res.status(404).json({ error: 'Partida não encontrada.' });
        }

        const card = await cardService.getCard(req.user.id, id);

        if (!card) {
            return res.status(404).json({
                error: 'Você ainda não possui cartela nesta partida. Entre na partida primeiro com POST /games/:id/join.'
            });
        }

        return res.status(200).json(card);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao buscar cartela.' });
    }
});

module.exports = router;