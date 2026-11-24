# Portal AACPD — Associação Angolana dos Canais e Plataformas Digitais

Site público + área do membro + administração. HTML/CSS/JS sem build, base de dados **Supabase** (projecto `aacpd-site`), alojamento **Vercel**.

- **Público:** início, sobre e direcção, notícias e notas de imprensa, benefícios, directório de membros, verificação do cartão de membro, contacto.
- **Membro:** adesão online, cartão de membro digital com QR, quotas (gerar pagamento, anexar comprovativo, histórico), códigos dos benefícios, perfil.
- **Administração (`#/admin`):** painel com receita, aprovação de membros, confirmação de quotas, notícias com imagem, benefícios, direcção, mensagens, planos e preços, dados de pagamento, textos do site e administradores.

`schema.sql` contém a base de dados completa (tabelas, regras de segurança, funções e ficheiros).

**Tornar-se administrador:** criar conta no site e, no Supabase (SQL Editor):
`update perfis set papel = 'admin' where id = (select id from auth.users where email = 'o-seu-email');`
