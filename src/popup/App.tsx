import { openWorkspace } from '../chrome/workspace';

import './popup.css';

export function App() {
  return (
    <main className="popup">
      <header className="popup__header">
        <div>
          <p className="popup__label">Current page</p>
          <h1>Tampr</h1>
        </div>
        <button type="button" onClick={() => void openWorkspace()}>
          Workspace
        </button>
      </header>

      <section className="popup__status" aria-label="Page snippets">
        <div className="popup__status-row">
          <strong>No snippets active</strong>
          <span>Ready</span>
        </div>
        <p>Nothing matches this page yet.</p>
      </section>
    </main>
  );
}
