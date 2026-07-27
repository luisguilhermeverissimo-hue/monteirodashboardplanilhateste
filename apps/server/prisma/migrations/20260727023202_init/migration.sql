-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PapelUsuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "processoId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PapelUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PapelUsuario_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Processo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cnj" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "tribunal" TEXT NOT NULL,
    "naturezaJuridica" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "sigiloso" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "ultimoEventoEm" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Movimento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processoId" TEXT NOT NULL,
    "loyMovementId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movimento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processoId" TEXT NOT NULL,
    "movimentoId" TEXT,
    "loyDocumentId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "secretLevel" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT,
    "downloadedAt" DATETIME,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Documento_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Documento_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "Movimento" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectorRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "iniciadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "processosVerificados" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "detalhe" TEXT
);

-- CreateTable
CREATE TABLE "Publicacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "processoId" TEXT NOT NULL,
    "movimentoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOVA',
    "redatorId" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Publicacao_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "Processo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Publicacao_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "Movimento" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Publicacao_redatorId_fkey" FOREIGN KEY ("redatorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Minuta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicacaoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "autorId" TEXT NOT NULL,
    "arquivoPath" TEXT NOT NULL,
    "observacao" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Minuta_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "Publicacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Minuta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RegraPrazo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipoContagem" TEXT NOT NULL,
    "quantidadeDias" INTEGER NOT NULL,
    "janelaInicio" DATETIME,
    "janelaFim" DATETIME,
    "fundamentoLegal" TEXT NOT NULL,
    "exigeAlertaTermoAquo" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Prazo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicacaoId" TEXT NOT NULL,
    "regraAplicadaCodigo" TEXT NOT NULL,
    "dataSugerida" DATETIME NOT NULL,
    "alertaTermoAquo" BOOLEAN NOT NULL DEFAULT false,
    "dataConfirmada" DATETIME,
    "confirmadoPorId" TEXT,
    "confirmadoEm" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Prazo_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "Publicacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Prazo_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PeticaoIntermediaria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicacaoId" TEXT NOT NULL,
    "loyIntermediateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "criadoPorId" TEXT NOT NULL,
    "reciboPath" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladoEm" DATETIME,
    CONSTRAINT "PeticaoIntermediaria_publicacaoId_fkey" FOREIGN KEY ("publicacaoId") REFERENCES "Publicacao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PeticaoIntermediaria_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SugestaoDescoberta" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cnj" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "tribunal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "detectadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvidoPorId" TEXT,
    "resolvidoEm" DATETIME,
    CONSTRAINT "SugestaoDescoberta_resolvidoPorId_fkey" FOREIGN KEY ("resolvidoPorId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditoriaEvento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidadeTipo" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuarioId" TEXT,
    "detalhes" TEXT,
    "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hashAnterior" TEXT,
    "hash" TEXT NOT NULL,
    CONSTRAINT "AuditoriaEvento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "PapelUsuario_usuarioId_idx" ON "PapelUsuario"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "PapelUsuario_usuarioId_papel_processoId_key" ON "PapelUsuario"("usuarioId", "papel", "processoId");

-- CreateIndex
CREATE UNIQUE INDEX "Processo_cnj_key" ON "Processo"("cnj");

-- CreateIndex
CREATE INDEX "Processo_status_idx" ON "Processo"("status");

-- CreateIndex
CREATE INDEX "Processo_naturezaJuridica_idx" ON "Processo"("naturezaJuridica");

-- CreateIndex
CREATE INDEX "Movimento_processoId_data_idx" ON "Movimento"("processoId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Movimento_processoId_loyMovementId_key" ON "Movimento"("processoId", "loyMovementId");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_processoId_loyDocumentId_key" ON "Documento"("processoId", "loyDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "Publicacao_movimentoId_key" ON "Publicacao"("movimentoId");

-- CreateIndex
CREATE INDEX "Publicacao_status_idx" ON "Publicacao"("status");

-- CreateIndex
CREATE INDEX "Publicacao_redatorId_idx" ON "Publicacao"("redatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Minuta_publicacaoId_versao_key" ON "Minuta"("publicacaoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "RegraPrazo_codigo_key" ON "RegraPrazo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Prazo_publicacaoId_key" ON "Prazo"("publicacaoId");

-- CreateIndex
CREATE INDEX "Prazo_status_idx" ON "Prazo"("status");

-- CreateIndex
CREATE INDEX "Prazo_dataConfirmada_idx" ON "Prazo"("dataConfirmada");

-- CreateIndex
CREATE UNIQUE INDEX "PeticaoIntermediaria_publicacaoId_key" ON "PeticaoIntermediaria"("publicacaoId");

-- CreateIndex
CREATE UNIQUE INDEX "SugestaoDescoberta_cnj_key" ON "SugestaoDescoberta"("cnj");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_entidadeTipo_entidadeId_idx" ON "AuditoriaEvento"("entidadeTipo", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditoriaEvento_criadoEm_idx" ON "AuditoriaEvento"("criadoEm");
