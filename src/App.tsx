import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SheetExplorer } from "./component/SheetExplorer";

const BOOTSTRAP_URL = "https://script.google.com/macros/s/AKfycbzLJ4z-H40kfH1KX_OECnk4vay7Ardt46m_Hf23vMg3KUB1YEKcDuPJQAPL40c4P_je/exec";

export default function App() {
  const { t } = useTranslation();
  const [apiUrl, setApiUrl] = useState<string | null>(null);

  useEffect(() => {
    if (apiUrl) return;

    fetch(`${BOOTSTRAP_URL}?path=/api/v1/get-url`)
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.url) {
          setApiUrl(data.url);
        } else {
          // Fallback to bootstrap if dynamic fails or is empty
          setApiUrl(BOOTSTRAP_URL);
        }
      })
      .catch(err => {
        console.error("Failed to fetch dynamic API URL:", err);
        setApiUrl(BOOTSTRAP_URL); // Last resort fallback
      });
  }, [apiUrl]);

  if (!apiUrl) {
    return (
      <div className="h-screen w-full bg-[#2a2a2a] flex items-center justify-center">
        <div className="text-yellow-500 font-black animate-pulse uppercase tracking-widest">
          {t('app.connecting')}
        </div>
      </div>
    );
  }

  return <SheetExplorer baseUrl={apiUrl} pollMs={15000} />;
}
