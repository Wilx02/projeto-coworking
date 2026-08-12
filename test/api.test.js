const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
process.env.RESERVAS_FILE = path.join(os.tmpdir(), `inova-work-test-${process.pid}.json`);
const { app, iniciarBase } = require('../server');

let servidor, base;
test.before(async () => { await iniciarBase(); servidor = app.listen(0); await new Promise(r => servidor.once('listening', r)); base = `http://127.0.0.1:${servidor.address().port}`; });
test.after(async () => { servidor.close(); await fs.rm(process.env.RESERVAS_FILE, { force: true }); });
test('health check responde com serviço operacional', async () => {
  const r = await fetch(`${base}/health`); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'ok');
});
test('valida campos obrigatórios da reserva', async () => {
  const r = await fetch(`${base}/api/reservas`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }); assert.equal(r.status, 400);
});
test('painel administrativo exige token e aceita o token configurado', async () => {
  const negado = await fetch(`${base}/api/admin/reservas`);
  assert.equal(negado.status, 401);
  const autorizado = await fetch(`${base}/api/admin/reservas`, { headers: { 'X-Admin-Token': 'inova-work-dev' } });
  assert.equal(autorizado.status, 200);
});
test('não permite duas reservas para a mesma mesa e data', async () => {
  const dia = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  const reserva = { nome:'Teste Automático', email:'teste@inova.com', data:`2090-01-${dia}`, mesa:'A01' };
  const post = () => fetch(`${base}/api/reservas`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(reserva) });
  assert.equal((await post()).status, 201); assert.equal((await post()).status, 409);
});
