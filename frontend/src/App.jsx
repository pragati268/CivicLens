import { useEffect, useState } from "react";
import { getReports, createReport } from "./api";
import HazardMap from "./components/HazarMap.jsx";
import "./App.css";

function App() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [coordinates, setCoordinates] = useState(null);
  const [gpsMessage, setGpsMessage] = useState("");

  // Load reports from the backend
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

  // Load reports when the page opens
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

  // Capture the user's GPS coordinates
  function captureLocation() {
    if (!navigator.geolocation) {
      setGpsMessage("Geolocation is not supported by this browser.");
      return;
    }

    setGpsMessage("Getting your location...");

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        setCoordinates(location);
        setGpsMessage(
          `Location captured: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
        );
      },
      (err) => {
        setGpsMessage(
          err.code === 1
            ? "Location permission denied. You can submit without GPS."
            : "Could not get location. Please try again.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  // Submit a new civic report
  async function handleSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);

    const report = {
      issue: formData.get("issue"),
      location: formData.get("location"),
      priority: formData.get("priority"),
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    };

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const created = await createReport(report);

      setReports((current) => [created, ...current]);
      setMessage(`Report ${created.id} submitted successfully.`);

      form.reset();
      setCoordinates(null);
      setGpsMessage("");
    } catch (err) {
      setError(err.message || "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">C</div>
          <div>
            <h2>CivicLens</h2>
            <p className="tagline">SMART CIVIC SAFETY</p>
          </div>
        </div>

        <nav>
          <a className="active" href="#overview">
            ⌂ Overview
          </a>
          <a href="#hazard-map">⌖ Hazard Map</a>
          <a href="#reports">▤ Civic Reports</a>
          <a href="#new-report">+ Report Issue</a>
        </nav>

        <div className="system-status">
          <span className="dot" /> API connection enabled
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>CivicLens / Dashboard</span>
          <span className="user">Citizen workspace</span>
        </header>

        <section className="welcome" id="overview">
          <div>
            <p className="eyebrow">CIVIC SAFETY DASHBOARD</p>
            <h1>Your city, made safer.</h1>
            <p>Detect road hazards. Report issues. Help build safer streets.</p>
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
            <small>From backend API</small>
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

        <div id="hazard-map">
          <HazardMap reports={reports} />
        </div>

        <section className="content">
          <article className="panel" id="reports">
            <div className="panel-heading">
              <div>
                <h3>Road hazard reports</h3>
                <p>Reports loaded from FastAPI</p>
              </div>

              <button
                className="secondary"
                onClick={loadReports}
                disabled={loading}
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loading && <p>Loading reports...</p>}
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            {!loading && !error && reports.length === 0 && (
              <p>No reports yet. Create the first report below.</p>
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

                  <b className={(report.priority || "Medium").toLowerCase()}>
                    {report.priority || "Medium"}
                  </b>
                </div>
              ))}
          </article>

          <article className="panel" id="new-report">
            <h3>Report a road issue</h3>
            <p>Submit a report with optional GPS coordinates.</p>

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
                Location or landmark
                <input
                  name="location"
                  placeholder="Enter road or landmark"
                  minLength={2}
                  maxLength={200}
                  required
                />
              </label>

              <button
                type="button"
                className="secondary"
                onClick={captureLocation}
              >
                Use my current location
              </button>

              {gpsMessage && <p className="gps-message">{gpsMessage}</p>}

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

        <footer>CivicLens © 2026 · Road safety prototype</footer>
      </main>
    </div>
  );
}

export default App;
