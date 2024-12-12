import React, { useState, useContext } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { Menu, X, User, LogOut, LayoutDashboard, Users, DollarSign, CreditCard, BarChart2 } from 'lucide-react';
import { toast } from "react-hot-toast";

const menuItems = [
  { path: "/", icon: LayoutDashboard, text: "Dashboard" },
  { path: "/debtors", icon: Users, text: "Deudores" },
  { path: "/loans", icon: DollarSign, text: "Préstamos" },
  { path: "/payments", icon: CreditCard, text: "Pagos" },
  { path: "/reports", icon: BarChart2, text: "Reportes" },
];

const Navbar = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Sesión cerrada exitosamente");
      navigate("/login");
    } catch (error) {
      toast.error("Error al cerrar sesión");
    }
  };

  return (
    <nav className="bg-yellow-400 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="text-black text-2xl font-bold">SDLG</span>
            </Link>
          </div>

          {currentUser && (
            <>
              <div className="hidden md:flex items-center space-x-4">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${
                        location.pathname === item.path
                          ? "text-red-600 bg-yellow-200"
                          : "text-black hover:text-red-600 hover:bg-yellow-200"
                      }`}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.text}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors text-black hover:text-red-600 hover:bg-yellow-200"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </button>
              </div>

              <div className="md:hidden flex items-center">
                <button
                  className="text-black hover:text-red-600 p-2"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                >
                  {isMobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {currentUser && (
        <div 
          className={`fixed inset-y-0 right-0 md:hidden transform ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          } transition-transform duration-300 ease-in-out bg-yellow-400 w-64 h-full shadow-lg z-50`}
        >
          <div className="flex justify-end p-4">
            <button
              className="text-black hover:text-red-600"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="px-2 pt-2 pb-3 space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium w-full
                  ${
                    location.pathname === item.path
                      ? "text-red-600 bg-yellow-200"
                      : "text-black hover:text-red-600 hover:bg-yellow-200"
                  }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.text}
              </Link>
            ))}
            <Link
              to="/profile"
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium w-full text-black hover:text-red-600 hover:bg-yellow-200"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <User className="mr-2 h-4 w-4" />
              Perfil
            </Link>
            <button
              onClick={() => {
                handleLogout();
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium w-full text-black hover:text-red-600 hover:bg-yellow-200"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      )}

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;