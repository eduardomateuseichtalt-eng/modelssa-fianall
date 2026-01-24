import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Modelos from "./pages/Modelos";
import ModelProfile from "./pages/ModelProfile";
import ModelRegister from "./pages/ModelRegister";
import ModelPhone from "./pages/ModelPhone";
import ModelValidation from "./pages/ModelValidation";
import ModelCode from "./pages/ModelCode";
import ModelFaceAuth from "./pages/ModelFaceAuth";
import ModelLogin from "./pages/ModelLogin";
import ModelDashboard from "./pages/ModelDashboard";
import ModelCityStats from "./pages/ModelCityStats";
import Login from "./pages/Login";
import Register from "./pages/Register";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Pricing from "./pages/Pricing";
import Faq from "./pages/Faq";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Shots from "./pages/Shots";
import NotFound from "./pages/NotFound";
import AdminApprovals from "./pages/AdminApprovals";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoute";
import AdminLogin from "./pages/AdminLogin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/modelos" element={<Modelos />} />
        <Route path="/modelos/:id" element={<ModelProfile />} />
        <Route path="/seja-modelo" element={<ModelPhone />} />
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
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/sobre" element={<About />} />
        <Route path="/contato" element={<Contact />} />
        <Route path="/anuncie" element={<Pricing />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/shots" element={<Shots />} />
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
        <Route path="/termos" element={<Terms />} />
        <Route path="/privacidade" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
