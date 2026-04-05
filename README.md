# OxenteExpress - Backend

O **OxenteExpress** é uma plataforma de logística inteligente projetada para conectar pequenos negócios, entregadores e clientes finais. Este repositório contém a central de inteligência e o motor de controle de toda a operação, garantindo que a comunicação entre lojistas e entregadores ocorra de forma segura, rápida e organizada.

---

## Visão Geral

O sistema funciona como o núcleo de processamento para o aplicativo de logística. Desenvolvido com **Node.js** e utilizando o **Prisma ORM** para a comunicação com o banco de dados **MongoDB Atlas**, o backend gerencia as regras de negócio, a segurança dos dados e a orquestração das entregas.

---

## Tecnologias Utilizadas

- **Node.js (v22)** — Ambiente de execução focado em alta performance e escalabilidade  
- **Prisma 6.5** — ORM moderno para mapeamento de modelos (Usuário, Veículo, Pacotes)  
- **MongoDB Atlas** — Banco de dados NoSQL em nuvem  
- **JWT (JSON Web Token)** — Autenticação e autorização segura  
- **bcrypt** — Criptografia de senhas  

---

## Arquitetura e Funcionalidades

O ecossistema é sustentado por três pilares fundamentais gerenciados pelo backend:

### 1. Segurança e Controle de Acesso

O sistema diferencia os perfis de acesso entre:

- **STORE (Lojistas)**
- **RIDER (Entregadores)**
- **USER (Usuários)**
- **ADMIN (Admin)**

Através de **middlewares de autenticação**, o backend valida cada requisição, impedindo acessos indevidos.

---

### 2. Gestão de Frota e Perfis

O backend permite o gerenciamento detalhado dos entregadores e seus veículos:

- Vinculação de placas  
- Controle de capacidade de carga  
- Organização de volumes  

Preparando o sistema para futuras otimizações de rotas.

---

### 3. Regras de Negócio e Integridade

- Validação de unicidade (e-mails e placas)  
- Restrição de cadastro de veículos apenas para **RIDER**  
- Estruturação de **Batches (Lotes)** para otimização de entregas  

---

## Integração com o Frontend

O backend fornece uma API para aplicações (ex: **React Native**) com suporte a:

- Validação de sessões  
- Consulta de veículos  
- Rastreamento e status de entregas  

---
