import "./App.css";

// Placeholder until the Library screen (M2). It shows the three bundled fonts so M0 can check they load.
function App() {
  return (
    <main className="app">
      <span className="material-symbols-rounded app__icon" aria-hidden="true">
        edit_note
      </span>
      <h1 className="app__title">Penwork</h1>
      <p className="app__tagline">Your PDFs and notes, in one place</p>
    </main>
  );
}

export default App;
