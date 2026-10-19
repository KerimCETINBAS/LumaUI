import { render } from "solid-js/web";
import { App } from "./app";
import "./theme.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Missing root");
render(() => <App />, root);
