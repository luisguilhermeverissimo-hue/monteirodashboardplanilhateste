# Projeto: Sistema de Monitoramento, Saneamento e Peticionamento Processual
### Integração com API Loy — Especificação para Desenvolvimento

**Titular do projeto:** Luís Guilherme Veríssimo de Andrade (OAB/PE 60.648) — Monteiro e Monteiro Advogados Associados
**Data de consolidação:** 26/07/2026
**Status:** Especificação funcional — pré-desenvolvimento

> Complementada pela revisão de segurança em [`loy-integration-security-review.md`](./loy-integration-security-review.md).

---

## 1. Visão Geral e Objetivo

O sistema substitui a checagem manual de publicações, intimações e movimentações processuais (hoje feita processo a processo, tribunal a tribunal) por um painel central que:

1. Vigia automaticamente um acervo de centenas de processos em múltiplos tribunais (TJPE, TRF-1, TRE-MA/TSE, entre outros conforme o acervo cresça);
2. Detecta publicações e intimações novas assim que ocorrem, sem depender de consulta manual ao mural eletrônico ou ao PJe de cada tribunal;
3. Organiza o fluxo de trabalho entre três papéis distintos do escritório — quem lê e triagem, quem redige a resposta, e quem tem autorização para protocolar — com trilha de auditoria completa;
4. Sugere prazos com base na regra de contagem correta (eleitoral vs. ordinária), mas nunca decide por conta própria: toda confirmação de prazo e todo protocolo dependem de ação humana explícita;
5. Permite consulta avulsa, em tempo real, de qualquer processo, além do acervo pré-cadastrado.

**Princípio orientador:** a automação faz o trabalho mecânico (vigiar, buscar, organizar); o julgamento jurídico (o que a decisão significa, qual o prazo real, se protocola ou não) permanece sempre com o advogado. Não há leitura inteligente (IA) do teor das decisões nesta versão — isso é decisão deliberada do titular do projeto, não uma limitação técnica.

---

## 2. Escopo do Projeto

### Dentro do escopo
- Importação inicial do acervo via planilha (Excel/CSV)
- Cadastro manual de processos novos pela interface
- Descoberta automática de processos vinculados à OAB do(s) advogado(s), via API Loy
- Consulta avulsa de qualquer processo por CNJ, sob demanda
- Monitoramento automático (cron) de movimentações/publicações dos processos do acervo
- Download e armazenamento dos documentos/decisões associados a cada evento
- Fluxo de trabalho com três papéis (Saneador, Redator, Peticionante) e transições de estado auditadas
- Motor de contagem de prazos com duas regras (eleitoral período especial e ordinária/CPC), com alerta específico para o termo a quo de recursos de registro de candidatura
- Tela dedicada de gestão de prazos (em aberto, cumpridos, vencidos), priorizada por urgência
- Integração de peticionamento fim a fim com a API Loy (criação de petição intermediária, upload de documentos, abertura da janela de assinatura/protocolo, coleta de recibo)
- Trilha de auditoria completa e imutável de todas as ações

### Fora do escopo (nesta versão)
- Qualquer leitura ou classificação automática do teor das decisões via IA
- Notificação via WhatsApp/Mesa (descartada por ora a pedido do titular)
- Módulo de audiências e atas (adiado para versão futura)
- Distribuição de ações novas (o escopo cobre atos em processos já existentes/importados)

---

## 3. Arquitetura Macro

O sistema tem três camadas com responsabilidades bem separadas:

**Camada 1 — Motor de coleta (roda sozinho, sem interface)**
Processo agendado (cron) que percorre o acervo ativo, consulta a API Loy (Movimentos/Documentos) para cada processo, identifica eventos novos, baixa os documentos associados e grava tudo na base de dados. Não interage com o usuário; não toma decisão alguma sobre prazo ou conteúdo.

**Camada 2 — Servidor-ponte (backend)**
Intermediário obrigatório entre a interface (HTML) e a API Loy. Necessário por um motivo de segurança concreto: o token de acesso à Loy não pode, em hipótese alguma, ficar exposto no código do navegador, pois ele também autoriza peticionamento — um vazamento permitiria protocolo indevido em nome do escritório. O servidor-ponte guarda o token, executa as chamadas reais à Loy, e expõe rotas internas simples para a interface consumir (listar acervo, adicionar processo, consultar avulso, preparar minuta, protocolar).

**Camada 3 — Interface (HTML/painel)**
O que o advogado efetivamente usa. Não fala diretamente com a Loy em nenhuma hipótese — sempre por meio do servidor-ponte. Contém as telas descritas na Seção 10.

```
Planilha inicial ──┐
Descoberta Loy ─────┼──▶ Base de dados (acervo) ◀── Cron (motor de coleta) ──▶ API Loy (Consulta)
Cadastro manual ────┘         │
                               ▼
                        Servidor-ponte ◀────────────▶ API Loy (Peticionamento / Trust)
                               │
                               ▼
                          Interface HTML
```

---

## 4. Fontes de Processos (entrada de dados)

Três formas de um processo entrar no acervo monitorado, todas convergindo para a mesma base:

1. **Planilha inicial** — fornecida pelo titular do projeto, contendo os processos já em acompanhamento (autor, CNJ, tribunal). Justificativa para manter essa via mesmo com a Descoberta de Processos disponível: nem todo processo já está habilitado em nome do advogado cadastrado na Loy (caso comum em processos de registro de candidatura em fase de habilitação), então a Descoberta automática não os encontraria.
2. **Descoberta de Processos (API Loy)** — identifica automaticamente processos novos vinculados à OAB do advogado. Quando encontrado, o sistema **sugere** a inclusão no acervo — nunca inclui sozinho; exige confirmação humana na interface.
3. **Cadastro manual / consulta avulsa promovida** — o advogado adiciona um processo pontualmente pela interface (formulário simples) ou promove uma consulta avulsa (ver Seção 10.3) ao acervo permanente com um clique.

---

## 5. Integração com a API Loy — Módulos Utilizados

| Módulo | Endpoints | Função no sistema |
|---|---|---|
| **Trust (Integração)** | `access-external` | Obtém sessão autenticada por tribunal, usando o certificado/login já cadastrado na conta Loy do advogado — não exige digitação de senha a cada chamada |
| **Consulta — Importação** | `process/capture` | Registra um novo CNJ na base Loy (assíncrono; resposta inicial é "processando") |
| **Consulta — Capa** | `process/{cnj}` | Dados estruturados do processo: partes, classe, assunto, magistrado, valor, status |
| **Consulta — Movimentos** | `movements/{id}` | Linha do tempo de eventos processuais — é a fonte primária de detecção de intimação/publicação nova |
| **Consulta — Documentos** | `documents/{id}` | Lista de arquivos anexados ao processo |
| **Consulta — Download** | `documents/file/{file}` | Baixa o PDF de um documento específico |
| **Peticionamento — Criação** | `intermediates` | Cria petição em rascunho, vinculada ao processo |
| **Peticionamento — Upload** | `documents/upload` | Anexa cada arquivo (petição, procuração, anexos) — uma chamada por arquivo |
| **Peticionamento — Janela** | `app.loylegal.com/delivery` | Tela onde o peticionante confere e efetivamente assina/protocola |
| **Peticionamento — Recibo** | `intermediates/{id}` | Consulta status e coleta o recibo em PDF |
| **Peticionamento — Cancelamento** | `intermediates/{id}` | Cancela petição intermediária ainda não protocolada |
| **Descoberta de Processos** | (produto separado, não confirmado publicamente o endpoint exato) | Identifica processos novos vinculados à OAB |

---

## 6. Perfis de Acesso e Permissões

| Ação | Saneador | Redator | Peticionante |
|---|---|---|---|
| Ver acervo completo | Sim | Não (só fila própria) | Sim |
| Ler publicação / baixar teor | Sim | Sim (apenas atribuídas) | Sim |
| Confirmar prazo | Sim | Não | Não |
| Marcar publicação como tratada | Sim | Não | Não |
| Atribuir publicação para redação | Sim | Não | Não |
| Elaborar/anexar minuta | Não | Sim | Sim (pode ajustar antes de protocolar) |
| Enviar minuta para protocolo | Não | Sim | — |
| Devolver minuta para ajuste | Não | Recebe de volta | Sim |
| Criar petição intermediária na Loy | Não | Não | Sim |
| Upload de documentos na Loy | Não | Não | Sim |
| Abrir janela de peticionamento / assinar / protocolar | Não | Não | Sim |
| Ver trilha de auditoria completa | Provável (a definir se todos ou só sócios) | Não | Provável |

Um mesmo usuário pode acumular papéis diferentes em processos diferentes (ex.: titular do projeto como Saneador em todo o acervo, colega como Peticionante exclusivo). O sistema deve permitir atribuição de papel por usuário, não só um papel fixo global.

---

## 7. Fluxo de Estados (pipeline da publicação)

Cada publicação percorre estados bem definidos, cada transição exigindo ação de um papel específico:

```
Nova publicação (capturada pelo motor de coleta)
        │
        ▼  [Saneador: lê, confirma prazo]
Triada — prazo confirmado
        │
        ▼  [Saneador: decide que precisa resposta, atribui a um Redator]
Aguardando redação
        │
        ▼  [Redator: elabora e anexa minuta]
Pronta para protocolo
        │
   ┌────┴────┐
   ▼         ▼
Aprovada   Devolvida (com observação) ──▶ volta para "Aguardando redação"
   │
   ▼  [Peticionante: cria intermediate, upload, abre janela, assina]
Protocolada (recibo anexado)
```

Publicações que não exigem resposta (apenas ciência) podem ser marcadas como "Tratada" diretamente pelo Saneador, sem passar pelas etapas de redação/peticionamento.

---

## 8. Trilha de Auditoria

Requisito: registro completo, granular e **imutável** de cada ação, com usuário e timestamp. Nenhum registro de auditoria pode ser editado ou apagado após criado — apenas complementado por novos eventos.

Eventos mínimos a registrar por publicação:
- Captura (sistema, timestamp)
- Leitura (usuário, timestamp)
- Confirmação de prazo (usuário, data confirmada, timestamp da confirmação)
- Atribuição para redação (usuário que atribuiu, redator designado, timestamp)
- Anexação de minuta — cada versão (redator, número da versão, timestamp)
- Aprovação ou devolução de minuta (peticionante, observação se devolvida, timestamp)
- Protocolo (peticionante, timestamp, referência ao recibo)
- Marcação como tratada (usuário, timestamp)

A interface deve exibir essa trilha como linha do tempo legível por publicação/processo, não apenas como tabela de log bruta.

---

## 9. Motor de Prazos

### 9.1 Duas regras de contagem

O sistema precisa saber, para cada processo, qual regra de contagem aplicar — isso depende da natureza da ação e da data do evento:

**Regra eleitoral (período especial):** dias corridos, contínuos e peremptórios — contam-se incluindo sábados, domingos e feriados, sem prorrogação para o próximo dia útil. Fundamento: art. 16 da LC 64/90. Para o ciclo eleitoral de 2026, a janela em que essa regra vale é **de 15 de agosto de 2026 (19h, encerramento do prazo de registro de candidatura) a 18 de dezembro de 2026**, conforme Resolução TSE nº 23.760/2026 (Calendário Eleitoral).

**Regra ordinária (fora dessa janela, ou processos não eleitorais no mesmo acervo — trabalhista, FUNDEF/FUNDEB, cível):** dias úteis, conforme art. 219 do CPC, com suspensão em fins de semana e feriados.

Cada processo no acervo precisa de um campo de **natureza jurídica** (ex.: "Eleitoral — Registro de Candidatura", "Eleitoral — Representação", "Trabalhista", "Cível/FUNDEB") para que o motor escolha a regra correta automaticamente.

### 9.2 Alerta específico — termo a quo em recursos de registro de candidatura

Ponto crítico identificado: para recursos em processos de registro de candidatura, o prazo (tipicamente 3 dias, contínuo e peremptório — Res-TSE 23.609/2019, arts. 38 §8º, 63 e 78) conta-se **da publicação em sessão de julgamento**, não da data em que o documento aparece no PJe ou no mural eletrônico. Há entendimento do TSE de que a disponibilização posterior no PJe não desloca esse termo inicial.

**Implicação para o sistema:** a data do movimento capturado pela API Loy (quando o documento entra na base) não pode ser usada, sozinha, como termo inicial de contagem para esse tipo específico de evento. O sistema deve:
- Calcular e exibir uma data sugerida com base no movimento capturado (como faz para os demais casos);
- Mas, quando o tipo de evento for identificado como "acórdão/decisão de registro de candidatura", exibir um aviso obrigatório: *"Prazo recursal conta da sessão de julgamento — confirme a data da ata antes de aceitar esta sugestão"*, impedindo confirmação de prazo em um clique sem que o Saneador veja esse alerta.

### 9.3 Confirmação humana obrigatória

Em nenhuma hipótese o sistema define o prazo sozinho. Ele sempre **sugere** (data calculada + regra aplicada + alerta quando cabível); a confirmação — e a responsabilidade — é sempre do Saneador, registrada na auditoria como ato distinto da sugestão do sistema.

---

## 10. Telas da Interface

### 10.1 Acervo completo
Lista de todos os processos monitorados: autor, CNJ, tribunal, natureza jurídica, data do último evento, status. Cada linha abre o histórico de movimentos já capturados.

### 10.2 Feed de novidades
Publicações/movimentos novos, mais recentes no topo, com contador de itens não vistos. Ponto de entrada do fluxo de triagem do Saneador.

### 10.3 Consulta avulsa
Campo para digitar um CNJ fora do acervo e consultar em tempo real (importação + capa + movimentos + documentos, via servidor-ponte). Botão para promover o resultado ao acervo permanente com um clique.

### 10.4 Formulário de cadastro manual
Adição pontual de processo ao acervo (CNJ, autor, tribunal, natureza jurídica) sem precisar de nova planilha.

### 10.5 Sugestões de descoberta
Lista de processos encontrados pela Descoberta de Processos (vinculados à OAB) ainda não confirmados pelo advogado — aguardando decisão de inclusão ou descarte.

### 10.6 Tela de gestão de prazos
Abas: **Em aberto** (ordenado por dias restantes, mais urgente no topo), **Cumpridos**, **Vencidos sem cumprimento** (destaque visual). Cada item mostra prazo sugerido, prazo confirmado, regra aplicada, e alerta de termo a quo quando cabível.

### 10.7 Fila do Redator
Visão restrita: apenas publicações atribuídas ao redator logado, ordenadas pelo prazo já confirmado pelo Saneador (o redator enxerga a urgência, mas não pode alterá-la).

### 10.8 Painel do Peticionante
Minutas "prontas para protocolo" aguardando ação. Cada item permite revisar o PDF, aprovar (iniciando o fluxo de criação/upload/janela na Loy) ou devolver com observação para o redator.

### 10.9 Linha do tempo de auditoria (por processo ou publicação)
Visualização cronológica de todas as ações registradas (Seção 8).

---

## 11. Considerações de Segurança

- O token da API Loy nunca é exposto ao navegador — vive exclusivamente no servidor-ponte.
- A ação de protocolar exige, além da permissão de papel, a confirmação explícita do advogado peticionante na janela da própria Loy (onde ocorre a assinatura digital via certificado).
- Documentos com `secretLevel` de sigilo devem ser tratados com controle de acesso adicional na interface (a definir se restrito por papel, por processo, ou ambos).

> Ver `loy-integration-security-review.md` para o detalhamento técnico destes controles e para itens adicionais (LGPD, gestão de segredo, autorização no servidor, auditoria imutável).

---

## 12. Fases de Desenvolvimento

**Fase 1 — Núcleo de monitoramento (leitura apenas)**
- Importação da planilha inicial para a base de dados
- Motor de coleta (cron): Movimentos + Documentos por processo
- Tela de Acervo completo e Feed de novidades
- Sem papéis distintos ainda — visão única de leitura

**Fase 2 — Fluxo de trabalho e papéis**
- Implementação dos três papéis (Saneador, Redator, Peticionante) e matriz de permissões
- Máquina de estados da publicação (Seção 7)
- Trilha de auditoria
- Tela de gestão de prazos com as duas regras de contagem e o alerta de termo a quo

**Fase 3 — Peticionamento integrado**
- Integração completa com o módulo de Peticionamento da Loy (criação, upload, janela, recibo, cancelamento)
- Painel do Peticionante e fila de minutas

**Fase 4 — Descoberta e consulta ativa**
- Integração com Descoberta de Processos (sugestão de inclusão)
- Consulta avulsa em tempo real com promoção ao acervo

**Fase 5 — Refinamentos**
- Cadastro manual de processos novos pela interface
- Ajustes de usabilidade identificados no uso real das fases anteriores

---

## 13. Pendências a Confirmar (bloqueadores ou riscos conhecidos)

1. **Cobertura da Loy para Justiça Eleitoral (TRE-MA/TSE)** — os exemplos públicos da API só confirmam nomenclatura de tribunal para TJ estadual (`TJMG(PJE)`, `TJPR(Projudi)`); não há confirmação pública de que a Justiça Eleitoral esteja no mesmo formato ou coberta. **Ação:** confirmar diretamente com o suporte/account manager da Loy.
2. **Vínculo entre Movimento e Documento** — os exemplos sugerem um campo `workload` comum entre o movimento e o documento gerado, mas isso não está explicitado na documentação pública como regra confiável de casamento entre os dois. **Ação:** confirmar com o suporte da Loy como mapear evento → documento de forma determinística.
3. **Contrato e custo** — Consulta Processual, Peticionamento e Descoberta de Processos podem ser módulos contratados separadamente, com cobrança por processo monitorado/mês. **Ação:** solicitar proposta comercial detalhada por módulo antes de comprometer a arquitetura a um fornecedor único.
4. **Texto exato dos artigos da Res-TSE 23.609/2019** (arts. 38 §8º, 63, 78) — a citação usada neste documento vem de fontes secundárias (jurisprudência do TSE) que reproduzem o texto; **recomenda-se validação direta no texto oficial da resolução** antes de travar a regra no motor de prazos, dado o rigor exigido para uma peça que definirá prazos peremptórios reais.
5. **Endpoint exato da Descoberta de Processos** — não localizado nos exemplos públicos da API (o produto existe comercialmente, mas o endpoint técnico não apareceu na documentação consultada). **Ação:** solicitar à Loy a documentação específica desse módulo.

---

## 14. Fora de Escopo Nesta Versão (registrado para evitar retrabalho de escopo)

- Leitura ou classificação automática do teor das decisões via IA — deliberadamente excluído; a leitura jurídica permanece manual, por escolha do titular do projeto.
- Notificação via WhatsApp/Mesa — descartada nesta fase.
- Módulo de audiências e atas — adiado.
- Distribuição de ações novas (fora de processos já existentes/importados).
