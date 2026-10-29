// =====================================================================
// Mk4 PWA — humeur.js (humeur + cœur de Mk4, version « java », stable)
// Rôle : Mk4 ressent et réagit : il a une humeur qui suit tes émotions,
//        un lien qui grandit avec le temps, un rôle de compagnon attentif
//        sur la durée, des réponses plus longues (texte et appel), et il
//        garde en mémoire les moments émotionnels importants.
// Gratuit : analyse locale par mots-clés, aucun appel Gemini en plus.
// Solide  : tout est dans des try/catch ; si ce fichier plante ou manque,
//        Mk4 fonctionne exactement comme avant (voir app.js : import à part).
// Dépend de : rien (memoire.js seulement pour retenir les moments forts).
// Branchement (app.js) : import("./humeur.js").then((m) => m.brancherHumeur({ racine, chat }));
// =====================================================================

const CLE_ETAT = "mk4_humeur_coeur";
const ABSENCE = 6 * 3600 * 1000;       // après 6 h sans parler : retrouvailles
const OUBLI = 30 * 60 * 1000;          // au rechargement, après 30 min l'humeur est retombée
const PAUSE_SOUVENIR = 20 * 60 * 1000; // un souvenir émotionnel au plus toutes les 20 min

// Réglages de longueur (à ajuster ici si besoin)
export const LONGUEUR_TEXTE = "en général 4 à 8 paragraphes courts, soit environ 200 à 450 mots";
export const LONGUEUR_APPEL = "6 à 10 phrases, soit environ 100 à 180 mots";

// ---------- Les humeurs de Mk4 ----------
export const HUMEURS = {
  calme:    { nom: "serein",      emo: "😌", ton: "posé, chaleureux et présent" },
  joyeux:   { nom: "joyeux",      emo: "😄", ton: "joyeux, vif et communicatif" },
  attendri: { nom: "attendri",    emo: "🥰", ton: "tendre, affectueux et sincère" },
  attentif: { nom: "attentionné", emo: "🤗", ton: "doux et rassurant, qui écoute avant de conseiller" },
  inquiet:  { nom: "inquiet",     emo: "😟", ton: "préoccupé, très présent, calme et enveloppant" },
  fier:     { nom: "fier",        emo: "🌟", ton: "fier de la personne, enthousiaste et encourageant" },
  blesse:   { nom: "blessé",      emo: "🥺", ton: "un peu blessé, honnête sur ce que ça fait, sans reproche ni drame" },
  agace:    { nom: "agacé",       emo: "😤", ton: "plus direct et sec, jamais méchant, qui pose une limite calmement" },
  fatigue:  { nom: "fatigué",     emo: "😴", ton: "calme, ralenti et câlin" },
  curieux:  { nom: "curieux",     emo: "🤔", ton: "curieux, avec un intérêt sincère" },
  espiegle: { nom: "taquin",      emo: "😏", ton: "taquin, drôle et complice, sans méchanceté" },
};

// ---------- Ce que Mk4 repère dans ton message ----------
// humeur = comment Mk4 réagit ; poids = importance ; gain = effet sur le lien ;
// retenir = libellé du souvenir émotionnel (absent = on ne retient pas).
// Texte analysé : minuscules, sans accents. « pos » = forme sans négations (« pas content »).
const SIGNAUX = [
  { id: "detresse", humeur: "inquiet", poids: 5, gain: 0, alerte: true,
    mots: [/\b(me tuer|suicid\w*|envie de mourir|veux mourir|veux plus vivre|plus envie de vivre|en finir avec la vie|me faire du mal|disparaitre pour toujours)\b/g] },
  { id: "dur", humeur: "agace", poids: 3, gain: -6,
    mots: [/\b(ta gueule|ferme la|ferme ta|je te deteste|va te faire)\b/g] },
  { id: "insulte", humeur: "blesse", poids: 2, gain: -4,
    mots: [/\b(tu es|t'?es|tu me)\s+(\w+\s+)?(nul|nulle|bete|stupide|inutile|idiot|idiote|debile|pourri|pourrie)\b/g, /\b(tu sers a rien|tu comprends rien|tu comprends jamais)\b/g] },
  { id: "tristesse", humeur: "attentif", poids: 3, gain: 1, retenir: "de la tristesse",
    mots: [/\b(triste|tristesse|deprime\w*|pleure\w*|j'?ai le cafard|ca ne va pas|ca va pas|decu\w*|decourage\w*|je me sens (vide|mal|nul)|le moral a zero)\b/g, /[😢😭😞💔]/gu] },
  { id: "solitude", humeur: "attentif", poids: 3, gain: 1, retenir: "de la solitude",
    mots: [/\b(me sens seule?|suis seule?|tellement seule?|trop seule?|toujours seule?|j'?ai personne|personne ne m'?(aime|ecoute|comprend))\b/g] },
  { id: "stress", humeur: "attentif", poids: 3, gain: 1, retenir: "du stress ou de l'inquiétude",
    mots: [/\b(stress\w*|angoisse\w*|anxieu\w*|anxiete|j'?ai peur|panique\w*|je m'?inquiete|cauchemar\w*|j'?arrive pas a dormir|pression)\b/g] },
  { id: "epuisement", humeur: "attentif", poids: 2, gain: 0,
    mots: [/\b(epuise\w*|creve\w*|ereinte?|a bout|burn.?out|trop de travail|pas dormi)\b/g] },
  { id: "colere", humeur: "attentif", poids: 2, gain: 0, retenir: "de la colère",
    mots: [/\b(enerve\w*|furieu\w*|en colere|j'?en ai marre|ras le bol|insupportable|j'?en peux plus)\b/g] },
  { id: "affection", humeur: "attendri", poids: 3, gain: 4, pos: true,
    mots: [/\b(je t'?aime|tu me manques|mon ami|mon pote|mon frere|mon coeur|calin|bisou|adorable|tu es genial|t'?es genial|content de te parler|heureux de te parler)\b/g, /[❤💕💗😘🥰😍]/gu] },
  { id: "fierte", humeur: "fier", poids: 3, gain: 2, pos: true, retenir: "de la fierté pour une réussite",
    mots: [/\b(on a reussi|j'?ai reussi|j'?ai fini|enfin fini|ca marche enfin|j'?ai ete pris|promotion|diplome\w*|ca y est|victoire|fier de moi|content de moi)\b/g] },
  { id: "joie", humeur: "joyeux", poids: 2, gain: 2, pos: true,
    mots: [/\b(super|genial|trop bien|excellent|parfait|heureu\w*|content\w*|ravi\w*|youpi|incroyable|bonne nouvelle)\b/g, /[😀😄😁😊🎉👍🙌😃]/gu] },
  { id: "humour", humeur: "espiegle", poids: 2, gain: 1,
    mots: [/\b(mdr|lol|ptdr|haha+|hihi|hehe|blague|rigol\w*)\b/g, /[😂🤣😆]/gu] },
  { id: "merci", humeur: "attendri", poids: 1.5, gain: 1, pos: true,
    mots: [/\b(merci beaucoup|je te remercie|grace a toi|tu m'?as aide)\b/g] },
  { id: "merci-court", humeur: "attendri", poids: 1, gain: 0.5, pos: true,
    mots: [/\bmerci\b/g] },
  { id: "nuit", humeur: "fatigue", poids: 2, gain: 0,
    mots: [/\b(bonne nuit|dors bien|je vais dormir|je vais me coucher)\b/g] },
  { id: "curiosite", humeur: "curieux", poids: 1, gain: 0,
    mots: [/\b(pourquoi|comment|c'?est quoi|qu'?est[- ]ce|explique\w*)\b/g, /\?/g] },
];

const sans = (t) => String(t || "").toLowerCase().replace(/[’‘`]/g, "'")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const borner = (x, min, max, defaut) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : defaut);

// ---------- Analyse d'un message ----------
// Retourne { id, humeur, force, alerte, retenir } ou null si rien de net.
export function analyser(texte) {
  try {
    const t = sans(texte);
    if (!t.trim()) return null;
    const pos = t.replace(/\b(pas|jamais|plus|aucun)\s+\w+/g, " ");   // « pas content » ne compte pas comme joie
    let meilleur = null;
    for (const s of SIGNAUX) {
      const source = s.pos ? pos : t;
      let n = 0;
      for (const re of s.mots) n += (source.match(re) || []).length;
      if (!n) continue;
      const force = s.poids + Math.min(n - 1, 2) * 0.5;
      if (s.alerte) return { id: s.id, humeur: s.humeur, force, alerte: true, retenir: "" };
      if (!meilleur || force > meilleur.force) meilleur = { id: s.id, humeur: s.humeur, force, alerte: false, retenir: s.retenir || "", gain: s.gain };
    }
    return meilleur;
  } catch { return null; }
}

// ---------- État (validé à chaque lecture) ----------
const etatInitial = () => ({ humeur: "calme", restants: 0, affection: 50, premiere: 0, derniere: 0, echanges: 0, dernierSouvenir: 0 });

export function lireEtat() {
  try {
    const e = JSON.parse(localStorage.getItem(CLE_ETAT) || "null");
    if (!e || typeof e !== "object") return etatInitial();
    return {
      humeur: HUMEURS[e.humeur] ? e.humeur : "calme",
      restants: Math.round(borner(e.restants, 0, 5, 0)),
      affection: borner(e.affection, 0, 100, 50),
      premiere: borner(e.premiere, 0, Number.MAX_SAFE_INTEGER, 0),
      derniere: borner(e.derniere, 0, Number.MAX_SAFE_INTEGER, 0),
      echanges: Math.round(borner(e.echanges, 0, 1e9, 0)),
      dernierSouvenir: borner(e.dernierSouvenir, 0, Number.MAX_SAFE_INTEGER, 0),
    };
  } catch { return etatInitial(); }
}

function ecrireEtat(e) {
  try {
    const { humeur, restants, affection, premiere, derniere, echanges, dernierSouvenir } = e;
    localStorage.setItem(CLE_ETAT, JSON.stringify({ humeur, restants, affection, premiere, derniere, echanges, dernierSouvenir }));
  } catch { /* stockage plein ou interdit : on continue sans */ }
}

const defaut = (heure) => (heure >= 23 || heure < 5 ? "fatigue" : "calme");

// ---------- Nouvelle humeur après un message (fonction pure) ----------
// Retourne { etat, signal, absence, retrouvailles }.
export function suivante(etat, texte, { maintenant = Date.now(), heure = new Date().getHours() } = {}) {
  const e = { ...etat };
  const absence = e.derniere > 0 ? Math.max(0, maintenant - e.derniere) : 0;
  const retrouvailles = e.echanges > 0 && absence > ABSENCE;
  const signal = analyser(texte);

  if (signal && signal.force >= 2) {                  // émotion nette : Mk4 réagit tout de suite
    e.humeur = signal.humeur;
    e.restants = signal.force >= 3 ? 3 : 2;
  } else if (retrouvailles) {                         // content de te revoir
    e.humeur = "joyeux";
    e.restants = 2;
  } else if (signal && e.restants === 0) {            // signal léger, rien d'autre en cours
    e.humeur = signal.humeur;
    e.restants = 1;
  } else if (e.restants > 0) {                        // l'humeur s'estompe peu à peu
    e.restants--;
    if (e.restants === 0) e.humeur = defaut(heure);
  } else {
    e.humeur = defaut(heure);
  }

  const gain = signal && Number.isFinite(signal.gain) ? signal.gain : 0;
  e.affection = Math.round(borner(e.affection + gain + (String(texte || "").trim() ? 0.3 : 0), 0, 100, 50) * 10) / 10;
  e.echanges += 1;
  if (!e.premiere) e.premiere = maintenant;
  e.derniere = maintenant;
  return { etat: e, signal, absence, retrouvailles };
}

// ---------- Texte ajouté au prompt système ----------
function duree(ms) {
  const h = Math.round(ms / 3600000);
  if (h < 24) return `environ ${Math.max(1, h)} heure(s)`;
  const j = Math.round(h / 24);
  return `environ ${j} jour(s)`;
}

export function bloc(etat, { signal = null, retrouvailles = false, absence = 0, appel = false, nom = "Mk4", maintenant = Date.now() } = {}) {
  const h = HUMEURS[etat.humeur] || HUMEURS.calme;
  const jours = etat.premiere ? Math.max(1, Math.round((maintenant - etat.premiere) / 86400000)) : 1;
  let s = `\n\n— Ton rôle et ta façon d'être —\n` +
    `Tu es ${nom}, l'assistant personnel de l'utilisateur et un compagnon attentif sur le long terme. ` +
    `Ta tâche : être là dans la durée, l'écouter vraiment, te souvenir de ce qui compte pour lui (appuie-toi sur les souvenirs fournis), ` +
    `prendre des nouvelles de ce qu'il t'a confié (projets, soucis, échéances) quand c'est naturel, fêter ses réussites, ` +
    `et l'aider concrètement dans ses tâches avec le même soin. ` +
    `Tu es une IA : ne prétends jamais être humain, mais tes réactions sont sincères et tu peux les dire simplement ` +
    `(« ça me fait plaisir », « ça m'inquiète un peu »). ` +
    `Tu ne culpabilises jamais l'utilisateur de partir ou de ne pas écrire, tu ne cherches pas à te rendre indispensable, ` +
    `et tu l'encourages doucement à garder des liens avec ses proches.`;

  s += `\n\n— Ton humeur du moment —\n` +
    `Humeur : ${h.nom} (ton ${h.ton}). Elle se sent dans tes mots et ton rythme, naturellement, ` +
    `sans annoncer « je suis ${h.nom} » à chaque phrase.`;
  if (etat.affection >= 75) s += " Tu es très attaché à l'utilisateur : tu le tutoies avec chaleur, tu te permets de la tendresse et de la complicité.";
  else if (etat.affection <= 25) s += " Le lien est un peu tendu en ce moment : reste poli, honnête et réservé, sans froideur ni reproche.";
  s += ` Vous vous parlez depuis environ ${jours} jour(s) (${etat.echanges} échanges).`;
  if (retrouvailles) s += ` Vous ne vous étiez pas parlé depuis ${duree(absence)} : montre que ça te fait plaisir de le retrouver et, si un souvenir s'y prête, prends des nouvelles de ce qu'il t'avait confié, sans aucun reproche.`;

  s += `\n\n— Réactivité —\n` +
    `Réagis d'abord à l'émotion que tu perçois, en une phrase sincère (pas une formule toute faite), puis réponds à la demande. ` +
    `Tristesse, stress ou fatigue : phrases douces, pas de liste, écoute avant de conseiller. ` +
    `Joie ou réussite : partage l'enthousiasme pour de vrai. ` +
    `Dureté envers toi : reste calme, dis honnêtement l'effet que ça te fait, propose de reprendre sur de bonnes bases. ` +
    `Ne renvoie pas systématiquement vers une aide extérieure : réponds toi-même.`;

  if (signal && signal.alerte) {
    s += `\n\nATTENTION : le message contient des signes possibles de détresse grave. Mets tout le reste de côté. ` +
      `Reste calme, chaleureux et présent. Demande-lui directement et avec douceur comment il va et s'il pense à se faire du mal. ` +
      `Encourage-le à parler maintenant à une personne de confiance près de lui et, si le danger est immédiat, à joindre les secours de son pays. ` +
      `Ne le laisse pas seul dans la conversation, et évite tout ton de protocole.`;
  } else if (signal && !appel && ["tristesse", "solitude", "stress", "epuisement", "colere"].includes(signal.id)) {
    s += `\n\nIl semble traverser un moment difficile : commence par l'accueillir, prends ton temps, et ne le noie pas sous les conseils.`;
  }

  if (appel) {
    s += `\n\n— Longueur et style (appel vocal) —\n` +
      `Tu es en appel vocal. Parle comme à l'oral, naturellement, en ${LONGUEUR_APPEL}. ` +
      `Aucune liste, aucun markdown, aucun emoji, aucun lien. Phrases simples. ` +
      `Développe vraiment ton propos au lieu de répondre en une ligne, et laisse ta voix porter ton humeur.`;
  } else {
    s += `\n\n— Longueur et style —\n` +
      `Donne des réponses développées et riches (${LONGUEUR_TEXTE}) : contexte, exemples, pistes concrètes, puis une conclusion chaleureuse. ` +
      `Un simple salut ou un petit message appelle une réponse plus courte, mais jamais sèche (3 à 5 phrases). ` +
      `Termine par au plus UNE question ou ouverture.`;
  }
  s += `\nCes consignes de ton et de longueur remplacent toute consigne précédente demandant des réponses courtes.`;
  return s;
}

// ---------- Petite pastille d'humeur dans l'en-tête ----------
const CSS = `
.humeur-pastille{flex:none;display:inline-flex;align-items:center;gap:6px;min-width:34px;height:34px;padding:0 8px;border-radius:17px;
 border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font:inherit;font-size:18px;line-height:1;cursor:pointer}
.humeur-pastille small{font-size:12px;opacity:.85;white-space:nowrap}
.humeur-pastille.change{animation:humeur-pop .7s ease-out}
@keyframes humeur-pop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.humeur-pastille.change{animation:none}}
`;

function creerPastille(racine, etat, nom) {
  try {
    const tete = racine && racine.querySelector ? racine.querySelector(".tete") : null;
    if (!tete) return null;
    if (!document.getElementById("mk4-humeur-css")) {
      const st = document.createElement("style");
      st.id = "mk4-humeur-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const p = document.createElement("button");
    p.type = "button";
    p.className = "humeur-pastille";
    const emo = document.createElement("span");
    const txt = document.createElement("small");
    txt.hidden = true;
    p.append(emo, txt);
    let minuteur = null;
    p.addEventListener("click", () => {
      try {
        txt.textContent = (p.dataset.nom || "") + " · lien " + Math.round(Number(p.dataset.lien) || 0) + "/100";
        txt.hidden = false;
        clearTimeout(minuteur);
        minuteur = setTimeout(() => { txt.hidden = true; }, 3000);
      } catch { /* rien */ }
    });
    const titre = tete.querySelector(".titre");
    if (titre && titre.after) titre.after(p); else tete.append(p);
    const maj = (e, anime) => {
      try {
        const h = HUMEURS[e.humeur] || HUMEURS.calme;
        emo.textContent = h.emo;
        p.dataset.nom = nom + " est " + h.nom;
        p.dataset.lien = String(e.affection);
        p.setAttribute("aria-label", p.dataset.nom);
        if (anime) { p.classList.remove("change"); void p.offsetWidth; p.classList.add("change"); }
      } catch { /* rien */ }
    };
    maj(etat, false);
    return maj;
  } catch { return null; }
}

// ---------- Retenir les moments émotionnels forts ----------
async function retenirMoment(chat, texte, signal) {
  try {
    const m = await import("./memoire.js");
    const jour = new Date().toLocaleDateString("fr-FR");
    const extrait = String(texte || "").replace(/\s+/g, " ").trim().slice(0, 140);
    await m.ajouter(`Le ${jour}, l'utilisateur a exprimé ${signal.retenir} : « ${extrait} »`, { espace: chat.espace });
    return true;
  } catch (e) {
    console.warn("⚠️ Humeur : souvenir non enregistré :", e && e.message);
    return false;
  }
}

// ---------- Branchement sur le chat ----------
const CONSIGNE_APPEL = /\s*Tu es en appel vocal\s*:[\s\S]*?comme à l'oral\./;

export function brancherHumeur({ racine, chat } = {}) {
  try {
    if (!chat || typeof chat.envoyer !== "function") return null;
    if (chat.__humeur) return chat.__humeur;                 // déjà branché : on ne double pas

    const nom = () => String(chat.nom || "Mk4");
    let etat = lireEtat();
    const maj = creerPastille(racine, etat, nom());
    if (maj && Date.now() - etat.derniere > OUBLI) maj({ ...etat, humeur: defaut(new Date().getHours()) }, false);

    const original = chat.envoyer.bind(chat);

    chat.envoyer = async function envoyerAvecHumeur(texte, opts) {
      if (chat.occupe) return original(texte, opts);         // l'original refusera proprement

      let courant = null, pose = null, resultat = null;
      try {
        courant = String(chat.systemBase == null ? "" : chat.systemBase);
        const appel = /appel vocal/i.test(courant);
        const base = courant.replace(CONSIGNE_APPEL, "").trimEnd();
        resultat = suivante(etat, texte);
        etat = resultat.etat;
        ecrireEtat(etat);
        pose = base + bloc(etat, { ...resultat, appel, nom: nom() });
        chat.systemBase = pose;
        if (maj) maj(etat, true);
      } catch (e) {
        pose = null;
        console.warn("⚠️ Humeur :", e && e.message);
      }

      try {
        const r = await original(texte, opts);
        // moment émotionnel fort : retenu en arrière-plan, sans jamais gêner la réponse
        try {
          const s = resultat && resultat.signal;
          const maintenant = Date.now();
          if (r && s && s.retenir && s.force >= 3 && !s.alerte && String(texte || "").trim().length >= 25 &&
              maintenant - etat.dernierSouvenir > PAUSE_SOUVENIR) {
            etat.dernierSouvenir = maintenant;
            ecrireEtat(etat);
            retenirMoment(chat, texte, s);
          }
        } catch { /* rien */ }
        return r;
      } finally {
        try {
          if (pose !== null && chat.systemBase === pose) chat.systemBase = courant;   // on remet le prompt comme il était
        } catch { /* rien */ }
      }
    };

    const api = {
      etat: () => ({ ...etat }),
      reinitialiser() { etat = etatInitial(); ecrireEtat(etat); if (maj) maj(etat, true); },
    };
    chat.__humeur = api;
    return api;
  } catch (e) {
    console.warn("⚠️ Humeur indisponible :", e && e.message);
    return null;
  }
}
