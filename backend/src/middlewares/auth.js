// ============================================================
// src/middlewares/auth.js
//
// Middlewares de autenticação e autorização.
//
// Um middleware é uma função que intercepta a requisição
// antes que ela chegue à lógica da rota. Recebe três parâmetros:
//   req  → a requisição (de onde lemos o token)
//   res  → a resposta (para rejeitar se inválido)
//   next → função que passa o controle para o próximo passo
//
// Este arquivo exporta dois middlewares:
//
//   authenticate  → verifica se o token JWT é válido.
//                   Usado em todas as rotas protegidas.
//
//   requireAdmin  → verifica se o usuário autenticado é admin.
//                   Sempre usado APÓS o authenticate.
//
// Uso nas rotas:
//   router.get('/rota', authenticate, handler)
//   router.post('/rota', authenticate, requireAdmin, handler)
// ============================================================

const jwt = require('jsonwebtoken');

// ------------------------------------------------------------
// authenticate
//
// Lê o token do cabeçalho Authorization no formato:
//   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
//
// Se o token for válido, anexa os dados do usuário em req.user
// e passa para o próximo passo com next().
//
// Rejeita com 401 (Unauthorized) se:
//   - o cabeçalho Authorization estiver ausente
//   - o token estiver expirado
//   - o token tiver sido adulterado
// ------------------------------------------------------------
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];

    // O cabeçalho deve existir e começar com "Bearer "
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido.' });
    }

    // Extrai apenas o token, removendo o prefixo "Bearer "
    const token = authHeader.split(' ')[1];

    try {
        // Verifica se o token é válido e não expirou.
        // jwt.verify() lança um erro se algo estiver errado.
        // Se for válido, retorna o payload que foi assinado no login:
        //   { id, username, is_admin, iat, exp }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Anexa os dados do usuário à requisição para que
        // os próximos middlewares e rotas possam acessá-los
        // sem precisar consultar o banco novamente.
        req.user = decoded;

        next();

    } catch (err) {
        // JsonWebTokenError  → token adulterado ou inválido
        // TokenExpiredError  → token expirado
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

// ------------------------------------------------------------
// requireAdmin
//
// Verifica se o usuário autenticado tem is_admin = true.
// Deve ser usado SEMPRE após o authenticate, pois depende
// do req.user que ele define.
//
// Rejeita com 403 (Forbidden) se o usuário não for admin.
// A diferença entre 401 e 403:
//   401 → não identificado (sem token ou token inválido)
//   403 → identificado, mas sem permissão suficiente
// ------------------------------------------------------------
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({
            error: 'Acesso restrito a administradores.'
        });
    }

    next();
}

module.exports = { authenticate, requireAdmin };