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

    /* Toxicológico */
    { id:"t1", tipo:"Toxicológico", entidade:"motorista", refId:"m1", emissao:"2025-02-06", validade:"2027-10-11", numero:"", orgao:"", obs:"" },
    { id:"t2", tipo:"Toxicológico", entidade:"motorista", refId:"m4", emissao:"2026-04-24", validade:"2028-10-24", numero:"", orgao:"", obs:"" },
    { id:"t3", tipo:"Toxicológico", entidade:"motorista", refId:"m5", emissao:"2025-08-14", validade:"2028-03-17", numero:"", orgao:"", obs:"" },
    { id:"t4", tipo:"Toxicológico", entidade:"motorista", refId:"m2", emissao:"2025-02-03", validade:"2027-02-03", numero:"", orgao:"", obs:"" },
    { id:"t5", tipo:"Toxicológico", entidade:"motorista", refId:"m3", emissao:"2026-03-13", validade:"2028-09-13", numero:"", orgao:"", obs:"" },
    { id:"t6", tipo:"Toxicológico", entidade:"motorista", refId:"m6", emissao:"", validade:"2028-12-16", numero:"", orgao:"", obs:"" },

    /* ASO (exame ocupacional) */
    { id:"a1", tipo:"ASO", entidade:"motorista", refId:"m1", emissao:"2026-07-13", validade:"2027-07-13", numero:"", orgao:"", obs:"" },
    { id:"a2", tipo:"ASO", entidade:"motorista", refId:"m4", emissao:"2025-08-20", validade:"2026-08-20", numero:"", orgao:"", obs:"" },
    { id:"a3", tipo:"ASO", entidade:"motorista", refId:"m5", emissao:"2025-09-19", validade:"2026-09-19", numero:"", orgao:"", obs:"" },
    { id:"a4", tipo:"ASO", entidade:"motorista", refId:"m2", emissao:"2026-03-18", validade:"2027-03-18", numero:"", orgao:"", obs:"" },
    { id:"a5", tipo:"ASO", entidade:"motorista", refId:"m3", emissao:"2026-03-13", validade:"2027-03-13", numero:"", orgao:"", obs:"" },
    { id:"a6", tipo:"ASO", entidade:"motorista", refId:"m6", emissao:"2026-07-20", validade:"2027-07-20", numero:"", orgao:"", obs:"" },

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

  /* -------------------- ANEXOS na nuvem (metadados; bytes no Supabase Storage) -------------------- */
  anexos: [],        /* {id, name, type, size, categoria, entidade, refId, validade, uploadedAt, storagePath} */

  config: { alertaCritico:30, alertaAtencao:60, alertaKm:2000, alertaHora:200, sulcoMinimo:3, finPin:"", tema:"claro" },
};
