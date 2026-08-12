const $ = s => document.querySelector(s);
const data = $('#data'), mesa = $('#mesa'), form = $('#formReserva'), mensagem = $('#mensagem'), mapa = $('#mapaMesas');
let todasMesas = [];
data.min = new Date().toISOString().slice(0, 10);
async function carregarMesas() {
  if (!data.value) return; mesa.innerHTML = '<option>Carregando estações...</option>';
  const [m, r] = await Promise.all([fetch('/api/mesas').then(x => x.json()), fetch(`/api/reservas?data=${data.value}`).then(x => x.json())]);
  todasMesas = m.mesas; const ocupadas = new Set(r.reservas.map(x => x.mesa));
  mesa.innerHTML = '<option value="">Selecione uma estação</option>' + todasMesas.map(x => `<option value="${x}" ${ocupadas.has(x) ? 'disabled' : ''}>${x}${ocupadas.has(x) ? ' — indisponível' : ''}</option>`).join('');
  mapa.innerHTML = todasMesas.map(x => `<span class="${ocupadas.has(x) ? 'ocupada' : 'livre'}">${x}<small>${ocupadas.has(x) ? 'ocupada' : 'livre'}</small></span>`).join('');
}
data.addEventListener('change', carregarMesas);
form.addEventListener('submit', async e => { e.preventDefault(); mensagem.textContent = 'Confirmando…'; mensagem.className = ''; const payload = Object.fromEntries(new FormData(form));
  const resp = await fetch('/api/reservas', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); const retorno = await resp.json(); mensagem.textContent = retorno.mensagem || retorno.erro; mensagem.className = resp.ok ? 'sucesso' : 'erro';
  if (resp.ok) { form.reset(); mesa.innerHTML = '<option value="">Selecione uma data primeiro</option>'; mapa.innerHTML = ''; }
});
const token = $('#tokenAdmin'), lista = $('#listaReservas'), mensagemAdmin = $('#mensagemAdmin');
function auth() { return {'X-Admin-Token': token.value, 'Content-Type':'application/json'}; }
async function carregarPainel() { mensagemAdmin.textContent = 'Carregando…'; const r = await fetch('/api/admin/reservas', { headers: auth() }); const d = await r.json(); if (!r.ok) { mensagemAdmin.textContent = d.erro; mensagemAdmin.className = 'erro'; return; } mensagemAdmin.textContent = `${d.reservas.length} reserva(s) encontrada(s).`; mensagemAdmin.className = 'sucesso'; lista.hidden = false;
  lista.innerHTML = d.reservas.length ? d.reservas.map(x => `<article class="reserva-item ${x.status === 'cancelada' ? 'cancelada' : ''}"><div><h3>${x.mesa} · ${x.data}</h3><p>${x.nome} — ${x.email}<br>Código ${x.codigo} · ${x.status}</p></div>${x.status === 'confirmada' ? `<div><button data-acao="remarcar" data-id="${x.id}">Remarcar</button> <button data-acao="cancelar" data-id="${x.id}">Cancelar</button></div>` : ''}</article>`).join('') : '<p>Nenhuma reserva registrada.</p>';
}
$('#entrarPainel').addEventListener('click', carregarPainel);
lista.addEventListener('click', async e => { const b = e.target.closest('button'); if (!b) return; let payload; if (b.dataset.acao === 'cancelar') { if (!confirm('Cancelar esta reserva?')) return; payload = {status:'cancelada'}; } else { const novaData = prompt('Nova data (AAAA-MM-DD):'); const novaMesa = prompt(`Nova estação: ${todasMesas.join(', ')}`); if (!novaData || !novaMesa) return; payload = {data:novaData, mesa:novaMesa}; } const r = await fetch(`/api/admin/reservas/${b.dataset.id}`, {method:'PATCH',headers:auth(),body:JSON.stringify(payload)}); const d = await r.json(); mensagemAdmin.textContent = d.mensagem || d.erro; mensagemAdmin.className = r.ok ? 'sucesso' : 'erro'; if (r.ok) carregarPainel(); });
const dialog = $('#privacidade'); document.querySelector('footer a').addEventListener('click', e => { e.preventDefault(); dialog.showModal(); }); $('#fecharPrivacidade').addEventListener('click', () => dialog.close());
