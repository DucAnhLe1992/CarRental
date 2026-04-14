import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import CarDetailPage from "./pages/CarDetailPage";
import CarsListPage from "./pages/CarsListPage";
import CreateCarPage from "./pages/CreateCarPage";
import EditDeleteCarPage from "./pages/EditDeleteCarPage";
import "./App.css";

function App() {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Rental Dashboard</p>
        <h1>Car Inventory</h1>

        <nav className="top-nav">
          <NavLink to="/cars" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            See cars
          </NavLink>
          <NavLink to="/cars/new" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            Add car
          </NavLink>
        </nav>
      </header>

      <main className="layout single-column">
        <Routes>
          <Route path="/" element={<Navigate to="/cars" replace />} />
          <Route path="/cars" element={<CarsListPage />} />
          <Route path="/cars/new" element={<CreateCarPage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/cars/:id/edit" element={<EditDeleteCarPage />} />
          <Route path="*" element={<Navigate to="/cars" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
