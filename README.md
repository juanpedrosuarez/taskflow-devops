# TaskFlow API — DevOps na Prática

Projeto da disciplina **DevOps na Prática (PUCRS)**. A aplicação é uma API REST
de gerenciamento de tarefas, com uma página web simples. O foco do projeto é o
fluxo DevOps em volta dela: integração contínua, infraestrutura como código,
containers, entrega contínua, monitoramento e segurança.

![CI](../../actions/workflows/ci.yml/badge.svg) ![CD](../../actions/workflows/cd.yml/badge.svg)

## Visão geral do fluxo

```
commit/PR ─► CI (lint, testes, cobertura, npm audit, terraform validate, docker build)
                │ sucesso na main
                ▼
            CD: build da imagem ─► smoke test ─► scan (Grype) ─► push GHCR
                ▼
            Staging: Kubernetes (kind) ─► rolling update ─► smoke test
                ▼ aprovação manual
            Produção: EC2 (Terraform) ─► Docker Compose ─► health check / rollback
```

## Estrutura

| Pasta / arquivo | Conteúdo |
| --- | --- |
| `src/` | Código da API (Node.js, sem dependências de produção) |
| `test/` | Testes unitários e de integração (`node:test`) |
| `public/` | Página web |
| `.github/workflows/ci.yml` | Pipeline de **Integração Contínua** (Fase 1) |
| `.github/workflows/cd.yml` | Pipeline de **Entrega Contínua** (Fase 2) |
| `infra/terraform/` | **Infraestrutura como Código** na AWS (VPC, EC2, IAM, CloudWatch) |
| `Dockerfile`, `docker-compose.yml` | Containerização |
| `k8s/` | Manifestos Kubernetes (orquestração) |
| `scripts/` | Scripts de deploy (`deploy.sh`, `deploy-k8s.sh`) e smoke test |
| `monitoring/` | Prometheus e Grafana |

## Endpoints

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Página web |
| GET | `/health` | Health check (usado por Docker, Kubernetes e deploy) |
| GET | `/metrics` | Métricas no formato Prometheus |
| GET / POST | `/api/tasks` | Lista / cria tarefas |
| GET / PUT / DELETE | `/api/tasks/:id` | Lê / atualiza / remove uma tarefa |

## Rodando localmente

```bash
npm ci
npm test              # testes
npm run test:coverage # testes + cobertura (mínimo 80%)
npm run lint
npm start             # http://localhost:3000
```

Com Docker:

```bash
docker compose up -d --build                 # http://localhost:8080
docker compose --profile monitoring up -d    # + Prometheus (9090) e Grafana (3001)
./scripts/smoke-test.sh http://localhost:8080
```

## Infraestrutura (Terraform)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # ajuste os valores
terraform init
terraform plan
terraform apply
terraform output app_url
```

Recursos criados: VPC, sub-rede pública, internet gateway, tabela de rotas,
security group (HTTP aberto, SSH restrito), EC2 Amazon Linux 2023 com Docker,
IP elástico, IAM role (SSM + CloudWatch), grupo de logs e alarmes de CPU e
status check no CloudWatch.

## Configurando o deploy em produção

1. Rode o Terraform com a chave pública SSH em `ssh_public_key`.
2. No GitHub, em *Settings → Environments*, crie `staging` e `production`
   (em `production`, marque *Required reviewers* para exigir aprovação).
3. Em *Settings → Secrets and variables → Actions*:
   - variável `EC2_HOST` = saída `public_ip` do Terraform
   - segredo `EC2_SSH_KEY` = chave privada SSH correspondente
4. Torne público o pacote `taskflow-api` no GHCR (ou faça `docker login` na EC2).

Sem a variável `EC2_HOST`, o pipeline para em staging (Kubernetes), que roda
inteiro dentro do GitHub Actions e não precisa de nenhuma conta de nuvem.
