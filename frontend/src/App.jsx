import { Navigate, Route, Routes } from "react-router-dom";

import { AdminRoute } from "./components/AdminRoute.jsx";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { Header } from "./components/Header.jsx";
import { AdminDashboardPage } from "./pages/AdminDashboardPage.jsx";
import { CartPage } from "./pages/CartPage.jsx";
import { CatalogPage } from "./pages/CatalogPage.jsx";
import { CheckoutPage } from "./pages/CheckoutPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { ProductPage } from "./pages/ProductPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { ReturnExchangePage } from "./pages/ReturnExchangePage.jsx";

const App = () => (
  <div className="site-shell">
    <Header />

    <main>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/phones" element={<CatalogPage />} />
        <Route path="/phones/:slug" element={<ProductPage />} />
        <Route
          path="/cart"
          element={<ProtectedRoute allowedRoles={["user"]}><CartPage /></ProtectedRoute>}
        />
        <Route
          path="/checkout"
          element={<ProtectedRoute allowedRoles={["user"]}><CheckoutPage /></ProtectedRoute>}
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/profile"
          element={<ProtectedRoute><ProfilePage /></ProtectedRoute>}
        />
        <Route
          path="/orders/:orderId/return-exchange/:variantSku"
          element={<ProtectedRoute><ReturnExchangePage /></ProtectedRoute>}
        />
        <Route
          path="/admin/*"
          element={<AdminRoute><AdminDashboardPage /></AdminRoute>}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>

    <footer className="footer">
      <strong>MobileMart</strong>
      <span>New mobile phones, clearly compared.</span>
    </footer>
  </div>
);

export default App;
