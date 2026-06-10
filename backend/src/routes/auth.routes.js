// ============================================================
// src/routes/auth.routes.js
//
// Define a rota pública de autenticação:
//   POST /auth/login — recebe username e password,
//   valida as credenciais e retorna um token JWT.
//
// Esta é a única rota acessível sem autenticação prévia.
// ============================================================

const express     = require('express');
const authService = require('../services/auth.service');

const router = express.Router();

// ------------------------------------------------------------
// POST /auth/login
//
// Body esperado:
//   { "username": "admin", "password": "senha123" }
//
// Resposta de sucesso (200):
//   { "token": "eyJ...", "user": { "id": 1, "username": "admin", "is_admin": true } }
//
// Resposta de erro — credenciais inválidas (401):
//   { "error": "Credenciais inválidas." }
//
// Resposta de erro — campos ausentes (400):
//   { "error": "Username e password são obrigatórios." }
// ------------------------------------------------------------
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Valida se os dois campos foram enviados no body.
    // Se o cliente enviar uma requisição sem esses campos,
    // retorna 400 (Bad Request) antes de consultar o banco.
    if (!username || !password) {
        return res.status(400).json({
            error: 'Username e password são obrigatórios.'
        });
    }

    try {
        // Delega a lógica de autenticação para o service.
        // A rota não sabe como o login funciona — só chama
        // o service e repassa o resultado ao cliente.
        const resultado = await authService.login(username, password);

        // Login bem-sucedido: retorna 200 com token e dados do usuário.
        return res.status(200).json(resultado);

    } catch (err) {
        // O service lança um erro com a mensagem 'Credenciais inválidas.'
        // tanto para usuário inexistente quanto para senha errada.
        // Retornamos 401 (Unauthorized) nesses casos.
        return res.status(401).json({ error: err.message });
    }
});

module.exports = router;