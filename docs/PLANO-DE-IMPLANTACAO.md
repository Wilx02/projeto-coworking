# Plano de implantação — Inova Work

## Objetivo

Disponibilizar um portal corporativo para consulta de planos e reserva de estações, eliminando a anotação manual e impedindo que uma mesma mesa seja confirmada duas vezes na mesma data.

## Arquitetura entregue

```text
Usuário / Recepção → https://www.inovawork.com.br → proxy TLS
                                                    → Portal Node.js → volume persistente de reservas
```

- **Portal:** página responsiva de planos e formulário de reserva.
- **API:** endpoints para estações, disponibilidade e confirmação.
- **Integridade:** a operação de leitura, validação e gravação é serializada; uma tentativa concorrente recebe `409 Conflict`.
- **Persistência:** `data/reservas.json` em volume Docker. Para produção de múltiplas instâncias, substituir pelo banco gerenciado PostgreSQL com índice único `(data, mesa)`.
- **Segurança aplicada:** validação no servidor, ID aleatório, cabeçalho `nosniff`, não armazenamento de dados em cache e limite de corpo da requisição.

## Configuração do acesso operacional

Antes de publicar, defina um token forte fora do código. Em PowerShell, para uso local:

```powershell
$env:ADMIN_TOKEN = 'troque-por-um-segredo-longo'
npm start
```

O valor padrão existe apenas para demonstração local e não deve ser usado em produção. O painel exige esse token para listar, cancelar ou remarcar reservas.

## E-mail de confirmação

O portal envia confirmação automaticamente quando `RESEND_API_KEY` estiver definida. Para teste no PowerShell, configure a chave apenas na sessão atual e inicie o portal:

```powershell
$env:RESEND_API_KEY = 'sua-chave-da-Resend'
$env:EMAIL_FROM = 'Inova Work <onboarding@resend.dev>'
npm start
```

Para enviar usando `@inovawork.com.br`, valide o domínio no provedor de e-mail e use um remetente desse domínio. A chave é segredo operacional: nunca a inclua no Git ou em arquivos públicos.

## Banco gerenciado em produção

O armazenamento JSON mantém a demonstração simples e persistente em um único container. Para ambiente em nuvem com escala, crie um PostgreSQL gerenciado e aplique [BANCO-DE-DADOS-PRODUCAO.sql](BANCO-DE-DADOS-PRODUCAO.sql). O índice parcial apresentado é a garantia final contra reservas duplicadas entre múltiplas instâncias.

## Critérios de aceite

| Critério | Evidência |
|---|---|
| Planos visíveis | Página inicial, seção “Planos” |
| Reserva com data e mesa | Formulário na seção “Garanta seu lugar” |
| Sem duplicidade | teste automatizado de resposta `409` |
| Serviço verificável | `GET /health` devolve `status: ok` |
| Operação documentada | Manual da recepção e roteiro de deploy |

## Roteiro de execução

1. Configure a máquina ou serviço de containers, instale Docker e copie o repositório.
2. Execute `docker compose up -d --build`.
3. Verifique `http://SEU_SERVIDOR:3000/health` e execute `npm test` antes da publicação.
4. Configure proxy reverso (Nginx, Caddy ou balanceador da nuvem) para encaminhar HTTPS à porta 3000.
5. Publique o DNS e valide a reserva com uma estação de teste.
6. Faça backup diário do volume `reservas_data` e monitore `/health` a cada 5 minutos.

## Operação e continuidade

## HTTPS local

Para desenvolvimento no Windows, execute uma única vez:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\criar-certificado-local.ps1
```

O script cria uma CA confiável apenas para o usuário atual e um certificado para `localhost`. Depois, `npm start` disponibiliza `https://localhost:3000` sem aviso de certificado. Em produção, use TLS emitido por uma autoridade pública no domínio oficial; nunca use este certificado local.

- Janela de manutenção: fora do horário comercial; avise a recepção antes.
- Incidente: se o portal estiver indisponível, a recepção não deve confirmar em papel. Registre o contato e retorne ao sistema após o health check ficar verde.
- LGPD: dados de contato são usados apenas para a reserva. Definir prazo interno de retenção e acesso apenas à equipe autorizada.
