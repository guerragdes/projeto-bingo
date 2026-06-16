// ============================================================
// src/services/auth.service.js
//
// Contém a lógica de negócio de autenticação.
// Busca o usuário no banco pelo username, compara a senha
// com o hash armazenado via bcrypt e, se válido,
// gera e retorna o token JWT junto com os dados do usuário.
//
// Este arquivo não lida com HTTP — ele não conhece req nem res.
// Apenas recebe dados, processa e retorna um resultado.
// A rota (auth.routes.js) é quem chama este service.
// ============================================================

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

// ------------------------------------------------------------
// login(username, password)
//
// Recebe as credenciais digitadas pelo usuário e retorna
// um objeto com o token JWT e os dados básicos do usuário.
//
// Lança um erro com mensagem legível nos seguintes casos:
//   - usuário não encontrado
//   - senha incorreta
// ------------------------------------------------------------
async function login(username, password) {

    // Busca o usuário no banco pelo username.
    // O $1 é substituído pelo valor de username com segurança,
    // evitando SQL injection.
    const result = await pool.query(
        'SELECT id, username, password_hash, is_admin FROM users WHERE username = $1',
        [username]
    );

    // Se nenhuma linha foi retornada, o usuário não existe.
    // Usamos a mesma mensagem para usuário inexistente e senha errada
    // intencionalmente — informar qual dos dois está errado ajudaria
    // um atacante a descobrir quais usernames existem no sistema.
    const user = result.rows[0];
    if (!user) {
        throw new Error('Credenciais inválidas.');
    }

    // Compara a senha digitada com o hash armazenado no banco.
    // O bcrypt.compare() aplica o mesmo processo de hash na senha
    // digitada e verifica se o resultado bate com o hash salvo.
    // Nunca é possível "desencriptar" o hash — só comparar.
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
        throw new Error('Credenciais inválidas.');
    }

    // Gera o token JWT com os dados que precisamos identificar
    // o usuário em requisições futuras.
    //
    // O token carrega três informações (o "payload"):
    //   id       → para saber quem está fazendo a requisição
    //   username → para exibir o nome sem consultar o banco
    //   is_admin → para saber se pode acessar rotas de admin
    //
    // JWT_SECRET é a chave usada para assinar o token.
    // Quem não tiver essa chave não consegue forjar um token válido.
    // JWT_EXPIRES_IN define por quanto tempo o token é válido (ex: 8h).
    const token = jwt.sign(
        {
            id:       user.id,
            username: user.username,
            is_admin: user.is_admin
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Retorna o token e os dados públicos do usuário.
    // A senha (mesmo em hash) nunca é retornada ao cliente.
    return {
        token,
        user: {
            id:       user.id,
            username: user.username,
            is_admin: user.is_admin
        }
    };
}

module.exports = { login };