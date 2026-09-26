import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";

const Home = lazy(() => import("./pages/Home"));
const Modelos = lazy(() => import("./pages/Modelos"));
const ModelProfile = lazy(() => import("./pages/ModelProfile"));
const ModelRegister = lazy(() => import("./pages/ModelRegister"));
const ModelValidation = lazy(() => import("./pages/ModelValidation"));
const ModelCode = lazy(() => import("./pages/ModelCode"));
const ModelFaceAuth = lazy(() => import("./pages/ModelFaceAuth"));
const ModelLogin = lazy(() => import("./pages/ModelLogin"));
const ModelDashboard = lazy(() => import("./pages/ModelDashboard"));
const ModelCityStats = lazy(() => import("./pages/ModelCityStats"));
const ModelPayment = lazy(() => import("./pages/ModelPayment"));
const AgeVerification = lazy(() => import("./pages/AgeVerification"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Faq = lazy(() => import("./pages/Faq"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Shots = lazy(() => import("./pages/Shots"));
const Reviews = lazy(() => import("./pages/Reviews"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AdminApprovals = lazy(() => import("./pages/AdminApprovals"));
const AdminPartners = lazy(() => import("./pages/AdminPartners"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));

export default function App() {
  return (
    <Suspense fallback={<div className="page" role="status">Carregando...</div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/modelos" element={<Modelos />} />
          <Route path="/modelos/:id" element={<ModelProfile />} />
          <Route path="/seja-modelo" element={<ModelRegister />} />
          <Route path="/seja-modelo/validacao" element={<ModelValidation />} />
          <Route path="/seja-modelo/codigo" element={<ModelCode />} />
          <Route path="/seja-modelo/autenticacao-facial" element={<ModelFaceAuth />} />
          <Route path="/seja-modelo/cadastro" element={<ModelRegister />} />
          <Route path="/modelo/login" element={<ModelLogin />} />
          <Route
            path="/modelo/area"
            element={
              <PrivateRoute>
                <ModelDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/modelo/estatisticas"
            element={
              <PrivateRoute>
                <ModelCityStats />
              </PrivateRoute>
            }
          />
          <Route
            path="/modelo/pagamento"
            element={
              <PrivateRoute>
                <ModelPayment />
              </PrivateRoute>
            }
          />
          <Route path="/verificacao-idade" element={<AgeVerification />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Register />} />
          <Route path="/sobre" element={<About />} />
          <Route path="/contato" element={<Contact />} />
          <Route path="/anuncie" element={<Navigate to="/seja-modelo" replace />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/shots" element={<Shots />} />
          <Route path="/avaliacoes" element={<Reviews />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminApprovals />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/aprovacoes"
            element={
              <AdminRoute>
                <AdminApprovals />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/parceiros"
            element={
              <AdminRoute>
                <AdminPartners />
              </AdminRoute>
            }
          />
          <Route path="/termos" element={<Terms />} />
          <Route path="/privacidade" element={<Privacy />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
