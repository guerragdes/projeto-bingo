// ============================================================
// test-gameview-cli.js
//
// "Controle remoto" de linha de comando para testar a Fase 7
// (GameView.vue) no navegador, já que o AdminView ainda não
// tem interface própria (placeholder, tarefa 40).
//
// Guarda o ID da partida atual num arquivo temporário
// (.test-gameview-state.json), para que cada comando saiba
// em qual partida agir sem precisar repetir o ID toda vez.
//
// Comandos disponíveis:
//   node test-gameview-cli.js create        -> cria nova partida
//   node test-gameview-cli.js use <ID>      -> aponta o script para uma partida já existente
//                                               (útil quando a partida foi criada pela interface)
//   node test-gameview-cli.js start         -> inicia a partida atual
//   node test-gameview-cli.js draw          -> sorteia 1 número
//   node test-gameview-cli.js draw 10       -> sorteia 10 números, com pausa entre eles
//   node test-gameview-cli.js finish        -> encerra a partida atual
//   node test-gameview-cli.js status        -> mostra a partida atual
//
// Requer que o servidor esteja rodando (npm run dev).
// ============================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const STATE_FILE = path.join(__dirname, '.test-gameview-state.json');

// Substitua pela senha real do admin (a mesma do .env)
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'senha123';

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function loadState() {
    if (!fs.existsSync(STATE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function login() {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    });
    const data = await res.json();
    if (res.status !== 200) {
        throw new Error('Login falhou: ' + JSON.stringify(data));
    }
    return data.token;
}

function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function esperar(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    const command = process.argv[2];
    const arg = process.argv[3];

    const token = await login();
    const headers = authHeaders(token);

    if (command === 'create') {
        const res = await fetch(`${BASE_URL}/games`, { method: 'POST', headers });
        const data = await res.json();

        if (res.status !== 201) {
            console.log('Não foi possível criar partida:', data);
            console.log('(Se já existe uma em andamento, rode "finish" primeiro.)');
            return;
        }

        saveState({ gameId: data.id });
        console.log(`Partida criada: id=${data.id}, status=${data.status}`);
        console.log('Verifique no navegador: o jogador deve ver a cartela e a mensagem');
        console.log('"Partida criada. Aguardando o administrador iniciar o sorteio."');

    } else if (command === 'start') {
        const state = loadState();
        if (!state) return console.log('Nenhuma partida registrada. Rode "create" primeiro.');

        const res = await fetch(`${BASE_URL}/games/${state.gameId}/start`, { method: 'PATCH', headers });
        const data = await res.json();
        console.log('Partida iniciada:', data);
        console.log('Verifique no navegador: a mensagem de "aguardando início" deve sumir automaticamente.');

    } else if (command === 'draw') {
        const state = loadState();
        if (!state) return console.log('Nenhuma partida registrada. Rode "create" primeiro.');

        const count = parseInt(arg) || 1;
        console.log(`Sorteando ${count} número(s), com pausa de 1.5s entre cada...`);

        for (let i = 1; i <= count; i++) {
            const res = await fetch(`${BASE_URL}/games/${state.gameId}/draw`, { method: 'POST', headers });
            const data = await res.json();

            if (res.status !== 200) {
                console.log(`Sorteio ${i} falhou:`, data);
                break;
            }

            console.log(`  sorteio ${i}: número ${data.number} (${data.letter})`);
            if (i < count) await esperar(1500);
        }

        console.log('Verifique no navegador: a bolinha, a tabela e a cartela devem atualizar a cada número.');

    } else if (command === 'finish') {
        const state = loadState();
        if (!state) return console.log('Nenhuma partida registrada. Rode "create" primeiro.');

        const res = await fetch(`${BASE_URL}/games/${state.gameId}/finish`, { method: 'PATCH', headers });
        const data = await res.json();
        console.log('Partida encerrada:', data);
        console.log('Verifique no navegador: deve aparecer a tela de "Partida encerrada!" com a lista de vencedores,');
        console.log('e após ~6 segundos, voltar sozinha para a tela de espera.');

    } else if (command === 'use') {
        const gameId = parseInt(arg);
        if (!gameId) {
            console.log('Uso: node test-gameview-cli.js use <ID_DA_PARTIDA>');
            return;
        }
        saveState({ gameId });
        console.log(`Script agora apontando para a partida id=${gameId}.`);
        console.log('Use "node test-gameview-cli.js draw N" para sortear vários números rapidamente.');

    } else if (command === 'status') {
        const state = loadState();
        console.log('Estado salvo localmente:', state || '(nenhum)');

        const res = await fetch(`${BASE_URL}/games/active`, { headers });
        if (res.status === 204) {
            console.log('Partida ativa no backend: nenhuma.');
        } else {
            console.log('Partida ativa no backend:', await res.json());
        }

    } else {
        console.log('Uso: node test-gameview-cli.js <create|start|draw [N]|finish|status>');
    }
}

main().catch(err => console.error('Erro inesperado:', err));