import{r as a,ad as N,j as e,G as T,L as R,I as i,B as d,F as L}from"./index-FF8bZjV3.js";const b="contrat-location",_="Contrat de location",l=`CONTRAT DE LOCATION ENTRE PARTICULIERS

Entre les soussignés :

LE PROPRIÉTAIRE (ci-après "le Loueur")
Nom : {nom_loueur}
Adresse : {adresse_loueur}
E-mail : {email_loueur}

ET

LE LOCATAIRE (ci-après "le Locataire")
Nom : {nom_locataire}
Adresse : {adresse_locataire}
E-mail : {email_locataire}

ARTICLE 1 - OBJET DE LA LOCATION
- Désignation : {nom_equipement}
- Description : {description_equipement}
- ?tat : {etat_equipement}

ARTICLE 2 - DURÉE DE LA LOCATION
- Date de début : {date_debut}
- Date de fin : {date_fin}
- Durée totale : {duree_jours} jours

ARTICLE 3 - PRIX ET MODALITÉS DE PAIEMENT
- Prix journalier : {prix_journalier} EUR
- Prix total : {prix_total} EUR
- Caution : {montant_caution} EUR

ARTICLE 4 - OBLIGATIONS DU LOCATAIRE
- Utiliser le matériel avec soin
- Restituer le matériel dans son état initial
- Respecter les conditions d'utilisation
- Déposer une pièce d'identité valide avant la remise du matériel

ARTICLE 5 - CAUTION
Une caution de {montant_caution} EUR est garantie uniquement par empreinte bancaire (CB):
- empreinte CB autorisée (non débitée) au paiement puis libérée, maintenue ou capturée selon le workflow officiel de fin de location;
- si la pièce d'identité n'est pas déposée à temps, la réservation peut être annulée, un jour de location conservé et le solde remboursé;
- en cas de litige valide, l'empreinte CB peut etre capturee totalement ou partiellement selon le protocole officiel.

Fait à {ville}, le {date_signature}

Signature du Loueur          Signature du Locataire`,c=[{name:"{nom_loueur}",description:"Nom du propriétaire"},{name:"{nom_locataire}",description:"Nom du locataire"},{name:"{nom_equipement}",description:"Nom de l??quipement"},{name:"{prix_journalier}",description:"Prix par jour"},{name:"{prix_total}",description:"Prix total de la location"},{name:"{montant_caution}",description:"Montant de la caution"},{name:"{date_debut}",description:"Date de début de location"},{name:"{date_fin}",description:"Date de fin de location"},{name:"{duree_jours}",description:"Durée en jours"}],I=()=>{const[m,n]=a.useState(l),[u,x]=a.useState(!0),[E,p]=a.useState(!1),[g,r]=a.useState(""),[f,o]=a.useState("");a.useEffect(()=>{h()},[]);const h=async()=>{var t;try{x(!0),r(""),o("");const{data:s,error:j}=await((t=N)==null?void 0:t.getLegalPage(b));if(j)throw j;n((s==null?void 0:s.content)||l)}catch(s){console.error("Erreur de chargement du contrat:",s),r((s==null?void 0:s.message)||"Impossible de charger le modèle de contrat"),n(l)}finally{x(!1)}},C=async()=>{var t;try{p(!0),r(""),o("");const{error:s}=await((t=N)==null?void 0:t.updateLegalPage(b,_,m||""));if(s)throw s;o("Modèle de contrat enregistré avec succès")}catch(s){console.error("Erreur de sauvegarde du contrat:",s),r((s==null?void 0:s.message)||"Impossible de sauvegarder le modèle de contrat")}finally{p(!1)}},v=()=>{window!=null&&window.confirm("Revenir au modèle de contrat par défaut ?")&&(n(l),o("Modèle par défaut restauré (non enregistré)"))};return e.jsxs("div",{className:"min-h-screen flex flex-col bg-surface",children:[e.jsx(T,{}),e.jsxs("main",{className:"flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8",children:[e.jsx("div",{className:"mb-6",children:e.jsxs(R,{to:"/administration-tableau-bord",className:"inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium",children:[e.jsx(i,{name:"ArrowLeft",size:16}),"Retour au tableau de bord"]})}),e.jsxs("div",{className:"flex items-center justify-between mb-6",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-2xl md:text-3xl font-bold text-foreground mb-2",children:"Modifier le contrat de location"}),e.jsx("p",{className:"text-muted-foreground",children:"Personnalisez le modèle de contrat entre particuliers"})]}),e.jsxs("div",{className:"flex gap-2",children:[e.jsx(d,{variant:"outline",iconName:"RotateCcw",onClick:v,children:"Restaurer le modèle"}),e.jsx(d,{iconName:"Save",loading:E,onClick:C,children:"Enregistrer"})]})]}),g&&e.jsx("div",{className:"bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm",children:g}),f&&e.jsx("div",{className:"bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3 mb-6 text-sm",children:f}),e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsx("div",{className:"lg:col-span-1",children:e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground mb-4",children:"Variables disponibles"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:"Utilisez ces variables dans le modèle. Elles seront remplacées automatiquement lors de la génération."}),e.jsx("div",{className:"space-y-3",children:c==null?void 0:c.map(t=>e.jsxs("div",{className:"p-3 bg-surface rounded-md",children:[e.jsx("code",{className:"text-xs font-mono text-blue-600 font-semibold",children:t==null?void 0:t.name}),e.jsx("p",{className:"text-xs text-muted-foreground mt-1",children:t==null?void 0:t.description})]},t==null?void 0:t.name))})]})}),e.jsxs("div",{className:"lg:col-span-2",children:[e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsx("h2",{className:"text-lg font-semibold text-foreground",children:"Contenu du contrat"}),e.jsx(d,{variant:"outline",size:"sm",iconName:"RefreshCw",onClick:h,loading:u,children:"Recharger"})]}),e.jsx("div",{className:"border border-border rounded-md p-4 bg-white",children:e.jsx("textarea",{className:"w-full font-mono text-sm focus:outline-none resize-none",rows:30,value:m,onChange:t=>{var s;return n(((s=t==null?void 0:t.target)==null?void 0:s.value)||"")},style:{minHeight:"600px"},disabled:u})})]}),e.jsxs("div",{className:"bg-white rounded-lg shadow-elevation-1 p-6 mt-6",children:[e.jsx("h3",{className:"text-lg font-semibold text-foreground mb-4",children:"Informations"}),e.jsxs("div",{className:"space-y-3 text-sm",children:[e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"Info",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Le contrat est généré automatiquement pour chaque réservation."})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"FileText",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Les utilisateurs peuvent télécharger le contrat en PDF depuis leur réservation."})]}),e.jsxs("div",{className:"flex items-start gap-2",children:[e.jsx(i,{name:"Shield",size:16,className:"text-blue-600 mt-0.5"}),e.jsx("p",{className:"text-muted-foreground",children:"Ce modèle sert de base contractuelle entre propriétaire et locataire."})]})]})]})]})]})]}),e.jsx(L,{})]})};export{I as default};
//# sourceMappingURL=index-Zl84w2Bj.js.map
