import "../styles/login.css";
import { Link, useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
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
    <div className="auth-wrapper auth-wrapper--login">
      <div className="auth-card auth-card--split auth-card--single">
        <div className="auth-brand">
          <div className="auth-brand__inner">
            <span className="auth-brand__eyebrow">Asian Granites</span>
            <h1>Asian Granites</h1>
            <p className="auth-brand__tagline">Enterprise Inventory & Purchase Management</p>
            <ul className="auth-brand__list">
              <li>Real-time stock tracking</li>
              <li>Purchase order automation</li>
              <li>Secure enterprise access</li>
            </ul>
            <div className="auth-brand__glow" aria-hidden="true" />
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2>Welcome Back</h2>
          </div>

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

            <button className="btn-primary auth-submit" type="submit">
              Login
            </button>
          </form>

          <button
            className="btn-google"
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            <FcGoogle size={22} /> {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="redirect-text">
            Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
