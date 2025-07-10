// --- IMPORTS DO FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js"
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js" 
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-functions.js"; 

import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  deleteDoc,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js"
import {
  getMessaging,
  getToken,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging.js"

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBayoWujkC2eVXwbWKJtv8uodofJvTieMI",
  authDomain: "sistemames-cd104.firebaseapp.com",
  projectId: "sistemames-cd104",
  storageBucket: "sistemames-cd104.firebasestorage.app",
  messagingSenderId: "928850901137",
  appId: "1:928850901137:web:e89c3170e356aafcc12730",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const functions = getFunctions(app, 'southamerica-east1');
// --- ESTADO GLOBAL DA APLICAÇÃO ---
let state = {
  userProfile: null,
  currentPage: "dashboard",
  darkMode: true,
  machines: [],
  products: [],
  stopReasons: [],
  services: [],
  productionOrders: [],
  rawMaterials: [],
  allUsers: [],
  chartInstances: {},
  selectedMachineId: null,
  activeRegistrationTab: null,
  rejectionCauses: [],
}
let activeListeners = []

// --- ELEMENTOS DO DOM ---
const DOMElements = {
  loadingScreen: document.getElementById("loading-screen"),
  authScreen: document.getElementById("auth-screen"),
  appContainer: document.getElementById("app-container"),
  pageContent: document.getElementById("page-content"),
  sidebar: document.getElementById("sidebar"),
  navItems: document.getElementById("nav-items"),
  headerTitle: document.getElementById("header-title"),
  headerUserInfo: document.getElementById("header-user-info"),
  headerOperatorLogout: document.getElementById("header-operator-logout"),
  userRole: document.getElementById("user-role"),
  userEmail: document.getElementById("user-email"),
  logoutButton: document.getElementById("logout-button"),
  darkModeToggle: document.getElementById("dark-mode-toggle"),
  themeIconSun: document.getElementById("theme-icon-sun"),
  themeIconMoon: document.getElementById("theme-icon-moon"),
  alertModalContainer: document.getElementById("alert-modal-container"),
  confirmModalContainer: document.getElementById("confirm-modal-container"),
  customModalContainer: document.getElementById("custom-modal-container"),
}
const registrationConfigs = [
  {
    title: "Criar OP",
    collectionName: "production_orders",
    stateKey: null,
    fields: [
      {
        name: "productName",
        placeholder: "Descrição do serviço ou produto...",
        type: "textarea",
      },
      {
        name: "targetQuantity",
        placeholder: "Quantidade Planejada",
        type: "number",
      },
    ],
  },
  {
    title: "Ordens de Produção Criadas",
    collectionName: "production_orders",
    stateKey: "productionOrders",
    displayFields: ["id", "productName", "overallStatus"],
    fields: [],
  },
  {
    title: "Máquinas",
    collectionName: "machines",
    stateKey: "machines",
    displayFields: ["id", "name", "line"],
    fields: [
      { name: "id", placeholder: "ID da Máquina", type: "text" },
      { name: "name", placeholder: "Nome da Máquina", type: "text" },
      { name: "line", placeholder: "Linha", type: "text" },
    ],
  },
  {
    title: "Produtos",
    collectionName: "products",
    stateKey: "products",
    displayFields: ["id", "name"],
    fields: [
      { name: "id", placeholder: "ID do Produto", type: "text" },
      { name: "name", placeholder: "Nome do Produto", type: "text" },
    ],
  },
  {
    title: "Matérias-Primas",
    collectionName: "raw_materials",
    stateKey: "rawMaterials",
    displayFields: ["id", "name", "unit"],
    fields: [
      { name: "id", placeholder: "ID do Material (ex: LIN-01)", type: "text" },
      { name: "name", placeholder: "Nome do Material", type: "text" },
      { name: "unit", placeholder: "Unidade (m, kg, un)", type: "text" },
    ],
  },
  {
    title: "Causas de Refugo",
    collectionName: "rejection_causes",
    stateKey: "rejectionCauses",
    displayFields: ["id", "category", "description"],
    fields: [
      { name: "id", placeholder: "ID da Causa (ex: RC-01)", type: "text" },
      {
        name: "category",
        placeholder: "Categoria (ex: Matéria-Prima, Operacional)",
        type: "text",
      },
      { name: "description", placeholder: "Descrição da Causa", type: "text" },
    ],
  },
  {
    title: "Motivos de Parada",
    collectionName: "stopReasons",
    stateKey: "stopReasons",
    displayFields: ["id", "description"],
    fields: [
      { name: "id", placeholder: "ID do Motivo", type: "text" },
      { name: "description", placeholder: "Descrição", type: "text" },
    ],
  },
  {
    title: "Serviços",
    collectionName: "services",
    stateKey: "services",
    displayFields: ["id", "name"],
    fields: [
      { name: "id", placeholder: "ID do Serviço", type: "text" },
      { name: "name", placeholder: "Nome", type: "text" },
      { name: "description", placeholder: "Descrição", type: "text" },
    ],
  },
]

// --- DADOS MOCK ---
const initialData = {
  machines: [
    { id: "MAQ-01", name: "Injetora Exemplo", line: "Linha A" },
    { id: "MAQ-02", name: "Prensa Exemplo", line: "Linha A" },
  ],
  products: [
    { id: "PROD-A", name: "Produto Exemplo A", standardCycleTimeSeconds: 30 },
    { id: "PROD-B", name: "Produto Exemplo B", standardCycleTimeSeconds: 45 },
  ],
  stopReasons: [
    { id: "SR-01", description: "Falta de material" },
    { id: "SR-02", description: "Manutenção corretiva" },
  ],
  services: [
    {
      id: "SERV-01",
      name: "Manutenção Preventiva Exemplo",
      description: "Serviço de rotina.",
    },
  ],
  productionOrders: [],
}

// --- FUNÇÕES DE MODAL ---
const showAlert = (message) => {
  DOMElements.alertModalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm m-4 p-6">
                        <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Aviso</h3>
                        <p class="text-gray-700 dark:text-gray-300 mb-6">${message}</p>
                        <button id="alert-ok-button" class="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded hover:bg-indigo-700">OK</button>
                    </div>
                </div>`
  document.getElementById("alert-ok-button").addEventListener("click", () => {
    DOMElements.alertModalContainer.innerHTML = ""
  })
}

const showOpDetailsModal = (opId) => {
  const op = state.productionOrders.find((o) => o.id === opId)
  if (!op) return

  let mainMachineName = "N/A"
  if (op.stages && op.stages[0] && op.stages[0].responsible) {
    const machine = state.machines.find(
      (m) => m.id === op.stages[0].responsible
    )
    if (machine) {
      mainMachineName = machine.name
    }
  }

  let stagesHTML = (op.stages || [])
    .map((stage) => {
      // Lógica para Rejeitos (buscando a causa)
      const rejectsForStage = (stage.rejects || [])
        .map((r) => {
          const cause = state.rejectionCauses.find((c) => c.id === r.causeId)
          const causeDescription = cause
            ? cause.description
            : r.causeId || "Causa não especificada"
          return `<li>${r.quantity} peças: ${causeDescription} ${
            r.notes ? `<em>(${r.notes})</em>` : ""
          }</li>`
        })
        .join("")

      // Lógica para Paradas
      const stopsForStage = (stage.stopHistory || [])
        .map((s) => {
          const startTime = new Date(s.startTime).toLocaleTimeString("pt-BR")
          const endTime = s.endTime
            ? new Date(s.endTime).toLocaleTimeString("pt-BR")
            : "ativa"
          return `<li>${s.reason} (${startTime} - ${endTime})</li>`
        })
        .join("")

      // Lógica para Inspeções
      const inspectionsForStage = (stage.inspections || [])
        .map((insp) => {
          const statusColor =
            insp.status === "Aprovado" ? "text-green-400" : "text-red-400"
          const inspector = insp.inspectorEmail.split("@")[0]
          const inspTime = new Date(insp.timestamp).toLocaleTimeString("pt-BR")
          return `<li><span class="font-semibold ${statusColor}">${
            insp.status
          }</span> às ${inspTime} por ${inspector}. <em>${
            insp.notes || "Sem observações."
          }</em></li>`
        })
        .join("")

      let statusColor = "text-slate-400"
      if (stage.status === "Em produção") statusColor = "text-yellow-400"
      if (stage.status === "Parado") statusColor = "text-red-500"
      if (stage.status === "Finalizado") statusColor = "text-green-400"

      return `
            <div class="border-t border-slate-700 pt-3 mt-3">
                <h5 class="font-semibold flex justify-between items-center">
                    Setor: ${stage.sector}
                    <span class="text-sm font-semibold ${statusColor} bg-slate-900/50 px-2 py-1 rounded-full">${
        stage.status
      }</span>
                </h5>
                <div class="text-xs text-slate-400 mt-1 space-y-1">
                    <p>Início: ${
                      stage.startedAt
                        ? new Date(stage.startedAt).toLocaleString("pt-BR")
                        : "N/A"
                    }</p>
                    <p>Fim: ${
                      stage.completedAt
                        ? new Date(stage.completedAt).toLocaleString("pt-BR")
                        : "N/A"
                    }</p>
                </div>
                ${
                  stopsForStage
                    ? `<p class="text-sm mt-2 mb-1 text-slate-300">Paradas na etapa:</p><ul class="list-disc pl-5 text-xs text-slate-400 space-y-1">${stopsForStage}</ul>`
                    : ""
                }
                ${
                  rejectsForStage
                    ? `<p class="text-sm mt-2 mb-1 text-slate-300">Rejeitos na etapa:</p><ul class="list-disc pl-5 text-xs text-slate-400 space-y-1">${rejectsForStage}</ul>`
                    : ""
                }
                ${
                  inspectionsForStage
                    ? `<p class="text-sm mt-2 mb-1 text-slate-300">Inspeções na etapa:</p><ul class="list-disc pl-5 text-xs text-slate-400 space-y-1">${inspectionsForStage}</ul>`
                    : ""
                }
            </div>
        `
    })
    .join("")

  const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-start p-4 overflow-y-auto">
            <div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl m-4 my-8 p-6 relative border border-slate-700">
                <button id="close-op-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-2xl font-bold mb-1 text-white">Detalhes da OP: ${op.id}</h3>
                <p class="text-slate-300 mb-2"><strong>Produto:</strong> ${op.productName}</p>
                <p class="text-slate-300 mb-4"><strong>Máquina Principal:</strong> ${mainMachineName}</p>
                
                <div class="bg-slate-900 p-4 rounded-lg">
                    <h4 class="text-lg font-bold text-white mb-2">Progresso das Etapas</h4>
                    ${stagesHTML}
                </div>
            </div>
        </div>
    `

  DOMElements.customModalContainer.innerHTML = modalHTML
  document.getElementById("close-op-modal").onclick = () =>
    (DOMElements.customModalContainer.innerHTML = "")
}

const showToastNotification = (message) => {
  const container = document.getElementById("notification-container")
  if (!container) return

  const toastId = `toast-${Date.now()}`
  const toastElement = document.createElement("div")
  toastElement.id = toastId
  toastElement.className =
    "bg-indigo-600 text-white font-bold rounded-lg shadow-xl p-4 animate-pulse"
  toastElement.innerHTML = `<p>${message}</p>`

  container.appendChild(toastElement)

  setTimeout(() => {
    const toastToRemove = document.getElementById(toastId)
    if (toastToRemove) {
      toastToRemove.remove()
    }
  }, 7000)
  if (Notification.permission === "granted") {
    const notificationTitle = "Nova Tarefa no Sistema MES"
    const notificationOptions = {
      body: message,
      icon: "favicon.ico",
    }
    new Notification(notificationTitle, notificationOptions)
  }
}

const showConfirm = (message, onConfirm) => {
  DOMElements.confirmModalContainer.innerHTML = `
                <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
                    <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm m-4 p-6">
                        <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Confirmação</h3>
                        <p class="text-gray-700 dark:text-gray-300 mb-6">${message}</p>
                        <div class="flex justify-end gap-4">
                            <button id="confirm-cancel-button" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-2 px-6 rounded hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                            <button id="confirm-ok-button" class="bg-red-500 text-white font-bold py-2 px-6 rounded hover:bg-red-700">Confirmar</button>
                        </div>
                    </div>
                </div>`

  const close = () => (DOMElements.confirmModalContainer.innerHTML = "")
  document
    .getElementById("confirm-cancel-button")
    .addEventListener("click", close)
  document.getElementById("confirm-ok-button").addEventListener("click", () => {
    onConfirm()
    close()
  })
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

const renderApp = () => {
  DOMElements.loadingScreen.classList.add("hidden")
  if (state.userProfile) {
    DOMElements.authScreen.classList.add("hidden")
    DOMElements.appContainer.classList.remove("hidden")
    renderMainLayout()
    renderCurrentPage()
  } else {
    DOMElements.appContainer.classList.add("hidden")
    DOMElements.authScreen.classList.remove("hidden")
    renderAuthScreen()
  }
}

const renderMainLayout = () => {
  const { role, email } = state.userProfile
  const operatorRoles = ["Impressão", "Corte", "Costura"] // <-- LISTA DE CARGOS DE OPERADOR

  if (operatorRoles.includes(role)) {
    DOMElements.sidebar.classList.remove("md:flex")
    DOMElements.sidebar.classList.add("hidden")
    DOMElements.headerTitle.classList.add("hidden")
    DOMElements.headerUserInfo.innerHTML = `
                    <div class="flex items-center gap-4">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <div>
                            <p class="font-semibold">${role}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">${email}</p>
                        </div>
                    </div>`
    DOMElements.headerOperatorLogout.innerHTML = `
                    <button id="operator-logout-button" class="flex items-center gap-2 p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 dark:text-red-400 transition-colors">
                        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                        <span>Sair</span>
                    </button>`
    document
      .getElementById("operator-logout-button")
      .addEventListener("click", handleLogout)
  } else {
    DOMElements.sidebar.classList.add("md:flex")
    DOMElements.sidebar.classList.remove("hidden")
    DOMElements.headerTitle.classList.remove("hidden")
    DOMElements.headerUserInfo.innerHTML = ""
    DOMElements.headerOperatorLogout.innerHTML = ""
    DOMElements.userRole.textContent = role
    DOMElements.userEmail.textContent = email
    renderNavItems()
  }
}

const renderNavItems = () => {
  const navConfig = [
    {
      id: "manager-dashboard",
      label: "Dashboard Gerencial",
      icon: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>`,
      roles: ["Supervisor", "Gestor"],
    },
    {
      id: "dashboard",
      label: "Painel",
      icon: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`,
      roles: ["Supervisor", "Gestor"],
    },
    {
      id: "reports",
      label: "Relatórios",
      icon: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8a6 6 0 0 0-6-6"/><path d="M13 13a6 6 0 0 0 6 6"/></svg>`,
      roles: ["Supervisor", "Gestor"],
    },
    {
      id: "registrations",
      label: "Cadastros",
      icon: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="8" x="8" y="2" rx="2"/><path d="M8 12h8"/><path d="M12 16v4"/><path d="M12 2v0"/><path d="M20 12v0"/><path d="M4 12v0"/><path d="M16 16v0"/><path d="M8 16v0"/></svg>`,
      roles: ["Gestor"],
    },
    {
      id: "users",
      label: "Usuários",
      icon: `<svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      roles: ["Gestor"],
    },
  ]

  DOMElements.navItems.innerHTML = navConfig
    .filter((item) => item.roles.includes(state.userProfile.role))
    .map(
      (item) => `
                    <li>
                        <a href="#" data-page="${
                          item.id
                        }" class="nav-link flex items-center gap-3 p-3 rounded-lg transition-colors ${
        state.currentPage === item.id
          ? "bg-blue-500 text-white"
          : "hover:bg-gray-200 dark:hover:bg-gray-700"
      }">
                            ${item.icon}
                            ${item.label}
                        </a>
                    </li>
                `
    )
    .join("")
}

const destroyCharts = () => {
  Object.values(state.chartInstances).forEach((chart) => chart.destroy())
  state.chartInstances = {}
}

const renderCurrentPage = () => {
  destroyCharts()
  DOMElements.headerTitle.textContent = state.currentPage

  const operatorRoles = ["Impressão", "Corte", "Costura"] // <-- LISTA DE CARGOS DE OPERADOR

  const page = operatorRoles.includes(state.userProfile.role)
    ? "operator"
    : state.currentPage

  switch (page) {
    case "manager-dashboard":
      renderManagerDashboard()
      break

    case "dashboard":
      renderDashboard()
      break
    case "reports":
      renderReports()
      break
    case "registrations":
      renderRegistrations()
      break
    case "users":
      renderUsers()
      break
    case "operator":
      renderOperatorView()
      break
    default:
      renderDashboard()
  }
}

// --- RENDERIZADORES DE PÁGINA ESPECÍFICOS ---

const renderDashboard = () => {
  DOMElements.pageContent.innerHTML = ""
  const template = document
    .getElementById("dashboard-template")
    .content.cloneNode(true)
  DOMElements.pageContent.appendChild(template)

  const board = document.getElementById("kanban-board")
  const sectors = ["Impressão", "Corte", "Costura"]

  let columnsHTML = sectors
    .map((sector) => {
      const opsInSector = state.productionOrders.filter((op) => {
        // Ignora OPs já finalizadas no geral
        if (op.overallStatus === "Finalizado" || !op.stages) return false

        // Encontra o índice do estágio correspondente ao setor da coluna
        const stageIndex = op.stages.findIndex((s) => s.sector === sector)
        if (stageIndex === -1) return false // Se a OP não tem este setor, não entra na coluna

        const currentStage = op.stages[stageIndex]

        // CONDIÇÃO 1: O estágio ATUAL está ativo (em produção ou parado)?
        const isStageActive =
          currentStage.status === "Em produção" ||
          currentStage.status === "Parado"
        if (isStageActive) {
          return true 
        }

       
        const isStageWaiting = currentStage.status === "Aguardando"
        const isFirstStage = stageIndex === 0
        const isPreviousStageDone =
          !isFirstStage && op.stages[stageIndex - 1].status === "Finalizado"

        if (isStageWaiting && (isFirstStage || isPreviousStageDone)) {
          return true
        }

        return false
      })

      return `
                    <div class="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 flex flex-col h-full">
                        <h2 class="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            ${sector} <span class="text-sm bg-gray-200 dark:bg-slate-700 rounded-full px-2">${
        opsInSector.length
      }</span>
                        </h2>
                        <div class="space-y-4 overflow-y-auto flex-grow" style="max-height: calc(100vh - 250px);">
                            ${opsInSector
                              .map((op) => {
                                const currentStage = op.stages.find(
                                  (s) => s.sector === sector
                                )
                                let statusClass = "border-gray-400"
                                if (currentStage?.status === "Em produção")
                                  statusClass = "border-green-500"
                                if (currentStage?.status === "Parado")
                                  statusClass = "border-yellow-500"

                                return `
                                <div data-op-id="${
                                  op.id
                                }" class="kanban-card cursor-pointer bg-white dark:bg-slate-700 rounded-lg shadow-md p-4 space-y-2 border-t-4 ${statusClass}">
                                    <p class="font-bold text-gray-900 dark:text-white">${
                                      op.id
                                    }</p>
                                    <p class="text-sm text-gray-600 dark:text-gray-300"><strong>Produto:</strong> ${
                                      op.productName || "N/A"
                                    }</p>
                                    <p class="text-sm text-gray-500 dark:text-gray-400">Status da Etapa: ${
                                      currentStage?.status || "N/A"
                                    }</p>
                                </div>`
                              })
                              .join("")}
                        </div>
                    </div>`
    })
    .join("")

  const finalizedOps = state.productionOrders.filter(
    (op) => op.overallStatus === "Finalizado"
  )
  columnsHTML += `
                <div class="bg-gray-100 dark:bg-slate-800 rounded-xl p-4 flex flex-col h-full">
                    <h2 class="font-bold text-lg mb-4 text-gray-800 dark:text-gray-200">Finalizado <span class="text-sm bg-gray-200 dark:bg-slate-700 rounded-full px-2">${
                      finalizedOps.length
                    }</span></h2>
                    <div class="space-y-4 overflow-y-auto flex-grow">
                        ${finalizedOps
                          .map(
                            (op) => `
                            <div data-op-id="${
                              op.id
                            }" class="kanban-card cursor-pointer bg-white dark:bg-slate-700 rounded-lg shadow-md p-4 space-y-2 border-t-4 border-blue-500">
                                <p class="font-bold text-gray-900 dark:text-white">${
                                  op.id
                                }</p>
                                <p class="text-sm text-gray-600 dark:text-gray-300"><strong>Produto:</strong> ${
                                  op.productName || "N/A"
                                }</p>
                            </div>`
                          )
                          .join("")}
                    </div>
                </div>`

  board.innerHTML = columnsHTML
}

const renderManagerDashboard = () => {
  DOMElements.pageContent.innerHTML = ""
  const template = document
    .getElementById("manager-dashboard-template")
    .content.cloneNode(true)
  DOMElements.pageContent.appendChild(template)
  updateManagerDashboardKPIs()
}

const updateManagerDashboardKPIs = () => {
  const allOpsRaw = state.productionOrders
  const allMachines = state.machines

  if (allOpsRaw.length === 0 || allMachines.length === 0) {
    console.log("Aguardando todos os dados necessários (OPs e Máquinas)...")
    return
  }

  const allOps = allOpsRaw.map((op) => {
    const machineId =
      op.stages && op.stages[0] ? op.stages[0].responsible : null
    const machine = allMachines.find((m) => m.id === machineId)
    return {
      ...op,
      machineName: machine ? machine.name : "N/A",
    }
  })

  const hoje = new Date().toISOString().slice(0, 10)
  const opsToday = allOps.filter((op) => op.createdAt.startsWith(hoje))
  document.getElementById("kpi-ops-today").textContent = opsToday.length
  let totalPlanned = 0
  let totalRejects = 0
  allOps.forEach((op) => {
    totalPlanned += Number(op.targetQuantity)
    const rejectsInOp = (op.stages || [])
      .flatMap((stage) => stage.rejects || [])
      .reduce((sum, reject) => sum + Number(reject.quantity), 0)
    totalRejects += rejectsInOp
  })
  const totalProduced = totalPlanned - totalRejects
  const efficiency = totalPlanned > 0 ? (totalProduced / totalPlanned) * 100 : 0
  const efficiencyEl = document.getElementById("kpi-efficiency")
  if (efficiencyEl) {
    efficiencyEl.textContent = `${efficiency.toFixed(1)}%`
    efficiencyEl.classList.remove(
      "text-yellow-400",
      "text-red-500",
      "text-green-400"
    )
    if (efficiency < 50) {
      efficiencyEl.classList.add("text-red-500")
    } else if (efficiency < 70) {
      efficiencyEl.classList.add("text-yellow-400")
    } else {
      efficiencyEl.classList.add("text-green-400")
    }
  }
  const rejectRate = totalPlanned > 0 ? (totalRejects / totalPlanned) * 100 : 0
  document.getElementById(
    "kpi-reject-rate"
  ).textContent = `${rejectRate.toFixed(1)}%`
  let totalDowntimeMinutes = 0
  allOps.forEach((op) => {
    const stopsToday = (op.stages || [])
      .flatMap((stage) => stage.stopHistory || [])
      .filter((stop) => stop.startTime.startsWith(hoje) && stop.endTime)
    stopsToday.forEach((stop) => {
      totalDowntimeMinutes +=
        (new Date(stop.endTime) - new Date(stop.startTime)) / 60000
    })
  })
  document.getElementById("kpi-downtime").textContent = `${Math.round(
    totalDowntimeMinutes
  )} min`

  const machineProductionData = allOps.reduce((acc, op) => {
    if (!op.machineName || op.machineName === "N/A") return acc
    const rejectsInOp = (op.stages || [])
      .flatMap((stage) => stage.rejects || [])
      .reduce((sum, reject) => sum + Number(reject.quantity), 0)
    const producedInOp = Number(op.targetQuantity) - rejectsInOp
    if (producedInOp > 0) {
      acc[op.machineName] = (acc[op.machineName] || 0) + producedInOp
    }
    return acc
  }, {})
  const machineLabels = Object.keys(machineProductionData)
  const machineData = Object.values(machineProductionData)
  const machineCtx = document.getElementById("machine-production-chart")
  if (machineCtx) {
    if (state.chartInstances.machineProduction) {
      state.chartInstances.machineProduction.destroy()
    }
    state.chartInstances.machineProduction = new Chart(machineCtx, {
      type: "bar",
      data: {
        labels: machineLabels,
        datasets: [
          {
            label: "Peças Produzidas",
            data: machineData,
            backgroundColor: "rgba(79, 70, 229, 0.8)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#cbd5e1" } },
          y: { ticks: { color: "#cbd5e1" } },
        },
      },
    })
  }

  const performanceEl = document.getElementById("performance-card")

  if (performanceEl) {
    const oldContent = performanceEl.querySelector(".card-content-wrapper")
    if (oldContent) {
      oldContent.remove()
    }

    const titleEl = performanceEl.querySelector("h3")
    if (titleEl) {
      titleEl.textContent = "Acompanhamento das Últimas Ordens"
    }

    const recentOps = allOps.slice(0, 5)

    let contentHTML =
      '<div class="card-content-wrapper mt-4 space-y-3 overflow-y-auto max-h-80">'

    if (recentOps.length === 0) {
      contentHTML +=
        '<p class="text-sm text-slate-400">Nenhuma ordem de produção para exibir.</p>'
    } else {
      recentOps.forEach((op) => {
        const rejectsInOp = (op.stages || [])
          .flatMap((stage) => stage.rejects || [])
          .reduce((sum, reject) => sum + Number(reject.quantity), 0)
        const totalPossible = Number(op.targetQuantity)
        const opRejectRate =
          totalPossible > 0 ? (rejectsInOp / totalPossible) * 100 : 0

        let statusColor = "text-slate-300"
        if (op.overallStatus === "Finalizado") statusColor = "text-green-400"
        if (op.overallStatus === "Em produção") statusColor = "text-yellow-400"
        if (op.overallStatus === "Parado") statusColor = "text-red-400"

        contentHTML += `
                    <div class="op-details-item p-3 bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors" data-op-id="${
                      op.id
                    }">
                        <div class="flex justify-between items-start">
                            <p class="font-bold text-slate-100 pr-2">${
                              op.productName
                            }</p>
                            <span class="text-xs font-semibold ${statusColor} bg-slate-900/50 px-2 py-1 rounded-full whitespace-nowrap">${
          op.overallStatus
        }</span>
                        </div>
                        <div class="flex justify-between text-sm mt-2 text-slate-400">
                            <span>OP: <strong>${op.id}</strong></span>
                            <span>Rejeitos: <strong class="text-red-500">${rejectsInOp}</strong> (${opRejectRate.toFixed(
          1
        )}%)</span>
                        </div>
                    </div>
                `
      })
    }
    contentHTML += "</div>"

    performanceEl.insertAdjacentHTML("beforeend", contentHTML)

    const contentWrapper = performanceEl.querySelector(".card-content-wrapper")
    if (contentWrapper) {
      contentWrapper.addEventListener("click", (e) => {
        const item = e.target.closest(".op-details-item")
        if (item) {
          const opId = item.dataset.opId
          showOpDetailsModal(opId)
        }
      })
    }
  }
}

const renderReports = () => {
  DOMElements.pageContent.innerHTML = ""

  const template = document
    .getElementById("reports-template")
    .content.cloneNode(true)
  DOMElements.pageContent.appendChild(template)
  document
    .getElementById("generate-pdf-btn")
    .addEventListener("click", generateWeeklyReportPDF)

  setTimeout(() => {
    // Lógica do OEE
    const finishedOps = state.productionOrders.filter(
      (op) =>
        op.overallStatus === "Finalizado" && op.stages && op.stages.length > 0
    )
    let totalAvailability = 0,
      totalPerformance = 0,
      totalQuality = 0
    if (finishedOps.length > 0) {
      let totalPlannedTime = 0,
        totalRunTime = 0,
        totalIdealRunTime = 0,
        totalPieces = 0,
        totalGoodPieces = 0
      finishedOps.forEach((op) => {
        const product = state.products.find((p) => p.id === op.productId)
        if (!product || !product.standardCycleTimeSeconds) return
        const firstStage = op.stages[0]
        const lastStage = op.stages[op.stages.length - 1]
        if (!firstStage.startedAt || !lastStage.completedAt) return
        const opStartTime = new Date(firstStage.startedAt)
        const opEndTime = new Date(lastStage.completedAt)
        const plannedTime = (opEndTime - opStartTime) / 1000
        const totalStopTime = op.stages
          .flatMap((stage) => stage.stopHistory || [])
          .reduce(
            (acc, stop) =>
              acc +
              (stop.endTime
                ? (new Date(stop.endTime) - new Date(stop.startTime)) / 1000
                : 0),
            0
          )
        const runTime = plannedTime - totalStopTime
        const totalRejects = op.stages
          .flatMap((stage) => stage.rejects || [])
          .reduce((acc, r) => acc + Number(r.quantity), 0)
        const goodPieces = op.targetQuantity - totalRejects
        totalPlannedTime += plannedTime
        totalRunTime += runTime
        totalPieces += op.targetQuantity
        totalGoodPieces += goodPieces
        totalIdealRunTime += goodPieces * product.standardCycleTimeSeconds
      })
      totalAvailability =
        totalPlannedTime > 0 ? (totalRunTime / totalPlannedTime) * 100 : 0
      totalPerformance =
        totalRunTime > 0 ? (totalIdealRunTime / totalRunTime) * 100 : 0
      totalQuality = totalPieces > 0 ? (totalGoodPieces / totalPieces) * 100 : 0
    }
    const oee =
      (totalAvailability / 100) *
      (totalPerformance / 100) *
      (totalQuality / 100) *
      100
    document.getElementById("oee-container").innerHTML = `
            <div class="p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg"><p class="text-sm text-blue-600 dark:text-blue-300 font-semibold">Disponibilidade</p><p class="text-3xl font-bold text-blue-800 dark:text-blue-200">${totalAvailability.toFixed(
              1
            )}%</p></div>
            <div class="p-4 bg-green-50 dark:bg-green-900/50 rounded-lg"><p class="text-sm text-green-600 dark:text-green-300 font-semibold">Performance</p><p class="text-3xl font-bold text-green-800 dark:text-green-200">${totalPerformance.toFixed(
              1
            )}%</p></div>
            <div class="p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg"><p class="text-sm text-yellow-600 dark:text-yellow-300 font-semibold">Qualidade</p><p class="text-3xl font-bold text-yellow-800 dark:text-yellow-200">${totalQuality.toFixed(
              1
            )}%</p></div>
            <div class="p-4 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg border-2 border-indigo-500"><p class="text-sm text-indigo-600 dark:text-indigo-300 font-semibold">OEE Global</p><p class="text-3xl font-bold text-indigo-800 dark:text-indigo-200">${oee.toFixed(
              1
            )}%</p></div>
        `

    // GRÁFICO 1: MOTIVOS DE PARADA 
    const stopReasonsCtx = document.getElementById("stop-reasons-chart")
    if (stopReasonsCtx) {
      const stopReasonsData = state.productionOrders
        .flatMap((op) => op.stages || [])
        .flatMap((stage) => stage.stopHistory || [])
        .reduce((acc, stop) => {
          const duration = stop.endTime
            ? (new Date(stop.endTime) - new Date(stop.startTime)) / 60000
            : 0
          if (duration > 0) {
            const reason =
              state.stopReasons.find((r) => r.id === stop.reason)
                ?.description || stop.reason
            acc[reason] = (acc[reason] || 0) + duration
          }
          return acc
        }, {})
      if (state.chartInstances.stopReasons)
        state.chartInstances.stopReasons.destroy()
      state.chartInstances.stopReasons = new Chart(stopReasonsCtx, {
        type: "doughnut",
        data: {
          labels: Object.keys(stopReasonsData),
          datasets: [
            {
              label: "Minutos de Parada",
              data: Object.values(stopReasonsData),
              backgroundColor: [
                "#3B82F6",
                "#10B981",
                "#F59E0B",
                "#EF4444",
                "#8B5CF6",
                "#6366F1",
                "#EC4899",
              ],
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
        },
      })
    }

    // GRÁFICO 2: HISTÓRICO DE PRODUÇÃO 
    const historyCtx = document.getElementById("production-history-chart")
    if (historyCtx) {
      const productionByDay = state.productionOrders
        .filter(
          (op) =>
            op.overallStatus === "Finalizado" &&
            op.stages &&
            op.stages.length > 0 &&
            op.stages[op.stages.length - 1].completedAt
        )
        .reduce((acc, op) => {
          const date = new Date(
            op.stages[op.stages.length - 1].completedAt
          ).toLocaleDateString("pt-BR")
          const totalRejects = op.stages
            .flatMap((s) => s.rejects || [])
            .reduce((sum, r) => sum + Number(r.quantity), 0)
          const produced = op.targetQuantity - totalRejects

          if (!acc[date]) {
            acc[date] = { produzido: 0, rejeitado: 0 }
          }
          acc[date].produzido += produced
          acc[date].rejeitado += totalRejects
          return acc
        }, {})

      const sortedDates = Object.keys(productionByDay).sort(
        (a, b) =>
          new Date(a.split("/").reverse().join("-")) -
          new Date(b.split("/").reverse().join("-"))
      )

      if (state.chartInstances.productionHistory)
        state.chartInstances.productionHistory.destroy()
      state.chartInstances.productionHistory = new Chart(historyCtx, {
        type: "bar",
        data: {
          labels: sortedDates,
          datasets: [
            {
              label: "Produzido",
              data: sortedDates.map((date) => productionByDay[date].produzido),
              backgroundColor: "#10B981",
            },
            {
              label: "Rejeitado",
              data: sortedDates.map((date) => productionByDay[date].rejeitado),
              backgroundColor: "#EF4444",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { stacked: true }, y: { stacked: true } },
        },
      })
    }
  }, 0)
}


const generateWeeklyReportPDF = () => {
  const doc = new jspdf.jsPDF()

  // 1. Filtrar dados da última semana
  const hoje = new Date()
  const umaSemanaAtras = new Date()
  umaSemanaAtras.setDate(hoje.getDate() - 7)

  const opsFinalizadasSemana = state.productionOrders.filter((op) => {
    if (op.overallStatus !== "Finalizado") return false
    const ultimoEstagio = op.stages[op.stages.length - 1]
    if (!ultimoEstagio || !ultimoEstagio.completedAt) return false

    const dataFinalizacao = new Date(ultimoEstagio.completedAt)
    return dataFinalizacao >= umaSemanaAtras && dataFinalizacao <= hoje
  })

  if (opsFinalizadasSemana.length === 0) {
    showAlert(
      "Nenhuma Ordem de Produção foi finalizada na última semana para gerar o relatório."
    )
    return
  }

  // 2. Definir Cabeçalho e Título
  doc.setFontSize(18)
  doc.text("Relatório de Produção Semanal", 14, 22)
  doc.setFontSize(11)
  doc.text("Empresa Principal - Sistema MES", 14, 30)

  const dataEmissao = hoje.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  const periodoRelatorio = `${umaSemanaAtras.toLocaleDateString(
    "pt-BR"
  )} - ${hoje.toLocaleDateString("pt-BR")}`
  doc.text(`Data de Emissão: ${dataEmissao}`, 14, 36)
  doc.text(`Período: ${periodoRelatorio}`, 14, 42)

  // 3. Resumo da Produção
  let totalProduzido = 0
  let totalRefugado = 0

  opsFinalizadasSemana.forEach((op) => {
    const refugosDaOp = op.stages
      .flatMap((s) => s.rejects || [])
      .reduce((sum, r) => sum + Number(r.quantity), 0)
    totalProduzido += Number(op.targetQuantity) - refugosDaOp
    totalRefugado += refugosDaOp
  })

  doc.setFontSize(12)
  doc.text("Resumo da Produção", 14, 55)
  doc.setFontSize(10)
  doc.text(
    `- Ordens de Produção Finalizadas: ${opsFinalizadasSemana.length}`,
    16,
    61
  )
  doc.text(`- Quantidade Total Produzida: ${totalProduzido}`, 16, 67)
  doc.text(`- Quantidade Total de Refugos: ${totalRefugado}`, 16, 73)

  // 4. Preparar dados para a tabela
  const head = [
    [
      "ID da OP",
      "Produto/Serviço",
      "Qtd. Planejada",
      "Refugos",
      "Data Finalização",
    ],
  ]
  const body = opsFinalizadasSemana.map((op) => {
    const refugosDaOp = op.stages
      .flatMap((s) => s.rejects || [])
      .reduce((sum, r) => sum + Number(r.quantity), 0)
    const dataFinalizacao = new Date(
      op.stages[op.stages.length - 1].completedAt
    ).toLocaleDateString("pt-BR")
    return [
      op.id,
      op.productName,
      op.targetQuantity,
      refugosDaOp,
      dataFinalizacao,
    ]
  })

  // 5. Gerar a tabela
  doc.autoTable({
    startY: 80,
    head: head,
    body: body,
    theme: "striped",
    headStyles: { fillColor: [22, 160, 133] },
  })

  // 6. Salvar o PDF
  doc.save(`Relatorio_Semanal_${hoje.toISOString().slice(0, 10)}.pdf`)
}


const renderRegistrations = () => {
  DOMElements.pageContent.innerHTML = ""
  const template = document
    .getElementById("registrations-template")
    .content.cloneNode(true)

  const tabsContainer = template.getElementById("registrations-tabs")
  const contentContainer = template.getElementById("registrations-content")

  if (!state.activeRegistrationTab) {
    state.activeRegistrationTab = registrationConfigs[0].title
  }

  registrationConfigs.forEach((config) => {
    const isActive = state.activeRegistrationTab === config.title
    const tabButton = document.createElement("button")
    tabButton.dataset.tabName = config.title
    tabButton.className = `py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
      isActive
        ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
    }`
    tabButton.textContent = config.title
    tabsContainer.appendChild(tabButton)
  })

  tabsContainer.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON") {
      state.activeRegistrationTab = e.target.dataset.tabName
      renderRegistrations()
    }
  })

  const activeConfig = registrationConfigs.find(
    (c) => c.title === state.activeRegistrationTab
  )
  if (activeConfig) {
  
    const dataList = activeConfig.stateKey ? state[activeConfig.stateKey] : []

    const card = document.createElement("div")
    card.innerHTML = `
            <div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white mb-4">${
                  activeConfig.title
                }</h2>
                ${
                  activeConfig.fields && activeConfig.fields.length > 0
                    ? `
                <form class="space-y-4 mb-6" data-collection="${
                  activeConfig.collectionName
                }" data-form-type="${activeConfig.title.replace(/\s/g, "")}">
                ${
                  activeConfig.title === "Criar OP"
                    ? `
    <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Produto Padrão (Recomendado)</label>
    <select name="productId" class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
        <option value="">-- Selecione um produto da lista --</option>
        ${state.products
          .map((p) => `<option value="${p.id}">${p.name}</option>`)
          .join("")}
    </select>

    <p class="text-center text-sm text-gray-400 dark:text-gray-500 my-3">-- OU --</p>

    <label class="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Serviço ou Produto Customizado</label>
    <textarea name="customProductName" rows="2" placeholder="Ex: Manutenção Corretiva, Amostra para Cliente X..." class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600"></textarea>
    
    <select name="machineId" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
        <option value="">Selecione a Máquina para a 1ª Etapa</option>
        ${state.machines
          .map((m) => `<option value="${m.id}">${m.name}</option>`)
          .join("")}
    </select>
    <input type="number" name="targetQuantity" placeholder="Quantidade Planejada" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
`
                    : activeConfig.fields
                        .map(
                          (field) =>
                            `<input type="${field.type}" name="${field.name}" placeholder="${field.placeholder}" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />`
                        )
                        .join("")
                }
                    <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded hover:bg-indigo-700">${
                      activeConfig.title === "Criar OP"
                        ? "Criar Ordem de Produção"
                        : "Adicionar"
                    }</button>
                </form>
                `
                    : ""
                }
                ${
                  dataList.length > 0
                    ? `
                <ul class="space-y-2 max-h-72 overflow-y-auto" data-list="${
                  activeConfig.collectionName
                }">
                    ${dataList
                      .map((item) => {
                        if (activeConfig.collectionName === "products") {
                          return `
            <li key="${item.id}" class="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                <span class="text-sm truncate">${item.name}</span>
                <div>
                    <button data-product-id="${item.id}" class="manage-bom-btn text-xs bg-indigo-600 text-white font-bold py-1 px-2 rounded hover:bg-indigo-700">Materiais</button>
                    <button data-id="${item.id}" data-collection="${activeConfig.collectionName}" class="delete-item-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2">
                        <svg class="h-4 w-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14"x2="14" y1="11" y2="17"/></svg>
                    </button>
                </div>
            </li>`
                        }
                        else if (
                          activeConfig.collectionName === "raw_materials"
                        ) {
                          return `
    <li key="${
      item.id
    }" class="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
        <span class="text-sm truncate">${activeConfig.displayFields
          .map((field) => item[field])
          .join(" - ")}</span>
        <div class="flex items-center">
            <button data-material-id="${item.id}" data-material-name="${
                            item.name
                          }" class="view-lots-btn text-xs bg-blue-600 text-white font-bold py-1 px-2 rounded hover:bg-blue-700">
                Ver Lotes
            </button>
            <button data-material-id="${item.id}" data-material-name="${
                            item.name
                          }" class="add-lot-btn text-xs bg-teal-600 text-white font-bold py-1 px-2 rounded hover:bg-teal-700 ml-2">
                + Adicionar Lote
            </button>
            <button data-id="${item.id}" data-collection="${
                            activeConfig.collectionName
                          }" class="delete-item-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2">
                <svg class="h-4 w-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14"x2="14" y1="11" y2="17"/></svg>
            </button>
        </div>
    </li>`
                        }
                        else {
                          return `
            <li key="${
              item.id
            }" class="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-700 rounded">
                <span class="text-sm truncate">${activeConfig.displayFields
                  .map((field) => item[field])
                  .join(" - ")}</span>
                <button data-id="${item.id}" data-collection="${
                            activeConfig.collectionName
                          }" class="delete-item-btn text-red-500 hover:text-red-700 dark:hover:text-red-400 ml-2">
                    <svg class="h-4 w-4 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14"x2="14" y1="11" y2="17"/></svg>
                </button>
            </li>`
                        }
                      })
                      .join("")}
                </ul>
                `
                    : ""
                }
            </div>`
    contentContainer.appendChild(card)
  }

  DOMElements.pageContent.appendChild(template)

  // Re-adiciona os listeners para os formulários e botões
  const createOpForm = contentContainer.querySelector(
    'form[data-form-type="CriarOP"]'
  )
  if (createOpForm) {
    createOpForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      const form = e.target
      const button = form.querySelector('button[type="submit"]')
      button.disabled = true

      const formData = new FormData(form)
      const opFromForm = Object.fromEntries(formData.entries())

      try {
        await runTransaction(db, async (transaction) => {
          const counterRef = doc(
            db,
            `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/metadata`,
            "op_counter"
          )
          const counterDoc = await transaction.get(counterRef)
          if (!counterDoc.exists())
            throw "Documento de contador não encontrado!"

          const newOpId = `OP-${counterDoc.data().last_id + 1}`

          const opRef = doc(
            db,
            `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
            newOpId
          )
          const workflowStages = [
            {
              sector: "Impressão",
              status: "Aguardando",
              responsible: opFromForm.machineId,
            },
            { sector: "Corte", status: "Aguardando", responsible: null },
            { sector: "Costura", status: "Aguardando", responsible: null },
          ]
          const selectedProductId = opFromForm.productId
          const customProductName = opFromForm.customProductName.trim() // .trim() remove espaços

          let finalProductId = null
          let finalProductName = ""

          if (selectedProductId) {
            const selectedProduct = state.products.find(
              (p) => p.id === selectedProductId
            )
            finalProductId = selectedProduct.id
            finalProductName = selectedProduct.name
          } else if (customProductName) {
            // PRIORIDADE 2: Se a lista está vazia, mas o usuário digitou um nome
            finalProductId = "CUSTOM" // Valor para sabermos que não é um produto padrão
            finalProductName = customProductName
          } else {
            // Se os dois campos estiverem vazios, dá um erro
            showAlert(
              "Você precisa selecionar um produto existente OU digitar uma descrição para o serviço/produto customizado."
            )
            button.disabled = false 
            return 
          }

          const opData = {
            id: newOpId,
            productId: finalProductId,
            productName: finalProductName,
            targetQuantity: Number(opFromForm.targetQuantity),
            overallStatus: "Aguardando",
            createdAt: new Date().toISOString(),
            stages: workflowStages,
          }
console.log("Conteúdo do state.userProfile antes da transação:", state.userProfile);
          const firstStage = opData.stages[0]
          const notificationRef = doc(
            collection(
              db,
              `artifacts/${firebaseConfig.appId}/public/data/notifications`
            )
          )
          const notificationData = {
            message: `Nova OP (${newOpId}) para o setor de ${firstStage.sector}.`,
            targetRole: firstStage.sector,
            createdAt: new Date().toISOString(),
            opId: newOpId,
            companyId: state.userProfile.companyId,
          }

          transaction.update(counterRef, {
            last_id: counterDoc.data().last_id + 1,
          })
          transaction.set(opRef, opData)
          transaction.set(notificationRef, notificationData)
        })
        showAlert(`Ordem de Produção criada com sucesso!`)
        form.reset()
      } catch (error) {
        showAlert(`Falha ao criar a Ordem de Produção. ${error}`);
      } finally {
        button.disabled = false
      }
    })
  }

  contentContainer
    .querySelectorAll('form[data-collection]:not([data-form-type="CriarOP"])')
    .forEach((form) => {
      form.addEventListener("submit", async (e) => {
        e.preventDefault()
        const collectionName = e.target.dataset.collection
        const formData = new FormData(e.target)
        const newItem = Object.fromEntries(formData.entries())
        newItem.companyId = state.userProfile.companyId
        if (collectionName === "products") newItem.bom = []
        const collectionRef = collection(
          db,
          `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/${collectionName}`
        )
        await setDoc(doc(collectionRef, newItem.id), newItem)
        e.target.reset()
      })
    })

  contentContainer.querySelectorAll(".delete-item-btn").forEach((button) => {
    button.addEventListener("click", async (e) => {
      const id = e.target.dataset.id
      const collectionName = e.target.dataset.collection

      showConfirm("Tem certeza que deseja apagar este item?", async () => {
        await deleteDoc(
          doc(
            db,
            `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/${collectionName}`,
            id
          )
        )
      })
    })
  })

  contentContainer.querySelectorAll(".manage-bom-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const productId = e.target.dataset.productId
      showBomModal(productId)
    })
  })

  contentContainer.querySelectorAll(".add-lot-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const materialId = e.target.dataset.materialId
      const materialName = e.target.dataset.materialName
      showAddLotModal(materialId, materialName)
    })
  })

  contentContainer.querySelectorAll(".view-lots-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const materialId = e.target.dataset.materialId
      const materialName = e.target.dataset.materialName
      showMaterialLotsModal(materialId, materialName)
    })
  })
}

const showBomModal = (productId) => {
  const product = state.products.find((p) => p.id === productId)
  if (!product) return

  if (!product.bom) product.bom = []

  const currentMaterialsHTML =
    product.bom
      .map((materialItem) => {
        const materialDetails = state.rawMaterials.find(
          (rm) => rm.id === materialItem.materialId
        )
        const materialName = materialDetails
          ? materialDetails.name
          : "Material não encontrado"
        const materialUnit = materialDetails ? materialDetails.unit : ""
        return `
            <li class="flex justify-between items-center text-sm p-2 bg-slate-700 rounded">
                <span>${materialName}</span>
                <span>${materialItem.quantityNeeded} ${materialUnit}</span>
            </li>
        `
      })
      .join("") ||
    '<p class="text-sm text-slate-400">Nenhum material adicionado.</p>'

  const materialOptionsHTML = state.rawMaterials
    .map((rm) => `<option value="${rm.id}">${rm.name}</option>`)
    .join("")

  const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 p-6 relative border border-slate-700">
                <button id="close-bom-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-xl font-bold mb-1 text-white">Gerenciar Materiais para:</h3>
                <p class="text-indigo-400 font-semibold mb-4">${product.name}</p>
                
                <h4 class="text-md font-semibold mb-2 text-slate-300">Materiais Atuais:</h4>
                <ul class="space-y-2 mb-6">${currentMaterialsHTML}</ul>

                <h4 class="text-md font-semibold mb-2 text-slate-300">Adicionar Novo Material:</h4>
                <form id="add-material-to-bom-form" class="flex items-center gap-2">
                    <select name="materialId" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600">${materialOptionsHTML}</select>
                    <input type="number" step="0.01" name="quantity" placeholder="Qtd." required class="w-24 p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    <button type="submit" class="bg-teal-600 text-white font-bold py-2 px-4 rounded hover:bg-teal-700">Add</button>
                </form>
            </div>
        </div>
    `

  DOMElements.customModalContainer.innerHTML = modalHTML

  document.getElementById("close-bom-modal").onclick = () =>
    (DOMElements.customModalContainer.innerHTML = "")

  document
    .getElementById("add-material-to-bom-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault()
      const form = e.target
      const newMaterial = {
        materialId: form.materialId.value,
        quantityNeeded: Number(form.quantity.value),
      }

      product.bom.push(newMaterial)

      const productRef = doc(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/products`,
        productId
      )
      await updateDoc(productRef, { bom: product.bom })

      DOMElements.customModalContainer.innerHTML = ""
      showBomModal(productId)
    })
}
const renderUsers = () => {
  DOMElements.pageContent.innerHTML = ""

  const template = document
    .getElementById("users-template")
    .content.cloneNode(true)
  DOMElements.pageContent.appendChild(template)

  const usersList = document.getElementById("users-list")

 
  const currentCompanyId = state.userProfile.companyId

  const companyUsers = state.allUsers.filter(
    (user) => user.companyId === currentCompanyId
  )

  usersList.innerHTML = companyUsers
    .map(
      (user) => `
        <li class="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
            <div>
                <p class="font-medium text-gray-900 dark:text-white">${
                  user.email
                }</p>
                <p class="text-sm text-gray-500 dark:text-gray-400">${
                  user.role
                }</p>
            </div>
            ${
              user.id !== state.userProfile.id
                ? `<button data-id="${user.id}" data-email="${user.email}" class="delete-user-btn text-red-500 hover:text-red-700 dark:hover:text-red-400"><svg class="h-5 w-5 pointer-events-none" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>`
                : ""
            }
        </li>
    `
    )
    .join("")

  document.querySelectorAll(".delete-user-btn").forEach((button) => {
    button.addEventListener("click", (e) => {
      const userId = e.target.dataset.id
      const userEmail = e.target.dataset.email
      showConfirm(
        `Tem certeza que deseja apagar o usuário ${userEmail}?`,
        async () => {
          await deleteDoc(
            doc(
              db,
              `artifacts/${firebaseConfig.appId}/public/data/users`,
              userId
            )
          )
          showAlert(`Usuário ${userEmail} foi removido.`)
        }
      )
    })
  })

  document.getElementById('add-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const button = form.querySelector('button[type="submit"]');
  const errorEl = document.getElementById('add-user-error');
  errorEl.textContent = '';
  button.disabled = true;

  const data = {
    email: form.email.value,
    password: form.password.value,
    role: form.role.value
  };

  try {
    const createNewUser = httpsCallable(functions, 'createNewUser');

    const result = await createNewUser(data);

    console.log(result.data.message); 
    showAlert("Usuário criado com sucesso!");
    form.reset();

  } catch (error) {
    console.error("Erro ao chamar a Cloud Function:", error);
    errorEl.textContent = error.message; 
  } finally {
    button.disabled = false;
  }
});
}

const renderOperatorView = () => {
  DOMElements.pageContent.innerHTML = ""
  const template = document
    .getElementById("operator-template")
    .content.cloneNode(true)
  DOMElements.pageContent.appendChild(template)

  const operatorContent = document.getElementById("operator-content")
  const machineSelectionDiv = document.getElementById(
    "operator-machine-selection"
  )
  const changeMachineBtn = document.getElementById("change-machine-btn")

  if (changeMachineBtn) changeMachineBtn.style.display = "none"
  if (machineSelectionDiv) machineSelectionDiv.style.display = "none"

  const userSector = state.userProfile.role
  const validSectors = ["Impressão", "Corte", "Costura"]

  if (!validSectors.includes(userSector)) {
    operatorContent.innerHTML = `<p class="text-center text-red-500">Seu usuário (${userSector}) não tem um cargo de operador de produção válido.</p>`
    return
  }

  const titleElement = DOMElements.pageContent.querySelector("h1")
  if (titleElement) {
    titleElement.innerHTML = `Modo Chão de Fábrica: <span class="text-blue-500">${userSector}</span>`
  }

  const activeOp = state.productionOrders.find((op) => {
    const activeStage = op.stages?.find(
      (s) =>
        (s.status === "Em produção" || s.status === "Parado") &&
        s.sector === userSector
    )
    return !!activeStage
  })

  if (activeOp) {
    const currentStage = activeOp.stages.find((s) => s.sector === userSector)
    const statusColor =
      currentStage.status === "Em produção"
        ? "text-green-500"
        : "text-yellow-500"
    const opDetails = `<div class="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg space-y-4"><h2 class="text-2xl font-bold">OP Ativa: ${
      activeOp.id
    } (${currentStage.sector})</h2><p><strong>Produto:</strong> ${
      activeOp.productName
    }</p><p><strong>Máquina:</strong> ${
      activeOp.machineName || "Não especificada"
    }</p><p><strong>Status da Etapa:</strong> <span class="font-semibold ${statusColor}">${
      currentStage.status
    }</span></p></div>`

    let actionButtons = ""
    if (currentStage.status === "Em produção") {
      actionButtons = `<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4"><button data-op-id="${activeOp.id}" data-action="stop_stage" class="op-action-btn bg-yellow-500 text-white font-bold py-4 px-6 rounded-lg text-lg shadow-lg hover:bg-yellow-600">REGISTRAR PARADA</button><button data-op-id="${activeOp.id}" data-action="reject" class="op-action-btn bg-red-500 text-white font-bold py-4 px-6 rounded-lg text-lg shadow-lg hover:bg-red-600">REGISTRAR REJEITOS</button><button data-op-id="${activeOp.id}" data-action="inspection" class="op-action-btn bg-cyan-500 text-white font-bold py-4 px-6 rounded-lg text-lg shadow-lg hover:bg-cyan-600">REGISTRAR INSPEÇÃO</button><button data-op-id="${activeOp.id}" data-action="finish_stage" class="op-action-btn md:col-span-3 bg-indigo-600 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg hover:bg-indigo-700 mt-2">FINALIZAR ETAPA</button></div>`
    } else if (currentStage.status === "Parado") {
      actionButtons = `<div class="mt-4"><button data-op-id="${activeOp.id}" data-action="resume_stage" class="op-action-btn w-full bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-xl shadow-lg hover:bg-green-600">RETOMAR PRODUÇÃO</button></div>`
    }
    operatorContent.innerHTML = opDetails + actionButtons
  } else {
    const waitingOpsElements = state.productionOrders
      .filter((op) => op.overallStatus !== "Finalizado")
      .map((op) => {
        const stageIndex = op.stages?.findIndex((s) => s.sector === userSector)
        if (stageIndex === -1 || op.stages[stageIndex].status !== "Aguardando")
          return null
        const isFirstStage = stageIndex === 0
        const isPreviousStageDone =
          !isFirstStage && op.stages[stageIndex - 1].status === "Finalizado"
        const isReady = isFirstStage || isPreviousStageDone
        if (isReady) {
          return `<li class="bg-white dark:bg-slate-700 p-4 rounded-lg shadow transition-transform hover:scale-105"><button data-action="start_stage" data-op-id="${op.id}" class="op-action-btn w-full text-left text-lg flex justify-between items-center"><span><span class="font-bold">${op.id}</span> - ${op.productName}</span><span class="text-sm font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900 px-3 py-1 rounded-full">PRONTO</span></button></li>`
        } else {
          const previousStage = op.stages[stageIndex - 1]
          return `<li class="bg-gray-100 dark:bg-slate-800 p-4 rounded-lg shadow opacity-70"><div class="w-full text-left text-lg flex justify-between items-center cursor-not-allowed"><div><span class="font-bold">${op.id}</span> - ${op.productName}<p class="text-xs text-gray-500 dark:text-gray-400">Aguardando liberação do setor: ${previousStage.sector}</p></div><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6 text-yellow-500 flex-shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div></li>`
        }
      })
      .filter(Boolean)
      .join("")

    if (waitingOpsElements.length > 0) {
      operatorContent.innerHTML = `<h3 class="text-xl font-semibold text-center mb-4">Próximas Tarefas</h3><ul class="space-y-3">${waitingOpsElements}</ul>`
    } else {
      operatorContent.innerHTML = `<p class="text-gray-600 dark:text-gray-400 text-lg text-center mt-8">Nenhuma ordem de produção para você no momento.</p>`
    }
  }

  // OUVINTE DE CLIQUES PARA TODAS AS AÇÕES DO OPERADOR
  operatorContent.addEventListener("click", async (e) => {
    const button = e.target.closest(".op-action-btn")
    if (!button) return

    const action = button.dataset.action
    const opId = button.dataset.opId
    const opData = state.productionOrders.find((o) => o.id === opId)
    if (!opData) return

    const stageIndex = opData.stages.findIndex((s) => s.sector === userSector)
    const opRef = doc(
      db,
      `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
      opId
    )
    const updatedStages = JSON.parse(JSON.stringify(opData.stages))

    if (action === "start_stage") {
      const product = state.products.find((p) => p.id === opData.productId)
      if (product && product.bom && product.bom.length > 0) {
        showLotSelectionModal(opId)
      } else {
        showConfirm(
          `Iniciar a etapa de ${userSector} para a OP ${opId}?`,
          async () => {
            const realStageIndex = opData.stages.findIndex(
              (s) => s.status === "Aguardando" && s.sector === userSector
            )
            if (realStageIndex === -1) return
            updatedStages[realStageIndex].status = "Em produção"
            updatedStages[realStageIndex].startedAt = new Date().toISOString()
            const newOverallStatus =
              opData.overallStatus === "Aguardando"
                ? "Em produção"
                : opData.overallStatus
            await updateDoc(opRef, {
              stages: updatedStages,
              overallStatus: newOverallStatus,
            })
          }
        )
      }
    } else if (action === "resume_stage") {
      updatedStages[stageIndex].status = "Em produção"
      const stopHistory = updatedStages[stageIndex].stopHistory
      if (stopHistory && stopHistory.length > 0) {
        const lastStop = stopHistory[stopHistory.length - 1]
        if (lastStop && !lastStop.endTime) {
          lastStop.endTime = new Date().toISOString()
        }
      }
      await updateDoc(opRef, { stages: updatedStages })
    } else if (action === "stop_stage") {
      showStopModal(opId, stageIndex)
    } else if (action === "reject") {
      showRejectModal(opId, stageIndex)
    } else if (action === "inspection") {
      showInspectionModal(opId, stageIndex) }
else if (action === "finish_stage") {
    showConfirm(`Finalizar a etapa de ${userSector} para a OP ${opId}?`, async () => {
        try {
            const isLastStage = stageIndex + 1 >= updatedStages.length;

            if (isLastStage) {
                updatedStages[stageIndex].status = "Finalizado";
                updatedStages[stageIndex].completedAt = new Date().toISOString();
                await updateDoc(opRef, {
                    stages: updatedStages,
                    overallStatus: "Finalizado",
                });
                showAlert("Ordem de Produção finalizada com sucesso!");
            } else {
                updatedStages[stageIndex].status = "Finalizado";
                updatedStages[stageIndex].completedAt = new Date().toISOString();
                updatedStages[stageIndex + 1].status = "Aguardando";
                await updateDoc(opRef, {
                    stages: updatedStages,
                    overallStatus: "Em produção",
                });
                showAlert("Etapa finalizada! A OP foi enviada para o próximo setor.");
            }
        } catch (error) {
            console.error("Erro ao finalizar a etapa: ", error);
            showAlert(`Falha ao finalizar etapa: ${error}`);
        }
    });
}
    }); 

}
const showStopModal = (opId, stageIndex) => {
  const modalContainer = DOMElements.customModalContainer

  const stopReasonOptions = state.stopReasons
    .map(
      (reason) => `<option value="${reason.id}">${reason.description}</option>`
    )
    .join("")

  modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm m-4 p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
                <h3 class="text-xl font-bold mb-4">Registrar Parada</h3>
                <form id="stop-form" class="space-y-4">
                    <div>
                        <label for="stop-reason" class="block text-sm font-medium text-gray-500 dark:text-gray-400">Motivo da Parada</label>
                        <select id="stop-reason" name="reason" required class="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
                            <option value="">-- Selecione um motivo --</option>
                            ${stopReasonOptions}
                        </select>
                    </div>
                    <button type="submit" class="w-full bg-yellow-500 text-white font-bold py-2 px-4 rounded hover:bg-yellow-600">Confirmar Parada</button>
                </form>
            </div>
        </div>`

  document.getElementById("close-modal").onclick = () =>
    (modalContainer.innerHTML = "")

  document.getElementById("stop-form").addEventListener("submit", async (e) => {
    e.preventDefault()
    const reason = e.target.reason.value
    if (!reason) {
      showAlert("Por favor, selecione um motivo.")
      return
    }

    const opRef = doc(
      db,
      `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
      opId
    )
    const opData = state.productionOrders.find((o) => o.id === opId)
    const updatedStages = JSON.parse(JSON.stringify(opData.stages))

    updatedStages[stageIndex].status = "Parado"

    if (!updatedStages[stageIndex].stopHistory) {
      updatedStages[stageIndex].stopHistory = []
    }
    updatedStages[stageIndex].stopHistory.push({
      reason: reason,
      startTime: new Date().toISOString(),
      endTime: null,
    })

    await updateDoc(opRef, { stages: updatedStages })
    modalContainer.innerHTML = ""
    showAlert("Parada registrada com sucesso!")
  })
}

const showInspectionModal = (opId, stageIndex) => {
  const modalContainer = DOMElements.customModalContainer
  modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Registrar Inspeção de Qualidade</h3>
                <form id="inspection-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Status da Inspeção</label>
                        <select name="status" required class="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
                            <option value="Aprovado">Aprovado</option>
                            <option value="Reprovado">Reprovado</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-500 dark:text-gray-400">Observações (opcional)</label>
                        <textarea name="notes" rows="3" placeholder="Ex: Medidas OK, pequena variação de cor..." class="w-full mt-1 p-2 border rounded dark:bg-slate-700 dark:border-gray-600"></textarea>
                    </div>
                    <button type="submit" class="w-full bg-cyan-500 text-white font-bold py-2 px-4 rounded hover:bg-cyan-600">Salvar Inspeção</button>
                </form>
            </div>
        </div>`

  document.getElementById("close-modal").onclick = () =>
    (modalContainer.innerHTML = "")

  document
    .getElementById("inspection-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault()
      const form = e.target

      const inspectionData = {
        status: form.status.value,
        notes: form.notes.value,
        timestamp: new Date().toISOString(),
        inspectorEmail: state.userProfile.email,
      }

      const opRef = doc(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
        opId
      )
      const opData = state.productionOrders.find((o) => o.id === opId)
      const updatedStages = JSON.parse(JSON.stringify(opData.stages))

      // Garante que o array 'inspections' exista no estágio correto
      if (!updatedStages[stageIndex].inspections) {
        updatedStages[stageIndex].inspections = []
      }

      // Adiciona a nova inspeção ao array
      updatedStages[stageIndex].inspections.push(inspectionData)

      // Atualiza a OP no banco de dados
      await updateDoc(opRef, { stages: updatedStages })

      modalContainer.innerHTML = ""
      showAlert("Inspeção registrada com sucesso!")
    })
}

const showAddLotModal = (materialId, materialName) => {
  const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md m-4 p-6 relative border border-slate-700">
                <button id="close-lot-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-xl font-bold mb-1 text-white">Adicionar Lote para:</h3>
                <p class="text-teal-400 font-semibold mb-4">${materialName}</p>
                
                <form id="add-lot-form" class="space-y-4">
                    <input type="text" name="lotNumber" placeholder="Número do Lote / NF" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    <input type="number" step="0.01" name="quantity" placeholder="Quantidade Recebida" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    <input type="text" name="supplier" placeholder="Fornecedor (Opcional)" class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    <input type="date" id="receivedDate" name="receivedDate" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    <button type="submit" class="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded hover:bg-teal-700">Salvar Lote</button>
                </form>
            </div>
        </div>
    `

  DOMElements.customModalContainer.innerHTML = modalHTML
  document.getElementById("receivedDate").valueAsDate = new Date() // Preenche a data com hoje

  document.getElementById("close-lot-modal").onclick = () =>
    (DOMElements.customModalContainer.innerHTML = "")

  document
    .getElementById("add-lot-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault()
      const form = e.target
      const newLot = {
        lotNumber: form.lotNumber.value,
        quantity: Number(form.quantity.value),
        supplier: form.supplier.value,
        receivedDate: form.receivedDate.value,
      }

      const lotsCollectionRef = collection(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/raw_materials/${materialId}/lots`
      )
      await addDoc(lotsCollectionRef, newLot)

      showAlert(`Lote ${newLot.lotNumber} adicionado com sucesso!`)
      DOMElements.customModalContainer.innerHTML = ""
    })
}

const showLotSelectionModal = (opId) => {
  const opData = state.productionOrders.find((o) => o.id === opId)
  if (!opData) {
    showAlert("Erro: Ordem de Produção não encontrada.")
    return
  }

  const product = state.products.find((p) => p.id === opData.productId)
  if (!product || !product.bom || product.bom.length === 0) {
    showConfirm(`Iniciar a etapa para a OP ${opId}?`, async () => {
      const opRef = doc(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
        opId
      )
      const stageIndex = opData.stages.findIndex(
        (s) => s.status === "Aguardando"
      )
      if (stageIndex === -1) return
      const updatedStages = JSON.parse(JSON.stringify(opData.stages))
      updatedStages[stageIndex].status = "Em produção"
      updatedStages[stageIndex].startedAt = new Date().toISOString()
      const newOverallStatus =
        opData.overallStatus === "Aguardando"
          ? "Em produção"
          : opData.overallStatus
      await updateDoc(opRef, {
        stages: updatedStages,
        overallStatus: newOverallStatus,
      })
    })
    return
  }

  const modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div id="lot-selection-content" class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg m-4 p-6 relative border border-slate-700">
                <button id="close-lot-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-white">Selecionar Lotes para OP: ${opId}</h3>
                <div id="lot-form-container"><p class="text-slate-400">Carregando lotes disponíveis...</p></div>
            </div>
        </div>
    `
  DOMElements.customModalContainer.innerHTML = modalHTML
  document.getElementById("close-lot-modal").onclick = () =>
    (DOMElements.customModalContainer.innerHTML = "")

  const buildForm = async () => {
    const formContainer = document.getElementById("lot-form-container")
    let formFieldsHTML = ""
    try {
      for (const materialItem of product.bom) {
        const materialDetails = state.rawMaterials.find(
          (rm) => rm.id === materialItem.materialId
        )
        if (!materialDetails) continue

        const lotsRef = collection(
          db,
          `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/raw_materials/${materialItem.materialId}/lots`
        )
        const lotsSnapshot = await getDocs(lotsRef)
        const availableLots = lotsSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((lot) => lot.quantity > 0)

        const unit = materialDetails?.unit || ""
        const optionsHTML = availableLots
          .map(
            (lot) =>
              `<option value="${lot.id}">${lot.lotNumber} (${lot.quantity} ${unit} disp.)</option>`
          )
          .join("")

        formFieldsHTML += `
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-400 mb-1">Lote para: ${materialDetails.name}</label>
                        <select name="${materialItem.materialId}" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
                            <option value="">-- Selecione um lote --</option>
                            ${optionsHTML}
                        </select>
                    </div>
                `
      }

      if (formFieldsHTML) {
        formContainer.innerHTML = `
                    <form id="lot-selection-form">
                        ${formFieldsHTML}
                        <button type="submit" class="w-full mt-4 bg-green-600 text-white font-bold py-3 px-4 rounded hover:bg-green-700">Confirmar Lotes e Iniciar Produção</button>
                    </form>
                `
        document
          .getElementById("lot-selection-form")
          .addEventListener("submit", (e) => handleLotSelectionSubmit(e))
      } else {
        formContainer.innerHTML =
          '<p class="text-yellow-400">Nenhum lote com estoque disponível foi encontrado para os materiais necessários.</p>'
      }
    } catch (error) {
      console.error("Erro ao construir formulário de lotes:", error)
      formContainer.innerHTML =
        '<p class="text-red-500">Ocorreu um erro ao carregar os lotes disponíveis.</p>'
    }
  }

  const handleLotSelectionSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const consumedLots = []

    for (const materialItem of product.bom) {
      const selectedLotId = formData.get(materialItem.materialId)
      if (selectedLotId) {
        consumedLots.push({
          materialId: materialItem.materialId,
          lotId: selectedLotId,
        })
      }
    }

    const opRef = doc(
      db,
      `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
      opId
    )
    await updateDoc(opRef, { consumedLots: consumedLots })

    const freshOpData =
      state.productionOrders.find((o) => o.id === opId) || opData
    const stageIndex = freshOpData.stages.findIndex(
      (s) => s.status === "Aguardando"
    )
    if (stageIndex === -1) return

    const updatedStages = JSON.parse(JSON.stringify(freshOpData.stages))
    updatedStages[stageIndex].status = "Em produção"
    updatedStages[stageIndex].startedAt = new Date().toISOString()
    const newOverallStatus =
      freshOpData.overallStatus === "Aguardando"
        ? "Em produção"
        : freshOpData.overallStatus
    await updateDoc(opRef, {
      stages: updatedStages,
      overallStatus: newOverallStatus,
    })

    DOMElements.customModalContainer.innerHTML = ""
    showAlert("Lotes selecionados e produção iniciada com sucesso!")
  }

  buildForm()
}

const showRejectModal = (opId, stageIndex) => {
  const modalContainer = DOMElements.customModalContainer

  // Cria as opções do <select> a partir das causas cadastradas no state
  const causeOptions = state.rejectionCauses
    .map(
      (cause) =>
        `<option value="${cause.id}">${cause.category} - ${cause.description}</option>`
    )
    .join("")

  modalContainer.innerHTML = `
         <div class="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
            <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm m-4 p-6 relative">
                <button id="close-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
                <h3 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">Registrar Rejeitos</h3>
                <form id="reject-form" class="space-y-4">
                    <input type="number" name="quantity" placeholder="Quantidade Rejeitada" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600" />
                    
                    <select name="causeId" required class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600">
                        <option value="">-- Selecione a Causa do Refugo --</option>
                        ${causeOptions}
                    </select>

                    <textarea name="notes" rows="2" placeholder="Observações (opcional)" class="w-full p-2 border rounded dark:bg-slate-700 dark:border-gray-600"></textarea>
                    
                    <button type="submit" class="w-full bg-red-500 text-white font-bold py-2 px-4 rounded hover:bg-red-600">Confirmar Rejeitos</button>
                </form>
            </div>
        </div>`

  document.getElementById("close-modal").onclick = () =>
    (modalContainer.innerHTML = "")

  document
    .getElementById("reject-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault()
      const form = e.target
      const quantity = form.quantity.value
      if (!quantity || quantity <= 0) {
        showAlert("Por favor, insira uma quantidade válida.")
        return
      }

      // Novos dados a serem salvos
      const rejectData = {
        quantity: Number(quantity),
        causeId: form.causeId.value, // Salva o ID da causa
        notes: form.notes.value,
        timestamp: new Date().toISOString(),
      }

      const opRef = doc(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/production_orders`,
        opId
      )
      const opData = state.productionOrders.find((o) => o.id === opId)
      const updatedStages = JSON.parse(JSON.stringify(opData.stages))

      if (!updatedStages[stageIndex].rejects) {
        updatedStages[stageIndex].rejects = []
      }
      updatedStages[stageIndex].rejects.push(rejectData)

      await updateDoc(opRef, { stages: updatedStages })
      modalContainer.innerHTML = ""
      showAlert("Rejeitos registrados com sucesso!")
    })
}

DOMElements.navItems.addEventListener("click", (e) => {
  const link = e.target.closest(".nav-link")
  if (link) {
    e.preventDefault()
    state.currentPage = link.dataset.page
    renderNavItems()
    renderCurrentPage()
  }
})

const handleLogout = () => {
  state.userProfile = null
  renderApp()
}
DOMElements.logoutButton.addEventListener("click", handleLogout)

DOMElements.darkModeToggle.addEventListener("click", () => {
  state.darkMode = !state.darkMode
  document.documentElement.classList.toggle("dark", state.darkMode)
  DOMElements.themeIconSun.classList.toggle("hidden", !state.darkMode)
  DOMElements.themeIconMoon.classList.toggle("hidden", state.darkMode)
})
const showMaterialLotsModal = (materialId, materialName) => {
  let modalHTML = `
        <div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex justify-center items-center p-4">
            <div id="lots-list-content" class="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl m-4 p-6 relative border border-slate-700">
                <button id="close-lots-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-xl font-bold mb-1 text-white">Estoque por Lote para:</h3>
                <p class="text-blue-400 font-semibold mb-4">${materialName}</p>
                <p class="text-slate-400">Carregando lotes...</p>
            </div>
        </div>
    `
  DOMElements.customModalContainer.innerHTML = modalHTML
  document.getElementById("close-lots-modal").onclick = () =>
    (DOMElements.customModalContainer.innerHTML = "")

  const buildLotsList = async () => {
 
    const lotsRef = collection(
      db,
      `artifacts/${firebaseConfig.appId}/public/data/companies/${state.userProfile.companyId}/raw_materials/${materialId}/lots`
    )

    const lotsSnapshot = await getDocs(lotsRef)
    const lots = lotsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

    let lotsHTML = ""
    let totalStock = 0

    if (lots.length === 0) {
      lotsHTML =
        '<p class="text-slate-400">Nenhum lote cadastrado para este material.</p>'
    } else {
      lotsHTML = `
                <div class="overflow-y-auto max-h-80">
                    <table class="w-full text-sm text-left text-gray-400">
                        <thead class="text-xs text-gray-300 uppercase bg-slate-700">
                            <tr>
                                <th scope="col" class="px-6 py-3">Lote / NF</th>
                                <th scope="col" class="px-6 py-3">Fornecedor</th>
                                <th scope="col" class="px-6 py-3">Data Receb.</th>
                                <th scope="col" class="px-6 py-3 text-right">Quantidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${lots
                              .map((lot) => {
                                totalStock += lot.quantity 
                                return `
                                    <tr class="border-b border-slate-700">
                                        <th scope="row" class="px-6 py-4 font-medium text-white whitespace-nowrap">${
                                          lot.lotNumber
                                        }</th>
                                        <td class="px-6 py-4">${
                                          lot.supplier || "N/A"
                                        }</td>
                                        <td class="px-6 py-4">${new Date(
                                          lot.receivedDate + "T00:00:00"
                                        ).toLocaleDateString("pt-BR")}</td>
                                        <td class="px-6 py-4 text-right font-bold">${
                                          lot.quantity
                                        }</td>
                                    </tr>
                                `
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `
    }

    const modalContent = document.getElementById("lots-list-content")
    if (modalContent) {
      const title = `
                <button id="close-lots-modal" class="absolute top-4 right-4 text-gray-400 hover:text-gray-200 text-3xl">&times;</button>
                <h3 class="text-xl font-bold mb-1 text-white">Estoque por Lote para:</h3>
                <p class="text-blue-400 font-semibold mb-1">${materialName}</p>
                <p class="text-lg font-bold text-white mb-4">Estoque Total: <span class="text-green-400">${totalStock}</span></p>
            `
      modalContent.innerHTML = title + lotsHTML
      document.getElementById("close-lots-modal").onclick = () =>
        (DOMElements.customModalContainer.innerHTML = "")
    }
  }

  buildLotsList()
}
// --- INICIALIZAÇÃO E LISTENERS DO FIREBASE ---

const renderAuthScreen = () => {
  const authForm = document.getElementById("auth-form")
  const authEmail = document.getElementById("auth-email")
  const authPassword = document.getElementById("auth-password")
  const authError = document.getElementById("auth-error")
  const authSubmitButton = document.getElementById("auth-submit-button")
  const authToggleLink = document.getElementById("auth-toggle-link")
  const authTitle = document.getElementById("auth-title")
  const authToggleContainer = document.getElementById("auth-toggle-container")

  let isLogin = true
  let hasGestor = true

  // O caminho para a coleção de usuários precisa ser exato.
  // Usar a variável de configuração garante isso.
  const usersCollectionRef = collection(
    db,
    `artifacts/${firebaseConfig.appId}/public/data/users`
  )

  const checkGestorExists = async () => {
    const q = query(usersCollectionRef, where("role", "==", "Gestor"))
    const querySnapshot = await getDocs(q)
    hasGestor = !querySnapshot.empty
    if (!hasGestor) {
      isLogin = false
    }
    updateAuthUI()
  }
  checkGestorExists()

  const updateAuthUI = () => {
    authTitle.textContent = isLogin
      ? "Faça login na sua conta"
      : hasGestor
      ? "Crie uma nova conta"
      : "Registre o usuário Gestor"
    authSubmitButton.textContent = isLogin ? "Entrar" : "Registrar"
    authToggleLink.textContent = isLogin
      ? "Não tem uma conta? Registre-se"
      : "Já tem uma conta? Faça login"
    authToggleContainer.classList.toggle("hidden", !hasGestor)
  }

  authToggleLink.addEventListener("click", (e) => {
    e.preventDefault()
    isLogin = !isLogin
    updateAuthUI()
  })

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    authError.textContent = ""
    authSubmitButton.disabled = true

    const email = authEmail.value
    const password = authPassword.value

    if (isLogin) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // --- INÍCIO DOS LOGS DE DIAGNÓSTICO ---
        console.log("PASSO 1: Login na Autenticação bem-sucedido.");
        console.log("UID do usuário retornado pela Autenticação:", user.uid);

        console.log("PASSO 2: Forçando atualização do token para obter os 'carimbos' (Custom Claims)...");
        const idTokenResult = await user.getIdTokenResult(true); // Usamos getIdTokenResult para ver os claims
        console.log("Token atualizado. Claims encontrados no token:", idTokenResult.claims);
        // --- FIM DOS LOGS DE DIAGNÓSTICO ---


        const userRef = doc(db, `artifacts/1:928850901137:web:e89c3170e356aafcc12730/public/data/users`, user.uid);

        // --- LOG ADICIONAL ANTES DA OPERAÇÃO CRÍTICA ---
        console.log("PASSO 3: Tentando ler o documento do usuário no Firestore no seguinte caminho:", userRef.path);

        const userDoc = await getDoc(userRef);

        console.log("PASSO 4: Leitura do documento no Firestore bem-sucedida!");


        if (!userDoc.exists()) {
            authError.textContent = "Erro: Perfil de usuário não encontrado no banco de dados.";
            authSubmitButton.disabled = false;
            return;
        }
        const userData = userDoc.data();
        if (!userData.companyId) {
            authError.textContent = "Este usuário não está vinculado a uma empresa. Contate o suporte.";
            authSubmitButton.disabled = false;
            return;
        }
        const companyRef = doc(db, `artifacts/1:928850901137:web:e89c3170e356aafcc12730/public/data/companies`, userData.companyId);
        const companyDoc = await getDoc(companyRef);
        if (!companyDoc.exists() || companyDoc.data().subscriptionStatus !== 'active') {
            authError.textContent = "A assinatura desta empresa não está ativa.";
            authSubmitButton.disabled = false;
            return;
        }

        state.userProfile = { id: userDoc.id, ...userData };
        setupFirestoreListeners();
        requestNotificationPermission();
        renderApp();

    } catch (error) {
        console.error("ERRO FINAL:", error); 
        authError.textContent = "Ocorreu um erro ao tentar fazer login. Verifique o console.";
    }

    } else {
      const q = query(usersCollectionRef, where("email", "==", email))
      const existingUserSnapshot = await getDocs(q)
      if (!existingUserSnapshot.empty) {
        authError.textContent = "Este e-mail já está em uso."
        authSubmitButton.disabled = false
        return
      }
   
      const userProfile = {
        email,
        password,
        role: hasGestor ? "Impressão" : "Gestor",
      }

     
      const userDocRef = await addDoc(usersCollectionRef, userProfile)
      state.userProfile = { id: userDocRef.id, ...userProfile }
      renderApp()
    }

    authSubmitButton.disabled = false
  })
}

// --- FUNÇÃO PARA PEDIR PERMISSÃO DE NOTIFICAÇÃO ---
const requestNotificationPermission = async () => {
  try {
    const messaging = getMessaging(app)

    const vapidKey =
      "BGjGj1hSlkkKIk_AD-2beIIG_fo2FBg_rKFB9oS0fMU6uIUBl8llp5h3Dx6RoJXXYpPcZvI9avXMMm3InCfLBDg"

    const token = await getToken(messaging, { vapidKey: vapidKey })

    if (token) {
      console.log("Token de notificação do usuário:", token)
      // Salva o token no perfil do usuário no banco de dados
      const userRef = doc(
        db,
        `artifacts/${firebaseConfig.appId}/public/data/users`,
        state.userProfile.id
      )
      await updateDoc(userRef, { notificationToken: token })
      console.log("Token salvo no perfil do usuário.")
    } else {
      console.log("Permissão para notificação não concedida.")
    }
  } catch (err) {
    console.error("Ocorreu um erro ao obter o token de notificação.", err)
  }
}

const setupFirestoreListeners = () => {
  activeListeners.forEach((unsubscribe) => unsubscribe())
  activeListeners = []

  if (!state.userProfile || !state.userProfile.companyId) {
    console.log("Usuário não logado ou sem empresa, listeners não ativados.")
    return
  }

  const appId = firebaseConfig.appId
  const companyId = state.userProfile.companyId

  const usersCollectionRef = collection(
    db,
    `artifacts/${appId}/public/data/users`
  )
  let unsubscribeUsers = onSnapshot(usersCollectionRef, (snapshot) => {
    state.allUsers = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    if (state.userProfile) renderCurrentPage()
  })
  activeListeners.push(unsubscribeUsers) // Registra na lista para ser desligado depois

  // Listeners para Coleções POR EMPRESA
  const companySpecificCollections = {
    machines: (data) => (state.machines = data),
    products: (data) => (state.products = data),
    stopReasons: (data) => (state.stopReasons = data),
    raw_materials: (data) => (state.rawMaterials = data),
    rejection_causes: (data) => (state.rejectionCauses = data),
    maintenance_plans: (data) => (state.maintenancePlans = data),
    services: (data) => (state.services = data),
    production_orders: (data) => {
      const enrichedData = data.map((op) => ({
        ...op,
        machineName:
          state.machines.find((m) => m.id === op.stages?.[0]?.responsible)
            ?.name || "Não especificada",
      }))
      state.productionOrders = enrichedData.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )
      if (state.currentPage === "manager-dashboard")
        updateManagerDashboardKPIs()
    },
  }

  Object.entries(companySpecificCollections).forEach(([colName, setter]) => {
    const collectionRef = collection(
      db,
      `artifacts/${appId}/public/data/companies/${companyId}/${colName}`
    )
    const unsubscribe = onSnapshot(query(collectionRef), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      setter(data)
      if (state.userProfile) renderCurrentPage()
    })
    activeListeners.push(unsubscribe) // Registra na lista
  })

  // Listener para Notificações POR EMPRESA
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString()

  const notificationsQuery = query(
    collection(db, `artifacts/${appId}/public/data/notifications`),
    where("companyId", "==", companyId),
    where("createdAt", ">", oneMinuteAgo) 
  )
  const unsubscribeNotifications = onSnapshot(
    notificationsQuery,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && state.userProfile) {
          const notification = change.doc.data()
          if (notification.targetRole === state.userProfile.role) {
            showToastNotification(notification.message)
          }
        }
      })
    }
  )
  activeListeners.push(unsubscribeNotifications) 
}

const init = () => {
  
  DOMElements.loadingScreen.classList.add("hidden")
  renderApp()

  document.body.addEventListener("click", (e) => {
    const card = e.target.closest(".kanban-card")
    if (
      card &&
      state.userProfile &&
      ["Gestor", "Supervisor"].includes(state.userProfile.role)
    ) {
      const opId = card.dataset.opId
      showOpDetailsModal(opId)
    }
  })
}

init()
