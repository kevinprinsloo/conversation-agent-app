import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppRouter from "./AppRouter"; 

import { I18nextProvider } from "react-i18next";
import i18next from "./i18n/config";

import "./index.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <I18nextProvider i18n={i18next}>
            <AppRouter />
        </I18nextProvider>
    </StrictMode>
);
