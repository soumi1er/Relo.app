import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Connexion from "./pages/Connexion";
import Dashboard from "./pages/Dashboard";
import Annees from "./pages/Annees";
import Matieres from "./pages/Matieres";
import Classes from "./pages/Classes";
import ClasseDetail from "./pages/ClasseDetail";
import Professeurs from "./pages/Professeurs";
import Eleves from "./pages/Eleves";
import EleveDetail from "./pages/EleveDetail";
import Promotion from "./pages/Promotion";
import MesClasses from "./pages/MesClasses";
import SaisieNotes from "./pages/SaisieNotes";
import AdminNotes from "./pages/AdminNotes";
import Consultation from "./pages/Consultation";
import ImporterEleves from "./pages/ImporterEleves";
import ReloIA from "./pages/ReloIA";
import ConfigurationEtablissement from "./pages/ConfigurationEtablissement";
import Paiements from "./pages/Paiements";
import CartesEleves from "./pages/CartesEleves";

export default function App() {
  const { utilisateur, chargement } = useAuth();

  if (chargement) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        Chargement de Relo...
      </div>
    );
  }

  if (!utilisateur) {
    return <Connexion />;
  }

  const estAdmin = utilisateur.role === "ADMIN";
  const estProfesseur = utilisateur.role === "PROFESSEUR";
  const configurationEnAttente = estAdmin && localStorage.getItem("relo.onboarding.pending") === "1";



  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={configurationEnAttente ? <Navigate to="/configuration-etablissement" replace /> : <Dashboard />} />
        <Route path="/relo-ia" element={<ReloIA />} />
        {estAdmin && <Route path="/configuration-etablissement" element={<ConfigurationEtablissement />} />}

        {estAdmin && (
          <>
            <Route path="/eleves" element={<Eleves />} />
            <Route path="/eleves/importer" element={<ImporterEleves />} />
            <Route path="/eleves/:id" element={<EleveDetail />} />
            <Route path="/classes" element={<Classes />} />
            <Route path="/classes/:id" element={<ClasseDetail />} />
            <Route path="/matieres" element={<Matieres />} />
            <Route path="/professeurs" element={<Professeurs />} />
            <Route path="/annees" element={<Annees />} />
            <Route path="/promotion" element={<Promotion />} />
            <Route path="/notes" element={<AdminNotes />} />
            <Route path="/paiements" element={<Paiements />} />
            <Route path="/cartes-eleves" element={<CartesEleves />} />
          </>
        )}

        {estProfesseur && (
          <>
            <Route path="/mes-classes" element={<MesClasses />} />
            <Route path="/mes-classes/:classeMatiereId" element={<SaisieNotes />} />
          </>
        )}

        {(utilisateur.role === "PARENT" || utilisateur.role === "ELEVE") && <Route path="/resultats" element={<Consultation />} />}
        <Route path="*" element={<Navigate to={estAdmin || estProfesseur ? "/" : "/resultats"} replace />} />
      </Route>
    </Routes>
  );
}
