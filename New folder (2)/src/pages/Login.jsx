import "../styles/login.css";
import { Link, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
import loginImg from "../assets/loginprofile.jfif";
import { supabase } from "../supabaseClient";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    localStorage.setItem("token", "loggedin");
    navigate("/");
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        alert("Google sign-in failed. Please try again.");
      }
    } catch (err) {
      alert("Unexpected error starting Google sign-in.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-left">
          <h1>Welcome Back</h1>
          <p>Manage your Inventory with ease and efficiency.</p>

          <form className="auth-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="btn-primary" type="submit">
              Login
            </button>
          </form>

          <button className="btn-google" type="button" onClick={handleGoogleLogin} disabled={googleLoading}>
            <FcGoogle size={22} /> {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="redirect-text">
            Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>

        <div className="auth-right">
          <img src={loginImg} alt="Warehouse team" />
        </div>
      </div>
    </div>
  );
}
