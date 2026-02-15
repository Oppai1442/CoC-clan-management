import { SheetExplorer } from "./component/SheetExplorer";

export default function App() {
  // Dán URL web app /exec của cậu vào đây
  const BASE_URL = "https://script.google.com/macros/s/AKfycbwseevXGaBZwBHHrFJQVCeZhD5NCZcW8K7_7qKMJrN7DjgwUqoyXznnzeJNe8zltYVS/exec";

  return <SheetExplorer baseUrl={BASE_URL} pollMs={15000} />;
}
