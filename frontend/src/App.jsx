import { useState } from "react";
import "./App.css";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">C</div>
        <h2>CivicLens</h2>
        <p className="tagline">SMART CIVIC SAFETY</p>

        <nav>
          <a className="active" href="#overview">⌂ Overview</a>
          <a href="#detection">◎ Live Detection</a>
          <a href="#map">⌖ Hazard Map</a>
          <a href="#reports">▤ My Reports</a>
        </nav>

        <div className="system-status">
          <span className="dot"></span>
          Demo environment
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span>Dashboard / Overview</span>
          <div className="user">U <span>Demo User</span></div>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">CIVIC SAFETY DASHBOARD</p>
            <h1>Your city, made safer.</h1>
            <p>Detect road hazards. Report issues. Make streets safer.</p>
          </div>
          <button onClick={() => alert("We will build the report form next!")}>
            + Report an issue
          </button>
        </section>

        <section className="stats">
          <article className="card">
            <span>Reported hazards</span>
            <h2>128</h2>
            <small>Sample demo data</small>
          </article>
          <article className="card">
            <span>High-priority</span>
            <h2>18</h2>
            <small>Need attention</small>
          </article>
          <article className="card">
            <span>Issues resolved</span>
            <h2>76</h2>
            <small>Sample demo data</small>
          </article>
          <article className="card">
            <span>Active reports</span>
            <h2>52</h2>
            <small>Awaiting action</small>
          </article>
        </section>

        <section className="content">
          <article className="panel">
            <h3>Recent civic reports</h3>
            <p>Example road hazards reported by citizens</p>
            <div className="report">
              <div><strong>Large pothole</strong><small>CL-1028</small></div>
              <span>Majitha Road</span>
              <b className="high">High</b>
            </div>
            <div className="report">
              <div><strong>Damaged road surface</strong><small>CL-1027</small></div>
              <span>Lawrence Road</span>
              <b className="medium">Medium</b>
            </div>
            <div className="report">
              <div><strong>Open manhole</strong><small>CL-1026</small></div>
              <span>Ranjit Avenue</span>
              <b className="high">High</b>
            </div>
          </article>

          <article className="panel safety">
            <h3>Road safety detection</h3>
            <div className="road">
              <div className="road-markings"></div>
              <div className="pothole"></div>
              <div className="detection">HAZARD</div>
            </div>
            <h4>See the hazard before you reach it.</h4>
            <p>This is a visual demo. AI camera detection comes next.</p>
            <button className="secondary" onClick={() => setCount(count + 1)}>
              Test interaction ({count})
            </button>
          </article>
        </section>

        <footer>CivicLens © 2026 · Prototype using demo data</footer>
      </main>
    </div>
  );
}

export default App;