// ============================================================
// test-admin.js
//
// Script temporário para testar as rotas de /admin/users
// sem precisar do Postman. Faz login como admin, cria um
// jogador, lista os usuários, testa o bloqueio por permissão
// e remove o jogador criado.
//
// Requer que o servidor esteja rodando (npm run dev).
//
// Uso:
//   node test-admin.js
// ============================================================

const BASE_URL = 'http://localhost:3000';

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

async function main() {
    console.log('1. Login como admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const loginData = await loginRes.json();
    console.log('   status:', loginRes.status);

    if (loginRes.status !== 200) {
        console.log('   Login falhou, abortando teste:', loginData);
        return;
    }

    const adminToken = loginData.token;
    console.log('   token obtido com sucesso');

    // ------------------------------------------------------------
    console.log('\n2. Criar jogador1...');
    const createRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ username: 'jogador1', password: 'senha123', is_admin: false })
    });
    const createData = await createRes.json();
    console.log('   status:', createRes.status, '| resposta:', createData);

    const jogador1Id = createData.id;

    // ------------------------------------------------------------
    console.log('\n3. Listar usuários...');
    const listRes = await fetch(`${BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const listData = await listRes.json();
    console.log('   status:', listRes.status, '| total de usuários:', listData.length);

    // ------------------------------------------------------------
    console.log('\n4. Criar usuário duplicado (espera 409)...');
    const dupRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
        },
        body: JSON.stringify({ username: 'jogador1', password: 'senha123', is_admin: false })
    });
    const dupData = await dupRes.json();
    console.log('   status:', dupRes.status, '| resposta:', dupData);

    // ------------------------------------------------------------
    console.log('\n5. Criar usuário sem token (espera 401)...');
    const noAuthRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'jogador2', password: 'senha123', is_admin: false })
    });
    const noAuthData = await noAuthRes.json();
    console.log('   status:', noAuthRes.status, '| resposta:', noAuthData);

    // ------------------------------------------------------------
    console.log('\n6. Login como jogador1...');
    const loginJogadorRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'jogador1', password: 'senha123' })
    });
    const loginJogadorData = await loginJogadorRes.json();
    const jogadorToken = loginJogadorData.token;
    console.log('   status:', loginJogadorRes.status, '| token obtido:', !!jogadorToken);

    // ------------------------------------------------------------
    console.log('\n7. Jogador1 tenta criar usuário (espera 403)...');
    const forbiddenRes = await fetch(`${BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jogadorToken}`
        },
        body: JSON.stringify({ username: 'jogador3', password: 'senha123', is_admin: false })
    });
    const forbiddenData = await forbiddenRes.json();
    console.log('   status:', forbiddenRes.status, '| resposta:', forbiddenData);

    // ------------------------------------------------------------
    console.log('\n8. Remover jogador1...');
    const deleteRes = await fetch(`${BASE_URL}/admin/users/${jogador1Id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const deleteData = await deleteRes.json();
    console.log('   status:', deleteRes.status, '| resposta:', deleteData);

    console.log('\nTeste concluído.');
}

main().catch(err => console.error('Erro inesperado:', err));