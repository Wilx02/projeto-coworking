-- Migração para PostgreSQL antes de escalar o portal para múltiplas instâncias.
CREATE TABLE reservas (
  id UUID PRIMARY KEY,
  codigo VARCHAR(16) NOT NULL UNIQUE,
  nome VARCHAR(80) NOT NULL,
  email VARCHAR(120) NOT NULL,
  data DATE NOT NULL,
  mesa VARCHAR(40) NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('confirmada', 'cancelada')),
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ
);
CREATE UNIQUE INDEX reserva_estacao_unica
  ON reservas (data, mesa) WHERE status = 'confirmada';
CREATE INDEX reservas_data_idx ON reservas (data);
