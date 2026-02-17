import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbw__e64Of9r1VwxjuSizQWim1SzQHqo1XSVcK8PM401Cs4XtDkH1vV8G9vw6ZFw-OFR/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
