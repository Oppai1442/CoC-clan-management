import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbxM7orXnebvgiL-qAqfa1DQuU0nBH3VrX0Fe-2ah9X_1B3AsfyrYkOjkHxtne_ZpIfo/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
