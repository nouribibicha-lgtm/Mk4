// =====================================================================
// Mk4 PWA — app.js : la « colle » (aucune logique, juste l'assemblage)
// Modules 6 (démarrage : clé API + GPS), 7 (appel vocal), 8 (service worker)
// et humeur.js (humeur + cœur de Mk4, chargé à part).
// =====================================================================
import { creerChat } from "./chat.js";
import { demanderStockagePersistant } from "./memoire.js";
import { demarrer } from "./demarrage.js";
import { demarrerUI } from "./ui.js";
import { brancherVoix } from "./voix.js";

const racine = document.getElementById("racine");

async function main() {
  await demarrer({ racine });          // écran clé API + GPS (ne s'affiche qu'une fois)
  demanderStockagePersistant();
  const chat = creerChat();
  demarrerUI({ racine, chat });
  brancherVoix({ racine, chat });      // bouton 📞 dans l'en-tête
  // Humeur : import à part. Si humeur.js manque ou plante, Mk4 marche comme avant.
  import("./humeur.js")
    .then((m) => m.brancherHumeur({ racine, chat }))
    .catch((e) => console.warn("Humeur indisponible :", e && e.message));
}
main();

// Module 8 : app installable et utilisable hors ligne
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
