import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbyGvFk3ZKsDUMBXH-4hXjIIGiGGON9DGpISXz6Ll8k5mP3wqMDIP0hl98N2fcYmXziR/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
