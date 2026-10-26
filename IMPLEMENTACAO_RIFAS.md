# Bingo e rifas

## Funcionalidades

- Bingo: de 1 a 100 cartelas por compra, novas compras na mesma partida enquanto a sala estiver aberta, débito e criação de cartelas em uma transação. O mínimo de jogadores continua contando pessoas diferentes. Sair antes do início devolve as chaves de todas as cartelas.
- Menu **Rifas** (`/rifas`): lista de edições, regras, descontos, compra com Pix e histórico das últimas 100 compras. Os números são emitidos em ordem de confirmação do pagamento, de zero até o limite da edição, com zeros à esquerda.
- **Admin → Rifas**: cadastro de imagem (arquivo PNG/JPEG/WebP até 1 MB ou URL HTTPS), título, descrição, prêmio, preço, descontos, datas e regras. Rascunhos podem ser editados; a publicação bloqueia alterações das regras e dos preços.
- Descontos: a maior faixa atingida aplica-se ao total da compra, arredondado para centavos. Compras anteriores não se somam. O Pix tem total mínimo de R$ 1,00.
- Dashboard: bilhetes pagos, reservas, disponibilidade, compradores únicos por edição e arrecadação antes das taxas do provedor. Compras pendentes e com falha não entram na arrecadação. Lista administrativa de compras com nome, e-mail, números, quantidade, desconto e valor, paginada em 50 registros.
- A visão geral financeira inclui os Pix pagos das rifas. O extrato identifica a compra como bilhetes de rifa; ela não credita ou consome chaves.

## Operação semanal e apuração

Cada cadastro representa uma edição. Use **Duplicar para nova semana**, informe o novo concurso, confira as datas e publique.

A regra implementada usa os últimos 1 a 5 dígitos de um número premiado da extração. O admin configura o nome da loteria, concurso e posição do prêmio. É adequada a extrações com números premiados individuais, como a Loteria Federal; não há conversão automática de combinações de dezenas de outras modalidades.

O intervalo de bilhetes é completo: por exemplo, 3 dígitos correspondem a 1.000 bilhetes de `000` a `999`. Se o número extraído não foi vendido, a edição termina sem ganhador. Essa condição é mostrada antes da compra. Não há substituição do resultado por sorteio interno.

Após o horário do sorteio e o encerramento das vendas, o admin informa o número completo do prêmio escolhido e o link HTTPS do resultado oficial em `caixa.gov.br` ou subdomínio. A tela apresenta o bilhete calculado e exige confirmação antes de publicar. São registrados o resultado original, o bilhete, a fonte, o administrador e a data. A operação é definitiva e bloqueada enquanto existirem Pix pendentes.

A consulta ao resultado da Caixa e a entrega do prêmio são manuais nesta versão. Não existe integração automática para importar concursos ou transferir o prêmio para a carteira do vencedor.

## Pix e reservas

As credenciais e o webhook **Order** do Mercado Pago já usados para chaves são reaproveitados. Cada compra gera sua própria transação `PURCHASE_RAFFLE` e cobrança Pix, com o valor calculado no servidor.

1. A compra reserva capacidade da edição, sem emitir números.
2. O webhook consulta a cobrança diretamente no Mercado Pago e confere o valor e a referência.
3. A confirmação emite os bilhetes e registra o pagamento numa única transação, protegida contra notificações repetidas e compras simultâneas.
4. Falha, cancelamento ou expiração confirmados pelo provedor liberam a reserva.

Fechar novas vendas não invalida Pix já emitidos. Esses pagamentos ainda podem ser confirmados antes da apuração. Não se liberam reservas por um cronômetro local, para evitar vender a mesma capacidade e depois receber o Pix antigo.

Se houver erro de conexão após criar uma cobrança, ela permanece pendente. **Meus bilhetes → Consultar / Retomar Pix** recupera a mesma cobrança e usa a mesma chave de idempotência. O admin também pode consultar as cobranças pelo painel. Se a notificação falhar no processamento, o servidor responde com erro para permitir nova tentativa do provedor.

Pendências sem resolução do provedor bloqueiam a apuração e precisam ser conferidas no Mercado Pago. Não há botão para marcar como pago sem confirmação do provedor.

## Instalação e atualização

Depois de instalar as dependências:

```powershell
npm run prisma:generate
npm run build
npm --prefix frontend run build
```

A migração `0018_raffles` cria as tabelas e o tipo de transação. Aplique no banco do ambiente de destino antes de liberar a nova interface:

```powershell
npm run prisma:migrate
```

O comando de inicialização existente já executa `prisma migrate deploy`. Nenhuma migração de produção é executada como parte da alteração dos arquivos.

## Validação

Verificação realizada nesta alteração:

- Compilação do servidor e da interface concluídas.
- 22 testes de preço e validação aprovados.
- 50 testes de integração aprovados nos oito arquivos relacionados abaixo, com o Mercado Pago simulado.
- Todas as 18 migrações SQL aplicadas em um PGlite descartável em memória. A verificação portátil usou uma conexão do Prisma; ela não substitui o teste de concorrência em um PostgreSQL real com várias conexões.
- O PostgreSQL nativo e o executor nativo de migrações não iniciaram neste ambiente Windows. Antes de publicar, valide `prisma migrate deploy` e repita os testes no PostgreSQL de homologação. O banco de produção não foi acessado.

Os testes de preço e validação não precisam de banco:

```powershell
npm run test:unit
```

Os testes `tests/raffles.test.ts` cobrem cadastro, publicação, permissões, regras imutáveis, descontos, Pix separado, capacidade sob concorrência, valores divergentes, retomada após timeout, confirmação repetida, pagamentos após fechamento e apuração. `tests/rounds.test.ts` cobre compras de múltiplas cartelas, saldo insuficiente, devolução integral e identificação da rodada.

A suíte existente usa exclusivamente o banco configurado em `.env.test` e limpa suas tabelas. Utilize somente um banco de testes descartável:

```powershell
npm test -- tests/raffles.test.ts tests/rounds.test.ts tests/pix.test.ts tests/pixWebhook.test.ts tests/roundLifecycle.test.ts tests/round.settlement.test.ts tests/adminStats.test.ts tests/history.test.ts
```
