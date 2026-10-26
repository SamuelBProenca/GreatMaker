import { presetSchema, type Preset } from "../core";

export const presets: Preset[] = [
  {
    id: "restaurant", version: 1, label: "Restaurante", industry: "Alimentação",
    summary: "Facilite a escolha e a visita. O cardápio, a localização e a reserva precisam ser encontrados sem esforço; a expressão visual vem da identidade da casa.",
    suggestedComponents: ["Cardápio com preços", "Horários e localização", "Reserva ou contato", "História da casa"],
    visualGuidance: ["Explore uma narrativa editorial ou um caminho direto para o pedido.", "Use imagens próprias e legíveis; não transforme o cardápio inteiro em uma imagem."],
    accessibilityChecks: ["Ofereça cardápio em texto e descrição das imagens.", "Não dependa apenas de cores para indicar restrições alimentares."],
    responsiveConsiderations: ["Priorize horário, endereço e reserva no celular.", "Evite menus horizontais que escondam categorias."]
  },
  {
    id: "agency", version: 1, label: "Agência", industry: "Serviços criativos",
    summary: "Conecte especialidade e evidências de trabalho. Uma agência pode comunicar clareza, experimentação ou proximidade sem depender de uma estética única.",
    suggestedComponents: ["Projetos e resultados", "Serviços", "Processo", "Formulário de contato"],
    visualGuidance: ["Compare uma grade objetiva com histórias de projetos mais imersivas.", "Dê mais peso à contribuição da equipe do que a efeitos de transição."],
    accessibilityChecks: ["Respeite movimento reduzido e não prenda a rolagem.", "Descreva a função dos links de cada projeto."],
    responsiveConsiderations: ["Reordene cases pela importância sem esconder informações.", "Mantenha contato e navegação acessíveis por toque."]
  },
  {
    id: "ecommerce", version: 1, label: "E-commerce", industry: "Comércio",
    summary: "Ajude a encontrar, avaliar e comprar. A densidade do catálogo e as dúvidas do público devem orientar a hierarquia, não um modelo visual obrigatório.",
    suggestedComponents: ["Busca e filtros", "Grade de produtos", "Detalhe e variações", "Carrinho", "Entrega e devolução"],
    visualGuidance: ["Explore uma vitrine editorial ou uma navegação orientada a comparação.", "Mantenha preço, disponibilidade e condições próximos da ação."],
    accessibilityChecks: ["Anuncie alterações do carrinho para leitores de tela.", "Rotule variações e mensagens de erro em texto."],
    responsiveConsiderations: ["Filtros devem abrir e fechar com foco previsível.", "Evite carrosséis obrigatórios e alvos pequenos."]
  },
  {
    id: "portfolio", version: 1, label: "Portfólio", industry: "Profissional independente",
    summary: "Mostre o trabalho certo para a oportunidade certa. Contexto, contribuição e evidências contam tanto quanto a apresentação visual.",
    suggestedComponents: ["Seleção de trabalhos", "Estudo de caso", "Sobre e especialidades", "Contato"],
    visualGuidance: ["Uma seleção curta pode funcionar melhor que um arquivo extenso.", "Explore um índice tipográfico ou uma composição visual; preserve o contexto dos projetos."],
    accessibilityChecks: ["Inclua alternativas textuais para trabalhos visuais.", "Mantenha links e foco identificáveis sobre imagens."],
    responsiveConsiderations: ["Adapte estudos de caso longos a leitura em uma coluna.", "Carregue mídia de forma gradual sem perder descrições."]
  },
  {
    id: "saas-dashboard", version: 1, label: "SaaS / Dashboard", industry: "Software e dados",
    summary: "Organize decisões e tarefas frequentes. A hierarquia parte do trabalho da pessoa e da densidade necessária, não de gráficos decorativos.",
    suggestedComponents: ["Navegação por tarefas", "Indicadores com contexto", "Tabelas e filtros", "Estados vazios e erros"],
    visualGuidance: ["Compare uma visão resumida com uma área de trabalho mais densa.", "Use cor com função semântica e permita entender os números sem ela."],
    accessibilityChecks: ["Ofereça tabelas ou descrições para gráficos.", "Garanta navegação por teclado e mensagens de status."],
    responsiveConsiderations: ["Priorize ações essenciais no celular.", "Use rolagem contida para tabelas e preserve seus rótulos."]
  }
].map(preset => presetSchema.parse(preset));
