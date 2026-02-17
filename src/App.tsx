import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbxf5QCumY54koSnDqk_Jy-ZrtiYLiv4TMAt_SknlRHGHNWkeO_Mq7I8CacaryO5Uc4s/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
