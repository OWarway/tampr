import './workspace.css';

export function App() {
  return (
    <main className="workspace">
      <header className="workspace__header">
        <div>
          <p>Tampr</p>
          <h1>Workspace</h1>
        </div>
        <span>Local snippets</span>
      </header>

      <section className="workspace__body" aria-label="Snippet workspace">
        <aside className="snippet-rail" aria-label="Snippets">
          <label htmlFor="snippet-search">Snippets</label>
          <input
            id="snippet-search"
            type="search"
            placeholder="Search snippets"
            disabled
          />
          <p>No snippets yet.</p>
        </aside>

        <section className="editor-shell" aria-label="Snippet editor">
          <div className="editor-shell__tabs">
            <span>CSS</span>
            <span>JavaScript</span>
            <span>Rules</span>
          </div>
          <div className="editor-shell__empty">
            <h2>No snippet selected</h2>
            <p>Nothing to edit yet.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
