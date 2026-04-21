import { Navigate, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import CarDetailPage from "./pages/CarDetailPage";
import CarsListPage from "./pages/CarsListPage";
import CreateCarPage from "./pages/CreateCarPage";
import EditDeleteCarPage from "./pages/EditDeleteCarPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./context/AuthContext";

function App() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = auth.status === "authenticated";

  async function handleLogout(): Promise<void> {
    await logout();
    void navigate("/cars");
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Rental Dashboard</p>
        <h1>Car Inventory</h1>
        <p className="hero-subtitle">
          Split into dedicated pages for each API action.
        </p>

        <nav className="top-nav">
          <NavLink to="/cars" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            GET all cars
          </NavLink>
          {isAuthenticated ? (
            <NavLink to="/cars/new" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
              POST create car
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <button
              type="button"
              className="nav-link nav-link-button"
              onClick={() => void handleLogout()}
            >
              Logout ({auth.user.name})
            </button>
          ) : (
            <>
              <NavLink to="/auth/login" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Login
              </NavLink>
              <NavLink to="/auth/register" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                Register
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="layout single-column">
        <Routes>
          <Route path="/" element={<Navigate to="/cars" replace />} />
          <Route path="/cars" element={<CarsListPage />} />
          <Route path="/cars/new" element={<CreateCarPage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/cars/:id/edit" element={<EditDeleteCarPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/cars" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
