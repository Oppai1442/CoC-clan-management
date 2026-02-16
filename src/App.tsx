import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbyF1bo_EQHV9NUGqdwOk0nrEad0TiP7s5EcvdEvKrxbYV5jSQsXDjE1zwgh54uj4BVT/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
