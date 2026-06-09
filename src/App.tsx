import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";

// Split the two routes so an invite-link visitor doesn't download the marketing
// Landing (and its demo theater), and a Landing visitor doesn't download all six
// board components up front.
const Landing = lazy(() => import("./routes/Landing"));
const Room = lazy(() => import("./routes/Room"));

export default function App() {
  return (
    <Suspense fallback={null}>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/r/:room" component={Room} />
        <Route>
          <div className="grid min-h-screen place-items-center text-slate-500">Not found.</div>
        </Route>
      </Switch>
    </Suspense>
  );
}
