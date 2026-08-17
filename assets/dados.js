/* ==========================================================================
   PLANETA EXPRESS — Base de dados inicial (dados reais da empresa)
   "Semente" carregada na 1ª abertura. Depois, tudo o que você editar fica
   salvo automaticamente no computador. Restaurar em Configurações.
   ========================================================================== */

const SEED = {
  empresa: {
    nome: "Planeta Express Transportes",
    razao: "Planeta Express Transportes LTDA",
    cnpj: "26.126.673/0001-86",
    atividade: "Transporte rodoviário de cargas frigorificadas",
  },

  /* -------------------- MOTORISTAS / COLABORADORES -------------------- */
  motoristas: [
    { id:"m1", matricula:"", nome:"Reinaldo Adriano do Amaral", nascimento:"1979-10-27", genero:"Masculino", celular:"(42) 99968-4325", telefone:"(42) 99968-4325", email:"", ufNat:"PR", municipioNat:"Ponta Grossa", tipoCondutor:"", cpf:"035.184.109-11", rg:"79340413", emissorRg:"SESP-PR", cargo:"", ctps:"", pis:"", admissao:"", categoria:"E", cnh:"02510171079", primeiraHab:"2002-09-09", emissaoCnh:"2025-04-14", cnhValidade:"2035-04-11", cnhUf:"PR", cnhMunicipio:"Curitiba", renach:"", espelho:"2965320528", ear:"Sim", cep:"", logradouro:"", numero:"", complemento:"", bairro:"", ufEnd:"", municipioEnd:"", endereco:"", funcao:"Motorista", socio:false, status:"Ativo", foto:"assets/fotos/m1.png", pasta:"Documentos Motoristas/Reinaldo Adriano do Amaral" },
    { id:"m2", matricula:"", nome:"Marcelo Setsuo Goto", nascimento:"1982-05-05", genero:"Masculino", celular:"(43) 98485-0743", telefone:"(43) 98485-0743", email:"", ufNat:"PR", municipioNat:"Assaí", tipoCondutor:"", cpf:"010.427.179-58", rg:"78324520", emissorRg:"SESP-PR", cargo:"", ctps:"", pis:"", admissao:"", categoria:"E", cnh:"03101125785", primeiraHab:"2003-11-05", emissaoCnh:"2025-03-20", cnhValidade:"2035-02-13", cnhUf:"PR", cnhMunicipio:"Curitiba", renach:"", espelho:"3356724071", ear:"Sim", cep:"", logradouro:"", numero:"", complemento:"", bairro:"", ufEnd:"", municipioEnd:"", endereco:"", funcao:"Motorista", socio:false, status:"Ativo", foto:"assets/fotos/m2.png", pasta:"Documentos Motoristas/Marcelo Setsuo Goto" },
    { id:"m3", matricula:"", nome:"Renato Carlos da Silva", nascimento:"1974-03-09", genero:"Masculino", celular:"(67) 99673-7521", telefone:"(67) 99673-7521", email:"", ufNat:"SP", municipioNat:"Embu das Artes", tipoCondutor:"", cpf:"170.033.118-36", rg:"247197634", emissorRg:"SSP-SP", cargo:"", ctps:"", pis:"", admissao:"", categoria:"E", cnh:"02210974134", primeiraHab:"1992-09-17", emissaoCnh:"2023-02-10", cnhValidade:"2032-08-28", cnhUf:"MS", cnhMunicipio:"Campo Grande", renach:"", espelho:"2501147725", ear:"Sim", cep:"", logradouro:"", numero:"", complemento:"", bairro:"", ufEnd:"", municipioEnd:"", endereco:"", funcao:"Motorista", socio:false, status:"Ativo", foto:"assets/fotos/m3.png", pasta:"Documentos Motoristas/Renato Carlos da Silva" },
    { id:"m4", matricula:"", nome:"Marcelo Ronsoni Moreira", nascimento:"1973-10-11", genero:"Masculino", celular:"", telefone:"", email:"", ufNat:"RS", municipioNat:"Erechim", tipoCondutor:"", cpf:"782.481.089-53", rg:"54901925", emissorRg:"SSP-PR", cargo:"", ctps:"", pis:"", admissao:"", categoria:"AE", cnh:"02040947477", primeiraHab:"1991-11-25", emissaoCnh:"2025-12-15", cnhValidade:"2031-05-14", cnhUf:"RS", cnhMunicipio:"Porto Alegre", renach:"", espelho:"3427735020", ear:"Sim", cep:"", logradouro:"", numero:"", complemento:"", bairro:"", ufEnd:"", municipioEnd:"", endereco:"", funcao:"Sócio · Motorista", socio:true, status:"Ativo", foto:"assets/fotos/m4.png", pasta:"Documentos Motoristas/Marcelo Ronsoni Moreira" },
    { id:"m5", matricula:"", nome:"Uilian Marcelo Moreira", nascimento:"1997-01-06", genero:"Masculino", celular:"", telefone:"", email:"", ufNat:"RS", municipioNat:"Getúlio Vargas", tipoCondutor:"", cpf:"022.997.900-98", rg:"02299790098", emissorRg:"SESP-PR", cargo:"", ctps:"", pis:"", admissao:"", categoria:"AE", cnh:"06304514325", primeiraHab:"2018-12-18", emissaoCnh:"2025-09-19", cnhValidade:"2035-08-22", cnhUf:"PR", cnhMunicipio:"Curitiba", renach:"", espelho:"3400239528", ear:"Sim", cep:"", logradouro:"", numero:"", complemento:"", bairro:"", ufEnd:"", municipioEnd:"", endereco:"", funcao:"Sócio · Responsável Técnico · Motorista", socio:true, status:"Ativo", foto:"assets/fotos/m5.jpg", pasta:"Documentos Motoristas/Uilian Marcelo Moreira" },
    { id:"m6", matricula:"098", nome:"Odecio Delatorre Fernandes", nascimento:"1956-06-12", genero:"Masculino", celular:"(43) 99128-8293", telefone:"(43) 99128-8293", email:"odecio@gmail.com", ufNat:"PR", municipioNat:"São João do Caiuá", tipoCondutor:"Motorista/Manobrista CLT - SPOT", cpf:"467.902.179-91", rg:"3421659-2", emissorRg:"SESP PR", cargo:"Motorista Carreta Primária", ctps:"0", pis:"0", admissao:"2026-07-20", categoria:"E", cnh:"0136225833", primeiraHab:"1990-09-24", emissaoCnh:"2024-05-29", cnhValidade:"2029-05-17", cnhUf:"PR", cnhMunicipio:"Curitiba", renach:"PR925643909", espelho:"2817862750", ear:"Sim", cep:"86031-380", logradouro:"Rua Almenio Correia Lemos Neto", numero:"676", complemento:"", bairro:"Conjunto Habitacional Jesualdo Garcia Pessoa", ufEnd:"PR", municipioEnd:"Londrina", endereco:"Rua Almenio Correia Lemos Neto, 676 — Conj. Hab. Jesualdo Garcia Pessoa, Londrina/PR", funcao:"Motorista", socio:false, status:"Ativo", foto:"assets/fotos/m6.png", pasta:"Documentos Motoristas/Odecio Delatorre Fernandes" },
    { id:"m7", matricula:"", nome:"Wesley Luiz da Silva Pereira", nascimento:"1988-03-10", genero:"Masculino", celular:"(66) 98127-2639", telefone:"(66) 98127-2639", email:"", ufNat:"PR", municipioNat:"Sertanópolis", tipoCondutor:"Motorista Carreteiro CLT - Primária", cpf:"068.256.969-04", rg:"97574090", emissorRg:"SESP-PR", mae:"Marlene Silva de Oliveira", pai:"Valdeir Luiz Pereira", cargo:"Motorista de Carreta", ctps:"068256", ctpsSerie:"96904", pis:"", admissao:"2026-08-18", categoria:"AE", cnh:"05396948335", primeiraHab:"2012-01-06", emissaoCnh:"2026-07-10", cnhValidade:"2036-07-08", cnhUf:"PR", cnhMunicipio:"Curitiba", renach:"PR929170076", espelho:"5160834370", ear:"Sim", cep:"86039-560", logradouro:"Avenida Anália Franco", numero:"151", complemento:"Casa", bairro:"Jardim Brasília", ufEnd:"PR", municipioEnd:"Londrina", endereco:"Avenida Anália Franco, 151 — Jardim Brasília, Londrina/PR", funcao:"Motorista", socio:false, status:"Ativo", foto:"assets/fotos/m7.png", pasta:"Documentos Motoristas/Wesley Luiz da Silva Pereira",
      contratoTipo:"Experiência", contratoInicio:"2026-08-18", contratoDias:45, contratoProrrog:"", contratoFuncao:"Motorista de Carreta", contratoSalario:2758.33, contratoLocal:"Carambeí/PR", contratoObs:"Contrato de experiência assinado digitalmente em 17/08/2026. Prorrogável uma única vez, respeitado o limite legal de 90 dias.",
      criminalSituacao:"Possui processo(s)", criminalData:"2026-08-05", criminalFonte:"Declaração da advogada Sarah Cachioni Machado Camilo (OAB/PR 117.881), de 05/08/2026, apresentada pelo próprio colaborador ao empregador.", criminalObs:"Um processo encerrado com ABSOLVIÇÃO (o próprio Ministério Público pediu a absolvição) e um segundo em fase inicial, sem audiência de instrução e julgamento e sem condenação. Certidões de objeto e pé dos dois processos foram requeridas pela defesa e serão entregues quando expedidas pelo Juízo." },
  ],

  /* -------------------- FROTA / VEÍCULOS --------------------
     kmAtual  -> cavalos (odômetro)     horaAtual -> aparelho Thermo King das carretas
  */
  veiculos: [
    { id:"v1", placa:"IRU-4G62", tipo:"Cavalo", marca:"Volvo", modelo:"FH 440", chassi:"9BVAS02C0BE771774", renavam:"316700762", anoModelo:"2011/2011", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:1500000, horaAtual:null },
    { id:"v2", placa:"EJZ-4I65", tipo:"Cavalo", marca:"Iveco", modelo:"Stralis 380", chassi:"93ZS2MRH0A8806029", renavam:"170983129", anoModelo:"2009/2010", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:962000, horaAtual:null },
    { id:"v3", placa:"JSX-4D55", tipo:"Cavalo", marca:"Iveco", modelo:"Stralis 380", chassi:"93ZS2MRH0A8806528", renavam:"191637114", anoModelo:"2009/2010", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:1104000, horaAtual:null },
    { id:"v4", placa:"QIO-9J07", tipo:"Cavalo", marca:"Iveco", modelo:"Hi Way 440", chassi:"93ZM2SSH0J8829526", renavam:"1128406214", anoModelo:"2017/2018", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:673000, horaAtual:null },
    { id:"v5", placa:"BDP-1B55", tipo:"Cavalo", marca:"Volvo", modelo:"FH 460", chassi:"9BVRG20C5KE865773", renavam:"1184587890", anoModelo:"2019/2019", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:543000, horaAtual:null },
    { id:"v7", placa:"IOW-1141", tipo:"Reboque Frigorífico", marca:"Thermosara", modelo:"SR/FG", chassi:"9A9CM28238CEF2024", renavam:"971367728", anoModelo:"2008/2008", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:null, horaAtual:6200 },
    { id:"v8", placa:"MDD-5C62", tipo:"Reboque Frigorífico", marca:"Randon", modelo:"SR/FG", chassi:"9ADF147333M185707", renavam:"800035208", anoModelo:"2003/2003", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:null, horaAtual:8750 },
    { id:"v9", placa:"AMB-2928", tipo:"Reboque Frigorífico", marca:"Randon", modelo:"SR/FG", chassi:"9ADF147345M207891", renavam:"836272374", anoModelo:"2004/2005", crlvAno:"2025", cor:"Branco", status:"Ativo", kmAtual:null, horaAtual:0 },
    { id:"v10", placa:"NTY-8B66", tipo:"Reboque Frigorífico", marca:"Randon", modelo:"SR/FG", chassi:"9ADF1473ABM323262", renavam:"274552671", anoModelo:"2010/2011", crlvAno:"2025", cor:"Branco", status:"Ativo", kmAtual:null, horaAtual:0 },
    { id:"v11", placa:"EOF-5A47", tipo:"Reboque Frigorífico", marca:"Thermosara", modelo:"SR/FG", chassi:"9A9CP3033BCEF2450", renavam:"330076868", anoModelo:"2011/2011", crlvAno:"2026", cor:"Branco", status:"Ativo", kmAtual:null, horaAtual:12000 },
  ],

  /* -------------------- VENCIMENTOS (motor de alertas) -------------------- */
  vencimentos: [
    /* CNH */
    { id:"c1", tipo:"CNH", entidade:"motorista", refId:"m1", emissao:"", validade:"2035-04-11", numero:"", orgao:"DETRAN-PR", obs:"Categoria E" },
    { id:"c2", tipo:"CNH", entidade:"motorista", refId:"m2", emissao:"", validade:"2035-02-13", numero:"", orgao:"DETRAN-PR", obs:"Categoria E" },
    { id:"c3", tipo:"CNH", entidade:"motorista", refId:"m3", emissao:"", validade:"2032-08-28", numero:"", orgao:"DETRAN-MS", obs:"Categoria E" },
    { id:"c4", tipo:"CNH", entidade:"motorista", refId:"m4", emissao:"2025-12-15", validade:"2031-05-14", numero:"02040947477", orgao:"DETRAN-RS", obs:"Categoria AE" },
    { id:"c5", tipo:"CNH", entidade:"motorista", refId:"m5", emissao:"2025-09-19", validade:"2035-08-22", numero:"06304514325", orgao:"DETRAN-PR", obs:"Categoria AE" },
    { id:"c6", tipo:"CNH", entidade:"motorista", refId:"m6", emissao:"2024-05-29", validade:"2029-05-17", numero:"0136225833", orgao:"DETRAN-PR", obs:"Categoria E" },
    { id:"c7", tipo:"CNH", entidade:"motorista", refId:"m7", emissao:"2026-07-10", validade:"2036-07-08", numero:"05396948335", orgao:"DETRAN-PR", obs:"Categoria AE · RENACH PR929170076 · EAR" },

    /* Toxicológico */
    { id:"t1", tipo:"Toxicológico", entidade:"motorista", refId:"m1", emissao:"2025-02-06", validade:"2027-10-11", numero:"", orgao:"", obs:"" },
    { id:"t2", tipo:"Toxicológico", entidade:"motorista", refId:"m4", emissao:"2026-04-24", validade:"2028-10-24", numero:"", orgao:"", obs:"" },
    { id:"t3", tipo:"Toxicológico", entidade:"motorista", refId:"m5", emissao:"2025-08-14", validade:"2028-03-17", numero:"", orgao:"", obs:"" },
    { id:"t4", tipo:"Toxicológico", entidade:"motorista", refId:"m2", emissao:"2025-02-03", validade:"2027-02-03", numero:"", orgao:"", obs:"" },
    { id:"t5", tipo:"Toxicológico", entidade:"motorista", refId:"m3", emissao:"2026-03-13", validade:"2028-09-13", numero:"", orgao:"", obs:"" },
    { id:"t6", tipo:"Toxicológico", entidade:"motorista", refId:"m6", emissao:"", validade:"2028-12-16", numero:"", orgao:"", obs:"" },
    { id:"t7", tipo:"Toxicológico", entidade:"motorista", refId:"m7", emissao:"2026-08-11", validade:"2029-02-11", numero:"03J7DXAC012221046", orgao:"Laboratório Sodré", obs:"Coleta 11/08/2026 (pelo de perna), resultado NEGATIVO para todas as substâncias. Laudo do médico revisor emitido em 13/08/2026. Validade aqui = periodicidade legal de 2 anos e 6 meses; o laudo traz 10/10/2026 como prazo para uso na admissão." },

    /* ASO (exame ocupacional) */
    { id:"a1", tipo:"ASO", entidade:"motorista", refId:"m1", emissao:"2026-07-13", validade:"2027-07-13", numero:"", orgao:"", obs:"" },
    { id:"a2", tipo:"ASO", entidade:"motorista", refId:"m4", emissao:"2025-08-20", validade:"2026-08-20", numero:"", orgao:"", obs:"" },
    { id:"a3", tipo:"ASO", entidade:"motorista", refId:"m5", emissao:"2025-09-19", validade:"2026-09-19", numero:"", orgao:"", obs:"" },
    { id:"a4", tipo:"ASO", entidade:"motorista", refId:"m2", emissao:"2026-03-18", validade:"2027-03-18", numero:"", orgao:"", obs:"" },
    { id:"a5", tipo:"ASO", entidade:"motorista", refId:"m3", emissao:"2026-03-13", validade:"2027-03-13", numero:"", orgao:"", obs:"" },
    { id:"a6", tipo:"ASO", entidade:"motorista", refId:"m6", emissao:"2026-07-20", validade:"2027-07-20", numero:"", orgao:"", obs:"" },
    { id:"a7", tipo:"ASO", entidade:"motorista", refId:"m7", emissao:"2026-08-12", validade:"2027-08-12", numero:"", orgao:"Dr. Vinícius Marcondes Silva — CRM 51786/PR", obs:"ASO admissional — APTO para a função. Exames de 12/08/2026, assinado em 14/08/2026. Validade de 1 ano (padrão da empresa; o ASO não traz data de validade impressa)." },

    /* Opentech Funcionários (BRF) */
    { id:"of1", tipo:"Opentech Funcionário", entidade:"motorista", refId:"m1", emissao:"2026-07-10", validade:"2027-01-10", numero:"", orgao:"BRF", obs:"BRF" },
    { id:"of2", tipo:"Opentech Funcionário", entidade:"motorista", refId:"m4", emissao:"2026-07-09", validade:"2027-01-09", numero:"", orgao:"BRF", obs:"BRF" },
    { id:"of3", tipo:"Opentech Funcionário", entidade:"motorista", refId:"m5", emissao:"2026-03-09", validade:"2026-09-09", numero:"", orgao:"BRF", obs:"BRF" },
    { id:"of4", tipo:"Opentech Funcionário", entidade:"motorista", refId:"m2", emissao:"2026-03-04", validade:"2026-09-04", numero:"", orgao:"BRF", obs:"BRF" },
    { id:"of5", tipo:"Opentech Funcionário", entidade:"motorista", refId:"m3", emissao:"2026-02-20", validade:"2026-08-20", numero:"", orgao:"BRF", obs:"BRF" },

    /* Tacógrafo (cronotacógrafo) */
    { id:"tc1", tipo:"Tacógrafo", entidade:"veiculo", refId:"v1", emissao:"2024-10-17", validade:"2026-10-17", numero:"", orgao:"INMETRO", obs:"" },
    { id:"tc2", tipo:"Tacógrafo", entidade:"veiculo", refId:"v3", emissao:"2026-07-07", validade:"2028-06-19", numero:"", orgao:"INMETRO", obs:"" },
    { id:"tc3", tipo:"Tacógrafo", entidade:"veiculo", refId:"v2", emissao:"2025-10-03", validade:"2027-09-19", numero:"", orgao:"INMETRO", obs:"" },
    { id:"tc4", tipo:"Tacógrafo", entidade:"veiculo", refId:"v4", emissao:"2026-05-08", validade:"2028-04-09", numero:"", orgao:"INMETRO", obs:"" },
    { id:"tc5", tipo:"Tacógrafo", entidade:"veiculo", refId:"v5", emissao:"2025-04-23", validade:"2027-01-21", numero:"", orgao:"INMETRO", obs:"" },

    /* Vigilância Sanitária (reboques frigoríficos) */
    { id:"vs1", tipo:"Vigilância Sanitária", entidade:"veiculo", refId:"v7", emissao:"2026-01-19", validade:"2027-01-19", numero:"", orgao:"", obs:"" },
    { id:"vs2", tipo:"Vigilância Sanitária", entidade:"veiculo", refId:"v9", emissao:"2026-01-19", validade:"2027-01-19", numero:"", orgao:"", obs:"" },
    { id:"vs3", tipo:"Vigilância Sanitária", entidade:"veiculo", refId:"v8", emissao:"2026-01-19", validade:"2027-01-19", numero:"", orgao:"", obs:"" },
    { id:"vs4", tipo:"Vigilância Sanitária", entidade:"veiculo", refId:"v11", emissao:"2026-01-19", validade:"2027-01-19", numero:"", orgao:"", obs:"" },
    { id:"vs5", tipo:"Vigilância Sanitária", entidade:"veiculo", refId:"v10", emissao:"2026-01-19", validade:"2027-01-19", numero:"", orgao:"", obs:"" },

    /* Opentech Veículos (BRF) */
    { id:"ov1", tipo:"Opentech Veículo", entidade:"veiculo", refId:"v1", emissao:"2026-07-09", validade:"2027-01-05", numero:"", orgao:"BRF", obs:"Conjunto IRU-4G62 / NTY-8B66" },
    { id:"ov2", tipo:"Opentech Veículo", entidade:"veiculo", refId:"v3", emissao:"2026-07-09", validade:"2027-01-05", numero:"", orgao:"BRF", obs:"Conjunto JSX-4D55 / AMB-2928" },
    { id:"ov3", tipo:"Opentech Veículo", entidade:"veiculo", refId:"v2", emissao:"2026-07-09", validade:"2027-01-05", numero:"", orgao:"BRF", obs:"Conjunto EJZ-4I65 / MDD-5C62" },
    { id:"ov4", tipo:"Opentech Veículo", entidade:"veiculo", refId:"v4", emissao:"2026-07-09", validade:"2027-01-05", numero:"", orgao:"BRF", obs:"Conjunto QIO-9J07 / IOW-1141" },
    { id:"ov5", tipo:"Opentech Veículo", entidade:"veiculo", refId:"v5", emissao:"2026-07-09", validade:"2027-01-05", numero:"", orgao:"BRF", obs:"Conjunto BDP-1B55 / EOF-5A47" },

    /* CRLV (licenciamento) */
    { id:"cr9", tipo:"CRLV", entidade:"veiculo", refId:"v9", emissao:"", validade:"2025-12-31", numero:"", orgao:"DETRAN-PR", obs:"Exercício 2025 — renovar p/ 2026" },
    { id:"cr10", tipo:"CRLV", entidade:"veiculo", refId:"v10", emissao:"", validade:"2025-12-31", numero:"", orgao:"DETRAN-PR", obs:"Exercício 2025 — renovar p/ 2026" },

    /* Programas / documentos da empresa */
    { id:"p1", tipo:"PCMSO", entidade:"empresa", refId:"empresa", emissao:"2026-03-23", validade:"2027-03-23", numero:"", orgao:"", obs:"Programa de Controle Médico" },
    { id:"p2", tipo:"PGR", entidade:"empresa", refId:"empresa", emissao:"2026-03-23", validade:"2027-03-23", numero:"", orgao:"", obs:"Programa de Gerenciamento de Riscos" },
    { id:"p3", tipo:"Certificado Digital", entidade:"empresa", refId:"empresa", emissao:"2026-06-12", validade:"2027-06-12", numero:"", orgao:"", obs:"e-CNPJ" },
  ],

  /* -------------------- BATERIAS -------------------- */
  baterias: [
    { id:"b1", data:"2025-09-25", placa:"JSX-4D55", marca:"Única 190 AH", local:"Rede Única Cambé", valor:770, garantiaMeses:12, garantiaAte:"2026-04-28", telefone:"(43) 3251-9281" },
    { id:"b2", data:"2026-01-15", placa:"IRU-4G62", marca:"Bats 190 AH", local:"Rede Única Ponta Grossa", valor:980, garantiaMeses:12, garantiaAte:"2027-01-15", telefone:"(42) 3236-3470" },
    { id:"b3", data:"2026-01-27", placa:"BDP-1B55", marca:"Moura 220 AH", local:"Rodo Ponta Del Pozo", valor:0, garantiaMeses:12, garantiaAte:"2027-01-27", telefone:"" },
    { id:"b4", data:"2026-02-04", placa:"QIO-9J07", marca:"Única 190 AH", local:"Rede Única Cambé", valor:942, garantiaMeses:12, garantiaAte:"2027-02-04", telefone:"(43) 3251-9281" },
    { id:"b5", data:"2026-02-15", placa:"IPD-9036", marca:"Única 190 AH", local:"Rede Única Cambé", valor:942, garantiaMeses:12, garantiaAte:"2027-02-15", telefone:"(43) 3251-9281" },
    { id:"b6", data:"2026-03-30", placa:"JSX-4D55", marca:"Única 190 AH", local:"Rede Única Cambé", valor:770, garantiaMeses:12, garantiaAte:"2027-03-30", telefone:"(43) 99129-7541" },
    { id:"b7", data:"2026-05-25", placa:"EJZ-4I65", marca:"Única 190 AH", local:"Rede Única Cambé", valor:850, garantiaMeses:12, garantiaAte:"2027-05-25", telefone:"(43) 99129-7541" },
    { id:"b8", data:"2026-04-06", placa:"IOW-1141", marca:"Bats 110 AH Selada", local:"Rede Única Maringá", valor:625, garantiaMeses:12, garantiaAte:"2027-04-06", telefone:"(44) 98455-3199" },
    { id:"b9", data:"2026-04-06", placa:"EOF-5A47", marca:"Zetta 100 AH", local:"Refrimax Lins SP", valor:870, garantiaMeses:12, garantiaAte:"2027-04-06", telefone:"(14) 99669-9060" },
    { id:"b10", data:"2025-12-02", placa:"MDD-5C62", marca:"Bats 105 AH Selada", local:"Rede Única Maringá", valor:539, garantiaMeses:12, garantiaAte:"2026-12-02", telefone:"(44) 98455-3199" },
    { id:"b11", data:"2025-10-07", placa:"AMB-2928", marca:"Bats 105 AH Selada", local:"Rede Única Maringá", valor:660, garantiaMeses:12, garantiaAte:"2026-02-25", telefone:"(44) 98455-3199" },
    { id:"b12", data:"2025-10-17", placa:"NTY-8B66", marca:"Bats 110 AH Selada", local:"Rede Única Maringá", valor:389, garantiaMeses:12, garantiaAte:"2026-04-06", telefone:"(44) 98455-3199" },
  ],

  /* -------------------- SEGUROS / APÓLICES --------------------
     Extraído das apólices reais (Tokio Marine, Allianz, Mitsui, HDI, Porto...).
     ramo: auto | frota | carga | vida.  grupo: empresa | socio | func.
     fim = fim da vigência (é o vencimento que dispara o alerta).
     premio = prêmio total anual em R$ (null = apólice de averbação, prêmio variável).
  */
  seguros: [
    /* ---- EMPRESA — Planeta Express Transportes LTDA ---- */
    { id:"s1", ramo:"frota", tipo:"Seguro de Frota", seguradora:"Allianz", apolice:"312205367", endosso:"1",
      segurado:"Planeta Express Transportes LTDA", grupo:"empresa", objeto:"Frota de veículos", placa:"",
      inicio:"2025-10-11", fim:"2026-10-11", premio:27050.00, pagamento:"10x Boleto",
      cobertura:"Frota (cascos dos veículos)", status:"Ativo",
      obs:"Endosso 1 — substituição/inclusão da placa BDP-1B55 (vigência 18/03/2026 a 11/10/2026), prêmio adicional R$ 3.191,05 em 6x Boleto." },
    { id:"s2", ramo:"carga", tipo:"RCTR-C — Resp. Civil do Transportador (Carga)", seguradora:"Tokio Marine", apolice:"540 00029910", endosso:"",
      segurado:"Planeta Express Transportes LTDA", grupo:"empresa", objeto:"Carga transportada de terceiros", placa:"",
      inicio:"2025-12-31", fim:"2026-12-31", premio:null, pagamento:"Averbação mensal (mínimo R$ 500/mês + IOF)",
      cobertura:"Limite máx. de garantia R$ 1.000.000", status:"Ativo",
      obs:"Seguro OBRIGATÓRIO do transportador. Prêmio por averbação de CT-e. Processo SUSEP 10.002445/01-88. Coberturas adicionais: Avarias Particulares e Limpeza de Pista (R$ 50.000 cada). Corretora VTECH/APACS — contato Marcelo (42) 99911-2828." },
    { id:"s3", ramo:"carga", tipo:"RC-DC — Resp. Civil por Desaparecimento de Carga", seguradora:"Tokio Marine", apolice:"550 00015676", endosso:"",
      segurado:"Planeta Express Transportes LTDA", grupo:"empresa", objeto:"Carga — roubo/desaparecimento", placa:"",
      inicio:"2025-12-31", fim:"2026-12-31", premio:null, pagamento:"Averbação mensal",
      cobertura:"Limite máx. de garantia R$ 1.000.000", status:"Ativo",
      obs:"Complementa a RCTR-C, cobrindo roubo e desaparecimento de carga. Mesma vigência." },
    { id:"s4", ramo:"vida", tipo:"Seguro de Vida em Grupo", seguradora:"HDI", apolice:"02909820000240", endosso:"",
      segurado:"Funcionários — Planeta Express", grupo:"func", objeto:"Vida em grupo (funcionários)", placa:"",
      inicio:"2025-11-06", fim:"2026-11-06", premio:1521.28, pagamento:"12x Boleto",
      cobertura:"", status:"Ativo", obs:"" },
    { id:"s5", ramo:"vida", tipo:"Seguro de Vida em Grupo", seguradora:"HDI / Icatu", apolice:"93752384", endosso:"93752384",
      segurado:"Funcionários — Planeta Express", grupo:"func", objeto:"Vida em grupo (funcionários)", placa:"",
      inicio:"2025-10-25", fim:"2026-10-25", premio:1530.72, pagamento:"12x Boleto",
      cobertura:"", status:"Ativo",
      obs:"Endosso 93752384 (vigência 23/12/2025 a 25/10/2026) — prêmio adicional R$ 127,10 em 1x Boleto." },

    /* ---- SÓCIO — Marcelo Ronsoni Moreira ---- */
    { id:"s6", ramo:"auto", tipo:"Seguro de Automóvel", seguradora:"Mitsui", apolice:"22497649", endosso:"7807386",
      segurado:"Marcelo Ronsoni Moreira", grupo:"socio", objeto:"Veículo placa BBJ-2D77", placa:"BBJ-2D77",
      inicio:"2025-08-17", fim:"2026-08-17", premio:4766.40, pagamento:"10x Cartão",
      cobertura:"", status:"Ativo",
      obs:"Endosso 7807386 (vigência 26/11/2025 a 17/08/2026) — R$ 797,84 em 4x Cartão. Cobertura ativa até 17/08/2026." },
    { id:"s7", ramo:"vida", tipo:"Seguro de Vida Individual", seguradora:"Tokio", apolice:"0001065234", endosso:"",
      segurado:"Marcelo Ronsoni Moreira", grupo:"socio", objeto:"Vida (individual)", placa:"",
      inicio:"2026-04-09", fim:"2027-04-09", premio:1151.00, pagamento:"12x Cartão de Crédito",
      cobertura:"", status:"Ativo", obs:"" },
    { id:"s8", ramo:"auto", tipo:"Seguro de Automóvel", seguradora:"Tokio", apolice:"35311757", endosso:"",
      segurado:"Marcelo Ronsoni Moreira", grupo:"socio", objeto:"Veículo placa QHS-0C02", placa:"QHS-0C02",
      inicio:"2025-11-26", fim:"2026-11-26", premio:5485.66, pagamento:"12x Cartão",
      cobertura:"", status:"Cancelado",
      obs:"CANCELADO em 05/05/2026 a pedido do segurado." },

    /* ---- SÓCIO — Uilian Marcelo Moreira ---- */
    { id:"s9", ramo:"vida", tipo:"Seguro de Vida Individual", seguradora:"Porto Seguro", apolice:"1513912740410", endosso:"",
      segurado:"Uilian Marcelo Moreira", grupo:"socio", objeto:"Vida (individual)", placa:"",
      inicio:"2026-01-06", fim:"2027-01-06", premio:992.91, pagamento:"12x Débito",
      cobertura:"", status:"Ativo", obs:"" },
  ],

  /* -------------------- PEDÁGIOS (extrato Sem Parar) --------------------
     Fatura 26152227636 (Sem Parar) — passagens reais jun–jul/2026.
     tipo: "Pedágio" (pago pela empresa) | "Vale-pedágio" (embarcador BRF, reembolsado).
     praca = texto original da praça; rodovia/km/sentido/cidade derivados por _pedInfo().
     valor em R$; uf=PR; fatura fixa; pago=true.  cat = categoria tarifária (~eixos).
  */
  pedagios: [
    /* ---- PEDÁGIOS PAGOS PELA EMPRESA (débito) ---- */
    { id:"pd1",  data:"2026-06-18", hora:"13:18:15", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 448+550, NORTE, TIBAGI", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd2",  data:"2026-06-18", hora:"13:59:21", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 370+950, NORTE, IMBAÚ", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd3",  data:"2026-06-18", hora:"14:35:33", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 316+700, NORTE, ORTIGUEIRA", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd4",  data:"2026-06-18", hora:"14:54:07", placa:"BBJ-2D77", conc:"PRVIAS", praca:"PR-445, KM 002+000, NORTE, LONDRINA", cat:1, valor:10.26, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd5",  data:"2026-06-30", hora:"05:21:15", placa:"BBJ-2D77", conc:"PRVIAS", praca:"PR-445, KM 002+000, SUL, LONDRINA", cat:1, valor:10.26, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd6",  data:"2026-06-30", hora:"05:42:10", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 316+700, SUL, ORTIGUEIRA", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd7",  data:"2026-06-30", hora:"06:22:49", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 370+950, SUL, IMBAÚ", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },
    { id:"pd8",  data:"2026-06-30", hora:"07:07:14", placa:"BBJ-2D77", conc:"PRVIAS", praca:"BR-376, KM 448+550, SUL, TIBAGI", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0759070686" },

    { id:"pd9",  data:"2026-06-09", hora:"09:14:42", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 448+550, NORTE, TIBAGI", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd10", data:"2026-06-09", hora:"10:06:21", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 370+950, NORTE, IMBAÚ", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd11", data:"2026-06-09", hora:"10:43:59", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 316+700, NORTE, ORTIGUEIRA", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd12", data:"2026-06-09", hora:"11:24:11", placa:"BCG-4D41", conc:"PRVIAS", praca:"PR-445, KM 002+000, NORTE, LONDRINA", cat:1, valor:10.26, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd13", data:"2026-06-17", hora:"10:45:57", placa:"BCG-4D41", conc:"PRVIAS", praca:"PR-445, KM 002+000, SUL, LONDRINA", cat:1, valor:10.26, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd14", data:"2026-06-17", hora:"11:04:46", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 316+700, SUL, ORTIGUEIRA", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd15", data:"2026-06-17", hora:"11:45:39", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 370+950, SUL, IMBAÚ", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd16", data:"2026-06-17", hora:"12:25:53", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 448+550, SUL, TIBAGI", cat:1, valor:12.16, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd17", data:"2026-06-18", hora:"13:18:09", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 448+550, NORTE, TIBAGI", cat:1, valor:11.91, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd18", data:"2026-06-18", hora:"13:59:12", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 370+950, NORTE, IMBAÚ", cat:1, valor:11.37, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd19", data:"2026-06-18", hora:"14:34:54", placa:"BCG-4D41", conc:"PRVIAS", praca:"BR-376, KM 316+700, NORTE, ORTIGUEIRA", cat:1, valor:11.94, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },
    { id:"pd20", data:"2026-06-18", hora:"14:53:58", placa:"BCG-4D41", conc:"PRVIAS", praca:"PR-445, KM 002+000, NORTE, LONDRINA", cat:1, valor:9.87, tipo:"Pedágio", emb:"", viagem:"", tag:"0756334614" },

    { id:"pd21", data:"2026-06-27", hora:"13:54:02", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:5, valor:47.03, tipo:"Pedágio", emb:"", viagem:"", tag:"0720741926" },
    { id:"pd22", data:"2026-06-27", hora:"14:29:27", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:5, valor:49.88, tipo:"Pedágio", emb:"", viagem:"", tag:"0720741926" },

    { id:"pd23", data:"2026-06-16", hora:"13:54:31", placa:"IRU-4G62", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:5, valor:47.03, tipo:"Pedágio", emb:"", viagem:"", tag:"0724999385" },

    { id:"pd24", data:"2026-06-15", hora:"15:50:49", placa:"JSX-4D55", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:5, valor:49.88, tipo:"Pedágio", emb:"", viagem:"", tag:"0756978339" },

    { id:"pd25", data:"2026-06-02", hora:"20:59:41", placa:"QIO-9J07", conc:"PRVIAS", praca:"PR-445, KM 002+000, NORTE, LONDRINA", cat:6, valor:61.56, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd26", data:"2026-06-08", hora:"13:16:29", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd27", data:"2026-06-11", hora:"12:39:00", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd28", data:"2026-07-02", hora:"09:09:47", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd29", data:"2026-07-02", hora:"10:50:14", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 289+000, SUL, MAUÁ DA SERRA", cat:3, valor:30.78, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd30", data:"2026-07-04", hora:"17:38:23", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 289+000, NORTE, MAUÁ DA SERRA", cat:6, valor:61.56, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },
    { id:"pd31", data:"2026-07-04", hora:"19:01:29", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Pedágio", emb:"", viagem:"", tag:"0744936751" },

    /* ---- VALE-PEDÁGIO (débito da concessionária; reembolsado pelo embarcador BRF) ---- */
    { id:"pv1",  data:"2026-06-21", hora:"10:42:13", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104719038", tag:"0757930328" },
    { id:"pv2",  data:"2026-06-22", hora:"09:43:06", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104719038", tag:"0757930328" },
    { id:"pv3",  data:"2026-06-25", hora:"04:56:34", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104719038", tag:"0757930328" },
    { id:"pv4",  data:"2026-06-25", hora:"05:43:51", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104973048", tag:"0757930328" },
    { id:"pv5",  data:"2026-06-25", hora:"10:34:05", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104973048", tag:"0757930328" },
    { id:"pv6",  data:"2026-06-25", hora:"11:12:13", placa:"BDP-1B55", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104719038", tag:"0757930328" },

    { id:"pv7",  data:"2026-06-08", hora:"12:19:49", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"103808811", tag:"0720741926" },
    { id:"pv8",  data:"2026-06-30", hora:"08:45:36", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:5, valor:49.88, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105274287", tag:"0720741926" },
    { id:"pv9",  data:"2026-06-30", hora:"15:30:54", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105274287", tag:"0720741926" },
    { id:"pv10", data:"2026-07-04", hora:"07:38:31", placa:"EJZ-4I65", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355332", tag:"0720741926" },

    { id:"pv11", data:"2026-06-24", hora:"12:05:16", placa:"IRU-4G62", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104905197", tag:"0724999385" },
    { id:"pv12", data:"2026-06-24", hora:"17:32:09", placa:"IRU-4G62", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104905197", tag:"0724999385" },
    { id:"pv13", data:"2026-07-04", hora:"06:50:45", placa:"IRU-4G62", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355347", tag:"0724999385" },

    { id:"pv14", data:"2026-06-15", hora:"15:08:18", placa:"JSX-4D55", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"103366926", tag:"0756978339" },

    { id:"pv15", data:"2026-06-02", hora:"18:18:27", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 448+550, NORTE, TIBAGI", cat:5, valor:60.80, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"103255837", tag:"0744936751" },
    { id:"pv16", data:"2026-06-02", hora:"19:49:14", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 370+950, NORTE, IMBAÚ", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"103255837", tag:"0744936751" },
    { id:"pv17", data:"2026-06-02", hora:"20:36:17", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 316+700, NORTE, ORTIGUEIRA", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"103255837", tag:"0744936751" },
    { id:"pv18", data:"2026-06-11", hora:"09:37:45", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"JAGUAFRANGOS", viagem:"103568573", tag:"0744936751" },
    { id:"pv19", data:"2026-06-24", hora:"09:57:05", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 179+000, OESTE, ROLÂNDIA", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104737458", tag:"0744936751" },
    { id:"pv20", data:"2026-06-24", hora:"10:48:33", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-376, KM 195+800, OESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104737458", tag:"0744936751" },
    { id:"pv21", data:"2026-06-29", hora:"15:47:16", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-376, KM 200+500, LESTE, MANDAGUARI", cat:6, valor:56.43, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104737458", tag:"0744936751" },
    { id:"pv22", data:"2026-06-29", hora:"16:22:10", placa:"QIO-9J07", conc:"EPR PARANÁ", praca:"BR-369, KM 180+200, LESTE, ARAPONGAS", cat:6, valor:59.85, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"104737458", tag:"0744936751" },
    { id:"pv23", data:"2026-07-02", hora:"11:20:41", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 316+700, SUL, ORTIGUEIRA", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv24", data:"2026-07-02", hora:"12:21:12", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 370+950, SUL, IMBAÚ", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv25", data:"2026-07-02", hora:"14:46:01", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 448+550, SUL, TIBAGI", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv26", data:"2026-07-02", hora:"18:27:22", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 529+850, SUL, WITMARSUM", cat:6, valor:68.40, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv27", data:"2026-07-02", hora:"18:52:24", placa:"QIO-9J07", conc:"VIA ARAUCÁRIA", praca:"BR-277, KM 132+800, SUL, SÃO LUIZ DO PURUNÃ", cat:6, valor:53.04, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv28", data:"2026-07-04", hora:"12:31:40", placa:"QIO-9J07", conc:"VIA ARAUCÁRIA", praca:"BR-277, KM 132+800, NORTE, SÃO LUIZ DO PURUNÃ", cat:6, valor:53.04, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv29", data:"2026-07-04", hora:"12:52:14", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 529+850, NORTE, WITMARSUM", cat:6, valor:68.40, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv30", data:"2026-07-04", hora:"15:09:25", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 448+550, NORTE, TIBAGI", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
    { id:"pv31", data:"2026-07-04", hora:"17:15:37", placa:"QIO-9J07", conc:"PRVIAS", praca:"BR-376, KM 316+700, NORTE, ORTIGUEIRA", cat:6, valor:72.96, tipo:"Vale-pedágio", emb:"BRF SA", viagem:"105355313", tag:"0744936751" },
  ],

  /* -------------------- ANTT / RNTRC (extrato do transportador) -------------------- */
  antt: {
    rntrc:"050428055", categoria:"ETC", situacao:"Ativo", apto:true,
    razao:"PLANETA EXPRESS TRANSPORTES LTDA", cnpj:"26.126.673/0001-86",
    cadastro:"2017-10-04", extratoData:"2026-03-18",
    endereco:"Av dos Pioneiros, 2495, Sala 09 — Centro, Carambeí/PR, CEP 84145-000",
    baseLegal:"Lei nº 10.233/2001 · Lei nº 11.442/2007 · Resolução ANTT nº 5.982/2022",
    consulta:"https://consultapublica.antt.gov.br/site/ConsultaRNTRC.aspx/ConsultPublica/",
    obs:"Transportador apto a realizar o transporte remunerado de cargas.",
    veiculos:[
      { id:"an1",  seq:1,  placa:"MDD-5C62", uf:"PR", tipo:"Implemento", descricao:"Semi-reboque",   renavam:"00800035208", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an2",  seq:2,  placa:"AMB-2928", uf:"PR", tipo:"Implemento", descricao:"Semi-reboque",   renavam:"00836272374", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an3",  seq:3,  placa:"IOW-1141", uf:"PR", tipo:"Implemento", descricao:"Semi-reboque",   renavam:"00971367728", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an4",  seq:4,  placa:"IPD-9036", uf:"RS", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"00984587284", propriedade:"Arrendado", situacao:"Ativo" },
      { id:"an5",  seq:5,  placa:"IPG-8A91", uf:"RS", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"00989882217", propriedade:"Arrendado", situacao:"Ativo" },
      { id:"an6",  seq:6,  placa:"EJZ-4I65", uf:"PR", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"00170983129", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an7",  seq:7,  placa:"JSX-4D55", uf:"PR", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"00191637114", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an8",  seq:8,  placa:"NTY-8B66", uf:"PR", tipo:"Implemento", descricao:"Semi-reboque",   renavam:"00274552671", propriedade:"Leasing",  situacao:"Ativo" },
      { id:"an9",  seq:9,  placa:"IRU-4G62", uf:"PR", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"00316700762", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an10", seq:10, placa:"EOF-5A47", uf:"PR", tipo:"Implemento", descricao:"Semi-reboque",   renavam:"00330076868", propriedade:"Próprio",  situacao:"Ativo" },
      { id:"an11", seq:11, placa:"QIO-9J07", uf:"PR", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"01128406214", propriedade:"Leasing",  situacao:"Ativo" },
      { id:"an12", seq:12, placa:"BDP-1B55", uf:"PR", tipo:"Automotor",  descricao:"Caminhão trator", renavam:"01184587890", propriedade:"Arrendado", situacao:"Ativo" },
    ],
  },

  /* -------------------- LICENÇAS E ALVARÁS (documentos reais 2026) --------------------
     Extraídos do PDF "Alvará e Vigilâncias Sanitárias 2026" (Município de Carambeí/PR).
     situacao:"auto" = o sistema calcula pela data de validade.                          */
  licencas: [
    { id:"lic1", nome:"Alvará de Licença para Localização e Funcionamento", categoria:"alvara",
      numero:"26/2026", orgao:"Prefeitura Municipal de Carambeí — Secretaria Municipal de Finanças / Departamento de Tributação",
      municipio:"Carambeí", estado:"PR", emissao:"", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"empresa", refId:"", titular:"", protocolo:"", hash:"",
      obs:"Inscrição Municipal 32885 · CNPJ 26.126.673/0001-86 · Área utilizada 15,00 m² · Início da atividade 27/09/2016. Atividades: transporte rodoviário de carga (municipal, intermunicipal, interestadual e internacional). Deve ficar em local visível, sem dobras ou rasuras.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2027-01-19", hora:"00:00", evento:"Validade do alvará", detalhe:"Conforme documento do Município de Carambeí", por:"Documento"} ] },

    { id:"lic2", nome:"Alvará Sanitário — Matriz", categoria:"sanitaria",
      numero:"13/2026", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"empresa", refId:"", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária do estabelecimento. Inscrição Municipal 32885 · Área 15,00 m² · Horário: Seg/Sex 8h-22h, Sáb 8h-20h, Dom/Feriado 8h-12h. Autoridade sanitária: Alan César de Assis — Inspetor Sanitário VISA (RG 3.985.045-1).",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Expedida pela Vigilância Sanitária de Carambeí", por:"Documento"} ] },

    { id:"lic3", nome:"Licença Sanitária de Veículo — IOW-1141", categoria:"sanitaria",
      numero:"", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"veiculo", refId:"v7", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária para veículo transportador de alimentos — Resolução SESA nº 465/2013. Frota C.FRIA · Chassi 9A9CM28238CEF2024 · Semirreboque fechado · Modelo/Marca SR/THERMOSARA SR FG.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Veículo transportador de alimentos (SESA 465/2013)", por:"Documento"} ] },

    { id:"lic4", nome:"Licença Sanitária de Veículo — EOF-5A47", categoria:"sanitaria",
      numero:"", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"veiculo", refId:"v11", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária para veículo transportador de alimentos — Resolução SESA nº 465/2013. Frota C.FRIA · Chassi 9A9CP3033BCEF2450 · Semirreboque · Modelo/Marca SR/THERMOSARA SR FG.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Veículo transportador de alimentos (SESA 465/2013)", por:"Documento"} ] },

    { id:"lic6", nome:"Licença Sanitária de Veículo — MDD-5C62", categoria:"sanitaria",
      numero:"", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"veiculo", refId:"v8", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária para veículo transportador de alimentos — Resolução SESA nº 465/2013. Frota C.FRIA · Chassi 9ADF147333M185707 · Semirreboque fechado · Modelo/Marca SR/RANDON SR FG.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Veículo transportador de alimentos (SESA 465/2013)", por:"Documento"} ] },

    { id:"lic7", nome:"Licença Sanitária de Veículo — AMB-2928", categoria:"sanitaria",
      numero:"", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"veiculo", refId:"v9", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária para veículo transportador de alimentos — Resolução SESA nº 465/2013. Frota C.FRIA · Chassi 9ADF147345M207891 · Semirreboque fechado · Modelo/Marca SR/RANDON SR FG.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Veículo transportador de alimentos (SESA 465/2013)", por:"Documento"} ] },

    { id:"lic8", nome:"Licença Sanitária de Veículo — NTY-8B66", categoria:"sanitaria",
      numero:"", orgao:"Secretaria Municipal de Saúde — Departamento de Vigilância Sanitária de Carambeí",
      municipio:"Carambeí", estado:"PR", emissao:"2026-01-27", validade:"2027-01-19", responsavel:"Uilian",
      situacao:"auto", escopo:"veiculo", refId:"v10", titular:"", protocolo:"", hash:"",
      obs:"Licença sanitária para veículo transportador de alimentos — Resolução SESA nº 465/2013. Frota C.FRIA · Chassi 9ADF1473ABM323262 · Semirreboque · Modelo/Marca SR/RANDON SR FG.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2026-01-27", hora:"00:00", evento:"Licença emitida", detalhe:"Veículo transportador de alimentos (SESA 465/2013)", por:"Documento"} ] },

    { id:"lic5", nome:"Inscrição Municipal — Carambeí", categoria:"municipal",
      numero:"32885", orgao:"Prefeitura Municipal de Carambeí — Departamento de Tributação",
      municipio:"Carambeí", estado:"PR", emissao:"2016-09-27", validade:"", responsavel:"Uilian",
      situacao:"auto", escopo:"empresa", refId:"", titular:"", protocolo:"", hash:"",
      obs:"Cadastro mobiliário do município (não tem data de validade). Número confirmado no alvará de funcionamento e nas 6 licenças sanitárias de 2026.",
      versoes:[], renov:{aberta:false},
      historico:[ {data:"2016-09-27", hora:"00:00", evento:"Início da atividade", detalhe:"Conforme alvará municipal", por:"Documento"} ] },
  ],

  /* -------------------- MANUTENÇÃO / TROCAS DE ÓLEO -------------------- */
  manutencoes: [
    /* Cavalos (km) */
    { id:"o1", veiculoId:"v4", item:"Óleo / Filtros", data:"2026-06-02", kmTroca:673000, proxKm:693000, intervalo:"20.000 km" },
    { id:"o2", veiculoId:"v4", item:"Filtro de Ar / Secador", data:"2026-06-02", kmTroca:673000, proxKm:733000, intervalo:"60.000 km" },
    { id:"o3", veiculoId:"v4", item:"Óleo Transmissão", data:"2024-04-30", kmTroca:627000, proxKm:717000, intervalo:"90.000 km" },
    { id:"o4", veiculoId:"v4", item:"Óleo Diferencial", data:"2024-04-30", kmTroca:627000, proxKm:717000, intervalo:"90.000 km" },

    { id:"o5", veiculoId:"v1", item:"Óleo / Filtros", data:"2026-01-14", kmTroca:1500000, proxKm:1520000, intervalo:"20.000 km" },
    { id:"o6", veiculoId:"v1", item:"Filtro de Ar / Secador", data:"2026-01-14", kmTroca:1500000, proxKm:1560000, intervalo:"60.000 km" },
    { id:"o7", veiculoId:"v1", item:"Óleo Transmissão", data:"2026-01-14", kmTroca:1500000, proxKm:1590000, intervalo:"90.000 km" },
    { id:"o8", veiculoId:"v1", item:"Óleo Diferencial", data:"2026-01-14", kmTroca:1500000, proxKm:1590000, intervalo:"90.000 km" },

    { id:"o9", veiculoId:"v5", item:"Óleo / Filtros", data:"2026-03-09", kmTroca:543000, proxKm:563000, intervalo:"20.000 km" },
    { id:"o10", veiculoId:"v5", item:"Filtro de Ar / Secador", data:"2026-03-09", kmTroca:543000, proxKm:603000, intervalo:"60.000 km" },
    { id:"o11", veiculoId:"v5", item:"Óleo Transmissão", data:"2025-09-26", kmTroca:500000, proxKm:590000, intervalo:"90.000 km" },
    { id:"o12", veiculoId:"v5", item:"Óleo Diferencial", data:"2025-09-26", kmTroca:500000, proxKm:590000, intervalo:"90.000 km" },

    { id:"o13", veiculoId:"v2", item:"Óleo / Filtros", data:"2025-07-15", kmTroca:962000, proxKm:982000, intervalo:"20.000 km" },
    { id:"o14", veiculoId:"v2", item:"Filtro de Ar / Secador", data:"2025-02-01", kmTroca:954000, proxKm:1014000, intervalo:"60.000 km" },
    { id:"o15", veiculoId:"v2", item:"Óleo Transmissão", data:"2022-10-17", kmTroca:901000, proxKm:991000, intervalo:"90.000 km" },
    { id:"o16", veiculoId:"v2", item:"Óleo Diferencial", data:"2022-06-14", kmTroca:887000, proxKm:977000, intervalo:"90.000 km" },

    { id:"o17", veiculoId:"v3", item:"Óleo / Filtros", data:"2025-09-16", kmTroca:1104000, proxKm:1124000, intervalo:"20.000 km" },
    { id:"o18", veiculoId:"v3", item:"Filtro de Ar / Secador", data:"2025-09-16", kmTroca:1104000, proxKm:1164000, intervalo:"60.000 km" },
    { id:"o19", veiculoId:"v3", item:"Óleo Transmissão", data:"2024-01-25", kmTroca:1079000, proxKm:1169000, intervalo:"90.000 km" },
    { id:"o20", veiculoId:"v3", item:"Óleo Diferencial", data:"2022-03-14", kmTroca:1040000, proxKm:1130000, intervalo:"90.000 km" },

    /* Carretas — aparelho Thermo King (horas) */
    { id:"o21", veiculoId:"v11", item:"Kit Filtro / Óleo", data:"2025-10-13", horasTroca:12000, proxHoras:13000, intervalo:"1.000 h" },
    { id:"o22", veiculoId:"v11", item:"Lavagem Condensador", data:"2025-10-13", horasTroca:12000, proxHoras:13000, intervalo:"1.000 h" },
    { id:"o25", veiculoId:"v7", item:"Kit Filtro / Óleo", data:"2026-06-29", horasTroca:6200, proxHoras:7200, intervalo:"1.000 h" },
    { id:"o26", veiculoId:"v7", item:"Lavagem Condensador", data:"2026-06-29", horasTroca:6200, proxHoras:7200, intervalo:"1.000 h" },
    { id:"o27", veiculoId:"v8", item:"Kit Filtro / Óleo", data:"2025-11-21", horasTroca:8750, proxHoras:9750, intervalo:"1.000 h" },
    { id:"o28", veiculoId:"v8", item:"Lavagem Condensador", data:"2025-08-20", horasTroca:7500, proxHoras:9750, intervalo:"1.000 h" },
    { id:"o29", veiculoId:"v9", item:"Kit Filtro / Óleo", data:"2026-01-20", horasTroca:0, proxHoras:1000, intervalo:"1.000 h" },
    { id:"o30", veiculoId:"v9", item:"Lavagem Condensador", data:"2026-01-20", horasTroca:0, proxHoras:1000, intervalo:"1.000 h" },
    { id:"o23", veiculoId:"v10", item:"Kit Filtro / Óleo", data:"2026-07-15", horasTroca:0, proxHoras:1000, intervalo:"1.000 h" },
    { id:"o24", veiculoId:"v10", item:"Lavagem Condensador", data:"2026-07-15", horasTroca:0, proxHoras:1000, intervalo:"1.000 h" },
  ],

  /* -------------------- DOCUMENTOS DA EMPRESA (registro/apontamento) -------------------- */
  documentos: [
    { id:"d1", titulo:"Contrato Social", categoria:"Societário", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Contrato Social.pdf" },
    { id:"d2", titulo:"Cartão CNPJ", categoria:"Fiscal", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Cartão CNPJ.pdf" },
    { id:"d3", titulo:"Cartão Inscrição Estadual", categoria:"Fiscal", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Cartão inscrição estadual.png" },
    { id:"d4", titulo:"Simples Nacional", categoria:"Fiscal", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Simpes Nacional.pdf" },
    { id:"d5", titulo:"Certidão Simplificada (Junta)", categoria:"Societário", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Certidão simplificada.pdf" },
    { id:"d6", titulo:"Alvará e Vigilância Sanitária 2026", categoria:"Licenças", entidade:"empresa", refId:"empresa", validade:"2027-01-19", arquivo:"Documentos Jurídicos/Alvará e Vigilâncias Sanitárias 2026.pdf" },
    { id:"d7", titulo:"PCMSO 2026", categoria:"SST", entidade:"empresa", refId:"empresa", validade:"2027-03-23", arquivo:"Documentos Jurídicos/PCMSO 2026.pdf" },
    { id:"d8", titulo:"PGR 2026", categoria:"SST", entidade:"empresa", refId:"empresa", validade:"2027-03-23", arquivo:"Documentos Jurídicos/PGR 2026.pdf" },
    { id:"d9", titulo:"Certificado Responsável Técnico (Uilian)", categoria:"Técnico", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Certificado Responsável Técnico Uilian.pdf" },
    { id:"d10", titulo:"Consulta Regularidade do Empregador", categoria:"Trabalhista", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Jurídicos/Consulta Regularidade do Empregador.pdf" },
    { id:"d11", titulo:"Comprovante de Endereço", categoria:"Cadastro", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Internos/Comprovante de endereço Planeta Express.pdf" },
    { id:"d12", titulo:"Contrato de Locação (SSUL)", categoria:"Contratos", entidade:"empresa", refId:"empresa", validade:"", arquivo:"Documentos Internos/Contrato de locação SSUL.pdf" },
  ],

  /* -------------------- NOTAS FISCAIS (valores por período) -------------------- */
  notas: [
    { id:"nf1", inicio:"2026-07-01", fim:"2026-07-15", alexandria:25480.88, notasGerais:21774.01, combustivel:14686.48, obs:"" },
  ],

  /* -------------------- CHECK-LIST — modelo de itens (formulário real) -------------------- */
  checklistModelo: {
    cavalo: ["Aparência Geral / Limpeza","Rastreador / Teclado","Tacógrafo","CRLVs / ANTT","Nível de Óleo","Nível de Água","Cabos de ponte","Baterias","Correias / Rolamentos","Vidros","Portas / Maçanetas","Elétrica","Cones","Lanterna","Extintor","Chave de Roda / Cabo","02 Calços","Macaco","Placas","Buzina","Pneus / Rodas","Calibragem","Vazamento AR","Tanques de combustível","Mangueiras espirais","Cabo rastreador","Freios / Lonas","Óleo Caixa / Diferencial","Sistema Hidráulico","Molejos","Fluído de Freio","Engraxamento","Sistema Arla"],
    carreta: ["Aparência Geral","Thermo King","Nível de Óleo","Nível de Água","Elétrica","Bateria","Correias / Rolamentos","Verificação alarmes","Gás TK","Paredes internas","Assoalho","Túnel","Divisória","4 Trava pallets","Guias Travas Pallets","Trava Baú","Portas / Vedação","Pneus","Molejos","Pés carreta","Freios / Lonas","Engraxamento","Vazamento AR","Tanque","Estepes","Faixas refletivas","Adesivos 80/60 km/h"],
  },
  /* Check-lists preenchidos (também recebidos do celular) */
  checklists: [],

  /* -------------------- PNEUS (controle) -------------------- */
  pneus: [],

  /* -------------------- ESTOQUE / RESERVA (não instalados em veículo) -------------------- */
  estoqueBaterias: [],   /* {id, data, marca, local, valor, qtd, obs} */
  estoquePneus: [],      /* {id, data, marca, medida, local, valor, qtd, dot, obs} */

  /* -------------------- CONTROLE DE VIAGENS (BRF) — jan a jun/2026 -------------------- */
  viagens: (typeof VIAGENS_SEED!=='undefined'? VIAGENS_SEED : []),

  /* -------------------- DESCARGAS (BRF) -------------------- */
  descargas: [
    { id:"dc1", data:"2026-05-05", placa:"JSX-4D55", transporte:"131760183", senha:"A000199550", valor:560, pago:"Bradesco", local:"Mufatto" },
    { id:"dc2", data:"2026-05-25", placa:"JSX-4D55", transporte:"131950147", senha:"PR46167402", valor:340, pago:"Bradesco", local:"Tonhão" },
    { id:"dc3", data:"2026-05-26", placa:"JSX-4D55", transporte:"131952554", senha:"A000202070", valor:335, pago:"Bradesco", local:"Atacadão" },
    { id:"dc4", data:"2026-05-26", placa:"EJZ-4I65", transporte:"131951931", senha:"A000202019", valor:436, pago:"Bradesco", local:"Atacadão" },
    { id:"dc5", data:"2026-05-29", placa:"BDP-1B55", transporte:"131982850", senha:"A000202489", valor:378, pago:"Bradesco", local:"Atacadão SJP" },
    { id:"dc6", data:"2026-06-01", placa:"QIO-9J07", transporte:"131991081", senha:"PR46175378", valor:644, pago:"Bradesco", local:"Condor SJP" },
    { id:"dc7", data:"2026-06-17", placa:"JSX-4D55", transporte:"132137850", senha:"A000204955", valor:832, pago:"Bradesco", local:"Muffato" },
    { id:"dc8", data:"2026-06-23", placa:"IRU-4G62", transporte:"132184093", senha:"S000380496", valor:953, pago:"Bradesco", local:"Muffato" },
    { id:"dc9", data:"2026-06-24", placa:"IRU-4G62", transporte:"132194903", senha:"PR46198578", valor:250, pago:"Bradesco", local:"Fagote e Sanches" },
    { id:"dc10", data:"2026-06-30", placa:"EJZ-4I65", transporte:"132244556", senha:"A000206415", valor:240, pago:"Bradesco", local:"Sanches Arapongas" },
    { id:"dc11", data:"2026-07-03", placa:"BDP-1B55", transporte:"132234127", senha:"S000207052", valor:474, pago:"Bradesco", local:"Atacadão" },
    { id:"dc12", data:"2026-07-04", placa:"QIO-9J07", transporte:"132256966", senha:"S000382285", valor:432, pago:"Bradesco", local:"Atacadão" },
    { id:"dc13", data:"2026-07-09", placa:"JSX-4D55", transporte:"132320045", senha:"S000383149", valor:800, pago:"Bradesco", local:"Muffato" },
  ],

  /* -------------------- ABASTECIMENTOS (gera as médias) --------------------
     cavalos: km (km/l)   |   carretas: horas do Thermo King (l/h)
  */
  abastecimentos: [],

  /* -------------------- FINANCEIRO (protegido por senha) -------------------- */
  faturamento: [],   /* {id, data, cliente, valor, obs} */
  vales: [],         /* {id, data, motoristaId, tipo:'Vale'|'Pagamento', valor, obs} */

  /* -------------------- CTE (Conhecimento de Transporte) -------------------- */
  ctes: [],          /* {id, data, numero, placa, cliente, valor, status, pago, obs} */

  /* -------------------- SERVIÇOS / REPAROS (relatório de manutenção) -------------------- */
  servicos: [],      /* {id, data, veiculoId, descricao, oficina, km, valor, obs} */

  /* -------------------- PROCESSOS JUDICIAIS dos colaboradores --------------------
     Registro factual do que o colaborador APRESENTOU à empresa (declaração da
     defesa, sentença, certidão). Serve para a homologação nas gerenciadoras de
     risco. Nunca inferir culpa: só é condenação quando o documento diz que é. */
  processos: [
    { id:"pj1", entidade:"motorista", refId:"m7", numero:"0057800-83.2024.8.16.0014",
      classe:"Ação Penal - Procedimento Ordinário", assunto:"Furto",
      comarca:"Londrina/PR", vara:"2ª Vara Criminal de Londrina", data:"2026-04-27",
      situacao:"Encerrado", resultado:"Absolvido",
      obs:"Sentença de 27/04/2026 (Juíza Chélida Roberta Soterroni Heitzmann): denúncia julgada IMPROCEDENTE e o réu ABSOLVIDO, com fulcro no art. 386, VII, do Código de Processo Penal. O próprio Ministério Público se manifestou pela absolvição. As medidas cautelares foram revogadas." },
    { id:"pj2", entidade:"motorista", refId:"m7", numero:"0039943-58.2023.8.16.0014",
      classe:"Ação Penal", assunto:"Violência doméstica",
      comarca:"Londrina/PR", vara:"", data:"",
      situacao:"Em andamento", resultado:"Sem julgamento",
      obs:"Em fase inicial, sem audiência de instrução e julgamento. Conforme a declaração da defesa, a denúncia não traz imputação de violência física e há elementos probatórios a apresentar. Não há condenação — vale a presunção de inocência." },
  ],

  /* -------------------- ANEXOS na nuvem (metadados; bytes no Supabase Storage) -------------------- */
  anexos: [],        /* {id, name, type, size, categoria, entidade, refId, validade, uploadedAt, storagePath} */

  config: { alertaCritico:30, alertaAtencao:60, alertaKm:2000, alertaHora:200, sulcoMinimo:3, finPin:"", tema:"claro" },
};
/* ==== Manutenções importadas das planilhas de Relatório de Manutenção (Cavalos + Carretas) ==== */
const MANUT_SEED = [
  {id:'mi_v1_01',data:'2021-04-13',veiculoId:'v1',descricao:'Trocado Bronzinas',oficina:'Volvo',km:1333000,valor:0,tipo:'Preventiva',obs:''},
  {id:'mi_v1_02',data:'2022-11-11',veiculoId:'v1',descricao:'Trocado Correias Alternador',oficina:'Truta',km:1387000,valor:550,tipo:'Preventiva',obs:''},
  {id:'mi_v1_03',data:'2023-01-17',veiculoId:'v1',descricao:'Trocado módulo ignição',oficina:'Volmix',km:1395000,valor:10000,tipo:'Corretiva',obs:''},
  {id:'mi_v1_04',data:'2023-07-18',veiculoId:'v1',descricao:'Trocado Embreagem recon',oficina:'Truta',km:1445000,valor:3500,tipo:'Corretiva',obs:''},
  {id:'mi_v1_05',data:'2024-02-09',veiculoId:'v1',descricao:'Trocado Valvula PU',oficina:'Katatal Marialva',km:1460000,valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v1_06',data:'2024-02-20',veiculoId:'v1',descricao:'Trocado Bomba Hidráulica',oficina:'Jorginho PG',km:1460000,valor:4000,tipo:'Corretiva',obs:''},
  {id:'mi_v1_07',data:'2024-05-10',veiculoId:'v1',descricao:'Barra Direção',oficina:'Junior atras cunhado',km:1472000,valor:900,tipo:'Corretiva',obs:''},
  {id:'mi_v1_08',data:'2025-04-16',veiculoId:'v1',descricao:'Trocado reservatório de água/mangueiras e aditivo',oficina:'RR radiadores',km:1489000,valor:1250,tipo:'Corretiva',obs:''},
  {id:'mi_v1_09',data:'2026-01-15',veiculoId:'v1',descricao:'Revisado molejos',oficina:'Arnaldo AM',km:1495000,valor:2500,tipo:'Corretiva',obs:''},
  {id:'mi_v1_10',data:'2026-01-15',veiculoId:'v1',descricao:'Trocado 5 Roda Recondicionada',oficina:'Arnaldo AM',km:1495000,valor:2500,tipo:'Corretiva',obs:''},
  {id:'mi_v1_11',data:'2026-01-15',veiculoId:'v1',descricao:'Teclado Rastreador novo',oficina:'Truck Control PG',km:1495000,valor:1268,tipo:'Corretiva',obs:''},
  {id:'mi_v1_12',data:'2026-01-19',veiculoId:'v1',descricao:'Pistão hidraulico',oficina:'Jango',km:1495000,valor:750,tipo:'Corretiva',obs:''},
  {id:'mi_v1_13',data:'2026-01-23',veiculoId:'v1',descricao:'Placas Solares',oficina:'Cunhado',km:1495000,valor:2000,tipo:'Preventiva',obs:''},
  {id:'mi_v1_14',data:'2026-07-15',veiculoId:'v1',descricao:'Embreagem nova completa Sachs 430MM',oficina:'Trizotto',km:1503500,valor:7791,tipo:'Corretiva',obs:''},
  {id:'mi_v1_15',data:'2026-07-15',veiculoId:'v1',descricao:'Atuador de embreagem novo Sachs',oficina:'Trizotto',km:1503500,valor:4750,tipo:'Corretiva',obs:''},
  {id:'mi_v1_16',data:'2026-07-15',veiculoId:'v1',descricao:'Valvula PWM câmbio nova masterfex',oficina:'Trizotto',km:1503500,valor:1418,tipo:'Preventiva',obs:''},
  {id:'mi_v1_17',data:'2026-07-20',veiculoId:'v1',descricao:'Revisado Valvula distribuidora Wabco',oficina:'JJS Freios',km:1503500,valor:415.65,tipo:'Corretiva',obs:''},
  {id:'mi_v1_18',data:'2026-07-20',veiculoId:'v1',descricao:'Flexivel caixa atuador PWM',oficina:'Trizotto',km:1503500,valor:432,tipo:'Preventiva',obs:''},
  {id:'mi_v1_19',data:'2026-07-20',veiculoId:'v1',descricao:'Sensor ABS truck LE',oficina:'Trizotto',km:1503500,valor:415,tipo:'Preventiva',obs:''},
  {id:'mi_v5_01',data:'2025-08-01',veiculoId:'v5',descricao:'Embreagem nova original ( Del pozo)',oficina:'Volvo',km:499000,valor:0,tipo:'Corretiva',obs:''},
  {id:'mi_v5_02',data:'2026-03-15',veiculoId:'v5',descricao:'Revisão Volvo ( Del pozo )',oficina:'Volvo',km:543000,valor:0,tipo:'Corretiva',obs:''},
  {id:'mi_v5_03',data:'2026-04-21',veiculoId:'v5',descricao:'Substituido Roda fônica tração',oficina:'Volvo',km:545000,valor:3000,tipo:'Corretiva',obs:''},
  {id:'mi_v5_04',data:'2026-04-21',veiculoId:'v5',descricao:'Subtituido fluido arrefecimento',oficina:'Volvo',km:545000,valor:2700,tipo:'Corretiva',obs:''},
  {id:'mi_v5_05',data:'2026-04-21',veiculoId:'v5',descricao:'Pintura Cabine',oficina:'Volvo',km:545000,valor:0,tipo:'Preventiva',obs:''},
  {id:'mi_v5_06',data:'2026-06-02',veiculoId:'v5',descricao:'Subtituido 2 Bolsas de ar tração',oficina:'Alinha laser',km:547000,valor:2200,tipo:'Corretiva',obs:''},
  {id:'mi_v5_07',data:'2026-06-20',veiculoId:'v5',descricao:'Substituido bolsa de ar truck LE',oficina:'Alinha laser',km:548000,valor:1100,tipo:'Corretiva',obs:''},
  {id:'mi_v4_01',data:'2024-05-10',veiculoId:'v4',descricao:'Trocado junta carter e retentor virabrequim',oficina:'Truta',km:627000,valor:1300,tipo:'Corretiva',obs:''},
  {id:'mi_v4_02',data:'2024-05-10',veiculoId:'v4',descricao:'Revisado Freios cavalo',oficina:'Truta',km:627000,valor:600,tipo:'Corretiva',obs:''},
  {id:'mi_v4_03',data:'2024-05-10',veiculoId:'v4',descricao:'Scanner para resolver falhas',oficina:'Truta',km:627000,valor:250,tipo:'Corretiva',obs:''},
  {id:'mi_v4_04',data:'2024-06-13',veiculoId:'v4',descricao:'Valvula Termostatica, mangueira agua + M.o',oficina:'Passarim',km:629000,valor:2025,tipo:'Corretiva',obs:''},
  {id:'mi_v4_05',data:'2024-07-15',veiculoId:'v4',descricao:'Bolsa Cabine Ld e Le',oficina:'Truta( pereck)',km:633000,valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v4_06',data:'2024-10-03',veiculoId:'v4',descricao:'bolsa Cabine LE',oficina:'Passarim',km:636000,valor:500,tipo:'Corretiva',obs:''},
  {id:'mi_v4_07',data:'2024-10-10',veiculoId:'v4',descricao:'Modulo Arla',oficina:'Ivesul Ricardo',km:638000,valor:2500,tipo:'Corretiva',obs:''},
  {id:'mi_v4_08',data:'2024-10-10',veiculoId:'v4',descricao:'Reparo Valvula PU + Filtro',oficina:'Ivesul Ricardo',km:638000,valor:500,tipo:'Corretiva',obs:''},
  {id:'mi_v4_09',data:'2024-10-10',veiculoId:'v4',descricao:'Revisado Sistema freio motor',oficina:'Ivesul Ricardo',km:638000,valor:1600,tipo:'Corretiva',obs:''},
  {id:'mi_v4_10',data:'2024-10-10',veiculoId:'v4',descricao:'Limpeza Catalisador',oficina:'Ivesul Ricardo',km:638000,valor:2000,tipo:'Corretiva',obs:''},
  {id:'mi_v4_11',data:'2025-03-06',veiculoId:'v4',descricao:'Revisado Cubo completo tração LD',oficina:'4 irmaos',km:'',valor:4300,tipo:'Corretiva',obs:''},
  {id:'mi_v4_12',data:'2026-03-23',veiculoId:'v4',descricao:'2 Pneus novos diateira Goodyear',oficina:'Planeta',km:670000,valor:0,tipo:'Corretiva',obs:''},
  {id:'mi_v3_01',data:'2022-09-22',veiculoId:'v3',descricao:'Motor de partida revisado',oficina:'',km:1050000,valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v3_02',data:'2023-01-25',veiculoId:'v3',descricao:'6 Unidades Inetoras revisadas bosch',oficina:'Vilmar Diesel',km:1065000,valor:7800,tipo:'Preventiva',obs:''},
  {id:'mi_v3_03',data:'2023-01-25',veiculoId:'v3',descricao:'Limpeza Tanques',oficina:'Truta',km:1065000,valor:400,tipo:'Preventiva',obs:''},
  {id:'mi_v3_04',data:'2023-01-25',veiculoId:'v3',descricao:'Turbina Holset reman',oficina:'Contorno turbo',km:1065000,valor:680,tipo:'Corretiva',obs:''},
  {id:'mi_v3_05',data:'2023-11-08',veiculoId:'v3',descricao:'Embreagem Sachs recond',oficina:'Cambé',km:1076000,valor:3620,tipo:'Corretiva',obs:''},
  {id:'mi_v3_06',data:'2023-11-18',veiculoId:'v3',descricao:'Cilindro e servo novos',oficina:'Alan cocamar',km:1076000,valor:2400,tipo:'Corretiva',obs:''},
  {id:'mi_v3_07',data:'2024-01-25',veiculoId:'v3',descricao:'Revisado Cambio',oficina:'Truta',km:1080000,valor:11200,tipo:'Preventiva',obs:''},
  {id:'mi_v3_08',data:'2024-02-24',veiculoId:'v3',descricao:'Revisado Servo embreagem',oficina:'Lucas Cambé',km:1083000,valor:750,tipo:'Corretiva',obs:''},
  {id:'mi_v3_09',data:'2024-03-26',veiculoId:'v3',descricao:'Motor novo , exceto cilindros (usados)',oficina:'Truta',km:1083000,valor:32000,tipo:'Corretiva',obs:''},
  {id:'mi_v3_10',data:'2024-03-26',veiculoId:'v3',descricao:'Embreagem Sachs recond',oficina:'Truta',km:1083000,valor:3900,tipo:'Corretiva',obs:''},
  {id:'mi_v3_11',data:'2024-03-26',veiculoId:'v3',descricao:'Cremalheira usada',oficina:'Truta',km:1083000,valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v3_12',data:'2024-03-26',veiculoId:'v3',descricao:'Revisado Radiador e Intercooler',oficina:'Fabio Radiadores PG',km:1083000,valor:1100,tipo:'Corretiva',obs:''},
  {id:'mi_v3_13',data:'2024-04-20',veiculoId:'v3',descricao:'Servo embreagem importado',oficina:'Truta',km:1084000,valor:1280,tipo:'Corretiva',obs:''},
  {id:'mi_v3_14',data:'2024-06-21',veiculoId:'v3',descricao:'Trocado cilindro e flexivel embreagem',oficina:'Truta',km:1089000,valor:850,tipo:'Corretiva',obs:''},
  {id:'mi_v3_15',data:'2025-09-18',veiculoId:'v3',descricao:'Teste intercooler',oficina:'Truta',km:1104000,valor:200,tipo:'Preventiva',obs:''},
  {id:'mi_v3_16',data:'2025-09-18',veiculoId:'v3',descricao:'Trocado mola tração',oficina:'Arnaldo molas',km:1104000,valor:300,tipo:'Corretiva',obs:''},
  {id:'mi_v3_17',data:'2025-09-18',veiculoId:'v3',descricao:'revisado freios dianteiros',oficina:'Arnaldo molas',km:1104000,valor:500,tipo:'Corretiva',obs:''},
  {id:'mi_v7_01',data:'2022-08-24',veiculoId:'v7',descricao:'Bomba d\'agua',oficina:'Piloto Londrina',km:24290,valor:1600,tipo:'Corretiva',obs:''},
  {id:'mi_v7_02',data:'2022-10-24',veiculoId:'v7',descricao:'Motor de Partida novo',oficina:'TK Piloto Cascavel',km:25100,valor:1750,tipo:'Corretiva',obs:''},
  {id:'mi_v7_03',data:'2023-10-10',veiculoId:'v7',descricao:'Solenoide partida',oficina:'Mazinho',km:'',valor:400,tipo:'Corretiva',obs:''},
  {id:'mi_v7_04',data:'2024-01-29',veiculoId:'v7',descricao:'Trocado Placa eletronica reman',oficina:'Mazinho',km:0,valor:1870,tipo:'Corretiva',obs:''},
  {id:'mi_v7_05',data:'2024-01-29',veiculoId:'v7',descricao:'Trocado Controlador reman',oficina:'Mazinho',km:0,valor:2400,tipo:'Corretiva',obs:''},
  {id:'mi_v7_06',data:'2024-10-23',veiculoId:'v7',descricao:'Trocado automatico MP e polia alternador',oficina:'Mazinho',km:1400,valor:1400,tipo:'Corretiva',obs:''},
  {id:'mi_v7_07',data:'2025-03-07',veiculoId:'v7',descricao:'Trocado correia dentada',oficina:'New ar Foz',km:'',valor:430,tipo:'Corretiva',obs:''},
  {id:'mi_v7_08',data:'2025-10-29',veiculoId:'v7',descricao:'Bomba d\'agua',oficina:'Mazinho',km:'',valor:1080,tipo:'Corretiva',obs:''},
  {id:'mi_v7_09',data:'2025-10-29',veiculoId:'v7',descricao:'Bomba Injetora',oficina:'Mazinho',km:'',valor:5500,tipo:'Corretiva',obs:''},
  {id:'mi_v8_01',data:'2024-09-24',veiculoId:'v8',descricao:'Trocado kit correias',oficina:'Piloto LDN',km:1600,valor:500,tipo:'Preventiva',obs:''},
  {id:'mi_v8_02',data:'2024-05-20',veiculoId:'v8',descricao:'Compressor novo',oficina:'Mazinho',km:'',valor:27000,tipo:'Corretiva',obs:''},
  {id:'mi_v8_03',data:'2025-08-19',veiculoId:'v8',descricao:'Motor TIER - 1',oficina:'Mazinho',km:7500,valor:18000,tipo:'Corretiva',obs:''},
  {id:'mi_v8_04',data:'2025-08-19',veiculoId:'v8',descricao:'Rolamento mancal helice / retentor polia',oficina:'Mazinho',km:7500,valor:500,tipo:'Corretiva',obs:''},
  {id:'mi_v8_05',data:'2025-12-10',veiculoId:'v8',descricao:'Trocado Controlador e placa',oficina:'Mazinho',km:'',valor:0,tipo:'Corretiva',obs:''},
  {id:'mi_v8_06',data:'2026-07-15',veiculoId:'v8',descricao:'Sensor oleo',oficina:'Mazinho',km:'',valor:475,tipo:'Corretiva',obs:''},
  {id:'mi_v9_01',data:'2022-08-25',veiculoId:'v9',descricao:'Revisado motor de partida',oficina:'Mazinho',km:'',valor:850,tipo:'Corretiva',obs:''},
  {id:'mi_v9_02',data:'2022-09-13',veiculoId:'v9',descricao:'Alternador novo',oficina:'Piloto TK',km:28300,valor:2100,tipo:'Corretiva',obs:''},
  {id:'mi_v9_03',data:'2023-06-06',veiculoId:'v9',descricao:'Rolamento e eixo mancal intermediario transmissão',oficina:'Mazinho',km:'',valor:1280,tipo:'Corretiva',obs:''},
  {id:'mi_v9_04',data:'2023-06-06',veiculoId:'v9',descricao:'Correia Alternador',oficina:'Mazinho',km:'',valor:153,tipo:'Corretiva',obs:''},
  {id:'mi_v9_05',data:'2023-07-25',veiculoId:'v9',descricao:'Kit Coxim',oficina:'Mazinho',km:'',valor:630,tipo:'Corretiva',obs:''},
  {id:'mi_v9_06',data:'2023-10-25',veiculoId:'v9',descricao:'Kit Correias',oficina:'Piloto TK',km:'',valor:310,tipo:'Corretiva',obs:''},
  {id:'mi_v9_07',data:'2024-05-25',veiculoId:'v9',descricao:'Trocado Controlador',oficina:'Mazinho',km:'',valor:2400,tipo:'Corretiva',obs:''},
  {id:'mi_v9_08',data:'2024-05-20',veiculoId:'v9',descricao:'Revisado motor de partida basico',oficina:'Mazinho',km:'',valor:650,tipo:'Preventiva',obs:''},
  {id:'mi_v9_09',data:'2024-06-20',veiculoId:'v9',descricao:'Trocado kit correias',oficina:'Mazinho',km:'',valor:488,tipo:'Corretiva',obs:''},
  {id:'mi_v9_10',data:'2024-06-20',veiculoId:'v9',descricao:'Esticador Alternador',oficina:'Mazinho',km:'',valor:126,tipo:'Corretiva',obs:''},
  {id:'mi_v9_11',data:'2025-03-05',veiculoId:'v9',descricao:'Trocado sensores frio',oficina:'Mazinho',km:'',valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v9_12',data:'2026-01-20',veiculoId:'v9',descricao:'Motor novo Reman',oficina:'Mazinho',km:'',valor:16000,tipo:'Corretiva',obs:''},
  {id:'mi_v9_13',data:'2026-01-20',veiculoId:'v9',descricao:'Sistema arrefecimento reman',oficina:'Mazinho',km:'',valor:8000,tipo:'Corretiva',obs:''},
  {id:'mi_v10_01',data:'2024-05-25',veiculoId:'v10',descricao:'Bomba injetora',oficina:'Mazinho',km:10100,valor:8000,tipo:'Corretiva',obs:''},
  {id:'mi_v10_02',data:'2024-10-23',veiculoId:'v10',descricao:'Trocado correias',oficina:'Mazinho',km:12750,valor:0,tipo:'Corretiva',obs:''},
  {id:'mi_v10_03',data:'2026-05-25',veiculoId:'v10',descricao:'Bomba Injetora Reman Tier ll',oficina:'Mazinho',km:'',valor:7500,tipo:'Corretiva',obs:''},
  {id:'mi_v10_04',data:'2026-05-25',veiculoId:'v10',descricao:'Kit Correia',oficina:'Mazinho',km:'',valor:492,tipo:'Corretiva',obs:''},
  {id:'mi_v10_05',data:'2026-05-25',veiculoId:'v10',descricao:'Kit Coxim',oficina:'Mazinho',km:'',valor:638,tipo:'Corretiva',obs:''},
  {id:'mi_v10_06',data:'2026-05-25',veiculoId:'v10',descricao:'Solenoide de partida',oficina:'Mazinho',km:'',valor:398,tipo:'Corretiva',obs:''},
  {id:'mi_v10_07',data:'2026-05-25',veiculoId:'v10',descricao:'Valvula check',oficina:'Mazinho',km:'',valor:200,tipo:'Corretiva',obs:''},
  {id:'mi_v11_01',data:'2024-04-20',veiculoId:'v11',descricao:'Limpeza Tanque combustível',oficina:'Truta',km:7500,valor:500,tipo:'Preventiva',obs:''},
  {id:'mi_v11_02',data:'2024-10-25',veiculoId:'v11',descricao:'Motor novo TK ( Garantia )',oficina:'Videfrigo',km:8500,valor:0,tipo:'Preventiva',obs:''},
  {id:'mi_v11_03',data:'2024-10-25',veiculoId:'v11',descricao:'Compressor revisado full',oficina:'Videfrigo',km:8500,valor:0,tipo:'Preventiva',obs:''},
  {id:'mi_v11_04',data:'2024-10-25',veiculoId:'v11',descricao:'Trocado liquido arrefecimento',oficina:'Videfrigo',km:8500,valor:0,tipo:'Preventiva',obs:''},
  {id:'mi_v11_05',data:'2026-04-29',veiculoId:'v11',descricao:'Kit Valvula 3 vias',oficina:'Mazinho',km:9500,valor:1327,tipo:'Corretiva',obs:''},
  {id:'mi_v11_06',data:'2026-04-29',veiculoId:'v11',descricao:'Solenoite de aceleração',oficina:'Mazinho',km:9500,valor:2911,tipo:'Corretiva',obs:''},
  {id:'mi_v11_07',data:'2026-04-29',veiculoId:'v11',descricao:'Valvula de expansão',oficina:'Mazinho',km:9500,valor:2217,tipo:'Corretiva',obs:''},
  {id:'mi_v2_01',data:'2023-01-25',veiculoId:'v2',descricao:'Chicote motor',oficina:'Tigre',km:930000,valor:1000,tipo:'Corretiva',obs:''},
  {id:'mi_v2_02',data:'2023-11-24',veiculoId:'v2',descricao:'Motor completo — bloco, virabrequim STD, bombas (água/óleo/diesel manual), comando de válvulas, kit pistões, bronzinas, radiador de óleo, roletes, juntas, servo e disco de embreagem novo, kit filtros, troca de óleo, limpeza de tanques, cabeçote revisado, torno volante do motor, pescador novo, unidades injetoras revisadas, turbina Holset HX50, mão de obra',oficina:'Truta',km:930000,valor:75000,tipo:'Preventiva',obs:'Reforma geral do motor'},
  {id:'mi_v2_03',data:'2023-12-18',veiculoId:'v2',descricao:'Motor de partida (porta escova/automático/induzido)',oficina:'Lagoa Cambé',km:931000,valor:750,tipo:'Corretiva',obs:''},
  {id:'mi_v2_04',data:'2024-01-25',veiculoId:'v2',descricao:'Limpeza Tanques',oficina:'Truta',km:933000,valor:500,tipo:'Preventiva',obs:''},
  {id:'mi_v2_05',data:'2024-01-25',veiculoId:'v2',descricao:'Revisado Chicote',oficina:'Tigre',km:933000,valor:850,tipo:'Corretiva',obs:''},
  {id:'mi_v2_06',data:'2024-01-25',veiculoId:'v2',descricao:'Limpeza radiador e intercooler',oficina:'Fabio Radiadores PG',km:933000,valor:1000,tipo:'Preventiva',obs:''},
  {id:'mi_v2_07',data:'2024-03-05',veiculoId:'v2',descricao:'Trocado reservatório de água',oficina:'Truta',km:936000,valor:900,tipo:'Corretiva',obs:''},
  {id:'mi_v2_08',data:'2024-10-10',veiculoId:'v2',descricao:'Boia Tanque Combustível',oficina:'Ivesul Ricardo',km:954000,valor:480,tipo:'Corretiva',obs:''},
  {id:'mi_v2_09',data:'2024-10-10',veiculoId:'v2',descricao:'Amortecedor traseiro cabine com bolsa',oficina:'Ivesul Ricardo',km:954000,valor:748,tipo:'Corretiva',obs:''},
  {id:'mi_v2_10',data:'2024-10-10',veiculoId:'v2',descricao:'Limpeza de Tanques com vapor',oficina:'Ivesul Ricardo',km:954000,valor:600,tipo:'Preventiva',obs:''},
  {id:'mi_v2_11',data:'2024-10-10',veiculoId:'v2',descricao:'Scanner para falhas',oficina:'Ivesul Ricardo',km:954000,valor:150,tipo:'Corretiva',obs:''},
  {id:'mi_v2_12',data:'2024-12-06',veiculoId:'v2',descricao:'Compressor motor novo',oficina:'Turim Diesel',km:956000,valor:4900,tipo:'Corretiva',obs:''},
  {id:'mi_v2_13',data:'2024-12-09',veiculoId:'v2',descricao:'Conserto e reparo Válvula Transferência e 2 pinos',oficina:'Lucas Cambé',km:956000,valor:950,tipo:'Corretiva',obs:''},
  {id:'mi_v2_14',data:'2026-06-18',veiculoId:'v2',descricao:'Revisado motor de partida',oficina:'Fujii Paiçandu',km:'',valor:1460,tipo:'Corretiva',obs:''},
];

/* ==== CT-e importados dos XML (36 conhecimentos de transporte, jun/2026) ==== */
const CTES_SEED = [
  {id:'cte_41260626126673000186570020000019241000000004',chave:'41260626126673000186570020000019241000000004',data:'2026-06-23',numero:'1924',serie:'2',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:8000,vCarga:'380.86',produto:'NHOQUE COM MOLHO BOLONHESA CONG 300G SD',placa:'',status:'Emitido',pago:'',obs:'Complementar Diária_LDN_148650 a SR5697435630.'},
  {id:'cte_41260626126673000186570020000019251000000001',chave:'41260626126673000186570020000019251000000001',data:'2026-06-25',numero:'1925',serie:'2',cfop:'6353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PENAPOLIS/SP',valor:1426.14,vCarga:'307.88',produto:'ALMONDEGA BOVINA SADIA 0,5KG',placa:'',status:'Emitido',pago:'',obs:'PLACA: BDP1B55'},
  {id:'cte_41260626126673000186570200000021591000215994',chave:'41260626126673000186570200000021591000215994',data:'2026-06-08',numero:'2159',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:1439.07,vCarga:'395398.36',produto:'COXA CONG FGO C/OP 1KG SADIA',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132058709 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00170983129'},
  {id:'cte_41260626126673000186570200000021601000216096',chave:'41260626126673000186570200000021601000216096',data:'2026-06-09',numero:'2160',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:707.3,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0131890420 e Load JDA: ZD05 AdicCustosDiar.Exc. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021611000216190',chave:'41260626126673000186570200000021611000216190',data:'2026-06-10',numero:'2161',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'BRUXELAS COMERCIO DE ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:868.87,vCarga:'329647.50',produto:'LINGUICA SUINA SADIA PT CX 15KG',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132080741 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021621000216295',chave:'41260626126673000186570200000021621000216295',data:'2026-06-11',numero:'2162',serie:'20',cfop:'6353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'CONDOR SUPER CENTER LTDA',origem:'LONDRINA/PR',destino:'JOINVILLE/SC',valor:9090.91,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0131991081 e Load JDA: ZD02 AdicCustos tp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021631000216390',chave:'41260626126673000186570200000021631000216390',data:'2026-06-17',numero:'2163',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'IRMAOS MUFFATO E CIA LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:868.87,vCarga:'384472.95',produto:'LINGUICA TIPO CALAB PERD PCT 4,5KG',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132137850 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00191637114'},
  {id:'cte_41260626126673000186570200000021641000216494',chave:'41260626126673000186570200000021641000216494',data:'2026-06-17',numero:'2164',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'ATACADAO S A',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:480.44,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0131951931 e Load JDA: ZD04 AdicCustosDescarga - Renavam 00170983129'},
  {id:'cte_41260626126673000186570200000021651000216599',chave:'41260626126673000186570200000021651000216599',data:'2026-06-17',numero:'2165',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'ATACADAO S A',origem:'LONDRINA/PR',destino:'PINHAIS/PR',valor:416.53,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0131982850 e Load JDA: ZD04 AdicCustosDescarga - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021661000216693',chave:'41260626126673000186570200000021661000216693',data:'2026-06-17',numero:'2166',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:28000,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132003452 e Load JDA: ZD02 AdicCustos tp.Distr. - Renavam 00191637114'},
  {id:'cte_41260626126673000186570200000021671000216798',chave:'41260626126673000186570200000021671000216798',data:'2026-06-17',numero:'2167',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:12000,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132003453 e Load JDA: ZD02 AdicCustos tp.Distr. - Renavam 00170983129'},
  {id:'cte_41260626126673000186570200000021681000216892',chave:'41260626126673000186570200000021681000216892',data:'2026-06-17',numero:'2168',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:20000,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132004264 e Load JDA: ZD02 AdicCustos tp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021691000216997',chave:'41260626126673000186570200000021691000216997',data:'2026-06-17',numero:'2169',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:32000,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132007400 e Load JDA: ZD02 AdicCustos tp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021701000217099',chave:'41260626126673000186570200000021701000217099',data:'2026-06-21',numero:'2170',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'M F C SUPERMERCADOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:2212.35,vCarga:'189309.43',produto:'MORTADELA MISTA S/TOUCINHO PERDIGAO',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132175475 e Load JDA: ZD03 Cust.transp.DistrTSP / Transporte ao destino final sera realizado pela transp. PLANETA EXPRESS TRANSPORTES LTDA CNPJ 26126673000186 IE 9073081111. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021711000217193',chave:'41260626126673000186570200000021711000217193',data:'2026-06-22',numero:'2171',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:1439.07,vCarga:'349490.04',produto:'MARGARINA BECEL ORIG COM SAL PT 250G',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168929 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00191637114'},
  {id:'cte_41260626126673000186570200000021721000217298',chave:'41260626126673000186570200000021721000217298',data:'2026-06-22',numero:'2172',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021731000217392',chave:'41260626126673000186570200000021731000217392',data:'2026-06-22',numero:'2173',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021741000217497',chave:'41260626126673000186570200000021741000217497',data:'2026-06-22',numero:'2174',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021751000217591',chave:'41260626126673000186570200000021751000217591',data:'2026-06-22',numero:'2175',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021761000217696',chave:'41260626126673000186570200000021761000217696',data:'2026-06-22',numero:'2176',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021771000217790',chave:'41260626126673000186570200000021771000217790',data:'2026-06-22',numero:'2177',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:1614.91,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021781000217895',chave:'41260626126673000186570200000021781000217895',data:'2026-06-23',numero:'2178',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'IRMAOS MUFFATO E CIA LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:868.87,vCarga:'468187.84',produto:'LING TIPO CALAB SADIA 4PT CX 20KG',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184093 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021791000217990',chave:'41260626126673000186570200000021791000217990',data:'2026-06-23',numero:'2179',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'IRMAOS MUFFATO E CIA LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:868.87,vCarga:'468187.84',produto:'LING TIPO CALAB SADIA 4PT CX 20KG',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184093 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021801000218091',chave:'41260626126673000186570200000021801000218091',data:'2026-06-23',numero:'2180',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'BRUXELAS COMERCIO DE ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:236.96,vCarga:'178161.50',produto:'SOBRECOXA FGO CONG SADIA CX 15KG FS',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184356 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021811000218196',chave:'41260626126673000186570200000021811000218196',data:'2026-06-23',numero:'2181',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'BRUXELAS COMERCIO DE ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:236.96,vCarga:'139115.23',produto:'ALMONDEGA MISTA CONG 0,5KG PERD MONTANA',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184356 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021821000218290',chave:'41260626126673000186570200000021821000218290',data:'2026-06-23',numero:'2182',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DINAMARCA INDUSTRIA E COMERCIO DE A',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:197.47,vCarga:'4071.00',produto:'MARGARINA VEG.CREM.S/SAL QUALY 500G',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184356 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021831000218395',chave:'41260626126673000186570200000021831000218395',data:'2026-06-23',numero:'2183',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DINAMARCA INDUSTRIA E COMERCIO DE A',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:197.47,vCarga:'8097.30',produto:'MARGARINA VEG.CREM.S/SAL QUALY 500G',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132184356 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021841000218490',chave:'41260626126673000186570200000021841000218490',data:'2026-06-23',numero:'2184',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'DIFAL ALIMENTOS LTDA',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:2000,vCarga:'273950.41',produto:'BIG CHICKEN TRAD EMP CONG PT 1 KG PD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132168931 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01128406214'},
  {id:'cte_41260626126673000186570200000021851000218594',chave:'41260626126673000186570200000021851000218594',data:'2026-06-24',numero:'2185',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'FAGOTTE E SANCHES LTDA',origem:'LONDRINA/PR',destino:'ARAPONGAS/PR',valor:1615.38,vCarga:'70565.90',produto:'NUGGETS FGO C/QJO CONG PT 300G SD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132194903 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021861000218699',chave:'41260626126673000186570200000021861000218699',data:'2026-06-24',numero:'2186',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'MERCEARIA PROMISSAO LTDA',origem:'LONDRINA/PR',destino:'ARAPONGAS/PR',valor:192.31,vCarga:'10145.19',produto:'NUGGETS FGO C/QJO CONG PT 300G SD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132194903 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021871000218793',chave:'41260626126673000186570200000021871000218793',data:'2026-06-24',numero:'2187',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'ADEMAR SANCHES CANO LTDA',origem:'LONDRINA/PR',destino:'ARAPONGAS/PR',valor:192.31,vCarga:'9171.03',produto:'MORTADELA DEFUMADA OURO PERDIGAO',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132194903 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00316700762'},
  {id:'cte_41260626126673000186570200000021881000218898',chave:'41260626126673000186570200000021881000218898',data:'2026-06-25',numero:'2188',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'J MARTINS SUPERMERCADOS PLANALTO LT',origem:'LONDRINA/PR',destino:'MARINGA/PR',valor:2000,vCarga:'216931.86',produto:'QUALY LIGHT 500 G COM SAL',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132206581 e Load JDA: ZD03 Cust.transp.DistrTSP / Transporte ao destino final sera realizado pela transp. PLANETA EXPRESS TRANSPORTES LTDA CNPJ 26126673000186 IE 9073081111. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021891000218992',chave:'41260626126673000186570200000021891000218992',data:'2026-06-26',numero:'2189',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'IRMAOS MUFFATO E CIA LTDA',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:916.8,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132137850 e Load JDA: ZD04 AdicCustosDescarga - Renavam 00191637114'},
  {id:'cte_41260626126673000186570200000021908000219091',chave:'41260626126673000186570200000021908000219091',data:'2026-06-29',numero:'2190',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'ATACADAO S A',origem:'LONDRINA/PR',destino:'CAMBE/PR',valor:2000,vCarga:'145791.97',produto:'BACON FATIADO 0,75 SD',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132234127 e Load JDA: ZD01 Custos transp.Distr. - Renavam 01184587890'},
  {id:'cte_41260626126673000186570200000021911000219199',chave:'41260626126673000186570200000021911000219199',data:'2026-06-30',numero:'2191',serie:'20',cfop:'5353',tpCTe:'0',cliente:'BRF S.A.',destinatario:'SANCHES E VECCHIATE LTDA',origem:'LONDRINA/PR',destino:'ARAPONGAS/PR',valor:2000,vCarga:'37686.75',produto:'APRESUNTADO PERDIGAO',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132244556 e Load JDA: ZD01 Custos transp.Distr. - Renavam 00170983129'},
  {id:'cte_41260626126673000186570200000021931000219398',chave:'41260626126673000186570200000021931000219398',data:'2026-06-30',numero:'2193',serie:'20',cfop:'5353',tpCTe:'1',cliente:'BRF S.A.',destinatario:'COMPANHIA SULAMERICANA DE DISTRIBUI',origem:'LONDRINA/PR',destino:'PAICANDU/PR',valor:24042.94,vCarga:'',produto:'',placa:'',status:'Emitido',pago:'',obs:'Transporte: 0132058709 e Load JDA: ZD05 AdicCustosDiar.Exc. - Renavam 00170983129'},
];
