# Registro de domínio e ambiente em nuvem (simulação)

> Esta simulação é um artefato de configuração. O domínio `inovawork.com.br` não foi comprado ou alterado por esta entrega.

## Zona DNS proposta

| Tipo | Nome | Valor | TTL | Finalidade |
|---|---|---|---|---|
| A | `@` | `203.0.113.10` | 300 | Portal principal (IP de documentação) |
| CNAME | `www` | `inovawork.com.br` | 300 | Acesso com www |
| CAA | `@` | `0 issue "letsencrypt.org"` | 3600 | Autoridade de certificado |

O endereço `203.0.113.10` pertence à faixa reservada para documentação (RFC 5737), portanto não direciona tráfego real. No provedor escolhido, ele deve ser trocado pelo IP público ou nome do balanceador.

## Parâmetros de publicação

- Domínio canônico: `https://www.inovawork.com.br`.
- Certificado TLS: Let's Encrypt, renovação automática.
- Redirecionamento: HTTP → HTTPS e raiz → `www`.
- Serviço: container da aplicação na porta interna 3000; somente 80/443 expostas publicamente.
- Dados: volume persistente com backup diário e teste mensal de restauração.

## Validação após apontamento

```powershell
Resolve-DnsName inovawork.com.br
curl https://www.inovawork.com.br/health
```

O DNS deve retornar o destino contratado e o health check deve responder HTTP 200.
