import { Route, Router } from "@solidjs/router";
import { EditorPage } from "./pages/EditorPage";
import { LibraryPage } from "./pages/LibraryPage";

export function App() {
  return (
    <Router>
      <Route path="/" component={LibraryPage} />
      <Route path="/editor" component={EditorPage} />
    </Router>
  );
}
