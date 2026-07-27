# Revisão de Segurança e Consolidação de Lacunas
### Complemento à "Especificação para Desenvolvimento — Integração com API Loy"

**Referente a:** Especificação consolidada em 26/07/2026
**Data desta revisão:** 27/07/2026
**Natureza deste documento:** Addendum técnico. Não substitui a especificação original — soma controles de segurança, resolve pendências da Seção 13 do documento base e propõe melhorias. A numeração de seções abaixo é própria deste addendum; referências à especificação original aparecem como "Espec. §N".

---

## 0. Resumo das mudanças propostas

A especificação original está bem desenhada no ponto mais importante — mantém o julgamento jurídico sempre com o advogado. As lacunas identificadas nesta revisão são, em ordem de risco:

1. **Nenhuma seção trata de LGPD.** O sistema processa dados pessoais de partes em processos judiciais (muitos deles eleitorais, portanto potencialmente sensíveis — filiação partidária pode ser tratada como dado de convicção política sob o art. 5º, II da LGPD). Isso precisa de tratamento explícito antes da Fase 1, não depois.
2. **A trilha de auditoria "imutável" (Espec. §8) não tem mecanismo técnico definido.** "Imutável" é uma propriedade que precisa ser implementada (permissões de banco, WORM, hash-chain) — sem isso é apenas uma convenção que qualquer acesso de DBA pode violar.
3. **Autorização por papel (Espec. §6) está descrita como matriz funcional, mas não diz onde é aplicada.** Se a checagem de papel existir só na interface, qualquer usuário com acesso à rede interna pode chamar a rota do servidor-ponte diretamente e protocolar sem ser Peticionante.
4. **Não há plano de contingência para falha silenciosa do motor de coleta.** Em um sistema cujo valor central é "detectar publicação sem depender de checagem manual", uma falha não percebida do cron é o pior cenário possível — pior que não ter o sistema, porque cria falsa sensação de segurança e ninguém mais olha o mural manualmente.
5. **As pendências da Seção 13 (cobertura eleitoral na Loy, vínculo movimento↔documento, texto oficial da Res-TSE 23.609/2019) são bloqueadores reais de arquitetura**, não apenas itens de rodapé — a Seção 3 abaixo propõe como tratá-los sem parar o desenvolvimento.

O restante deste documento detalha cada ponto.

---

## 1. Segurança do sistema, por camada

### 1.1 Camada 2 — Servidor-ponte (o ponto de maior risco)

**Autorização deve ser reforçada no servidor, não confiar na interface.**
A matriz de papéis da Espec. §6 precisa ser aplicada em cada rota do servidor-ponte, checando o papel do usuário autenticado contra a ação pedida — nunca assumir que "o botão não aparece na tela" é controle de acesso. Em particular, a rota que cria `intermediates` e a que abre a janela de assinatura devem recusar a chamada se o usuário autenticado não tiver o papel Peticionante *naquele processo específico* (não apenas papel global), porque a Espec. §6 já prevê atribuição de papel por usuário e por processo.

**Gestão do token Loy:**
- Token nunca em variável de ambiente em texto puro em produção — usar um secret manager (Vault, AWS Secrets Manager, GCP Secret Manager ou equivalente) com rotação programada.
- Se a Loy suportar tokens escopados (um token só de consulta, separado de um token com permissão de peticionamento), usar dois tokens distintos: o motor de coleta (Camada 1) só precisa do token de consulta; apenas a rota de protocolamento deve ter acesso ao token com permissão de peticionamento. Isso reduz o raio de explosão se o processo do cron for comprometido. **Ação:** confirmar com a Loy se escopos de token separados existem — se não existirem, é um risco a registrar formalmente, não a ignorar.
- Plano de revogação: procedimento documentado e testado para revogar/rotacionar o token Loy em minutos, não dias, caso haja suspeita de vazamento (ex.: log acidental do token, servidor comprometido).

**Rede e transporte:**
- TLS 1.2+ obrigatório em todas as chamadas ao servidor-ponte e à Loy; HSTS habilitado na interface.
- O servidor-ponte deve ser a única origem de saída autorizada a falar com a Loy (egress allow-list), reduzindo a superfície caso outro componente seja comprometido.
- Rate limiting nas rotas do servidor-ponte (por usuário e por IP) — protege contra abuso interno e contra erro de integração (loop) que gere custo indevido, já que Consulta e Peticionamento provavelmente têm cobrança por chamada/processo (Espec. §13.3).

**Validação de entrada:**
- CNJ digitado em Consulta avulsa (Espec. §10.3) e no cadastro manual (§10.4) deve ser validado por formato e dígito verificador antes de sair para a Loy — evita chamadas malformadas e reduz custo de chamadas inválidas.
- Sanitização padrão contra injeção em todos os campos livres (ex.: observação de devolução de minuta, Espec. §7).

### 1.2 Camada 1 — Motor de coleta

**Falha silenciosa é o risco central desta camada.** Recomendações:
- Todo ciclo do cron deve gravar um heartbeat (sucesso/falha, quantidade de processos verificados, timestamp) em uma tabela de observabilidade própria.
- Alerta automático (e-mail, já que WhatsApp está fora de escopo — Espec. §14) se o cron não completar um ciclo esperado, ou se a taxa de erro por chamada à Loy ultrapassar um limiar.
- Idempotência: reprocessar o mesmo processo não deve duplicar publicações na base — usar chave natural (CNJ + identificador do movimento retornado pela Loy) com constraint de unicidade.
- Reconciliação periódica (ex.: mensal, amostral): checagem manual de um subconjunto do acervo comparando o que o motor capturou com consulta direta ao mural/PJe, para detectar lacunas sistemáticas de captura antes que causem perda de prazo real. Isso é especialmente importante enquanto a pendência §13.1 (cobertura eleitoral) não estiver formalmente confirmada com a Loy.

### 1.3 Camada 3 — Interface

- Autenticação individual por usuário (nunca login compartilhado de escritório) — pré-requisito para a auditoria da Espec. §8 fazer sentido, já que ela depende de atribuir cada ação a uma pessoa.
- MFA obrigatório pelo menos para o papel Peticionante, dado que a ação final (protocolar) é irreversível no sentido prático.
- Sessão com expiração curta e reautenticação exigida antes da confirmação final de protocolo (re-auth step-up), similar ao que a própria janela da Loy já faz com o certificado digital (Espec. §11) — reforço em profundidade, não redundância inútil.
- Cookies de sessão `httpOnly`, `secure`, `SameSite=Strict`.

### 1.4 Armazenamento de documentos

- Documentos baixados da Loy (Espec. §5, `documents/file/{file}`) devem ser armazenados criptografados em repouso.
- Controle de acesso a documentos com `secretLevel` (Espec. §11) deve ser resolvido nesta fase, não deixado "a definir": recomenda-se controle **por processo** (lista de usuários com acesso àquele processo específico) combinado com papel — não apenas papel isolado, porque sigilo em processo é tipicamente por processo, não por função do usuário.
- Backup dos documentos e da base de dados com teste de restauração periódico — perda de um documento com prazo em curso é incidente grave, não apenas operacional.

### 1.5 Trilha de auditoria — tornando "imutável" uma propriedade técnica real

A Espec. §8 exige que nenhum registro seja editável ou apagável após criado. Para isso ser verdade e não apenas uma regra de aplicação:
- Tabela de auditoria em modo append-only: a conta de serviço da aplicação tem apenas `INSERT`, nunca `UPDATE`/`DELETE`, aplicado no nível de permissão do banco (não apenas na lógica da aplicação).
- Considerar hash-chaining (cada registro inclui o hash do registro anterior) para tornar detectável qualquer adulteração retroativa, mesmo por quem tiver acesso administrativo ao banco.
- Backup do log de auditoria replicado para um destino separado (ex.: bucket com object-lock/WORM), para que mesmo o comprometimento total do banco principal não apague o histórico.
- Acesso de leitura à trilha de auditoria completa deve ele próprio ser restrito e logado (Espec. §6 já marca isso como "a definir" — recomendação: restringir a sócios/administradores do sistema, com log de quem consultou).

---

## 2. Segurança operacional e conformidade (não coberta na especificação original)

### 2.1 LGPD e sigilo profissional

O sistema centraliza dados pessoais de partes de processos (nomes, CPF/CNPJ quando disponíveis, endereços em algumas capas processuais) e, em processos eleitorais, dados que podem ser tratados como sensíveis (filiação partidária). Recomenda-se, antes do fim da Fase 1:
- Definir base legal de tratamento (execução de contrato/exercício regular de direito em processo, conforme art. 7º da LGPD — usual para escritórios de advocacia, mas deve ser documentado).
- Política de retenção: por quanto tempo os documentos e movimentos ficam armazenados após o fim do processo ou o desligamento do cliente.
- Registro das Operações de Tratamento (ROPA) simplificado, já que o volume ("centenas de processos") justifica isso mesmo em escritório de porte médio.
- Sigilo profissional (art. 34, VII, "d" e art. 7º, XIX do EOAB): o desenho de acesso por papel e por processo (Seção 1.4 acima) também é o controle que sustenta esse dever perante a OAB, não apenas a LGPD.

### 2.2 Continuidade operacional

- **Cenário Loy fora do ar:** o sistema depende inteiramente da Loy para captura e para protocolo. Deve haver um procedimento manual documentado (voltar à checagem manual do mural/PJe) para os processos com prazo em curso durante uma indisponibilidade prolongada da Loy — isso é operação, não código, mas precisa estar escrito e testado, porque o sistema está justamente substituindo esse hábito manual.
- **Fallback de alerta de prazo:** mesmo com WhatsApp fora de escopo (Espec. §14), recomenda-se manter um canal mínimo *ativo* (e-mail automático) para prazos a vencer em ≤48h, porque a Tela de Gestão de Prazos (Espec. §10.6) é passiva — só ajuda quem a abre. Um sistema cujo objetivo é eliminar checagem manual não deve depender de alguém lembrar de abrir uma tela.

### 2.3 Segregação de ambientes

- Ambiente de desenvolvimento/homologação nunca deve usar o token de produção da Loy nem protocolar de fato. **Ação:** perguntar à Loy se existe ambiente sandbox/homologação antes da Fase 3 (peticionamento), para não testar o fluxo de protocolo contra o ambiente real.

### 2.4 Regra dos quatro olhos (opcional, configurável)

Para petições de alto risco (ex.: recurso com prazo peremptório de registro de candidatura, Espec. §9.2), considerar exigir confirmação de um segundo usuário antes do protocolo efetivo — não como regra geral do fluxo (que já tem Redator → Peticionante), mas como opção configurável por tipo de processo, já que o custo de um protocolo indevido é alto e irreversível.

---

## 3. Resolução proposta para as pendências da Espec. §13

Estas pendências foram corretamente identificadas no documento original como bloqueadoras. Proposta de encaminhamento para não travar o desenvolvimento:

| # | Pendência | Encaminhamento recomendado |
|---|---|---|
| 1 | Cobertura Loy para Justiça Eleitoral (TRE-MA/TSE) | Tratar como **suposto não confirmado** e construir o motor de coleta de forma agnóstica ao tribunal (não hardcoded para TJ), para que a mesma integração funcione se a Loy confirmar a cobertura. Enquanto não houver confirmação por escrito da Loy, manter checagem manual paralela para os processos eleitorais (ver §2.2 acima) e não desligar o hábito manual só para esse subconjunto. |
| 2 | Vínculo Movimento ↔ Documento (campo `workload`) | Não travar a lógica de casamento automática como regra rígida até confirmação da Loy. Implementar como heurística (campo comum + proximidade temporal) com **confirmação visual do Saneador** quando a correspondência não for exata — ou seja, o sistema sugere o vínculo, mas expõe claramente quando o vínculo é heurístico vs. confirmado pela API, similar ao tratamento dado ao termo a quo em §9.2. |
| 3 | Contrato e custo por módulo | Bloqueador comercial, não técnico — mas com implicação técnica: implementar contadores de uso (chamadas à Loy por módulo, por processo, por mês) desde a Fase 1, tanto para dar insumo à negociação comercial quanto para alertar sobre custo antes que ele surpreenda (ver rate limiting, §1.1). |
| 4 | Texto oficial da Res-TSE 23.609/2019 (arts. 38 §8º, 63, 78) | Não hardcodar o prazo de 3 dias direto no código. Implementar o motor de prazos (Espec. §9) como **regras configuráveis** (tabela de regras, não constantes no código), para que, após validação do texto oficial, um ajuste de prazo não exija novo deploy — e para que a validação jurídica possa ser feita e re-feita sem depender do time técnico. |
| 5 | Endpoint da Descoberta de Processos | Como esse módulo só entra na Fase 4 (Espec. §12), não é bloqueador imediato — mas recomenda-se solicitar a documentação à Loy já agora, em paralelo às Fases 1-3, para não descobrir tardiamente que o módulo não está disponível como descrito. |

---

## 4. Melhorias sugeridas adicionais

1. **Regras de prazo como dados, não código** (detalhado em §3.4 acima) — maior impacto estrutural desta revisão. Permite correção rápida se a janela eleitoral de 2026 (15/08–18/12) mudar por nova resolução do TSE, sem depender de novo deploy.
2. **Testes automatizados dedicados ao motor de prazos**, cobrindo especificamente: transições na borda da janela eleitoral (14/08 → 15/08 e 18/12 → 19/12), feriados nacionais e municipais na regra ordinária, e o caso do termo a quo de recursos de registro de candidatura (Espec. §9.2) — essa é a parte do sistema com maior risco jurídico direto, e a que mais se beneficia de cobertura de teste alta.
3. **Painel de observabilidade operacional** (separado da auditoria jurídica): saúde do cron, taxa de erro por chamada à Loy, custo acumulado por módulo, latência de triagem (tempo médio entre captura e confirmação de prazo pelo Saneador) — dá visibilidade gerencial que a especificação original não previa.
4. **Ambiente de homologação com dados sintéticos** antes de ligar o módulo de Peticionamento em produção (Fase 3), evitando testar o fluxo de protocolo contra processos reais.
5. **Página de status/health-check** do motor de coleta acessível pelo titular do projeto, complementando o alerta por e-mail de §1.2 — visibilidade passiva além do alerta ativo.
6. **Revisão do controle de acesso a documentos sigilosos por processo** (não apenas por papel) antes da Fase 2, conforme §1.4 e §2.1 — hoje está listado na especificação original como "a definir"; recomenda-se decidir isso antes da máquina de estados entrar em produção, não depois.

---

## 5. Checklist de segurança mapeado às fases (Espec. §12)

| Fase | Controles de segurança que devem entrar junto (não depois) |
|---|---|
| Fase 1 — Núcleo de monitoramento | Secret manager para token Loy; TLS/HSTS; heartbeat + alerta de falha do cron; criptografia em repouso dos documentos; base da trilha de auditoria já em modo append-only |
| Fase 2 — Papéis e fluxo | Autorização aplicada no servidor-ponte por rota (não só na UI); autenticação individual + MFA para Peticionante; controle de acesso a documentos sigilosos por processo; regras de prazo como dados configuráveis |
| Fase 3 — Peticionamento | Ambiente de homologação/sandbox antes de produção; re-autenticação (step-up) antes do protocolo; regra dos quatro olhos opcional para petições de alto risco |
| Fase 4 — Descoberta e consulta ativa | Rate limiting e contadores de custo por chamada (Consulta avulsa é sob demanda e pode ser abusada); validação de CNJ antes de qualquer chamada paga à Loy |
| Fase 5 — Refinamentos | Auditoria de acesso à própria trilha de auditoria; teste de restauração de backup; revisão LGPD/ROPA formal |

---

## 6. O que permanece sem alteração

A arquitetura de três camadas (Espec. §3), a separação de papéis (§6), a máquina de estados da publicação (§7) e o princípio de que o sistema nunca decide prazo ou protocolo sozinho (§9.3) estão corretos e não exigem mudança — são, inclusive, o que já reduz a maior parte do risco jurídico do projeto. As adições deste documento tratam do risco que fica **em torno** dessas decisões corretas: como o token é guardado, como a autorização é imposta de fato, como uma falha silenciosa é detectada, e como as pendências abertas são tratadas sem virarem bloqueio disfarçado de "vamos resolver depois".
