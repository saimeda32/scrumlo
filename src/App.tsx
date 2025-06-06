import { Route, Switch } from "wouter";
import Landing from "./routes/Landing";
import Room from "./routes/Room";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/r/:room" component={Room} />
      <Route>
        <div className="grid min-h-screen place-items-center text-slate-500">
          Not found.
        </div>
      </Route>
    </Switch>
  );
}
