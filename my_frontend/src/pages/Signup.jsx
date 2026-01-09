import "../styles/login.css";
import { Link } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Signup() {
  const [googleLoading, setGoogleLoading] = useState(false);

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
            <h2>Create Your Account</h2>
            <p>Build your workspace in minutes.</p>
          </div>

          <form className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" placeholder="Enter your name" />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input type="email" placeholder="Enter your email" />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="Create a password" />
            </div>

            <button className="btn-primary auth-submit">Sign Up</button>
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
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
