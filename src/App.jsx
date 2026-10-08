import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

const emptyData = {
  mezzi: [],
  operatori: [],
  rifornimenti: [],
  manutenzioni: [],
  documenti: [],
};

const today = () => new Date().toISOString().split("T")[0];

const formatDate = (date) => {
  if (!date) return "-";
  return new Date(`${date}T00:00:00`).toLocaleDateString("it-IT");
};

const formatNumber = (value) =>
  Number(value || 0).toLocaleString("it-IT", {
    maximumFractionDigits: 2,
  });

const money = (value) =>
  Number(value || 0).toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
  });

function getScadenzaStato(data) {
  if (!data) return "Nessuna data";

  const oggi = new Date();
  const scadenza = new Date(`${data}T00:00:00`);
  const giorni = Math.ceil(
    (scadenza - oggi) / (1000 * 60 * 60 * 24)
  );

  if (giorni < 0) return "Scaduto";
  if (giorni <= 7) return "Urgente";
  if (giorni <= 30) return "In scadenza";
  return "Valido";
}

function statoClass(stato) {
  if (stato === "Scaduto") return "danger";
  if (stato === "Urgente") return "danger";
  if (stato === "In scadenza") return "warning";
  if (stato === "Valido") return "success";
  if (stato === "Attivo") return "success";
  return "neutral";
}

function App() {
  const [data, setData] = useState(emptyData);
  const [pagina, setPagina] = useState("dashboard");
  const [ricerca, setRicerca] = useState("");
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({});

  useEffect(() => {
    caricaDati();
  }, []);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function caricaDati() {
    setLoading(true);

    const [
      mezziRes,
      operatoriRes,
      rifornimentiRes,
      manutenzioniRes,
      documentiRes,
    ] = await Promise.all([
      supabase.from("mezzi").select("*").order("id", { ascending: false }),
      supabase
        .from("operatori")
        .select("*")
        .order("cognome", { ascending: true }),
      supabase
        .from("rifornimenti")
        .select("*, mezzi(targa, marca, modello), operatori(nome, cognome)")
        .order("data", { ascending: false }),
      supabase
        .from("manutenzioni")
        .select("*, mezzi(targa, marca, modello)")
        .order("data", { ascending: false }),
      supabase
        .from("documenti")
        .select("*, mezzi(targa, marca, modello)")
        .order("data_scadenza", { ascending: true }),
    ]);

    if (mezziRes.error) console.error(mezziRes.error);
    if (operatoriRes.error) console.error(operatoriRes.error);
    if (rifornimentiRes.error) console.error(rifornimentiRes.error);
    if (manutenzioniRes.error) console.error(manutenzioniRes.error);
    if (documentiRes.error) console.error(documentiRes.error);

    setData({
      mezzi: mezziRes.data || [],
      operatori: operatoriRes.data || [],
      rifornimenti: rifornimentiRes.data || [],
      manutenzioni: manutenzioniRes.data || [],
      documenti: documentiRes.data || [],
    });

    setLoading(false);
  }

  function apriModal(tipo, elemento = null) {
    setSelected(elemento);

    if (tipo === "mezzo") {
      setForm(
        elemento
          ? { ...elemento }
          : {
              targa: "",
              marca: "",
              modello: "",
              anno: "",
              km: "",
              utilizzatore: "",
              alimentazione: "Diesel",
              stato: "Attivo",
            }
      );
    }

    if (tipo === "carburante") {
      setForm({
        mezzo_id: elemento?.id || "",
        operatore_id: "",
        data: today(),
        km: elemento?.km || "",
        litri: "",
        prezzo_litro: "",
        costo_totale: "",
        firma: "",
      });
    }

    if (tipo === "manutenzione") {
      setForm({
        mezzo_id: "",
        data: today(),
        tipo: "Ordinaria",
        descrizione: "",
        km: "",
        costo: "",
        officina: "",
      });
    }

    if (tipo === "documento") {
      setForm({
        mezzo_id: "",
        tipo: "Assicurazione",
        numero: "",
        data_emissione: today(),
        data_scadenza: "",
        note: "",
        file_url: "",
      });
    }

    setModal(tipo);
  }

  function chiudiModal() {
    setModal(null);
    setSelected(null);
    setForm({});
  }

  function aggiornaForm(campo, valore) {
    setForm((prev) => ({
      ...prev,
      [campo]: valore,
    }));
  }

  async function salvaMezzo() {
    if (!form.targa) {
      setToast("Inserisci la targa");
      return;
    }

    const payload = {
      targa: form.targa.toUpperCase().trim(),
      marca: form.marca,
      modello: form.modello,
      anno: form.anno ? Number(form.anno) : null,
      km: form.km ? Number(form.km) : 0,
      utilizzatore: form.utilizzatore,
      alimentazione: form.alimentazione,
      stato: form.stato,
    };

    let result;

    if (selected?.id) {
      result = await supabase
        .from("mezzi")
        .update(payload)
        .eq("id", selected.id);
    } else {
      result = await supabase.from("mezzi").insert(payload);
    }

    if (result.error) {
      console.error(result.error);
      setToast("Errore nel salvataggio del mezzo");
      return;
    }

    await caricaDati();
    chiudiModal();
    setToast("Mezzo salvato correttamente");
  }

  async function eliminaMezzo(id) {
    if (
      !window.confirm(
        "Vuoi davvero eliminare questo mezzo? Verranno eliminati anche i dati collegati."
      )
    ) {
      return;
    }

    const { error } = await supabase
      .from("mezzi")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast("Errore durante l'eliminazione");
      return;
    }

    await caricaDati();
    setToast("Mezzo eliminato");
  }

  async function salvaRifornimento() {
    if (!form.mezzo_id || !form.km || !form.litri) {
      setToast("Compila mezzo, KM e litri");
      return;
    }

    const litri = Number(form.litri);
    const prezzo = Number(form.prezzo_litro || 0);

    const payload = {
      mezzo_id: Number(form.mezzo_id),
      operatore_id: form.operatore_id
        ? Number(form.operatore_id)
        : null,
      data: form.data || today(),
      km: Number(form.km),
      litri,
      prezzo_litro: prezzo || null,
      costo_totale: prezzo ? litri * prezzo : null,
      firma: form.firma || null,
    };

    const { error } = await supabase
      .from("rifornimenti")
      .insert(payload);

    if (error) {
      console.error(error);
      setToast("Errore nel salvataggio del rifornimento");
      return;
    }

    await supabase
      .from("mezzi")
      .update({ km: Number(form.km) })
      .eq("id", Number(form.mezzo_id));

    await caricaDati();
    chiudiModal();
    setToast("Rifornimento registrato");
  }

  async function eliminaRifornimento(id) {
    if (!window.confirm("Eliminare questo rifornimento?")) return;

    const { error } = await supabase
      .from("rifornimenti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast("Errore durante l'eliminazione");
      return;
    }

    await caricaDati();
    setToast("Rifornimento eliminato");
  }

  async function salvaManutenzione() {
    if (!form.mezzo_id || !form.tipo) {
      setToast("Seleziona il mezzo e il tipo di manutenzione");
      return;
    }

    const payload = {
      mezzo_id: Number(form.mezzo_id),
      data: form.data || today(),
      tipo: form.tipo,
      descrizione: form.descrizione,
      km: form.km ? Number(form.km) : null,
      costo: Number(form.costo || 0),
      officina: form.officina,
    };

    const { error } = await supabase
      .from("manutenzioni")
      .insert(payload);

    if (error) {
      console.error(error);
      setToast("Errore nel salvataggio della manutenzione");
      return;
    }

    await caricaDati();
    chiudiModal();
    setToast("Manutenzione registrata");
  }

  async function eliminaManutenzione(id) {
    if (!window.confirm("Eliminare questa manutenzione?")) return;

    const { error } = await supabase
      .from("manutenzioni")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast("Errore durante l'eliminazione");
      return;
    }

    await caricaDati();
    setToast("Manutenzione eliminata");
  }

  async function salvaDocumento() {
    if (!form.mezzo_id || !form.tipo || !form.data_scadenza) {
      setToast("Compila mezzo, tipo e data di scadenza");
      return;
    }

    const payload = {
      mezzo_id: Number(form.mezzo_id),
      tipo: form.tipo,
      numero: form.numero,
      data_emissione: form.data_emissione || null,
      data_scadenza: form.data_scadenza,
      note: form.note,
      file_url: form.file_url || null,
    };

    const { error } = await supabase
      .from("documenti")
      .insert(payload);

    if (error) {
      console.error(error);
      setToast("Errore nel salvataggio del documento");
      return;
    }

    await caricaDati();
    chiudiModal();
    setToast("Documento registrato");
  }

  async function eliminaDocumento(id) {
    if (!window.confirm("Eliminare questo documento?")) return;

    const { error } = await supabase
      .from("documenti")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setToast("Errore durante l'eliminazione");
      return;
    }

    await caricaDati();
    setToast("Documento eliminato");
  }

  const mezziFiltrati = useMemo(() => {
    const q = ricerca.toLowerCase().trim();

    if (!q) return data.mezzi;

    return data.mezzi.filter((m) =>
      [
        m.targa,
        m.marca,
        m.modello,
        m.utilizzatore,
        m.alimentazione,
        m.stato,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data.mezzi, ricerca]);

  const rifornimentiFiltrati = useMemo(() => {
    const q = ricerca.toLowerCase().trim();

    if (!q) return data.rifornimenti;

    return data.rifornimenti.filter((r) =>
      [
        r.mezzi?.targa,
        r.mezzi?.marca,
        r.mezzi?.modello,
        r.operatori?.nome,
        r.operatori?.cognome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data.rifornimenti, ricerca]);

  const manutenzioniFiltrate = useMemo(() => {
    const q = ricerca.toLowerCase().trim();

    if (!q) return data.manutenzioni;

    return data.manutenzioni.filter((m) =>
      [
        m.mezzi?.targa,
        m.tipo,
        m.descrizione,
        m.officina,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data.manutenzioni, ricerca]);

  const documentiFiltrati = useMemo(() => {
    const q = ricerca.toLowerCase().trim();

    if (!q) return data.documenti;

    return data.documenti.filter((d) =>
      [
        d.mezzi?.targa,
        d.tipo,
        d.numero,
        d.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [data.documenti, ricerca]);

  const scadenze = useMemo(() => {
    return [...data.documenti].sort(
      (a, b) =>
        new Date(a.data_scadenza) -
        new Date(b.data_scadenza)
    );
  }, [data.documenti]);

  const statistiche = useMemo(() => {
    const totaleCarburante = data.rifornimenti.reduce(
      (sum, r) => sum + Number(r.costo_totale || 0),
      0
    );

    const totaleLitri = data.rifornimenti.reduce(
      (sum, r) => sum + Number(r.litri || 0),
      0
    );

    const totaleManutenzioni = data.manutenzioni.reduce(
      (sum, m) => sum + Number(m.costo || 0),
      0
    );

    const scaduti = data.documenti.filter(
      (d) => getScadenzaStato(d.data_scadenza) === "Scaduto"
    ).length;

    const urgenti = data.documenti.filter(
      (d) => getScadenzaStato(d.data_scadenza) === "Urgente"
    ).length;

    return {
      mezzi: data.mezzi.length,
      rifornimenti: data.rifornimenti.length,
      litri: totaleLitri,
      carburante: totaleCarburante,
      manutenzioni: totaleManutenzioni,
      documenti: data.documenti.length,
      scaduti,
      urgenti,
      costiTotali: totaleCarburante + totaleManutenzioni,
    };
  }, [data]);

  function vai(paginaNuova) {
    setPagina(paginaNuova);
    setRicerca("");
  }

  function titoloPagina() {
    const titoli = {
      dashboard: "Dashboard",
      mezzi: "Gestione Mezzi",
      carburante: "Rifornimenti",
      manutenzioni: "Manutenzioni",
      documenti: "Documenti",
      scadenze: "Scadenze",
      report: "Report",
    };

    return titoli[pagina] || "Gestione Mezzi";
  }

  function esportaCSV(tipo) {
    let rows = [];
    let filename = "export.csv";

    if (tipo === "mezzi") {
      rows = data.mezzi.map((m) => ({
        Targa: m.targa,
        Marca: m.marca,
        Modello: m.modello,
        Anno: m.anno,
        KM: m.km,
        Utilizzatore: m.utilizzatore,
        Alimentazione: m.alimentazione,
        Stato: m.stato,
      }));

      filename = "mezzi.csv";
    }

    if (tipo === "rifornimenti") {
      rows = data.rifornimenti.map((r) => ({
        Data: r.data,
        Targa: r.mezzi?.targa || "",
        Operatore: `${r.operatori?.nome || ""} ${
          r.operatori?.cognome || ""
        }`,
        KM: r.km,
        Litri: r.litri,
        PrezzoLitro: r.prezzo_litro,
        Costo: r.costo_totale,
      }));

      filename = "rifornimenti.csv";
    }

    if (tipo === "manutenzioni") {
      rows = data.manutenzioni.map((m) => ({
        Data: m.data,
        Targa: m.mezzi?.targa || "",
        Tipo: m.tipo,
        Descrizione: m.descrizione,
        KM: m.km,
        Costo: m.costo,
        Officina: m.officina,
      }));

      filename = "manutenzioni.csv";
    }

    if (tipo === "documenti") {
      rows = data.documenti.map((d) => ({
        Targa: d.mezzi?.targa || "",
        Tipo: d.tipo,
        Numero: d.numero,
        Emissione: d.data_emissione,
        Scadenza: d.data_scadenza,
        Stato: getScadenzaStato(d.data_scadenza),
        Note: d.note,
      }));

      filename = "documenti.csv";
    }

    if (!rows.length) {
      setToast("Nessun dato da esportare");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csv = [
      headers.join(";"),
      ...rows.map((row) =>
        headers
          .map((h) =>
            `"${String(row[h] ?? "")
              .replaceAll('"', '""')
              .replaceAll("\n", " ")}"`
          )
          .join(";")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    setToast("Esportazione completata");
  }

  function stampa() {
    window.print();
  }

  function renderDashboard() {
    const ultime = data.rifornimenti.slice(0, 5);
    const prossime = scadenze.slice(0, 5);

    return (
      <>
        <div className="page-header">
          <div>
            <h1>Dashboard</h1>
            <p>Panoramica della gestione del parco mezzi</p>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🚚</div>
            <div>
              <span>Mezzi</span>
              <strong>{statistiche.mezzi}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⛽</div>
            <div>
              <span>Rifornimenti</span>
              <strong>{statistiche.rifornimenti}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📄</div>
            <div>
              <span>Documenti</span>
              <strong>{statistiche.documenti}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚠️</div>
            <div>
              <span>Scadenze critiche</span>
              <strong>
                {statistiche.scaduti + statistiche.urgenti}
              </strong>
            </div>
          </div>
        </div>

        <div className="stats-grid secondary">
          <div className="summary-card">
            <span>Litri erogati</span>
            <strong>{formatNumber(statistiche.litri)} L</strong>
          </div>

          <div className="summary-card">
            <span>Costo carburante</span>
            <strong>{money(statistiche.carburante)}</strong>
          </div>

          <div className="summary-card">
            <span>Costo manutenzioni</span>
            <strong>{money(statistiche.manutenzioni)}</strong>
          </div>

          <div className="summary-card">
            <span>Costi complessivi</span>
            <strong>{money(statistiche.costiTotali)}</strong>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Ultimi rifornimenti</h2>
                <p>Attività più recenti</p>
              </div>

              <button
                className="btn secondary"
                onClick={() => vai("carburante")}
              >
                Vedi tutti
              </button>
            </div>

            {ultime.length === 0 ? (
              <div className="empty">Nessun rifornimento registrato.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Targa</th>
                      <th>KM</th>
                      <th>Litri</th>
                      <th>Costo</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ultime.map((r) => (
                      <tr key={r.id}>
                        <td>{formatDate(r.data)}</td>
                        <td>
                          <strong>{r.mezzi?.targa || "-"}</strong>
                        </td>
                        <td>{formatNumber(r.km)}</td>
                        <td>{formatNumber(r.litri)} L</td>
                        <td>{money(r.costo_totale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Prossime scadenze</h2>
                <p>Documenti da controllare</p>
              </div>

              <button
                className="btn secondary"
                onClick={() => vai("scadenze")}
              >
                Vedi tutte
              </button>
            </div>

            {prossime.length === 0 ? (
              <div className="empty">Nessuna scadenza presente.</div>
            ) : (
              <div className="deadline-list">
                {prossime.map((d) => {
                  const stato = getScadenzaStato(
                    d.data_scadenza
                  );

                  return (
                    <div className="deadline-item" key={d.id}>
                      <div>
                        <strong>{d.tipo}</strong>
                        <span>{d.mezzi?.targa || "-"}</span>
                      </div>

                      <div className="deadline-right">
                        <span>{formatDate(d.data_scadenza)}</span>
                        <span
                          className={`badge ${statoClass(
                            stato
                          )}`}
                        >
                          {stato}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </>
    );
  }

  function renderMezzi() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Gestione Mezzi</h1>
            <p>Gestisci il parco mezzi aziendale</p>
          </div>

          <button
            className="btn primary"
            onClick={() => apriModal("mezzo")}
          >
            + Nuovo mezzo
          </button>
        </div>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Cerca targa, marca, modello..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />

          <button
            className="btn secondary"
            onClick={() => esportaCSV("mezzi")}
          >
            Esporta CSV
          </button>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Targa</th>
                  <th>Veicolo</th>
                  <th>Anno</th>
                  <th>KM</th>
                  <th>Utilizzatore</th>
                  <th>Alimentazione</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {mezziFiltrati.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.targa}</strong>
                    </td>
                    <td>
                      {m.marca} {m.modello}
                    </td>
                    <td>{m.anno || "-"}</td>
                    <td>{formatNumber(m.km)}</td>
                    <td>{m.utilizzatore || "-"}</td>
                    <td>{m.alimentazione || "-"}</td>
                    <td>
                      <span
                        className={`badge ${statoClass(
                          m.stato
                        )}`}
                      >
                        {m.stato}
                      </span>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="btn small"
                          onClick={() =>
                            apriModal("mezzo", m)
                          }
                        >
                          Modifica
                        </button>

                        <button
                          className="btn small danger-btn"
                          onClick={() =>
                            eliminaMezzo(m.id)
                          }
                        >
                          Elimina
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {mezziFiltrati.length === 0 && (
              <div className="empty">
                Nessun mezzo trovato.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderCarburante() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Rifornimenti</h1>
            <p>Registro dei rifornimenti dei mezzi</p>
          </div>

          <button
            className="btn primary"
            onClick={() => apriModal("carburante")}
          >
            + Nuovo rifornimento
          </button>
        </div>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Cerca targa o operatore..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />

          <button
            className="btn secondary"
            onClick={() => esportaCSV("rifornimenti")}
          >
            Esporta CSV
          </button>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Targa</th>
                  <th>Operatore</th>
                  <th>KM</th>
                  <th>Litri</th>
                  <th>€/L</th>
                  <th>Costo</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {rifornimentiFiltrati.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.data)}</td>
                    <td>
                      <strong>{r.mezzi?.targa || "-"}</strong>
                    </td>
                    <td>
                      {r.operatori
                        ? `${r.operatori.nome} ${r.operatori.cognome}`
                        : "-"}
                    </td>
                    <td>{formatNumber(r.km)}</td>
                    <td>{formatNumber(r.litri)} L</td>
                    <td>{money(r.prezzo_litro)}</td>
                    <td>{money(r.costo_totale)}</td>
                    <td>
                      <button
                        className="btn small danger-btn"
                        onClick={() =>
                          eliminaRifornimento(r.id)
                        }
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rifornimentiFiltrati.length === 0 && (
              <div className="empty">
                Nessun rifornimento registrato.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderManutenzioni() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Manutenzioni</h1>
            <p>Storico degli interventi sui mezzi</p>
          </div>

          <button
            className="btn primary"
            onClick={() => apriModal("manutenzione")}
          >
            + Nuova manutenzione
          </button>
        </div>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Cerca..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />

          <button
            className="btn secondary"
            onClick={() => esportaCSV("manutenzioni")}
          >
            Esporta CSV
          </button>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Targa</th>
                  <th>Tipo</th>
                  <th>Descrizione</th>
                  <th>KM</th>
                  <th>Officina</th>
                  <th>Costo</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {manutenzioniFiltrate.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.data)}</td>
                    <td>
                      <strong>{m.mezzi?.targa || "-"}</strong>
                    </td>
                    <td>{m.tipo}</td>
                    <td>{m.descrizione || "-"}</td>
                    <td>{formatNumber(m.km)}</td>
                    <td>{m.officina || "-"}</td>
                    <td>{money(m.costo)}</td>
                    <td>
                      <button
                        className="btn small danger-btn"
                        onClick={() =>
                          eliminaManutenzione(m.id)
                        }
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {manutenzioniFiltrate.length === 0 && (
              <div className="empty">
                Nessuna manutenzione registrata.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderDocumenti() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Documenti</h1>
            <p>Documentazione e scadenze dei mezzi</p>
          </div>

          <button
            className="btn primary"
            onClick={() => apriModal("documento")}
          >
            + Nuovo documento
          </button>
        </div>

        <div className="toolbar">
          <input
            className="search"
            placeholder="Cerca documento, targa..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
          />

          <button
            className="btn secondary"
            onClick={() => esportaCSV("documenti")}
          >
            Esporta CSV
          </button>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Targa</th>
                  <th>Tipo</th>
                  <th>Numero</th>
                  <th>Emissione</th>
                  <th>Scadenza</th>
                  <th>Stato</th>
                  <th>Azioni</th>
                </tr>
              </thead>

              <tbody>
                {documentiFiltrati.map((d) => {
                  const stato = getScadenzaStato(
                    d.data_scadenza
                  );

                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>
                          {d.mezzi?.targa || "-"}
                        </strong>
                      </td>
                      <td>{d.tipo}</td>
                      <td>{d.numero || "-"}</td>
                      <td>
                        {formatDate(d.data_emissione)}
                      </td>
                      <td>
                        {formatDate(d.data_scadenza)}
                      </td>
                      <td>
                        <span
                          className={`badge ${statoClass(
                            stato
                          )}`}
                        >
                          {stato}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn small danger-btn"
                          onClick={() =>
                            eliminaDocumento(d.id)
                          }
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {documentiFiltrati.length === 0 && (
              <div className="empty">
                Nessun documento registrato.
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderScadenze() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Scadenze</h1>
            <p>Controllo delle prossime scadenze</p>
          </div>
        </div>

        <div className="deadline-grid">
          {scadenze.map((d) => {
            const stato = getScadenzaStato(
              d.data_scadenza
            );

            return (
              <div className="deadline-card" key={d.id}>
                <div className="deadline-card-top">
                  <span
                    className={`badge ${statoClass(stato)}`}
                  >
                    {stato}
                  </span>

                  <strong>{d.tipo}</strong>
                </div>

                <div className="deadline-card-info">
                  <span>Mezzo</span>
                  <strong>
                    {d.mezzi?.targa || "-"}
                  </strong>
                </div>

                <div className="deadline-card-info">
                  <span>Scadenza</span>
                  <strong>
                    {formatDate(d.data_scadenza)}
                  </strong>
                </div>

                {d.note && (
                  <div className="deadline-note">
                    {d.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {scadenze.length === 0 && (
          <div className="panel empty">
            Nessuna scadenza registrata.
          </div>
        )}
      </>
    );
  }

  function renderReport() {
    return (
      <>
        <div className="page-header">
          <div>
            <h1>Report</h1>
            <p>Riepilogo economico e operativo</p>
          </div>

          <button className="btn primary" onClick={stampa}>
            🖨 Stampa report
          </button>
        </div>

        <div className="report-grid">
          <div className="report-box">
            <span>Numero mezzi</span>
            <strong>{statistiche.mezzi}</strong>
          </div>

          <div className="report-box">
            <span>Rifornimenti</span>
            <strong>{statistiche.rifornimenti}</strong>
          </div>

          <div className="report-box">
            <span>Litri consumati</span>
            <strong>
              {formatNumber(statistiche.litri)} L
            </strong>
          </div>

          <div className="report-box">
            <span>Costo carburante</span>
            <strong>
              {money(statistiche.carburante)}
            </strong>
          </div>

          <div className="report-box">
            <span>Manutenzioni</span>
            <strong>
              {money(statistiche.manutenzioni)}
            </strong>
          </div>

          <div className="report-box highlight">
            <span>Costi complessivi</span>
            <strong>
              {money(statistiche.costiTotali)}
            </strong>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Esportazioni</h2>
              <p>Scarica i dati per Excel</p>
            </div>
          </div>

          <div className="export-buttons">
            <button
              className="btn secondary"
              onClick={() => esportaCSV("mezzi")}
            >
              🚚 Esporta mezzi
            </button>

            <button
              className="btn secondary"
              onClick={() => esportaCSV("rifornimenti")}
            >
              ⛽ Esporta rifornimenti
            </button>

            <button
              className="btn secondary"
              onClick={() => esportaCSV("manutenzioni")}
            >
              🔧 Esporta manutenzioni
            </button>

            <button
              className="btn secondary"
              onClick={() => esportaCSV("documenti")}
            >
              📄 Esporta documenti
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderModal() {
    if (!modal) return null;

    return (
      <div className="modal-overlay" onMouseDown={chiudiModal}>
        <div
          className="modal"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h2>
                {modal === "mezzo" &&
                  (selected
                    ? "Modifica mezzo"
                    : "Nuovo mezzo")}

                {modal === "carburante" &&
                  "Nuovo rifornimento"}

                {modal === "manutenzione" &&
                  "Nuova manutenzione"}

                {modal === "documento" &&
                  "Nuovo documento"}
              </h2>
            </div>

            <button
              className="modal-close"
              onClick={chiudiModal}
            >
              ×
            </button>
          </div>

          {modal === "mezzo" && (
            <div className="form-grid">
              <div className="field">
                <label>Targa *</label>
                <input
                  value={form.targa || ""}
                  onChange={(e) =>
                    aggiornaForm("targa", e.target.value)
                  }
                  placeholder="AB123CD"
                />
              </div>

              <div className="field">
                <label>Marca</label>
                <input
                  value={form.marca || ""}
                  onChange={(e) =>
                    aggiornaForm("marca", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Modello</label>
                <input
                  value={form.modello || ""}
                  onChange={(e) =>
                    aggiornaForm("modello", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Anno</label>
                <input
                  type="number"
                  value={form.anno || ""}
                  onChange={(e) =>
                    aggiornaForm("anno", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>KM</label>
                <input
                  type="number"
                  value={form.km || ""}
                  onChange={(e) =>
                    aggiornaForm("km", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Utilizzatore</label>
                <input
                  value={form.utilizzatore || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "utilizzatore",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Alimentazione</label>
                <select
                  value={form.alimentazione || "Diesel"}
                  onChange={(e) =>
                    aggiornaForm(
                      "alimentazione",
                      e.target.value
                    )
                  }
                >
                  <option>Diesel</option>
                  <option>Benzina</option>
                  <option>Metano</option>
                  <option>GPL</option>
                  <option>Ibrido</option>
                  <option>Elettrico</option>
                </select>
              </div>

              <div className="field">
                <label>Stato</label>
                <select
                  value={form.stato || "Attivo"}
                  onChange={(e) =>
                    aggiornaForm("stato", e.target.value)
                  }
                >
                  <option>Attivo</option>
                  <option>Fermo</option>
                  <option>Manutenzione</option>
                  <option>Dismesso</option>
                </select>
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={chiudiModal}
                >
                  Annulla
                </button>

                <button
                  className="btn primary"
                  onClick={salvaMezzo}
                >
                  Salva mezzo
                </button>
              </div>
            </div>
          )}

          {modal === "carburante" && (
            <div className="form-grid">
              <div className="field">
                <label>Mezzo *</label>
                <select
                  value={form.mezzo_id || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "mezzo_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Seleziona mezzo
                  </option>

                  {data.mezzi.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.targa} - {m.marca} {m.modello}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Operatore</label>
                <select
                  value={form.operatore_id || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "operatore_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Seleziona operatore
                  </option>

                  {data.operatori.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome} {o.cognome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Data</label>
                <input
                  type="date"
                  value={form.data || today()}
                  onChange={(e) =>
                    aggiornaForm("data", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>KM *</label>
                <input
                  type="number"
                  value={form.km || ""}
                  onChange={(e) =>
                    aggiornaForm("km", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Litri *</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.litri || ""}
                  onChange={(e) =>
                    aggiornaForm("litri", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Prezzo al litro</label>
                <input
                  type="number"
                  step="0.001"
                  value={form.prezzo_litro || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "prezzo_litro",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field full">
                <label>Firma</label>
                <input
                  value={form.firma || ""}
                  onChange={(e) =>
                    aggiornaForm("firma", e.target.value)
                  }
                  placeholder="Nome e cognome / firma digitale"
                />
              </div>

              <div className="cost-preview">
                Costo rifornimento:{" "}
                <strong>
                  {money(
                    Number(form.litri || 0) *
                      Number(form.prezzo_litro || 0)
                  )}
                </strong>
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={chiudiModal}
                >
                  Annulla
                </button>

                <button
                  className="btn primary"
                  onClick={salvaRifornimento}
                >
                  Salva rifornimento
                </button>
              </div>
            </div>
          )}

          {modal === "manutenzione" && (
            <div className="form-grid">
              <div className="field">
                <label>Mezzo *</label>
                <select
                  value={form.mezzo_id || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "mezzo_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Seleziona mezzo
                  </option>

                  {data.mezzi.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.targa} - {m.marca} {m.modello}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Data</label>
                <input
                  type="date"
                  value={form.data || today()}
                  onChange={(e) =>
                    aggiornaForm("data", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Tipo</label>
                <select
                  value={form.tipo || "Ordinaria"}
                  onChange={(e) =>
                    aggiornaForm("tipo", e.target.value)
                  }
                >
                  <option>Ordinaria</option>
                  <option>Straordinaria</option>
                  <option>Revisione</option>
                  <option>Gomme</option>
                  <option>Carrozzeria</option>
                  <option>Altro</option>
                </select>
              </div>

              <div className="field">
                <label>KM</label>
                <input
                  type="number"
                  value={form.km || ""}
                  onChange={(e) =>
                    aggiornaForm("km", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Costo €</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.costo || ""}
                  onChange={(e) =>
                    aggiornaForm("costo", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Officina</label>
                <input
                  value={form.officina || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "officina",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field full">
                <label>Descrizione</label>
                <textarea
                  value={form.descrizione || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "descrizione",
                      e.target.value
                    )
                  }
                  rows="4"
                />
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={chiudiModal}
                >
                  Annulla
                </button>

                <button
                  className="btn primary"
                  onClick={salvaManutenzione}
                >
                  Salva manutenzione
                </button>
              </div>
            </div>
          )}

          {modal === "documento" && (
            <div className="form-grid">
              <div className="field">
                <label>Mezzo *</label>
                <select
                  value={form.mezzo_id || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "mezzo_id",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Seleziona mezzo
                  </option>

                  {data.mezzi.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.targa} - {m.marca} {m.modello}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Tipo documento</label>
                <select
                  value={form.tipo || "Assicurazione"}
                  onChange={(e) =>
                    aggiornaForm("tipo", e.target.value)
                  }
                >
                  <option>Assicurazione</option>
                  <option>Revisione</option>
                  <option>Bollo</option>
                  <option>Carta di circolazione</option>
                  <option>Patente</option>
                  <option>ADR</option>
                  <option>Tagliando</option>
                  <option>Altro</option>
                </select>
              </div>

              <div className="field">
                <label>Numero documento</label>
                <input
                  value={form.numero || ""}
                  onChange={(e) =>
                    aggiornaForm("numero", e.target.value)
                  }
                />
              </div>

              <div className="field">
                <label>Data emissione</label>
                <input
                  type="date"
                  value={form.data_emissione || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "data_emissione",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Data scadenza *</label>
                <input
                  type="date"
                  value={form.data_scadenza || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "data_scadenza",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="field">
                <label>Link documento</label>
                <input
                  value={form.file_url || ""}
                  onChange={(e) =>
                    aggiornaForm(
                      "file_url",
                      e.target.value
                    )
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="field full">
                <label>Note</label>
                <textarea
                  value={form.note || ""}
                  onChange={(e) =>
                    aggiornaForm("note", e.target.value)
                  }
                  rows="4"
                />
              </div>

              <div className="modal-footer">
                <button
                  className="btn secondary"
                  onClick={chiudiModal}
                >
                  Annulla
                </button>

                <button
                  className="btn primary"
                  onClick={salvaDocumento}
                >
                  Salva documento
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">🚚</div>

          <div>
            <strong>GESTIONE MEZZI</strong>
            <span>Gestione flotta aziendale</span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="connection">
            <span className="connection-dot"></span>
            Database online
          </div>

          <div className="today">
            {new Date().toLocaleDateString("it-IT")}
          </div>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <nav>
            <button
              className={pagina === "dashboard" ? "active" : ""}
              onClick={() => vai("dashboard")}
            >
              <span>📊</span>
              Dashboard
            </button>

            <button
              className={pagina === "mezzi" ? "active" : ""}
              onClick={() => vai("mezzi")}
            >
              <span>🚚</span>
              Mezzi
            </button>

            <button
              className={
                pagina === "carburante" ? "active" : ""
              }
              onClick={() => vai("carburante")}
            >
              <span>⛽</span>
              Rifornimenti
            </button>

            <button
              className={
                pagina === "manutenzioni" ? "active" : ""
              }
              onClick={() => vai("manutenzioni")}
            >
              <span>🔧</span>
              Manutenzioni
            </button>

            <button
              className={
                pagina === "documenti" ? "active" : ""
              }
              onClick={() => vai("documenti")}
            >
              <span>📄</span>
              Documenti
            </button>

            <button
              className={
                pagina === "scadenze" ? "active" : ""
              }
              onClick={() => vai("scadenze")}
            >
              <span>📅</span>
              Scadenze
            </button>

            <button
              className={pagina === "report" ? "active" : ""}
              onClick={() => vai("report")}
            >
              <span>📈</span>
              Report
            </button>
          </nav>

          <div className="sidebar-bottom">
            <div className="company-box">
              <strong>GESTIONE AZIENDALE</strong>
              <span>Parco mezzi</span>
            </div>
          </div>
        </aside>

        <main className="content">
          {loading ? (
            <div className="loading">
              <div className="spinner"></div>
              <p>Connessione al database...</p>
            </div>
          ) : (
            <>
              {pagina === "dashboard" && renderDashboard()}
              {pagina === "mezzi" && renderMezzi()}
              {pagina === "carburante" && renderCarburante()}
              {pagina === "manutenzioni" &&
                renderManutenzioni()}
              {pagina === "documenti" && renderDocumenti()}
              {pagina === "scadenze" && renderScadenze()}
              {pagina === "report" && renderReport()}
            </>
          )}
        </main>
      </div>

      {renderModal()}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;