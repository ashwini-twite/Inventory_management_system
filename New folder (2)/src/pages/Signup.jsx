import "../styles/login.css";
import { Link } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { useState } from "react";
import loginImg from "../assets/loginprofile.jfif";
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
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-left">
          <h1>Create Account</h1>
          <p>Start managing your inventory today.</p>

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

          <button className="btn-primary">Sign Up</button>
        </form>

          <button className="btn-google" type="button" onClick={handleGoogleLogin} disabled={googleLoading}>
            <FcGoogle size={22} /> {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <p className="redirect-text">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>

        <div className="auth-right">
          <img src={loginImg} alt="Warehouse team" />
        </div>
      </div>
    </div>
  );
}
