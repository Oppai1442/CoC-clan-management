import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbyfVmbRQU0a1O7puelRfAnVnjDf3eoNGayXIlDy4FJe0CzQGunzs7cFYfWLwrcOdX3k/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
