import { Route, Router } from "@solidjs/router";
import { ClickCastPage } from "./pages/ClickCastPage";
import { InputsPage } from "./pages/InputsPage";
import { ModulePage } from "./pages/ModulePage";
import { PartPage } from "./pages/PartPage";
import { PartsPage } from "./pages/PartsPage";
import { PrimitivePage } from "./pages/PrimitivePage";
import { PrimitivesPage } from "./pages/PrimitivesPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { RegionPage } from "./pages/RegionPage";

export function App() {
  return (
    <Router>
      <Route path="/" component={ProfilesPage} />
      <Route path="/profiles/:id" component={ProfilePage} />
      <Route path="/regions/:id" component={RegionPage} />
      <Route path="/modules/:id" component={ModulePage} />
      <Route path="/parts" component={PartsPage} />
      <Route path="/parts/:id" component={PartPage} />
      <Route path="/primitives/inputs" component={InputsPage} />
      <Route path="/primitives/:id" component={PrimitivePage} />
      <Route path="/primitives" component={PrimitivesPage} />
      <Route path="/click-cast" component={ClickCastPage} />
    </Router>
  );
}
