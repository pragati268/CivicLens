import { useEffect, useState } from "react";
import "./App.css";
import { getReports, createReport } from "./api";

function App() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const data = await getReports();
      setReports(data);
    } catch (err) {
      setError(err.message || "Unable to connect to CivicLens API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      setError("");

      try {
        const data = await getReports();
        setReports(data);
      } catch (err) {
        setError(err.message || "Unable to connect to CivicLens API.");
      } finally {
        setLoading(false);
      }
    }

    fetchReports();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const report = {
      issue: formData.get("issue"),
      location: formData.get("location"),
      priority: formData.get("priority"),
    };

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const createdReport = await createReport(report);

      setReports((current) => [createdReport, ...current]);
      setMessage(`Report ${createdReport.id} submitted successfully.`);
      form.reset();
    } catch (err) {
      setError(err.message || "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">C</div>
        <h2>CivicLens</h2>
        <p className="tagline">SMART CIVIC SAFETY</p>

        <nav>
          <a className="active" href="#overview">
            ⌂ Overview
          </a>
          <a href="#reports">▤ Civic Reports</a>
          <a href="#new-report">+ Report Issue</a>
        </nav>

        <div className="system-status">
          <span className="dot" />
          Backend connected
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>CivicLens / Dashboard</span>
          <div className="user">
            U <span>Demo User</span>
          </div>
        </header>

        <section className="welcome" id="overview">
          <div>
            <p className="eyebrow">CIVIC SAFETY DASHBOARD</p>
            <h1>Your city, made safer.</h1>
            <p>Report road hazards and help build safer streets.</p>
          </div>
          <button
            onClick={() =>
              document.getElementById("new-report")?.scrollIntoView({
                behavior: "smooth",
              })
            }
          >
            + Report an issue
          </button>
        </section>

        <section className="stats">
          <article className="card">
            <span>Total reports</span>
            <h2>{reports.length}</h2>
            <small>From the backend API</small>
          </article>
          <article className="card">
            <span>High priority</span>
            <h2>{reports.filter((r) => r.priority === "High").length}</h2>
            <small>Needs attention</small>
          </article>
          <article className="card">
            <span>In progress</span>
            <h2>{reports.filter((r) => r.status === "In progress").length}</h2>
            <small>Being addressed</small>
          </article>
          <article className="card">
            <span>Resolved</span>
            <h2>{reports.filter((r) => r.status === "Resolved").length}</h2>
            <small>Marked resolved</small>
          </article>
        </section>

        <section className="content">
          <article className="panel" id="reports">
            <div className="panel-heading">
              <div>
                <h3>Road hazard reports</h3>
                <p>Reports retrieved from FastAPI</p>
              </div>
              <button className="secondary" type="button" onClick={loadReports}>
                Refresh
              </button>
            </div>

            {loading && <p>Loading reports...</p>}
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            {!loading && !error && reports.length === 0 && (
              <p>No reports found. Submit the first report below.</p>
            )}

            {!loading &&
              reports.map((report) => (
                <div className="report" key={report.id}>
                  <div>
                    <strong>{report.issue}</strong>
                    <small>
                      {report.id} · {report.status}
                    </small>
                  </div>
                  <span>{report.location}</span>
                  <b className={report.priority.toLowerCase()}>
                    {report.priority}
                  </b>
                </div>
              ))}
          </article>

          <article className="panel" id="new-report">
            <h3>Report a road issue</h3>
            <p>Submit your report to the CivicLens backend.</p>

            <form className="report-form" onSubmit={handleSubmit}>
              <label>
                Issue type
                <select name="issue" required defaultValue="">
                  <option value="" disabled>
                    Select an issue
                  </option>
                  <option>Large pothole</option>
                  <option>Damaged road surface</option>
                  <option>Open manhole</option>
                  <option>Road cracks</option>
                  <option>Waterlogging</option>
                </select>
              </label>

              <label>
                Location
                <input
                  name="location"
                  placeholder="Enter a road or landmark"
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>

              <label>
                Priority
                <select name="priority" defaultValue="Medium">
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </label>

              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit report"}
              </button>
            </form>
          </article>
        </section>

        <footer>CivicLens © 2026 · Full-stack development prototype</footer>
      </main>
    </div>
  );
}

export default App;
