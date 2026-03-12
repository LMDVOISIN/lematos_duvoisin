import{r as a,O as N,j as e,p as R,L as v,I as i,B as d,F as L}from"./index-Da6L1pSv.js";const E="contrat-location",_="Contrat de location",l=`CONTRAT DE LOCATION ENTRE PARTICULIERS

Entre les soussignes :

LE PROPRIETAIRE (ci-apres "le Loueur")
Nom : {nom_loueur}
Adresse : {adresse_loueur}
E-mail : {email_loueur}

ET

LE LOCATAIRE (ci-apres "le Locataire")
Nom : {nom_locataire}
Adresse : {adresse_locataire}
E-mail : {email_locataire}

ARTICLE 1 - OBJET DE LA LOCATION
- Designation : {nom_equipement}
- Description : {description_equipement}
- Etat : {etat_equipement}

ARTICLE 2 - DUREE DE LA LOCATION
- Date de debut : {date_debut}
- Date de fin : {date_fin}
- Duree totale : {duree_jours} jours

ARTICLE 3 - PRIX ET MODALITES DE PAIEMENT
- Prix journalier : {prix_journalier} EUR
- Prix total : {prix_total} EUR
- Caution : {montant_caution} EUR

ARTICLE 4 - OBLIGATIONS DU LOCATAIRE
- Utiliser le materiel avec soin
- Restituer le materiel dans son etat initial
- Respecter les conditions d utilisation

ARTICLE 5 - CAUTION
Une caution de {montant_caution} EUR est versee au moment de la reservation.

Fait a {ville}, le {date_signature}

Signature du Loueur          Signature du Locataire`,c=[{name:"{nom_loueur}",description:"Nom du proprietaire"},{name:"{nom_locataire}",description:"Nom du locataire"},{name:"{nom_equipement}",description:"Nom de l equipement"},{name:"{prix_journalier}",description:"Prix par jour"},{name:"{prix_total}",description:"Prix total de la location"},{name:"{montant_caution}",description:"Montant de la caution"},{name:"{date_debut}",description:"Date de debut de location"},{name:"{date_fin}",description:"Date de fin de location"},{name:"{duree_jours}",description:"Duree en jours"}],I=()=>{const[m,r]=a.useState(l),[u,x]=a.useState(!0),[b,p]=a.useState(!1),[g,n]=a.useState(""),[h,o]=a.useState("");a.useEffect(()=>{f()},[]);const f=async()=>{var t;try{x(!0),n(""),o("");const{data:s,error:j}=await((t=N)==null?void 0:t.getLegalPage(E));if(j)throw j;r((s==null?void 0:s.content)||l)}catch(s){console.error("Erreur de chargement du contrat:",s),n((s==null?void 0:s.message)||"Impossible de charger le modele de contrat"),r(l)}finally{x(!1)}},T=async()=>{var t;try{p(!0),n(""),o("");const{error:s}=await((t=N)==null?void 0:t.updateLegalPage(E,_,m||""));if(s)throw s;o("Modele de contrat enregistre avec succes")}catch(s){console.error("Erreur de sauvegarde du contrat:",s),n((s==null?void 0:s.message)||"Impossible de sauvegarder le modele de contrat")}finally{p(!1)}},C=()=>{window!=null&&window.confirm("Revenir au modele de contrat par defaut ?")&&(r(l),o("Modele par defaut restaure (non enregistre)"))};return e.jsxs("div",{className:"min-h-screen flex flex-col bg-surface",children:[e.jsx(R,{}),e.jsxs("main",{className:"flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8",children:[e.jsx("div",{className:"mb-6",children:e.jsxs(v,{to:"/administration-tableau-bord",className:"inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium",children:[e.jsx(i,{name:"ArrowLeft",size:16}),"Retour au tableau de bord"]})}),e.jsxs("div",{className:"flex items-center justify-between mb-6",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl md:text-3xl font-bold text-foreground mb-2",children:"Modifier le contrat de location"}),e.jsx("p",{className:"text-muted-foreground",children:"Personnalisez le modele de contrat entre particuliers"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(d,{variant:"outline",iconName:"RotateCcw",onClick:C,children:"Restaurer le modele"}),e.jsx(d,{iconName:"Save",loading:b,onClick:T,children:"Enregistrer"})]})]}),g&&e.jsx("div",{className:"bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm",children:g}),h&&e.jsx("div",{className:"bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3 mb-6 text-sm",children:h}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsx("div",{className:"lg:col-span-1",children:e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground mb-4",children:"Variables disponibles"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:"Utilisez ces variables dans le modele. Elles seront remplacees automatiquement lors de la generation."}),e.jsx("div",{className:"space-y-3",children:c==null?void 0:c.map(t=>e.jsxs("div",{className:"p-3 bg-surface rounded-md",children:[e.jsx("code",{className:"text-xs font-mono text-blue-600 font-semibold",children:t==null?void 0:t.name}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:t==null?void 0:t.description})]},t==null?void 0:t.name))})]})}),e.jsxs("div",{className:"lg:col-span-2",children:[e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground",children:"Contenu du contrat"}),e.jsx(d,{variant:"outline",size:"sm",iconName:"RefreshCw",onClick:f,loading:u,children:"Recharger"})]}),e.jsx("div",{className:"border border-border rounded-md p-4 bg-white",children:e.jsx("textarea",{className:"w-full font-mono text-sm focus:outline-none resize-none",rows:30,value:m,onChange:t=>{var s;return r(((s=t==null?void 0:t.target)==null?void 0:s.value)||"")},style:{minHeight:"600px"},disabled:u})})]}),e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6 mt-6",children:[e.jsx("h3",{className:"text-lg font-semibold text-foreground mb-4",children:"Informations"}),e.jsxs("div",{className:"space-y-3 text-sm",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"Info",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Le contrat est genere automatiquement pour chaque reservation."})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"FileText",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Les utilisateurs peuvent telecharger le contrat en PDF depuis leur reservation."})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"Shield",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Ce modele sert de base contractuelle entre proprietaire et locataire."})]})]})]})]})]})]}),e.jsx(L,{})]})};export{I as default};
