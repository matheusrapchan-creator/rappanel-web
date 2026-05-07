import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "https://api.raptech.com.br";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";

const initialAgenda = {
  titulo: "",
  tipo: "venda",
  data: "",
  hora: "",
  responsavel: "",
  cliente: "",
  status: "agendado",
  observacao: "",
};

const statusMap = {
  agendado: { label: "Agendado", tone: "blue" },
  novo: { label: "Novo", tone: "blue" },
  pendente: { label: "Pendente", tone: "amber" },
  "em andamento": { label: "Em andamento", tone: "purple" },
  em_andamento: { label: "Em andamento", tone: "purple" },
  aprovado: { label: "Aprovado", tone: "green" },
  concluido: { label: "Concluído", tone: "green" },
  "concluído": { label: "Concluído", tone: "green" },
  cancelado: { label: "Cancelado", tone: "red" },
  recusado: { label: "Recusado", tone: "red" },
};

function normalizeStatus(status) {
  return String(status || "novo").trim().toLowerCase();
}

function statusInfo(status) {
  return statusMap[normalizeStatus(status)] || {
    label: status || "Novo",
    tone: "gray",
  };
}

function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(item) {
  const rawDate = item.data_hora || item.data || item.created_at;
  const rawTime = item.hora ? ` ${item.hora}` : "";

  if (!rawDate) return "Sem data";

  const date = new Date(rawDate);
  if (Number.isNaN(date.getTime())) return `${rawDate}${rawTime}`;

  return `${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)}${rawTime}`;
}

function moneyFromQuote(item) {
  return item.valor_venda || item.valor || item.total || item.preco || 0;
}

async function requestApi(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(API_TOKEN ? { "x-api-token": API_TOKEN } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Erro ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function StatusBadge({ status }) {
  const info = statusInfo(status);
  return <span className={`status status-${info.tone}`}>{info.label}</span>;
}

function MetricCard({ label, value, caption, accent }) {
  return (
    <article className={`metric metric-${accent}`}>
      <span className="metric-kicker">{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function EmptyState({ title, caption }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{caption}</span>
    </div>
  );
}

function AgendaForm({ onSaved }) {
  const [novoItem, setNovoItem] = useState(initialAgenda);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field, value) {
    setNovoItem((current) => ({ ...current, [field]: value }));
  }

  async function salvarAgenda(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await requestApi("/agenda", {
        method: "POST",
        body: JSON.stringify(novoItem),
      });

      setNovoItem(initialAgenda);
      onSaved();
    } catch (err) {
      setError(err.message || "Não foi possível salvar a agenda.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel form-panel">
      <div className="section-title">
        <div>
          <span>Cadastro</span>
          <h2>Nova agenda</h2>
        </div>
        <span className="section-icon">+</span>
      </div>

      <form onSubmit={salvarAgenda}>
        <div className="form-grid">
          <label>
            Título
            <input
              value={novoItem.titulo}
              onChange={(event) => updateField("titulo", event.target.value)}
              placeholder="Ex: Reunião de pré-venda"
              required
            />
          </label>

          <label>
            Cliente
            <input
              value={novoItem.cliente}
              onChange={(event) => updateField("cliente", event.target.value)}
              placeholder="Nome do cliente"
            />
          </label>

          <label>
            Data
            <input
              type="date"
              value={novoItem.data}
              onChange={(event) => updateField("data", event.target.value)}
            />
          </label>

          <label>
            Hora
            <input
              type="time"
              value={novoItem.hora}
              onChange={(event) => updateField("hora", event.target.value)}
            />
          </label>

          <label>
            Responsável
            <input
              value={novoItem.responsavel}
              onChange={(event) => updateField("responsavel", event.target.value)}
              placeholder="Equipe ou pessoa"
            />
          </label>

          <label>
            Status
            <select
              value={novoItem.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              <option value="agendado">Agendado</option>
              <option value="em andamento">Em andamento</option>
              <option value="concluído">Concluído</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </label>
        </div>

        <label>
          Observação
          <textarea
            value={novoItem.observacao}
            onChange={(event) => updateField("observacao", event.target.value)}
            placeholder="Próximo passo, contexto comercial ou detalhe operacional"
          />
        </label>

        {error && <div className="error-message">{error}</div>}

        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar agenda"}
        </button>
      </form>
    </section>
  );
}

function AgendaList({ agenda }) {
  return (
    <section className="panel table-panel">
      <div className="section-title">
        <div>
          <span>Operação</span>
          <h2>Lista de agenda</h2>
        </div>
        <span className="section-icon">A</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Compromisso</th>
              <th>Cliente</th>
              <th>Responsável</th>
              <th>Quando</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {agenda.map((item, index) => (
              <tr key={item.id || `${item.titulo}-${index}`}>
                <td>
                  <strong>{item.titulo || "Compromisso"}</strong>
                  <small>{item.observacao || item.tipo || "Sem observação"}</small>
                </td>
                <td>{item.cliente || "-"}</td>
                <td>{item.responsavel || "-"}</td>
                <td>{formatDate(item)}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!agenda.length && (
        <EmptyState
          title="Nenhum compromisso encontrado"
          caption="Cadastre o primeiro item para acompanhar a operação por aqui."
        />
      )}
    </section>
  );
}

function OrcamentosList({ orcamentos }) {
  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <span>Comercial</span>
          <h2>Lista de orçamentos</h2>
        </div>
        <span className="section-icon">R$</span>
      </div>

      <div className="quote-list">
        {orcamentos.map((item, index) => (
          <article className="quote-row" key={item.id || `${item.cliente}-${index}`}>
            <div>
              <strong>{item.cliente || item.nome || "Cliente sem nome"}</strong>
              <small>{item.servico || item.descricao || item.observacao || "Sem descrição"}</small>
            </div>
            <div className="quote-value">
              <b>{formatCurrency(moneyFromQuote(item))}</b>
              <StatusBadge status={item.status} />
            </div>
          </article>
        ))}
      </div>

      {!orcamentos.length && (
        <EmptyState
          title="Nenhum orçamento encontrado"
          caption="Os orçamentos criados na API vão aparecer nesta área."
        />
      )}
    </section>
  );
}

function KanbanPreview({ agenda, orcamentos }) {
  const columns = [
    {
      title: "Pré-venda",
      items: orcamentos.filter((item) => ["novo", "pendente", "agendado"].includes(normalizeStatus(item.status))),
    },
    {
      title: "Em negociação",
      items: orcamentos.filter((item) => ["em andamento", "em_andamento"].includes(normalizeStatus(item.status))),
    },
    {
      title: "Pós-venda",
      items: agenda.filter((item) => ["aprovado", "concluido", "concluído"].includes(normalizeStatus(item.status))),
    },
  ];

  return (
    <section className="panel kanban-panel">
      <div className="section-title">
        <div>
          <span>Pipeline</span>
          <h2>Kanban de pré-venda e pós-venda</h2>
        </div>
        <span className="section-icon">K</span>
      </div>

      <div className="kanban-grid">
        {columns.map((column) => (
          <div className="kanban-column" key={column.title}>
            <div className="kanban-header">
              <strong>{column.title}</strong>
              <span>{column.items.length}</span>
            </div>
            {column.items.slice(0, 4).map((item, index) => (
              <article className="kanban-card" key={item.id || `${column.title}-${index}`}>
                <strong>{item.cliente || item.titulo || item.nome || "Registro"}</strong>
                <StatusBadge status={item.status} />
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [agenda, setAgenda] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("verificando");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  async function carregarDados() {
    setLoading(true);
    setError("");

    try {
      const [healthPayload, agendaPayload, orcamentosPayload] = await Promise.all([
        requestApi("/health").catch(() => null),
        requestApi("/agenda"),
        requestApi("/orcamentos"),
      ]);

      setApiStatus(healthPayload ? "online" : "offline");
      setAgenda(toArray(agendaPayload));
      setOrcamentos(toArray(orcamentosPayload));
    } catch (err) {
      setApiStatus("offline");
      setError(err.message || "Não foi possível carregar os dados da API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Initial API sync when the panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarDados();
  }, []);

  const agendaFiltrada = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agenda;
    return agenda.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [agenda, search]);

  const orcamentosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orcamentos;
    return orcamentos.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [orcamentos, search]);

  const valorAberto = orcamentos.reduce((total, item) => total + Number(moneyFromQuote(item) || 0), 0);
  const tarefasPendentes = agenda.filter((item) => !["concluído", "concluido", "cancelado"].includes(normalizeStatus(item.status))).length;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>RapPanel</strong>
            <small>RapTech</small>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <a href="#dashboard" className="active">Dashboard</a>
          <a href="#agenda">Agenda</a>
          <a href="#orcamentos">Orçamentos</a>
          <a href="#kanban">Kanban</a>
        </nav>
      </aside>

      <section className="content-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">Painel operacional</span>
            <h1>Dashboard RapTech</h1>
          </div>

          <div className="topbar-actions">
            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar agenda ou orçamento"
              aria-label="Buscar agenda ou orçamento"
            />
            <button className="secondary-button" onClick={carregarDados} disabled={loading}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </header>

        {!API_TOKEN && (
          <div className="notice warning">
            Configure VITE_API_TOKEN no ambiente de produção para autenticar na API.
          </div>
        )}

        {error && <div className="notice danger">{error}</div>}

        <section className="metrics-grid" id="dashboard">
          <MetricCard
            label="API"
            value={apiStatus === "online" ? "Online" : "Offline"}
            caption={API_URL}
            accent={apiStatus === "online" ? "green" : "red"}
          />
          <MetricCard label="Agenda" value={agenda.length} caption={`${tarefasPendentes} pendentes`} accent="blue" />
          <MetricCard label="Orçamentos" value={orcamentos.length} caption="registros comerciais" accent="purple" />
          <MetricCard label="Valor em orçamento" value={formatCurrency(valorAberto)} caption="soma aproximada" accent="amber" />
        </section>

        <section className="workspace-grid" id="agenda">
          <AgendaForm onSaved={carregarDados} />
          <AgendaList agenda={agendaFiltrada} />
        </section>

        <section id="orcamentos">
          <OrcamentosList orcamentos={orcamentosFiltrados} />
        </section>

        <section id="kanban">
          <KanbanPreview agenda={agenda} orcamentos={orcamentos} />
        </section>
      </section>
    </main>
  );
}

export default App;
