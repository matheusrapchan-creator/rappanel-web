import { Fragment, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "https://api.raptech.com.br";
const API_TOKEN = import.meta.env.VITE_API_TOKEN || "";
const PANEL_PASSWORD = import.meta.env.VITE_PANEL_PASSWORD || "";
const FIELD_PASSWORD = import.meta.env.VITE_FIELD_PASSWORD || "";
const ACCESS_KEY = "rappanel_device_access";
const FIELD_ACCESS_KEY = "rappanel_field_device_access";
const PROJECT_FINISHED_STATUS = "finalizado";
const FIELD_RESPONSIBLES = ["marcos", "pedro"];

const initialAgenda = {
  titulo: "",
  tipo: "venda",
  data: "",
  hora: "",
  responsavel: "",
  cliente: "",
  endereco: "",
  status: "agendado",
  observacao: "",
};

const statusMap = {
  agendado: { label: "Agendado", tone: "blue" },
  novo: { label: "Novo", tone: "blue" },
  ok: { label: "OK", tone: "green" },
  pendente: { label: "Pendente", tone: "amber" },
  "em andamento": { label: "Em andamento", tone: "purple" },
  em_andamento: { label: "Em andamento", tone: "purple" },
  aprovado: { label: "Aprovado", tone: "green" },
  fechado: { label: "Fechado", tone: "green" },
  "aguardando documentação": { label: "Aguardando documentação", tone: "amber" },
  "aguardando documentacao": { label: "Aguardando documentação", tone: "amber" },
  "aguardando assinatura": { label: "Aguardando assinatura", tone: "amber" },
  "aguardando dados técnicos": { label: "Aguardando dados técnicos", tone: "purple" },
  "aguardando dados tecnicos": { label: "Aguardando dados técnicos", tone: "purple" },
  "pronto para fazer": { label: "Pronto para fazer", tone: "blue" },
  "enviado concessionaria": { label: "Enviado concessionária", tone: "purple" },
  "enviado concessionária": { label: "Enviado concessionária", tone: "purple" },
  "aguardando vistoria": { label: "Aguardando vistoria", tone: "amber" },
  finalizado: { label: "Finalizado", tone: "green" },
  entrada: { label: "Entrada", tone: "green" },
  saida: { label: "Saída", tone: "red" },
  saída: { label: "Saída", tone: "red" },
  ajuste: { label: "Ajuste", tone: "blue" },
  concluido: { label: "Concluído", tone: "green" },
  "concluído": { label: "Concluído", tone: "green" },
  cancelado: { label: "Cancelado", tone: "red" },
  recusado: { label: "Recusado", tone: "red" },
};

function normalizeStatus(status) {
  return String(status || "novo").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function wazeUrl(address) {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function moneyFromQuote(item) {
  return item.valor_venda || item.valor || item.total || item.preco || 0;
}

function isAgendaHistory(item) {
  return ["concluído", "concluido", "cancelado"].includes(normalizeStatus(item.status));
}

function isFieldAgenda(item) {
  const responsavel = normalizeText(item.responsavel);
  return Boolean(responsavel) && FIELD_RESPONSIBLES.some((name) => responsavel.includes(name));
}

function isPresidentePrudenteAgenda(item) {
  const searchable = [
    item.cidade,
    item.endereco,
    item.observacao,
    item.proxima_acao,
    item.titulo,
    item.cliente,
  ].join(" ");

  return normalizeText(searchable).includes("presidente prudente");
}

function isQuoteClosed(item) {
  return ["fechado", "aprovado", "concluído", "concluido", "cancelado", "recusado"].includes(normalizeStatus(item.status));
}

function isProjectFinished(item) {
  return normalizeStatus(item.status) === PROJECT_FINISHED_STATUS;
}

function stockQuantity(item) {
  return Number(item.quantidade_atual ?? item.quantidade ?? item.saldo ?? 0);
}

function stockUnit(item) {
  return item.unidade || "un";
}

function isLowStock(item) {
  const minimum = Number(item.estoque_minimo ?? item.minimo ?? 0);
  return minimum > 0 && stockQuantity(item) <= minimum;
}

function formatGeneration(value) {
  if (!value) return "-";
  return `${Number(value).toLocaleString("pt-BR")} kWh/mês`;
}

function quoteKey(item, index) {
  return String(item.id || `${item.cliente || "cliente"}-${index}`);
}

function groupQuotesByClient(orcamentos) {
  const groups = new Map();

  for (const item of orcamentos) {
    const cliente = (item.cliente || item.nome || "Cliente sem nome").trim();
    const key = cliente.toLowerCase();
    const current = groups.get(key) || {
      cliente,
      total: 0,
      count: 0,
      latestStatus: item.status,
      latestDate: item.atualizado_em || item.criado_em || "",
      items: [],
    };

    current.items.push(item);
    current.count += 1;
    current.total += Number(moneyFromQuote(item) || 0);

    const itemDate = item.atualizado_em || item.criado_em || "";
    if (String(itemDate) > String(current.latestDate)) {
      current.latestDate = itemDate;
      current.latestStatus = item.status;
    }

    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      average: group.count ? group.total / group.count : 0,
    }))
    .sort((a, b) => String(b.latestDate).localeCompare(String(a.latestDate)));
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

function LoginScreen({ error, password, onPasswordChange, onSubmit, title = "RapPanel", subtitle = "Acesso ao painel", placeholder = "Digite a senha do painel", buttonLabel = "Entrar neste dispositivo" }) {
  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand login-brand">
          <span className="brand-mark">R</span>
          <div>
            <strong>{title}</strong>
            <small>{subtitle}</small>
          </div>
        </div>

        <label>
          Senha de acesso
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={placeholder}
          />
        </label>

        {error && <div className="error-message">{error}</div>}

        <button className="primary-button" type="submit">
          {buttonLabel}
        </button>
      </form>
    </main>
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
          Endereço do chamado
          <input
            value={novoItem.endereco}
            onChange={(event) => updateField("endereco", event.target.value)}
            placeholder="Rua, número, bairro e cidade"
          />
        </label>

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

function AgendaList({ agenda, title = "Lista de agenda", eyebrow = "Operação", emptyTitle = "Nenhum compromisso encontrado", emptyCaption = "Cadastre o primeiro item para acompanhar a operação por aqui.", showResponsible = false }) {
  const grupos = [
    {
      title: "Presidente Prudente",
      items: agenda.filter(isPresidentePrudenteAgenda),
    },
    {
      title: "Outras cidades",
      items: agenda.filter((item) => !isPresidentePrudenteAgenda(item)),
    },
  ];

  return (
    <section className="panel table-panel">
      <div className="section-title">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="section-icon">A</span>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Compromisso</th>
              <th>Cliente</th>
              {showResponsible && <th>Responsável</th>}
              <th>Quando</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => (
              grupo.items.length ? (
                <Fragment key={grupo.title}>
                  <tr className="agenda-group-row">
                    <td colSpan={showResponsible ? 5 : 4}>{grupo.title}</td>
                  </tr>
                  {grupo.items.map((item, index) => (
                    <tr key={item.id || `${item.titulo}-${grupo.title}-${index}`}>
                      <td>
                        <strong>{item.titulo || "Compromisso"}</strong>
                        <small>{item.observacao || item.endereco || item.tipo || "Sem observação"}</small>
                      </td>
                      <td data-label="Cliente">{item.cliente || "-"}</td>
                      {showResponsible && <td data-label="Responsável">{item.responsavel || "-"}</td>}
                      <td data-label="Quando">{formatDate(item)}</td>
                      <td data-label="Status">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ) : null
            ))}
          </tbody>
        </table>
      </div>

      {!agenda.length && (
        <EmptyState
          title={emptyTitle}
          caption={emptyCaption}
        />
      )}
    </section>
  );
}

function OrcamentosList({
  orcamentos,
  onCloseQuote,
  title = "Clientes e orçamentos",
  eyebrow = "Comercial",
  emptyTitle = "Nenhum orçamento encontrado",
  emptyCaption = "Os orçamentos criados na API vão aparecer nesta área.",
}) {
  const [expandedClient, setExpandedClient] = useState("");
  const [expandedQuote, setExpandedQuote] = useState("");
  const [closingQuote, setClosingQuote] = useState("");
  const [actionError, setActionError] = useState("");
  const clientes = useMemo(() => groupQuotesByClient(orcamentos), [orcamentos]);

  async function handleCloseQuote(item) {
    if (!onCloseQuote || !item.id) return;

    setClosingQuote(String(item.id));
    setActionError("");

    try {
      await onCloseQuote(item);
    } catch (err) {
      setActionError(err.message || "Não foi possível fechar este orçamento como projeto.");
    } finally {
      setClosingQuote("");
    }
  }

  return (
    <section className="panel">
      <div className="section-title">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="section-icon">R$</span>
      </div>

      <div className="quote-list">
        {clientes.map((cliente) => (
          <article className="client-group" key={cliente.cliente}>
            <button
              className="client-row"
              type="button"
              onClick={() => setExpandedClient((current) => (current === cliente.cliente ? "" : cliente.cliente))}
            >
              <div>
                <strong>{cliente.cliente}</strong>
                <small>
                  {cliente.count} orçamento{cliente.count > 1 ? "s" : ""} enviado{cliente.count > 1 ? "s" : ""}
                </small>
              </div>
              <div className="quote-value">
                <b>{formatCurrency(cliente.average)}</b>
                <small>Média</small>
                <StatusBadge status={cliente.latestStatus} />
              </div>
            </button>

            {expandedClient === cliente.cliente && (
              <div className="client-quotes">
                <p className="client-summary">
                  Foram criados {cliente.count} orçamento{cliente.count > 1 ? "s" : ""} para {cliente.cliente}.
                </p>

                <div className="client-quotes-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Opção</th>
                        <th>Módulos</th>
                        <th>Inversor</th>
                        <th>Geração</th>
                        <th>Valor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cliente.items.map((item, index) => {
                        const key = quoteKey(item, index);
                        const isOpen = expandedQuote === key;

                        return (
                          <Fragment key={key}>
                            <tr
                              className="quote-option-row"
                              key={key}
                              onClick={() => setExpandedQuote((current) => (current === key ? "" : key))}
                            >
                              <td data-label="ID">#{item.id || index + 1}</td>
                              <td data-label="Opção">
                                <strong>{item.opcao || item.marca_modulo || "Sem opção"}</strong>
                                <small>{item.observacao || item.descricao || ""}</small>
                              </td>
                              <td data-label="Módulos">{item.modulos || "-"}</td>
                              <td data-label="Inversor">{item.inversor || "-"}</td>
                              <td data-label="Geração">{formatGeneration(item.geracao_estimada_kwh || item.geracao)}</td>
                              <td data-label="Valor">{formatCurrency(moneyFromQuote(item))}</td>
                              <td data-label="Status">
                                <StatusBadge status={item.status} />
                              </td>
                            </tr>

                            {isOpen && (
                              <tr className="quote-detail-row" key={`${key}-detail`}>
                                <td colSpan="7">
                                  <div className="quote-detail">
                                    <div className="margin-grid">
                                      <div>
                                        <span>Total Material DC</span>
                                        <strong>{formatCurrency(item.total_material_dc)}</strong>
                                      </div>
                                      <div>
                                        <span>Lucro</span>
                                        <strong>{formatCurrency(item.lucro)}</strong>
                                      </div>
                                      <div>
                                        <span>Lucro c/ desc. 5%</span>
                                        <strong>{formatCurrency(item.lucro_com_desconto_5)}</strong>
                                      </div>
                                      <div>
                                        <span>Margem</span>
                                        <strong>{item.margem_percentual ? `${item.margem_percentual}%` : "-"}</strong>
                                      </div>
                                    </div>

                                    <div className="detail-table-wrapper">
                                      <table className="detail-table">
                                        <thead>
                                          <tr>
                                            <th>Item</th>
                                            <th>Cálculo</th>
                                            <th>Valor</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {(Array.isArray(item.detalhamento) ? item.detalhamento : []).map((row, rowIndex) => (
                                            <tr key={`${key}-detail-${rowIndex}`}>
                                              <td data-label="Item">{row.item || "-"}</td>
                                              <td data-label="Cálculo">{row.calculo || "-"}</td>
                                              <td data-label="Valor">{formatCurrency(row.valor)}</td>
                                            </tr>
                                          ))}
                                          {!Array.isArray(item.detalhamento) || !item.detalhamento.length ? (
                                            <tr>
                                              <td colSpan="3">Sem detalhamento de margem neste orçamento.</td>
                                            </tr>
                                          ) : null}
                                        </tbody>
                                      </table>
                                    </div>

                                    {onCloseQuote && !isQuoteClosed(item) && (
                                      <div className="quote-actions">
                                        <button
                                          className="primary-button compact-button"
                                          type="button"
                                          disabled={closingQuote === String(item.id)}
                                          onClick={() => handleCloseQuote(item)}
                                        >
                                          {closingQuote === String(item.id) ? "Fechando..." : "Fechar projeto com este orçamento"}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {actionError && <div className="error-message">{actionError}</div>}

      {!clientes.length && (
        <EmptyState
          title={emptyTitle}
          caption={emptyCaption}
        />
      )}
    </section>
  );
}

function ProjetosList({ projetos, orcamentos = [], title = "Projetos fechados", eyebrow = "Implantação", emptyTitle = "Nenhum projeto fechado", emptyCaption = "Quando um orçamento for fechado, o projeto aparecerá nesta área." }) {
  const orcamentosPorId = useMemo(() => {
    const items = new Map();
    orcamentos.forEach((orcamento) => {
      if (orcamento.id) items.set(Number(orcamento.id), orcamento);
    });
    return items;
  }, [orcamentos]);

  return (
    <section className="panel project-panel">
      <div className="section-title">
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <span className="section-icon">P</span>
      </div>

      <div className="project-list">
        {projetos.map((projeto) => {
          const orcamento = orcamentosPorId.get(Number(projeto.orcamento_id));

          return (
            <article className="project-row" key={projeto.id || `${projeto.cliente}-${projeto.orcamento_id}`}>
              <div>
                <strong>{projeto.cliente || "Cliente sem nome"}</strong>
                <small>
                  Orçamento #{projeto.orcamento_id || "-"}
                  {orcamento?.opcao ? ` · ${orcamento.opcao}` : ""}
                  {projeto.observacao ? ` · ${projeto.observacao}` : ""}
                </small>
                {orcamento && (
                  <div className="project-equipment">
                    <span>{orcamento.modulos || "-"} módulos</span>
                    <span>{orcamento.marca_modulo || orcamento.modulo_nome || "Módulo sem marca"}</span>
                    <span>{orcamento.inversor || "Inversor não informado"}</span>
                    <span>{formatGeneration(orcamento.geracao_estimada_kwh || orcamento.geracao)}</span>
                  </div>
                )}
              </div>
              <div className="project-status">
                <StatusBadge status={projeto.status} />
                <small>{formatDate({ data: projeto.atualizado_em || projeto.criado_em })}</small>
              </div>
            </article>
          );
        })}
      </div>

      {!projetos.length && (
        <EmptyState
          title={emptyTitle}
          caption={emptyCaption}
        />
      )}
    </section>
  );
}

function EstoquePage({ itens, movimentacoes }) {
  const baixoEstoque = itens.filter(isLowStock);

  return (
    <section className="stock-layout" id="estoque">
      <section className="panel table-panel">
        <div className="section-title">
          <div>
            <span>Estoque</span>
            <h2>Controle de estoque</h2>
          </div>
          <span className="section-icon">E</span>
        </div>

        {baixoEstoque.length > 0 && (
          <div className="notice warning stock-warning">
            {baixoEstoque.length} item{baixoEstoque.length > 1 ? "s" : ""} abaixo ou no estoque mínimo.
          </div>
        )}

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th>Saldo</th>
                <th>Mínimo</th>
                <th>Local</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id || item.nome}>
                  <td>
                    <strong>{item.nome || "Item sem nome"}</strong>
                    <small>{item.observacao || item.descricao || "Sem observação"}</small>
                  </td>
                  <td data-label="Categoria">{item.categoria || "-"}</td>
                  <td data-label="Saldo">
                    {stockQuantity(item).toLocaleString("pt-BR")} {stockUnit(item)}
                  </td>
                  <td data-label="Mínimo">
                    {Number(item.estoque_minimo ?? item.minimo ?? 0).toLocaleString("pt-BR")} {stockUnit(item)}
                  </td>
                  <td data-label="Local">{item.localizacao || item.local || "-"}</td>
                  <td data-label="Status">
                    <StatusBadge status={isLowStock(item) ? "pendente" : "ok"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!itens.length && (
          <EmptyState
            title="Nenhum item de estoque"
            caption="Os itens cadastrados pela skill aparecerão aqui."
          />
        )}
      </section>

      <section className="panel project-panel">
        <div className="section-title">
          <div>
            <span>Movimentações</span>
            <h2>Últimas entradas e saídas</h2>
          </div>
          <span className="section-icon">M</span>
        </div>

        <div className="project-list">
          {movimentacoes.slice(0, 12).map((movimento) => (
            <article className="project-row" key={movimento.id || `${movimento.produto_id}-${movimento.criado_em}`}>
              <div>
                <strong>{movimento.nome || movimento.produto_nome || `Item #${movimento.produto_id || "-"}`}</strong>
                <small>
                  {movimento.motivo || movimento.observacao || "Sem observação"}
                  {movimento.projeto_id ? ` · Projeto #${movimento.projeto_id}` : ""}
                </small>
              </div>
              <div className="project-status">
                <StatusBadge status={movimento.tipo || "novo"} />
                <small>
                  {Number(movimento.quantidade || 0).toLocaleString("pt-BR")} {movimento.unidade || ""}
                </small>
              </div>
            </article>
          ))}
        </div>

        {!movimentacoes.length && (
          <EmptyState
            title="Nenhuma movimentação"
            caption="Entradas e saídas registradas pela skill aparecerão aqui."
          />
        )}
      </section>
    </section>
  );
}

function FieldAgendaPage({ agenda, loading, error, onRefresh, onUpdateStatus, onLogout }) {
  const [updatingId, setUpdatingId] = useState("");
  const grupos = [
    {
      title: "Presidente Prudente",
      items: agenda.filter(isPresidentePrudenteAgenda),
    },
    {
      title: "Outras cidades",
      items: agenda.filter((item) => !isPresidentePrudenteAgenda(item)),
    },
  ];

  async function updateStatus(item, status) {
    const actionLabel = status === "concluído" ? "concluir" : "marcar como em andamento";
    const confirmed = window.confirm(`Confirmar ${actionLabel} esta atividade?\n\n${item.titulo || "Compromisso"} - ${item.cliente || "Sem cliente"}`);

    if (!confirmed) return;

    setUpdatingId(String(item.id));

    try {
      await onUpdateStatus(item, status);
    } finally {
      setUpdatingId("");
    }
  }

  return (
    <main className="field-shell">
      <header className="field-header">
        <div>
          <span className="eyebrow">Equipe de campo</span>
          <h1>Agenda de hoje</h1>
        </div>
        <div className="field-actions">
          <button className="ghost-button" type="button" onClick={onRefresh} disabled={loading}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          {FIELD_PASSWORD && (
            <button className="ghost-button" type="button" onClick={onLogout}>
              Sair
            </button>
          )}
        </div>
      </header>

      {error && <div className="notice danger">{error}</div>}

      <section className="field-list">
        {grupos.map((grupo) => (
          grupo.items.length ? (
            <Fragment key={grupo.title}>
              <div className="field-group-title">{grupo.title}</div>
              {grupo.items.map((item) => (
                <article className="field-card" key={item.id}>
                  <div className="field-card-head">
                    <div>
                      <strong>{item.titulo || "Compromisso"}</strong>
                      <small>{formatDate(item)}</small>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>

                  <div className="field-info">
                    <span>Cliente</span>
                    <strong>{item.cliente || "-"}</strong>
                  </div>

                  <div className="field-info">
                    <span>Responsável</span>
                    <strong>{item.responsavel || "-"}</strong>
                  </div>

                  {(item.endereco || item.observacao) && (
                    <div className="field-note">
                      {item.endereco && (
                        <div className="field-address">
                          <div>
                            <span>Endereço</span>
                            <strong>{item.endereco}</strong>
                          </div>
                          <a
                            className="field-map-link"
                            href={wazeUrl(item.endereco)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Waze
                          </a>
                        </div>
                      )}
                      {item.observacao && <span>{item.observacao}</span>}
                    </div>
                  )}

                  <div className="field-card-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={updatingId === String(item.id)}
                      onClick={() => updateStatus(item, "em andamento")}
                    >
                      Em andamento
                    </button>
                    <button
                      className="primary-button compact-button"
                      type="button"
                      disabled={updatingId === String(item.id)}
                      onClick={() => updateStatus(item, "concluído")}
                    >
                      Concluir
                    </button>
                  </div>
                </article>
              ))}
            </Fragment>
          ) : null
        ))}
      </section>

      {!agenda.length && (
        <EmptyState
          title="Nenhuma atividade atribuída"
          caption="Apenas atividades com responsável Marcos ou Pedro aparecem aqui."
        />
      )}
    </main>
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
  const isFieldMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("campo") === "1" || window.location.pathname.replace(/\/+$/, "") === "/campo";
  }, []);
  const [isAuthenticated, setIsAuthenticated] = useState(() => !PANEL_PASSWORD || localStorage.getItem(ACCESS_KEY) === "granted");
  const [isFieldAuthenticated, setIsFieldAuthenticated] = useState(() => !FIELD_PASSWORD || localStorage.getItem(FIELD_ACCESS_KEY) === "granted");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [fieldLoginPassword, setFieldLoginPassword] = useState("");
  const [fieldLoginError, setFieldLoginError] = useState("");
  const [agenda, setAgenda] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);
  const [projetos, setProjetos] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [movimentacoesEstoque, setMovimentacoesEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState("verificando");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const isTvMode = useMemo(() => new URLSearchParams(window.location.search).get("tv") === "1", []);

  const canLoadData = isFieldMode ? isFieldAuthenticated : isAuthenticated;

  async function carregarDados(options = {}) {
    if (!options.silent) setLoading(true);
    setError("");

    try {
      const [healthPayload, agendaPayload, orcamentosPayload, projetosPayload, estoquePayload, movimentacoesPayload] = await Promise.all([
        requestApi("/health").catch(() => null),
        requestApi("/agenda"),
        requestApi("/orcamentos"),
        requestApi("/projetos").catch(() => []),
        requestApi("/estoque").catch(() => []),
        requestApi("/estoque/movimentacoes").catch(() => []),
      ]);

      setApiStatus(healthPayload ? "online" : "offline");
      setAgenda(toArray(agendaPayload));
      setOrcamentos(toArray(orcamentosPayload));
      setProjetos(toArray(projetosPayload));
      setEstoque(toArray(estoquePayload));
      setMovimentacoesEstoque(toArray(movimentacoesPayload));
    } catch (err) {
      setApiStatus("offline");
      setError(err.message || "Não foi possível carregar os dados da API.");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (!canLoadData) return undefined;

    // Initial API sync when the panel opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregarDados();

    const intervalId = window.setInterval(() => {
      carregarDados({ silent: true });
    }, 30000);

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        carregarDados({ silent: true });
      }
    }

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [canLoadData]);

  function handleLogin(event) {
    event.preventDefault();

    if (loginPassword === PANEL_PASSWORD) {
      localStorage.setItem(ACCESS_KEY, "granted");
      setIsAuthenticated(true);
      setLoginError("");
      setLoginPassword("");
      return;
    }

    setLoginError("Senha inválida.");
  }

  function handleLogout() {
    localStorage.removeItem(ACCESS_KEY);
    setIsAuthenticated(!PANEL_PASSWORD);
  }

  function handleFieldLogin(event) {
    event.preventDefault();

    if (fieldLoginPassword === FIELD_PASSWORD) {
      localStorage.setItem(FIELD_ACCESS_KEY, "granted");
      setIsFieldAuthenticated(true);
      setFieldLoginError("");
      setFieldLoginPassword("");
      return;
    }

    setFieldLoginError("Senha inválida.");
  }

  function handleFieldLogout() {
    localStorage.removeItem(FIELD_ACCESS_KEY);
    setIsFieldAuthenticated(!FIELD_PASSWORD);
  }

  async function atualizarStatusAgenda(item, status) {
    await requestApi(`/agenda/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
        motivo_status: `Atualizado pela equipe de campo para ${status}`,
      }),
    });

    await carregarDados({ silent: true });
  }

  async function fecharOrcamentoComoProjeto(orcamento) {
    await requestApi(`/orcamentos/${orcamento.id}/fechar`, {
      method: "POST",
      body: JSON.stringify({
        status: "aguardando documentação",
        observacao: `Projeto fechado a partir do orçamento #${orcamento.id}`,
      }),
    });

    await carregarDados({ silent: true });
  }

  const agendaFiltrada = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return agenda;
    return agenda.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [agenda, search]);

  const agendaAtiva = useMemo(() => agendaFiltrada.filter((item) => !isAgendaHistory(item)), [agendaFiltrada]);
  const historicoAgenda = useMemo(() => agendaFiltrada.filter(isAgendaHistory), [agendaFiltrada]);
  const agendaCampo = useMemo(() => (
    agenda
      .filter((item) => !isAgendaHistory(item))
      .filter(isFieldAgenda)
      .sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")) || String(a.hora || "").localeCompare(String(b.hora || "")))
  ), [agenda]);

  const orcamentosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orcamentos;
    return orcamentos.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [orcamentos, search]);

  const projetosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projetos;
    return projetos.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [projetos, search]);

  const estoqueFiltrado = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return estoque;
    return estoque.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [estoque, search]);

  const movimentacoesFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return movimentacoesEstoque;
    return movimentacoesEstoque.filter((item) => JSON.stringify(item).toLowerCase().includes(term));
  }, [movimentacoesEstoque, search]);

  const orcamentosEmAberto = useMemo(() => (
    orcamentosFiltrados.filter((item) => !isQuoteClosed(item))
  ), [orcamentosFiltrados]);
  const orcamentosFechados = useMemo(() => (
    orcamentosFiltrados.filter(isQuoteClosed)
  ), [orcamentosFiltrados]);
  const projetosAtivos = useMemo(() => projetosFiltrados.filter((item) => !isProjectFinished(item)), [projetosFiltrados]);
  const projetosFinalizados = useMemo(() => projetosFiltrados.filter(isProjectFinished), [projetosFiltrados]);
  const clientesAgrupados = useMemo(() => groupQuotesByClient(orcamentosEmAberto), [orcamentosEmAberto]);
  const clientesComOrcamento = clientesAgrupados.length;
  const valorAberto = clientesAgrupados.reduce((total, cliente) => total + cliente.average, 0);

  if (isFieldMode && !isFieldAuthenticated) {
    return (
      <LoginScreen
        title="RapPanel Campo"
        subtitle="Acesso da equipe externa"
        placeholder="Digite a senha da equipe de campo"
        buttonLabel="Entrar neste celular"
        error={fieldLoginError}
        password={fieldLoginPassword}
        onPasswordChange={setFieldLoginPassword}
        onSubmit={handleFieldLogin}
      />
    );
  }

  if (isFieldMode) {
    return (
      <FieldAgendaPage
        agenda={agendaCampo}
        loading={loading}
        error={error}
        onRefresh={() => carregarDados()}
        onUpdateStatus={atualizarStatusAgenda}
        onLogout={handleFieldLogout}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        error={loginError}
        password={loginPassword}
        onPasswordChange={setLoginPassword}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <main className={`app-shell ${isTvMode ? "tv-mode" : ""}`}>
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
          <a href="#historico-agenda">Histórico</a>
          <a href="#orcamentos">Orçamentos</a>
          <a href="#orcamentos-fechados">Fechados</a>
          <a href="#projetos">Projetos</a>
          <a href="#projetos-finalizados">Finalizados</a>
          <a href="#estoque">Estoque</a>
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
            {PANEL_PASSWORD && (
              <button className="ghost-button" onClick={handleLogout} type="button">
                Sair
              </button>
            )}
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
          <MetricCard label="Agenda" value={agendaAtiva.length} caption={`${historicoAgenda.length} no histórico`} accent="blue" />
          <MetricCard label="Orçamentos abertos" value={clientesComOrcamento} caption={`${orcamentosEmAberto.length} opções em negociação`} accent="purple" />
          <MetricCard label="Projetos" value={projetosAtivos.length} caption={`${projetosFinalizados.length} finalizados`} accent="green" />
          <MetricCard label="Valor em orçamento" value={formatCurrency(valorAberto)} caption="média por cliente" accent="amber" />
        </section>

        <section className="workspace-grid" id="agenda">
          {!isTvMode && <AgendaForm onSaved={carregarDados} />}
          <AgendaList agenda={isTvMode ? agendaAtiva.slice(0, 15) : agendaAtiva} showResponsible={isTvMode} />
        </section>

        {!isTvMode && (
          <section id="historico-agenda">
            <AgendaList
              agenda={historicoAgenda}
              eyebrow="Histórico"
              title="Histórico da agenda"
              emptyTitle="Nenhum item no histórico"
              emptyCaption="Compromissos concluídos ou cancelados serão mantidos aqui."
            />
          </section>
        )}

        <section id="orcamentos">
          <OrcamentosList
            orcamentos={orcamentosEmAberto}
            onCloseQuote={isTvMode ? null : fecharOrcamentoComoProjeto}
          />
        </section>

        {!isTvMode && (
          <section id="orcamentos-fechados">
            <OrcamentosList
              orcamentos={orcamentosFechados}
              title="Orçamentos fechados"
              eyebrow="Histórico comercial"
              emptyTitle="Nenhum orçamento fechado"
              emptyCaption="Quando uma proposta virar projeto, ela ficará disponível aqui para consulta."
            />
          </section>
        )}

        <section id="projetos">
          <ProjetosList projetos={projetosAtivos} orcamentos={orcamentos} />
        </section>

        {!isTvMode && (
          <section id="projetos-finalizados">
            <ProjetosList
              projetos={projetosFinalizados}
              orcamentos={orcamentos}
              eyebrow="Histórico"
              title="Projetos finalizados"
              emptyTitle="Nenhum projeto finalizado"
              emptyCaption="Projetos com status finalizado serão mantidos aqui."
            />
          </section>
        )}

        {!isTvMode && (
          <EstoquePage
            itens={estoqueFiltrado}
            movimentacoes={movimentacoesFiltradas}
          />
        )}

        {!isTvMode && (
          <section id="kanban">
            <KanbanPreview agenda={agenda} orcamentos={orcamentos} />
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
