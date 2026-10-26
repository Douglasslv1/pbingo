# Parceiros e indicações

## Atualização no Railway

Esta funcionalidade adiciona a migração **0019_partners**. Publique backend e frontend. O `npm start` do backend já executa `prisma migrate deploy` antes de iniciar o servidor; verifique o sucesso dessa migração nos logs. O `postinstall` gera o cliente Prisma. Nenhuma configuração nova de credencial é necessária e não é preciso recriar o PostgreSQL.

## Configurar um parceiro

1. O parceiro precisa ter uma conta na plataforma.
2. Entre em **Admin → Parceiros → Cadastrar novo parceiro** e informe o e-mail exato dessa conta.
3. Escolha o código do link ou deixe vazio para gerar um código.
4. Defina explicitamente percentual, dias de liberação e prazo de remuneração por indicado (um número de dias após o cadastro ou sem prazo).
5. Marque **Ativar link e novas comissões** e registre uma observação administrativa.
6. Copie o link apresentado, por exemplo `https://seu-dominio/?ref=parceiro`.

Não existe percentual ou prazo financeiro preenchido silenciosamente: a configuração é obrigatória. O código não muda depois da criação. A opção de pausa interrompe novos cadastros pelo link e novas compras elegíveis, preservando valores já devidos. O bloqueio para revisão também impede solicitar e pagar saques de comissões; prêmios ficam separados.

## Vínculo e compras elegíveis

O primeiro link válido fica lembrado no navegador por até 30 dias, para que a pessoa possa navegar antes do cadastro. O formulário informa a indicação e permite removê-la antes de cadastrar. Após criar a conta, o parceiro é permanente. O banco impede inclusive preencher um parceiro em contas antigas que nasceram sem indicação. Entrar com uma conta já existente não cria vínculo.

Compras de **bilhetes de rifas**, realizadas depois do vínculo e com parceria elegível, geram comissão sobre o valor pago **após os descontos**. Compras de chaves, bingo, jogos, depósitos e Venox não geram comissão nesta implementação.

Cada compra guarda o parceiro, o percentual em pontos-base e o prazo de liberação usados ao gerar o Pix. Alterações administrativas não modificam esses valores. Cobranças pendentes anteriores à implantação, sem esse registro, não ganham comissão retroativa.

A comissão só é gerada quando o Pix é confirmado, dentro da mesma transação que emite os bilhetes. Uma compra só pode ter uma comissão. Reenvios do webhook não duplicam saldo. O cálculo é em centavos, arredondado para baixo; `500` pontos-base equivalem a `5%`.

## Carteira e pagamento

O painel **Parcerias** e a carteira mostram separadamente comissões pendentes, disponíveis, reservadas em saques e estornos a compensar. A liberação das comissões vencidas é persistida ao consultar carteira/dashboard ou solicitar/revisar saque; não depende de deixar um servidor ou cronômetro ligado.

Em **Carteira**, o parceiro escolhe **Comissões disponíveis**, informa CPF e chave Pix e solicita o saque. O valor é reservado imediatamente para impedir pedidos duplicados. O mínimo de saque é o mesmo já configurado na plataforma.

O admin revisa em **Admin → Saques**, que identifica a origem **Comissões de parceiro**. O pagamento via Pix é manual; depois, o admin informa a referência/comprovante. Recusar devolve a reserva à carteira de comissões. Cada pedido só pode ser revisado uma vez.

## Estornos e abuso

O registro administrativo de estorno de comissão fica no dashboard detalhado, em cada compra. É necessário informar o **total acumulado já devolvido** e a referência/motivo, além de confirmar a conferência no provedor. Repetir o mesmo total não duplica o ajuste; reduzir um total já registrado é recusado.

Essa operação **não executa uma devolução no Mercado Pago e não cancela bilhetes**. O operador deve realizar/conferir a devolução externamente e tratar a participação da compra conforme as regras da rifa. Não há importação automática dos eventos de devolução do Mercado Pago nesta versão.

O ajuste é proporcional ao valor líquido remanescente. Se a comissão ainda estiver pendente, reduz a liberação futura. Se já estiver liberada, desconta da carteira de comissões. Se já tiver sido sacada, o valor fica a compensar nas próximas comissões. Os prêmios dos jogos não são consumidos.

Um saque de comissão já reservado não pode ser marcado como pago enquanto houver dívida por estornos. O admin deve recusar/revisar o pedido e o parceiro poderá solicitar novamente o valor correto. É possível bloquear a parceria durante uma análise.

O vínculo impede autoindicação da mesma conta. CPF também utilizado em saques de contas indicadas bloqueia o saque de comissões para revisão. Isso é um sinal de possível duplicidade, não uma verificação completa de identidade. Não existe bloqueio automático apenas por IP, nem monitoramento externo de fraude.

## Dashboard

O parceiro vê seu link, regras, carteira, cadastros no período, compradores, bilhetes em compras pagas, vendas após descontos, devoluções registradas e comissões geradas/revertidas. Há filtros por período e rifa, além de histórico de compras paginado. As datas das vendas correspondem à criação da comissão na confirmação do pagamento; cadastros usam sua própria data. O saldo da carteira é geral e não muda de significado com os filtros.

Os compradores aparecem por apelido/número e data, sem CPF ou contato. Os 50 cadastros mais recentes no período são listados. O admin consulta todos os parceiros, regras, saldos e histórico de alterações e estornos com autor e data. Os saques pagos/pendentes/recusados permanecem no histórico de saques da carteira e no painel administrativo.

## Validação

Nesta alteração, passaram 54 testes unitários e 65 testes de integração nos arquivos de parceiros, saques, cadastro, pagamentos, rifas, webhook Pix, histórico e visão geral. Backend e frontend compilaram. As 19 migrações SQL foram aplicadas no banco descartável PGlite, com uma conexão do Prisma e Mercado Pago simulado. A validação de concorrência com várias conexões e a execução nativa de `prisma migrate deploy` devem ser conferidas no PostgreSQL de homologação antes de ativar parceiros em produção. Nenhuma compra ou transferência real foi realizada.

`npm run test:unit` inclui cálculos de comissão, centavos e estornos proporcionais. Os testes `tests/partners.test.ts` usam somente o banco descartável de `.env.test`, com provedor Pix simulado. Eles verificam vínculo imutável, permissões, cálculo após desconto, configuração congelada na compra, liberação sem duplicação, expiração, pausa, privacidade, estornos, reservas, pagamentos e bloqueios. Execute também as regressões de cadastro, carteira, saques, rifas e Pix antes de publicar.
