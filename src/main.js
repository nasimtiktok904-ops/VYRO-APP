import { supabase } from "./config.js";
import "./style.css";

const app = document.querySelector("#app");

let currentUser = null;

function showAuth() {
  app.innerHTML = `
    <div class="auth-page">
      <div class="logo">VYRO</div>
      <p class="tagline">Watch • Share • Connect</p>

      <div class="auth-card">
        <h2 id="formTitle">Welcome Back</h2>
        <p class="sub">Sign in to continue to VYRO</p>

        <form id="authForm">
          <input id="username" placeholder="Username (signup only)" />
          <input id="email" type="email" placeholder="Email address" required />
          <input id="password" type="password" placeholder="Password" required minlength="6" />
          <button type="submit" id="submitBtn">Login</button>
        </form>

        <p id="message"></p>

        <button class="link-btn" id="toggleBtn">Create new account</button>
        <button class="link-btn" id="resetBtn">Forgot password?</button>
      </div>
    </div>
  `;

  let signup = false;

  const form = document.querySelector("#authForm");
  const title = document.querySelector("#formTitle");
  const submit = document.querySelector("#submitBtn");
  const toggle = document.querySelector("#toggleBtn");
  const username = document.querySelector("#username");
  const message = document.querySelector("#message");

  username.style.display = "none";

  toggle.onclick = () => {
    signup = !signup;
    title.textContent = signup ? "Create Account" : "Welcome Back";
    submit.textContent = signup ? "Sign Up" : "Login";
    toggle.textContent = signup ? "Already have an account? Login" : "Create new account";
    username.style.display = signup ? "block" : "none";
    message.textContent = "";
  };

  form.onsubmit = async (event) => {
    event.preventDefault();

    const email = document.querySelector("#email").value.trim();
    const password = document.querySelector("#password").value;
    const name = username.value.trim();

    submit.disabled = true;
    submit.textContent = "Please wait...";

    let result;

    if (signup) {
      result = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: name || null,
            full_name: name || null
          }
        }
      });
    } else {
      result = await supabase.auth.signInWithPassword({
        email,
        password
      });
    }

    submit.disabled = false;
    submit.textContent = signup ? "Sign Up" : "Login";

    if (result.error) {
      message.textContent = result.error.message;
      message.className = "error";
      return;
    }

    if (signup && !result.data.session) {
      message.textContent = "Registration successful. Check your email to confirm your account.";
      message.className = "success";
      return;
    }

    currentUser = result.data.user;
    showHome();
  };

  document.querySelector("#resetBtn").onclick = async () => {
    const email = document.querySelector("#email").value.trim();

    if (!email) {
      message.textContent = "Enter your email address first.";
      message.className = "error";
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);

    message.textContent = error
      ? error.message
      : "Password reset link sent. Check your email.";

    message.className = error ? "error" : "success";
  };
}

function showHome() {
  app.innerHTML = `
    <div class="home-page">
      <header>
        <div class="small-logo">VYRO</div>
        <button id="logoutBtn">Logout</button>
      </header>

      <main>
        <h1>Welcome to VYRO</h1>
        <p class="welcome">Your short video community starts here.</p>

        <div class="feed-placeholder">
          <div class="play-icon">▶</div>
          <h2>VYRO FEED</h2>
          <p>Video feed will be connected in the next step.</p>
        </div>

        <div class="profile-card">
          <h3>Your Account</h3>
          <p>${escapeHTML(currentUser?.email || "")}</p>
        </div>
      </main>

      <nav class="bottom-nav">
        <span>⌂<small>Home</small></span>
        <span>⌕<small>Search</small></span>
        <span>＋<small>Upload</small></span>
        <span>♡<small>Activity</small></span>
        <span>◉<small>Profile</small></span>
      </nav>
    </div>
  `;

  document.querySelector("#logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    currentUser = null;
    showAuth();
  };
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function startApp() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    app.textContent = "Could not load your session. Please refresh.";
    return;
  }

  currentUser = data.session?.user || null;

  if (currentUser) {
    showHome();
  } else {
    showAuth();
  }
}

startApp();
