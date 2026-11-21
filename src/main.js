import { supabase } from "./config.js";
import "./style.css";

const app = document.querySelector("#app");
let currentUser = null;
let videos = [];
let activeTab = "home";
let busy = false;

const esc = (s = "") => String(s).replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function message(text) {
  alert(text);
}

function extraStyles() {
  if (document.getElementById("vyro-v2-style")) return;

  const s = document.createElement("style");
  s.id = "vyro-v2-style";
  s.textContent = `
    body{background:#090909;color:white;margin:0;font-family:Arial,sans-serif}
    .v-app{max-width:600px;margin:auto;min-height:100vh;background:#101010;padding-bottom:85px}
    .v-header{position:sticky;top:0;z-index:5;background:#101010;border-bottom:1px solid #303030;padding:15px 18px;display:flex;align-items:center;justify-content:space-between}
    .v-logo{font-size:26px;font-weight:900;letter-spacing:4px;color:#e9c45b}
    .v-content{padding:14px}
    .v-card{background:#191919;border:1px solid #303030;border-radius:15px;padding:14px;margin-bottom:15px}
    .v-title{font-size:20px;margin:10px 0 15px}
    .v-video{width:100%;max-height:72vh;background:#000;object-fit:contain;border-radius:12px}
    .v-input{width:100%;box-sizing:border-box;padding:14px;margin:8px 0;background:#222;color:white;border:1px solid #444;border-radius:10px}
    .v-btn{border:0;border-radius:10px;background:#e9c45b;color:#111;font-weight:bold;padding:12px 16px;cursor:pointer}
    .v-muted{color:#aaa;font-size:13px;line-height:1.5}
    .v-nav{position:fixed;bottom:0;left:0;right:0;max-width:600px;margin:auto;background:#111;border-top:1px solid #333;display:flex;justify-content:space-around;padding:10px 3px calc(10px + env(safe-area-inset-bottom));z-index:10}
    .v-nav button{background:none;border:0;color:#999;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px}
    .v-nav button.active{color:#e9c45b}
    .v-nav b{font-size:22px}
    .v-delete{border:0;border-radius:8px;padding:9px 12px;background:#a83232;color:white;margin-top:10px}
    .v-empty{text-align:center;color:#aaa;padding:40px 10px}
    .v-auth{max-width:420px;margin:35px auto;padding:20px}
    .v-auth h1{text-align:center;color:#e9c45b;letter-spacing:5px}
  `;
  document.head.appendChild(s);
}

function showAuth() {
  app.innerHTML = `
    <div class="v-auth">
      <h1>VYRO</h1>
      <p class="v-muted" style="text-align:center">Short Video Community</p>
      <div class="v-card">
        <h2>Login / Signup</h2>
        <input class="v-input" id="email" type="email" placeholder="Email">
        <input class="v-input" id="password" type="password" placeholder="Password (minimum 6)">
        <button class="v-btn" id="login" style="width:100%">Login</button>
        <button class="v-btn" id="signup" style="width:100%;margin-top:8px">Create Account</button>
        <button id="reset" style="width:100%;margin-top:12px;background:none;color:#e9c45b;border:0">Forgot Password?</button>
        <p class="v-muted" id="authMsg"></p>
      </div>
    </div>
  `;

  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const msg = document.querySelector("#authMsg");

  document.querySelector("#login").onclick = async () => {
    if (!email.value.trim() || !password.value) {
      msg.textContent = "Email ও Password লিখো।";
      return;
    }
    msg.textContent = "Login হচ্ছে...";
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(), password: password.value
    });
    if (error) { msg.textContent = error.message; return; }
    currentUser = data.user;
    await home();
  };

  document.querySelector("#signup").onclick = async () => {
    if (!email.value.trim() || password.value.length < 6) {
      msg.textContent = "Email এবং কমপক্ষে ৬ অক্ষরের Password দাও।";
      return;
    }
    msg.textContent = "Account তৈরি হচ্ছে...";
    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(), password: password.value
    });
    if (error) { msg.textContent = error.message; return; }
    if (data.session) {
      currentUser = data.user;
      await home();
    } else {
      msg.textContent = "Account তৈরি হয়েছে। Email confirmation প্রয়োজন হলে Email যাচাই করো।";
    }
  };

  document.querySelector("#reset").onclick = async () => {
    if (!email.value.trim()) { msg.textContent = "Email লিখো।"; return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.value.trim());
    msg.textContent = error ? error.message : "Reset link পাঠানো হয়েছে। Email চেক করো।";
  };
}

async function loadFeed() {
  const { data, error } = await supabase
    .from("videos")
    .select("id,user_id,title,video_url,thumbnail_url,status,views,created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    videos = [];
    return error.message;
  }
  videos = data || [];
  return null;
}

async function loadMyVideos() {
  const { data, error } = await supabase
    .from("videos")
    .select("id,user_id,title,video_url,thumbnail_url,status,views,created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function videoCard(v, mine = false) {
  return `
    <article class="v-card">
      <video class="v-video" controls playsinline preload="metadata"
        src="${esc(v.video_url)}"></video>
      <h3>${esc(v.title || "Untitled Video")}</h3>
      <p class="v-muted">${Number(v.views || 0)} views · ${esc(v.status || "")}</p>
      ${mine ? `<button class="v-delete" data-delete="${esc(v.id)}">Delete</button>` : ""}
    </article>
  `;
}

function renderHome() {
  const page = document.querySelector("#vPage");
  page.innerHTML = `
    <h2 class="v-title">Discover</h2>
    ${videos.length ? videos.map(v => videoCard(v)).join("") :
      `<div class="v-empty">এখনো Approved ভিডিও নেই।</div>`}
  `;
}

async function renderUpload() {
  document.querySelector("#vPage").innerHTML = `
    <h2 class="v-title">Upload Video</h2>
    <div class="v-card">
      <input class="v-input" id="title" maxlength="100" placeholder="Video title">
      <input class="v-input" id="file" type="file" accept="video/mp4">
      <p class="v-muted">MP4 ভিডিও · সর্বোচ্চ ৫০ MB</p>
      <button class="v-btn" id="upload" style="width:100%">Upload</button>
      <p class="v-muted" id="uploadMsg"></p>
    </div>
  `;

  document.querySelector("#upload").onclick = doUpload;
}

async function doUpload() {
  if (busy) return;
  const file = document.querySelector("#file").files[0];
  const title = document.querySelector("#title").value.trim();
  const msg = document.querySelector("#uploadMsg");
  const btn = document.querySelector("#upload");

  if (!file) { message("ভিডিও নির্বাচন করো।"); return; }
  if (file.type !== "video/mp4") { message("MP4 ভিডিও দিতে হবে।"); return; }
  if (file.size > 50 * 1024 * 1024) { message("ভিডিও ৫০ MB-এর বেশি।"); return; }

  busy = true;
  btn.disabled = true;
  msg.textContent = "Upload হচ্ছে, অপেক্ষা করো...";

  const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  try {
    const { error: upError } = await supabase.storage
      .from("videos")
      .upload(path, file, { contentType: "video/mp4", upsert: false });
    if (upError) throw upError;

    const { data: url } = supabase.storage.from("videos").getPublicUrl(path);

    const { error: insertError } = await supabase.from("videos").insert({
      user_id: currentUser.id,
      title: title || "Untitled Video",
      video_url: url.publicUrl,
      thumbnail_url: null,
      status: "pending",
      views: 0
    });

    if (insertError) {
      await supabase.storage.from("videos").remove([path]);
      throw insertError;
    }

    message("ভিডিও Upload হয়েছে। Admin অনুমোদনের পর Feed-এ দেখা যাবে।");
    activeTab = "profile";
    await renderApp();
  } catch (e) {
    msg.textContent = "Upload Error: " + (e.message || "Failed");
  } finally {
    busy = false;
    if (document.querySelector("#upload")) {
      document.querySelector("#upload").disabled = false;
    }
  }
}

async function deleteVideo(id) {
  const own = await loadMyVideos();
  const v = own.find(x => x.id === id);
  if (!v) return message("ভিডিও পাওয়া যায়নি।");
  if (!confirm("ভিডিও Delete করবে?")) return;

  try {
    const marker = "/storage/v1/object/public/videos/";
    const idx = v.video_url.indexOf(marker);
    if (idx === -1) throw new Error("Storage path পাওয়া যায়নি।");
    const path = decodeURIComponent(v.video_url.slice(idx + marker.length));

    const { error: dbError } = await supabase.from("videos")
      .delete().eq("id", id).eq("user_id", currentUser.id);
    if (dbError) throw dbError;

    const { error: storageError } = await supabase.storage.from("videos").remove([path]);
    if (storageError) console.warn("Storage delete warning:", storageError.message);

    message("ভিডিও Delete হয়েছে।");
    await renderApp();
  } catch (e) {
    message("Delete Error: " + e.message);
  }
}

async function renderProfile() {
  const mine = await loadMyVideos();
  document.querySelector("#vPage").innerHTML = `
    <div class="v-card" style="text-align:center">
      <div class="v-logo">VYRO</div>
      <h2>My Profile</h2>
      <p>${esc(currentUser.email || "")}</p>
      <p class="v-muted">My Videos: ${mine.length}</p>
    </div>
    <h3>My Uploads</h3>
    ${mine.length ? mine.map(v => videoCard(v, true)).join("") :
      `<div class="v-empty">তোমার Upload করা ভিডিও নেই।</div>`}
  `;
  document.querySelectorAll("[data-delete]").forEach(btn => {
    btn.onclick = () => deleteVideo(btn.dataset.delete);
  });
}

async function renderApp() {
  app.innerHTML = `
    <div class="v-app">
      <header class="v-header">
        <div class="v-logo">VYRO</div>
        <button class="v-btn" id="logout">Logout</button>
      </header>
      <main class="v-content" id="vPage"></main>
      <nav class="v-nav">
        <button data-tab="home"><b>⌂</b>Home</button>
        <button data-tab="upload"><b>＋</b>Upload</button>
        <button data-tab="profile"><b>◉</b>Profile</button>
      </nav>
    </div>
  `;

  document.querySelector("#logout").onclick = async () => {
    await supabase.auth.signOut();
    currentUser = null;
    showAuth();
  };

  document.querySelectorAll("[data-tab]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === activeTab);
    btn.onclick = async () => {
      activeTab = btn.dataset.tab;
      await renderApp();
    };
  });

  if (activeTab === "home") {
    const error = await loadFeed();
    if (error) {
      document.querySelector("#vPage").innerHTML =
        `<div class="v-card">Feed Error: ${esc(error)}</div>`;
    } else {
      renderHome();
    }
  } else if (activeTab === "upload") {
    await renderUpload();
  } else {
    await renderProfile();
  }
}

async function home() {
  activeTab = "home";
  await renderApp();
}

async function start() {
  extraStyles();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showAuth();
    return;
  }
  currentUser = data.session?.user || null;
  if (currentUser) await home();
  else showAuth();
}

start();
