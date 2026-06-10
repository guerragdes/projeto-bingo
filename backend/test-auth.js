require('dotenv').config();
const { login } = require('./src/services/auth.service');

async function test() {
    try {
        const resultado = await login('admin', 'senha123');
        console.log('Login bem-sucedido:', resultado);
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        process.exit(0);
    }
}

test();