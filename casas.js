/* =====================================================================
   RUMO AO DEPLOY — ARQUIVO DE CONFIGURAÇÃO
   ---------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar para adaptar o jogo.
   Depois de salvar, é só recarregar a página no navegador (F5).

   DICAS
   - Casa 0 é a largada; a última casa (totalCasas - 1) é a chegada.
   - Casas especiais na casa 0, na chegada ou fora do tabuleiro são ignoradas.
   - Efeitos NÃO encadeiam: se um efeito te levar a outra casa especial,
     ela não é ativada (evita loops infinitos... como um bom programador!).

   TIPOS DE EFEITO disponíveis em "efeito":
     { tipo: "avancar", casas: 3 }          -> avança N casas
     { tipo: "voltar", casas: 2 }           -> volta N casas
     { tipo: "pularRodada", rodadas: 1 }    -> fica N rodadas sem jogar
     { tipo: "jogarNovamente" }             -> joga o dado de novo
     { tipo: "irPara", casa: 10 }           -> vai direto para a casa indicada
     { tipo: "casaDoUltimo" }               -> volta para a casa do último colocado
     { tipo: "trocarComLider" }             -> troca de lugar com quem está na frente
     { tipo: "outrosVoltam", casas: 2 }     -> todos os OUTROS jogadores voltam N casas
     { tipo: "condicional",                 -> rola um dado extra:
       par:   { tipo: "avancar", casas: 2 },   efeito se sair número par
       impar: { tipo: "voltar", casas: 1 } }   efeito se sair número ímpar

   CATEGORIA (cor da casa) é escolhida automaticamente pelo tipo, mas você
   pode forçar com  categoria: "bom" | "ruim" | "sorte".
   ===================================================================== */

window.CONFIG = {
  titulo: "Rumo ao Deploy",
  subtitulo: "Uma corrida de código · Ciência da Computação · UESC",

  totalCasas: 32,          // inclui a largada (0) e a chegada
  colunas: 8,              // casas por linha do tabuleiro (formato zigue-zague) em tela deitada
  colunasRetrato: 4,       // casas por linha quando a tela está em pé (totem vertical/celular)
  chegadaExata: false,     // true = precisa tirar o número exato para chegar (senão "quica" de volta)

  velocidadePasso: 260,    // milissegundos por casa na animação
  fecharMensagemApos: 0,   // segundos para fechar a mensagem sozinha (0 = só no botão)
  somAtivado: true,

  casaInicio: { rotulo: "main()", icone: "▶" },
  casaFinal:  { rotulo: "DEPLOY", icone: "🚀" },

  // Cores e símbolos das peças (até 4). O símbolo ajuda quem tem daltonismo.
  jogadores: [
    { nome: "Jogador 1", cor: "#FFD23F", simbolo: "{ }" },
    { nome: "Jogador 2", cor: "#3EC1F3", simbolo: "</>" },
    { nome: "Jogador 3", cor: "#FF5CA8", simbolo: "λ" },
    { nome: "Jogador 4", cor: "#FF8A3D", simbolo: "#" },
  ],

  // ---------------------- CASAS ESPECIAIS ----------------------
  // rotulo: texto curto que aparece na casa | icone: emoji ou símbolo
  // titulo + texto: mensagem mostrada quando o jogador cai na casa
  casasEspeciais: [
    { casa: 2,  rotulo: "def f()",   icone: "🧩", titulo: "Função definida!",
      texto: "Você escreveu uma função reutilizável. Código limpo merece recompensa: chame a função de novo!",
      efeito: { tipo: "jogarNovamente" } },

    { casa: 4,  rotulo: "i += 3",    icone: "➕", titulo: "Incremento!",
      texto: "A variável i foi incrementada em 3. Seu progresso também!",
      efeito: { tipo: "avancar", casas: 3 } },

    { casa: 6,  rotulo: "Bug!",      icone: "🐛", titulo: "Bug encontrado!",
      texto: "Um bug apareceu no seu código. Volte um pouco para depurar.",
      efeito: { tipo: "voltar", casas: 2 } },

    { casa: 9,  rotulo: "if / else", icone: "🔀", titulo: "Estrutura condicional",
      texto: "if (dado % 2 == 0) avance 2; else volte 1. Vamos rolar o dado da condição...",
      efeito: { tipo: "condicional", par: { tipo: "avancar", casas: 2 }, impar: { tipo: "voltar", casas: 1 } } },

    { casa: 11, rotulo: "while",     icone: "🔁", titulo: "Preso no while!",
      texto: "while (true) { ... } — você entrou num laço sem condição de parada. Fique uma rodada sem jogar.",
      efeito: { tipo: "pularRodada", rodadas: 1 } },

    { casa: 13, rotulo: "append()",  icone: "📎", titulo: "lista.append(voce)",
      texto: "append() adiciona o elemento no FIM da lista. Volte para a casa do último jogador!",
      efeito: { tipo: "casaDoUltimo" } },

    { casa: 15, rotulo: "git commit", icone: "🌿", titulo: "git commit -m \"feat\"",
      texto: "Commit bem feito, histórico organizado. Avance 2 casas.",
      efeito: { tipo: "avancar", casas: 2 } },

    { casa: 17, rotulo: "API 404",   icone: "🌐", titulo: "Erro 404 na API",
      texto: "A rota da API não foi encontrada. Revise a URL e volte 3 casas.",
      efeito: { tipo: "voltar", casas: 3 } },

    { casa: 19, rotulo: "git pull",  icone: "🔃", titulo: "git pull do líder",
      texto: "Você puxou as alterações da branch de quem está na frente... e trocou de lugar com o líder!",
      efeito: { tipo: "trocarComLider" } },

    { casa: 21, rotulo: "SELECT",    icone: "🗄️", titulo: "Consulta otimizada",
      texto: "Você criou um índice no banco de dados e a consulta voou. Avance 3 casas.",
      efeito: { tipo: "avancar", casas: 3 } },

    { casa: 23, rotulo: "DROP TABLE", icone: "💥", titulo: "DROP TABLE adversarios;",
      texto: "Você apagou a tabela dos adversários! Todos os OUTROS jogadores voltam 2 casas.",
      efeito: { tipo: "outrosVoltam", casas: 2 } },

    { casa: 25, rotulo: "Recursão",  icone: "♾️", titulo: "Stack Overflow!",
      texto: "Recursão sem caso base estourou a pilha de chamadas. Volte 4 casas.",
      efeito: { tipo: "voltar", casas: 4 } },

    { casa: 27, rotulo: "for i in",  icone: "🔄", titulo: "Laço for",
      texto: "for i in range(2): avance() — o laço executou 2 vezes.",
      efeito: { tipo: "avancar", casas: 2 } },

    { casa: 29, rotulo: "Null",      icone: "☠️", titulo: "NullPointerException",
      texto: "Você acessou um objeto que era null. Volte 3 casas e trate esse erro!",
      efeito: { tipo: "voltar", casas: 3 } },
  ],
};
