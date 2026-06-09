// ============================================================
// db/seed.js
//
// Script de inicialização do banco de dados.
// Lê ADMIN_USERNAME e ADMIN_PASSWORD do .env, aplica bcrypt
// na senha e insere o primeiro administrador na tabela users.
//
// Deve ser executado uma única vez após o schema:
//   npm run seed
//
// Se o usuário já existir, o script avisa e encerra sem erro,
// portanto é seguro rodar mais de uma vez.
// ============================================================

require('dotenv').config();

const bcrypt = require('bcrypt');
const pool   = require('../src/config/db');

async function seed() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    // ------------------------------------------------------------
    // Valida se as variáveis de ambiente estão preenchidas.
    // Se o .env não tiver esses valores, o seeder encerra antes
    // de tentar qualquer operação no banco.
    // ------------------------------------------------------------
    if (!username || !password) {
        console.error(
            'Erro: ADMIN_USERNAME e ADMIN_PASSWORD precisam estar definidos no .env'
        );
        process.exit(1);
    }

    try {
        // ------------------------------------------------------------
        // Verifica se já existe um usuário com esse username.
        // Isso evita criar duplicatas se o seed for rodado duas vezes.
        // ------------------------------------------------------------
        const existing = await pool.query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );

        if (existing.rows.length > 0) {
            console.log(`Administrador "${username}" já existe. Nenhuma alteração feita.`);
            process.exit(0);
        }

        // ------------------------------------------------------------
        // Gera o hash da senha com bcrypt.
        // O número 10 é o "salt rounds" — quantas vezes o algoritmo
        // processa a senha. Quanto maior, mais seguro e mais lento.
        // 10 é o valor padrão recomendado para a maioria dos sistemas.
        // ------------------------------------------------------------
        const passwordHash = await bcrypt.hash(password, 10);

        // ------------------------------------------------------------
        // Insere o administrador inicial no banco.
        // is_admin = TRUE garante que ele terá acesso total ao sistema.
        // ------------------------------------------------------------
        await pool.query(
            `INSERT INTO users (username, password_hash, is_admin)
             VALUES ($1, $2, TRUE)`,
            [username, passwordHash]
        );

        console.log(`Administrador "${username}" criado com sucesso.`);

    } catch (err) {
        console.error('Erro ao executar o seeder:', err.message);
        process.exit(1);
    } finally {
        // Encerra o pool de conexões para o script terminar corretamente
        await pool.end();
    }
}

seed();