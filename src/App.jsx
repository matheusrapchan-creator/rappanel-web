import { useEffect, useState } from "react";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL;
const API_TOKEN = import.meta.env.VITE_API_TOKEN;

function App() {
  const [agenda, setAgenda] = useState([]);
  const [orcamentos, setOrcamentos] = useState([]);

  const [novoItem, setNovoItem] = useState({
    titulo: "",
    tipo: "venda",
    data: "",
    hora: "",
    responsavel: "",
    cliente: "",
    status: "agendado",
    observacao: "",
  });

  async function carregarDados() {
    const headers = {
      "x-api-token": API_TOKEN,
    };

    const agendaResp = await fetch(`${API_URL}/agenda`, { headers });
    const orcResp = await fetch(`${API_URL}/orcamentos`, { headers });

    setAgenda(await agendaResp.json());
    setOrcamentos(await orcResp.json());
  }

  async function salvarAgenda(e) {
    e.preventDefault();

    await fetch(`${API_URL}/agenda`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": API_TOKEN,
      },
      body: JSON.stringify(novoItem),
    });

    setNovoItem({
      titulo: "",
      tipo: "venda",
      data: "",
      hora: "",
      responsavel: "",
      cliente: "",
      status: "agendado",
      observacao: "",
    });

    carregarDados();
  }

  useEffect(() => {
    carregarDados();
  }, []);

  return (
    <div className="page">
      <header>
        <h1>RapPanel</h1>
        <p>Gestão de agenda e orçamentos</p>
      </header>

      <section className="cards">
        <div className="card">
          <h2>{agenda.length}</h2>
          <p>Itens na agenda</p>
        </div>

        <div className="card">
          <h2>{orcamentos.length}</h2>
          <p>Orçamentos</p>
        </div>
      </section>

      <section className="form-box">
        <h2>Nova agenda</h2>

        <form onSubmit={salvarAgenda}>
          <div className="form-grid">
            <input
              placeholder="Título"
              value={novoItem.titulo}
              onChange={(e) =>
                setNovoItem({ ...novoItem, titulo: e.target.value })
              }
              required
            />

            <input
              placeholder="Cliente"
              value={novoItem.cliente}
              onChange={(e) =>
                setNovoItem({ ...novoItem, cliente: e.target.value })
              }
            />

            <input
              type="date"
              value={novoItem.data}
              onChange={(e) =>
                setNovoItem({ ...novoItem, data: e.target.value })
              }
            />

            <input
              type="time"
              value={novoItem.hora}
              onChange={(e) =>
                setNovoItem({ ...novoItem, hora: e.target.value })
              }
            />

            <input
              placeholder="Responsável"
              value={novoItem.responsavel}
              onChange={(e) =>
                setNovoItem({ ...novoItem, responsavel: e.target.value })
              }
            />

            <select
              value={novoItem.status}
              onChange={(e) =>
                setNovoItem({ ...novoItem, status: e.target.value })
              }
            >
              <option>agendado</option>
              <option>em andamento</option>
              <option>concluído</option>
              <option>cancelado</option>
            </select>
          </div>

          <textarea
            placeholder="Observação"
            value={novoItem.observacao}
            onChange={(e) =>
              setNovoItem({ ...novoItem, observacao: e.target.value })
            }
          />

          <button type="submit">Salvar agenda</button>
        </form>
      </section>

      <section className="grid">
        <div className="box">
          <h2>Agenda</h2>

          {agenda.map((item) => (
            <div className="item" key={item.id}>
              <strong>{item.titulo}</strong>
              <span>{item.data || "Sem data"} {item.hora || ""}</span>
              <p>Status: {item.status}</p>
              {item.cliente && <small>Cliente: {item.cliente}</small>}
              {item.observacao && <small>{item.observacao}</small>}
            </div>
          ))}
        </div>

        <div className="box">
          <h2>Orçamentos</h2>

          {orcamentos.map((item) => (
            <div className="item" key={item.id}>
              <strong>{item.cliente}</strong>
              <span>R$ {Number(item.valor_venda || 0).toLocaleString("pt-BR")}</span>
              <p>Status: {item.status}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
