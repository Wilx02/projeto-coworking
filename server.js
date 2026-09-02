try { process.loadEnvFile(); } catch { /* .env ausente: segue sem ele */ }
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'inova-work-dev';
const PUBLIC = path.join(__dirname, 'public');
const DATA = process.env.RESERVAS_FILE || path.join(__dirname, 'data', 'reservas.json');
const CERT = path.join(__dirname, 'certs', 'localhost.pfx');
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Inova Work <onboarding@resend.dev>';
const mesas = ['A01', 'A02', 'A03', 'B01', 'B02', 'Sala Privativa 1'];
let filaDeGravacao = Promise.resolve();

async function iniciarBase() { await fs.mkdir(path.dirname(DATA), { recursive: true }); try { await fs.access(DATA); } catch { await fs.writeFile(DATA, '[]'); } }
async function lerReservas() { return JSON.parse(await fs.readFile(DATA, 'utf8')); }
function falha(mensagem, code) { const erro = new Error(mensagem); erro.code = code; return erro; }
function dataValida(data) { return /^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(new Date(`${data}T12:00:00`).getTime()); }
function dataFutura(data) { return data >= new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); }
function reservaValida({ nome, email, data, mesa }) { return [nome, email, data, mesa].every(v => typeof v === 'string' && v.trim()) && dataValida(data) && dataFutura(data) && /^\S+@\S+\.\S+$/.test(email) && mesas.includes(mesa); }
async function naFila(operacao) { const trabalho = filaDeGravacao.then(operacao); filaDeGravacao = trabalho.catch(() => {}); return trabalho; }
async function criarReserva(reserva) { return naFila(async () => {
  const reservas = await lerReservas();
  if (reservas.some(r => r.data === reserva.data && r.mesa === reserva.mesa && r.status === 'confirmada')) throw falha('Esta estação já está reservada para a data escolhida.', 'CONFLITO');
  const mes = reserva.data.slice(0, 7);
  if (reservas.filter(r => r.email === reserva.email && r.data.startsWith(mes) && r.status === 'confirmada').length >= 10) throw falha('Este cliente já atingiu o limite mensal de 10 reservas.', 'LIMITE');
  reservas.push(reserva); await fs.writeFile(DATA, JSON.stringify(reservas, null, 2)); return reserva;
}); }
async function atualizarReserva(id, alteracoes) { return naFila(async () => {
  const reservas = await lerReservas(); const indice = reservas.findIndex(r => r.id === id);
  if (indice < 0) throw falha('Reserva não encontrada.', 'NAO_ENCONTRADA');
  const proxima = { ...reservas[indice], ...alteracoes, atualizadaEm: new Date().toISOString() };
  if (proxima.status === 'confirmada' && reservas.some(r => r.id !== id && r.data === proxima.data && r.mesa === proxima.mesa && r.status === 'confirmada')) throw falha('Esta estação já está reservada para a data escolhida.', 'CONFLITO');
  reservas[indice] = proxima; await fs.writeFile(DATA, JSON.stringify(reservas, null, 2)); return proxima;
}); }
function autorizado(req) { const token = req.headers['x-admin-token']; return typeof token === 'string' && token.length === ADMIN_TOKEN.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(ADMIN_TOKEN)); }
function escaparHtml(valor) { return String(valor).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]); }
async function enviarConfirmacao(reserva) {
  if (!RESEND_API_KEY) return { status: 'nao_configurado' };
  const html = `<main style="font-family:Arial,sans-serif;color:#192b28"><h1>Reserva confirmada!</h1><p>Olá, ${escaparHtml(reserva.nome)}.</p><p>Sua estação no <strong>Inova Work</strong> está garantida.</p><table><tr><td><strong>Código</strong></td><td>${reserva.codigo}</td></tr><tr><td><strong>Data</strong></td><td>${reserva.data}</td></tr><tr><td><strong>Estação</strong></td><td>${escaparHtml(reserva.mesa)}</td></tr></table><p>Rua da Inovação, 1200 — Florianópolis, SC.</p><p>Para remarcar ou cancelar, entre em contato com a recepção.</p></main>`;
  const resposta = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `reserva-${reserva.id}` }, body: JSON.stringify({ from: EMAIL_FROM, to: [reserva.email], subject: `Reserva confirmada — ${reserva.codigo}`, html, text: `Reserva confirmada. Código: ${reserva.codigo}. Data: ${reserva.data}. Estação: ${reserva.mesa}.` }) });
  const retorno = await resposta.json();
  if (!resposta.ok) throw falha(retorno.message || 'Não foi possível enviar o e-mail.', 'EMAIL');
  return { status: 'enviado', id: retorno.id };
}
function responder(res, status, corpo, tipo = 'application/json') { res.writeHead(status, { 'Content-Type': `${tipo}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin' }); res.end(tipo === 'application/json' ? JSON.stringify(corpo) : corpo); }
function corpoJson(req) { return new Promise((resolve, reject) => { let dados = ''; req.on('data', p => { dados += p; if (dados.length > 100000) reject(falha('Requisição muito grande.')); }); req.on('error', () => reject(falha('Conexão interrompida.'))); req.on('end', () => { try { resolve(JSON.parse(dados || '{}')); } catch { reject(falha('JSON inválido.')); } }); }); }
const handler = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === 'GET' && url.pathname === '/health') return responder(res, 200, { status: 'ok', servico: 'inova-work', horario: new Date().toISOString() });
    if (req.method === 'GET' && url.pathname === '/api/mesas') return responder(res, 200, { mesas });
    if (req.method === 'GET' && url.pathname === '/api/reservas') { const data = url.searchParams.get('data'); return responder(res, 200, { reservas: (await lerReservas()).filter(r => !data || r.data === data).filter(r => r.status === 'confirmada').map(r => ({ mesa: r.mesa, data: r.data })) }); }
    if (req.method === 'GET' && url.pathname === '/api/admin/reservas') { if (!autorizado(req)) return responder(res, 401, { erro: 'Acesso não autorizado.' }); return responder(res, 200, { reservas: (await lerReservas()).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)) }); }
    if (req.method === 'POST' && url.pathname === '/api/reservas') {
      const dados = await corpoJson(req); if (!reservaValida(dados)) return responder(res, 400, { erro: 'Informe nome, e-mail válido, data futura e estação disponível.' });
      const reserva = { id: crypto.randomUUID(), codigo: `IW-${crypto.randomBytes(3).toString('hex').toUpperCase()}`, nome: dados.nome.trim(), email: dados.email.trim().toLowerCase(), data: dados.data, mesa: dados.mesa, status: 'confirmada', criadaEm: new Date().toISOString() };
      await criarReserva(reserva);
      try { reserva.emailEntrega = await enviarConfirmacao(reserva); } catch (erro) { reserva.emailEntrega = { status: 'falhou', motivo: erro.message }; }
      await atualizarReserva(reserva.id, { emailEntrega: reserva.emailEntrega });
      return responder(res, 201, { mensagem: reserva.emailEntrega.status === 'enviado' ? `Reserva confirmada e e-mail enviado. Código: ${reserva.codigo}.` : `Reserva confirmada. Código: ${reserva.codigo}.`, reserva });
    }
    if (req.method === 'PATCH' && /^\/api\/admin\/reservas\/[^/]+$/.test(url.pathname)) {
      if (!autorizado(req)) return responder(res, 401, { erro: 'Acesso não autorizado.' }); const dados = await corpoJson(req); const id = decodeURIComponent(url.pathname.split('/').pop());
      if (dados.status === 'cancelada') return responder(res, 200, { mensagem: 'Reserva cancelada.', reserva: await atualizarReserva(id, { status: 'cancelada' }) });
      if (reservaValida({ nome: 'x', email: 'x@x.com', data: dados.data, mesa: dados.mesa })) return responder(res, 200, { mensagem: 'Reserva remarcada.', reserva: await atualizarReserva(id, { data: dados.data, mesa: dados.mesa, status: 'confirmada' }) });
      return responder(res, 400, { erro: 'Informe uma nova data futura e uma estação válida.' });
    }
    if (req.method === 'GET') { const arquivo = url.pathname === '/' ? 'index.html' : path.basename(url.pathname); const permitido = { 'index.html': 'text/html', 'app.js': 'application/javascript', 'style.css': 'text/css' }; if (permitido[arquivo]) return responder(res, 200, await fs.readFile(path.join(PUBLIC, arquivo), 'utf8'), permitido[arquivo]); }
    responder(res, 404, { erro: 'Recurso não encontrado.' });
  } catch (erro) { const status = erro.code === 'CONFLITO' ? 409 : erro.code === 'NAO_ENCONTRADA' ? 404 : erro.code === 'LIMITE' ? 422 : 500; responder(res, status, { erro: erro.message || 'Erro interno.' }); }
};
const app = http.createServer(handler);
if (require.main === module) iniciarBase().then(async () => {
  try {
    const pfx = await fs.readFile(CERT);
    const servidor = https.createServer({ pfx, passphrase: process.env.HTTPS_PFX_PASSWORD || 'inova-work-local' }, handler);
    servidor.on('error', erro => console.error(`Não foi possível iniciar o servidor HTTPS: ${erro.message}`));
    servidor.listen(PORT, () => console.log(`Inova Work disponível em https://localhost:${PORT}`));
  } catch {
    const servidor = http.createServer(handler);
    servidor.on('error', erro => console.error(`Não foi possível iniciar o servidor HTTP: ${erro.message}`));
    servidor.listen(PORT, () => console.log(`Inova Work disponível em http://localhost:${PORT} (sem HTTPS: certificado local ausente)`));
  }
});
module.exports = { app, iniciarBase };
