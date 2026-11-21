import { supabase } from "./config.js";
import "./style.css";

const app = document.querySelector("#app");

let currentUser = null;
let activeTab = "home";
let videos = [];
let activeChat = null;
let activeProfileId = null;
let cameraStream = null;
let recorder = null;
let cameraChunks = [];
let voiceRecorder = null;
let voiceChunks = [];
let busy = false;
let feedObserver = null;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const msg = text => alert(text);

const fileName = name =>
  String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");

const avatar = (url, size = 48) => `
  <img class="v-avatar"
    style="width:${size}px;height:${size}px"
    src="${esc(url || "")}"
    onerror="this.style.display='none'">
`;

function styles() {
  if (document.getElementById("vyro-full-style")) return;

  const s = document.createElement("style");
  s.id = "vyro-full-style";
  s.textContent = `
    * { box-sizing:border-box; }
    body {
      margin:0;
      background:#090909;
      color:#fff;
      font-family:Arial,sans-serif;
    }
    button,input { font:inherit; }
    .v-app {
      max-width:600px;
      margin:auto;
      min-height:100vh;
      background:#101010;
      padding-bottom:85px;
    }
    .v-header {
      position:sticky;
      top:0;
      z-index:20;
      background:#111;
      border-bottom:1px solid #333;
      padding:12px 15px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }
    .v-logo {
      font-size:25px;
      font-weight:900;
      letter-spacing:4px;
      color:#e9c45b;
    }
    .v-page { padding:14px; }
    .v-title { font-size:21px; margin:10px 0 15px; }
    .v-card {
      background:#191919;
      border:1px solid #333;
      border-radius:16px;
      padding:14px;
      margin-bottom:15px;
    }
    .v-input {
      width:100%;
      padding:13px;
      margin:7px 0;
      background:#222;
      color:white;
      border:1px solid #444;
      border-radius:10px;
    }
    .v-btn {
      border:0;
      border-radius:10px;
      background:#e9c45b;
      color:#111;
      font-weight:bold;
      padding:12px 15px;
      margin:3px;
      cursor:pointer;
    }
    .v-btn:disabled { opacity:.5; }
    .v-secondary { background:#303030;color:#fff; }
    .v-danger { background:#a83232;color:white; }
    .v-full { width:100%; }
    .v-muted { color:#aaa;font-size:13px;line-height:1.5; }
    .v-small { font-size:12px;color:#aaa; }
    .v-row { display:flex;align-items:center;gap:10px; }
    .v-between {
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:8px;
    }
    .v-avatar {
      width:48px;
      height:48px;
      border-radius:50%;
      background:#333;
      object-fit:cover;
      flex-shrink:0;
    }
    .v-nav {
      position:fixed;
      bottom:0;
      left:0;
      right:0;
      max-width:600px;
      margin:auto;
      background:#111;
      border-top:1px solid #333;
      display:flex;
      justify-content:space-around;
      padding:8px 2px calc(8px + env(safe-area-inset-bottom));
      z-index:30;
    }
    .v-nav button {
      background:none;
      border:0;
      color:#888;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:3px;
      font-size:11px;
      padding:5px;
    }
    .v-nav button.active { color:#e9c45b; }
    .v-nav b { font-size:20px; }
    .v-empty { text-align:center;color:#aaa;padding:35px 10px; }
    .v-actions { display:flex;gap:6px;flex-wrap:wrap;margin-top:10px; }
    .v-comment { border-top:1px solid #333;padding:9px 0; }
    .v-chat { max-height:55vh;overflow:auto; }
    .v-bubble {
      padding:10px;
      border-radius:12px;
      background:#282828;
      margin:8px 0;
      max-width:85%;
      overflow-wrap:anywhere;
    }
    .v-bubble.mine { margin-left:auto;background:#66521b; }
    .v-auth { max-width:420px;margin:30px auto;padding:20px; }
    .v-auth h1 { text-align:center;color:#e9c45b;letter-spacing:5px; }

    .v-feed {
      height:calc(100dvh - 145px);
      overflow-y:auto;
      scroll-snap-type:y mandatory;
      overscroll-behavior:contain;
      margin:-14px;
      background:#000;
    }
    .v-feed-card {
      height:calc(100dvh - 145px);
      min-height:480px;
      position:relative;
      scroll-snap-align:start;
      overflow:hidden;
      background:#000;
    }
    .v-feed-video {
      width:100%;
      height:100%;
      object-fit:contain;
      background:#000;
    }
    .v-feed-shade {
      position:absolute;
      inset:45% 0 0;
      background:linear-gradient(transparent,rgba(0,0,0,.78));
      pointer-events:none;
    }
    .v-feed-info {
      position:absolute;
      left:13px;
      right:85px;
      bottom:22px;
      z-index:2;
      text-shadow:0 1px 4px #000;
    }
    .v-feed-user { display:flex;align-items:center;gap:9px;margin-bottom:10px; }
    .v-feed-user button {
      background:none;border:0;color:#fff;padding:0;text-align:left;
    }
    .v-feed-rail {
      position:absolute;
      right:10px;
      bottom:25px;
      z-index:3;
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:15px;
    }
    .v-rail-btn {
      background:rgba(20,20,20,.65);
      border:0;
      color:white;
      border-radius:30px;
      min-width:48px;
      padding:8px 5px;
      font-size:12px;
    }
    .v-rail-btn b { display:block;font-size:24px; }
    .v-rail-btn.active { color:#ff5268; }
    .v-stories {
      display:flex;
      gap:12px;
      overflow-x:auto;
      padding:8px 0 14px;
    }
    .v-story {
      flex:0 0 68px;
      text-align:center;
      font-size:11px;
      color:#ddd;
      background:none;
      border:0;
      padding:0;
    }
    .v-story-ring {
      width:60px;height:60px;
      border-radius:50%;
      padding:3px;
      margin:0 auto 5px;
      background:linear-gradient(45deg,#e9c45b,#ff5a8a,#9c5bff);
    }
    .v-story-ring img {
      width:100%;height:100%;
      border-radius:50%;
      object-fit:cover;
      border:2px solid #111;
    }
    .v-story-add {
      width:60px;height:60px;
      border-radius:50%;
      border:2px dashed #e9c45b;
      background:#222;
      color:#e9c45b;
      font-size:25px;
      margin:0 auto 5px;
    }
    .v-modal {
      position:fixed;inset:0;
      z-index:100;
      background:rgba(0,0,0,.94);
      display:flex;
      align-items:center;
      justify-content:center;
      padding:15px;
    }
    .v-modal-inner { width:100%;max-width:520px; }
    .v-modal-media {
      width:100%;
      max-height:75vh;
      object-fit:contain;
      background:#000;
    }
    .v-profile-grid {
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:3px;
    }
    .v-profile-grid video {
      width:100%;
      aspect-ratio:3/4;
      object-fit:cover;
      background:#000;
    }
    .v-chat-media {
      max-width:220px;
      max-height:260px;
      display:block;
      border-radius:10px;
      margin-top:5px;
    }
    .v-chat-controls {
      display:flex;
      gap:5px;
      flex-wrap:wrap;
      margin-top:8px;
    }
    .v-tap { cursor:pointer; }
  `;
  document.head.appendChild(s);
}

async function profileOf(id) {
  const { data, error } = await supabase.from("profiles")
    .select("id,username,full_name,avatar_url,bio")
    .eq("id", id)
    .maybeSingle();

  if (error) console.warn(error.message);

  return data || {
    id,
    username:"user",
    full_name:"",
    avatar_url:"",
    bio:""
  };
}

/* AUTH */

async function showAuth() {
  app.innerHTML = `
    <div class="v-auth">
      <h1>VYRO</h1>
      <p class="v-muted" style="text-align:center">Short Video Community</p>

      <div class="v-card">
        <h2>Login / Signup</h2>

        <input class="v-input" id="email"
          type="email" placeholder="Email">

        <input class="v-input" id="password"
          type="password" placeholder="Password">

        <button class="v-btn v-full" id="login">Login</button>
        <button class="v-btn v-full" id="signup">Create Account</button>

        <button id="reset" class="v-full"
          style="margin-top:12px;background:none;color:#e9c45b;border:0">
          Forgot Password?
        </button>

        <p id="authMsg" class="v-muted"></p>
      </div>
    </div>
  `;

  const email = document.querySelector("#email");
  const password = document.querySelector("#password");
  const out = document.querySelector("#authMsg");
  const loginBtn = document.querySelector("#login");
  const signupBtn = document.querySelector("#signup");

  loginBtn.onclick = async () => {
    const e = email.value.trim();
    const p = password.value;

    if (!e || !p) {
      out.textContent = "Email ও Password লিখো।";
      return;
    }

    loginBtn.disabled = true;
    out.textContent = "Login হচ্ছে...";

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: e,
          password: p
        });

      if (error) throw error;

      currentUser = data.user;
      await home();

    } catch (err) {
      out.textContent = err.message;
    } finally {
      loginBtn.disabled = false;
    }
  };

  signupBtn.onclick = async () => {
    const e = email.value.trim();
    const p = password.value;

    if (!e) {
      out.textContent = "Email লিখো।";
      return;
    }

    if (p.length < 6) {
      out.textContent = "Password কমপক্ষে ৬ অক্ষরের হতে হবে।";
      return;
    }

    signupBtn.disabled = true;
    out.textContent = "Account তৈরি হচ্ছে...";

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: e,
          password: p
        });

      if (error) throw error;

      if (data.session && data.user) {
        currentUser = data.user;
        await home();
        return;
      }

      // Session না থাকলে সরাসরি Login চেষ্টা করবে
      const { data: loginData, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: e,
          password: p
        });

      if (loginError) {
        out.textContent =
          "Account তৈরি হয়েছে, কিন্তু Login হয়নি। Supabase-এ Email Confirmation বন্ধ আছে কি না দেখো।";
        return;
      }

      currentUser = loginData.user;
      await home();

    } catch (err) {
      out.textContent = err.message;
    } finally {
      signupBtn.disabled = false;
    }
  };

  document.querySelector("#reset").onclick = async () => {
    const e = email.value.trim();

    if (!e) {
      out.textContent = "আগে Email লিখো।";
      return;
    }

    out.textContent = "Reset email পাঠানো হচ্ছে...";

    const { error } =
      await supabase.auth.resetPasswordForEmail(e);

    out.textContent = error
      ? error.message
      : "Password reset email পাঠানো হয়েছে।";
  };
}

/* FEED */

async function loadFeed() {
  const { data, error } = await supabase.from("videos")
    .select("id,user_id,title,video_url,thumbnail_url,status,views,created_at")
    .order("created_at",{ascending:false});

  if (error) throw error;

  videos = data || [];
  const ids = [...new Set(videos.map(v => v.user_id))];
  if (!ids.length) return;

  const { data: people, error: pe } = await supabase.from("profiles")
    .select("id,username,full_name,avatar_url")
    .in("id",ids);

  if (pe) console.warn(pe.message);

  const map = {};
  (people || []).forEach(p => map[p.id] = p);
  videos = videos.map(v => ({...v,owner:map[v.user_id] || {}}));
}

async function myVideos() {
  const { data, error } = await supabase.from("videos")
    .select("*")
    .eq("user_id",currentUser.id)
    .order("created_at",{ascending:false});

  if (error) throw error;

  const p = await profileOf(currentUser.id);
  return (data || []).map(v => ({...v,owner:p}));
}

async function getCounts(videoId) {
  const [likes,comments,reposts] = await Promise.all([
    supabase.from("likes").select("id",{count:"exact",head:true}).eq("video_id",videoId),
    supabase.from("comments").select("id",{count:"exact",head:true}).eq("video_id",videoId),
    supabase.from("reposts").select("id",{count:"exact",head:true}).eq("video_id",videoId)
  ]);

  return {
    likes:likes.count || 0,
    comments:comments.count || 0,
    reposts:reposts.count || 0
  };
}

async function hasLiked(id) {
  const { data } = await supabase.from("likes")
    .select("id")
    .eq("video_id",id)
    .eq("user_id",currentUser.id)
    .maybeSingle();
  return !!data;
}

async function hasReposted(id) {
  const { data } = await supabase.from("reposts")
    .select("id")
    .eq("video_id",id)
    .eq("user_id",currentUser.id)
    .maybeSingle();
  return !!data;
}

function videoCard(v) {
  return `
    <section class="v-feed-card" data-feed-card="${esc(v.id)}">
      <video class="v-feed-video"
        playsinline
        loop
        preload="metadata"
        data-feed-video="${esc(v.id)}"
        src="${esc(v.video_url)}">
      </video>

      <div class="v-feed-shade"></div>

      <div class="v-feed-info">
        <div class="v-feed-user">
          <button data-action="open-profile" data-user="${esc(v.user_id)}">
            ${avatar(v.owner?.avatar_url,42)}
          </button>
          <button data-action="open-profile" data-user="${esc(v.user_id)}">
            <b>@${esc(v.owner?.username || v.owner?.full_name || "VYRO User")}</b>
          </button>
          ${
            v.user_id !== currentUser.id
              ? `<button class="v-btn v-secondary"
                   data-action="follow" data-user="${esc(v.user_id)}">Follow</button>`
              : ""
          }
        </div>
        <b>${esc(v.title || "VYRO Video")}</b>
        <div class="v-small">
          ${Number(v.views || 0)} views
        </div>
      </div>

      <div class="v-feed-rail">
        <button class="v-rail-btn"
          data-action="open-profile" data-user="${esc(v.user_id)}">
          ${avatar(v.owner?.avatar_url,44)}
        </button>
        <button class="v-rail-btn" data-action="like" data-id="${esc(v.id)}">
          <b>♥</b><span data-like-count="${esc(v.id)}">…</span>
        </button>
        <button class="v-rail-btn" data-action="comment" data-id="${esc(v.id)}">
          <b>💬</b><span data-comment-count="${esc(v.id)}">Comment</span>
        </button>
        <button class="v-rail-btn" data-action="share" data-id="${esc(v.id)}">
          <b>↗</b>Share
        </button>
        <button class="v-rail-btn" data-action="repost" data-id="${esc(v.id)}">
          <b>🔁</b><span data-repost-count="${esc(v.id)}">Repost</span>
        </button>
        <button class="v-rail-btn" data-action="copy-link" data-id="${esc(v.id)}">
          <b>🔗</b>Copy
        </button>
      </div>
      <div data-comments="${esc(v.id)}"></div>
    </section>
  `;
}

async function updateCardCounts() {
  for (const v of videos) {
    const c = await getCounts(v.id);
    const like = document.querySelector(`[data-like-count="${CSS.escape(v.id)}"]`);
    const comment = document.querySelector(`[data-comment-count="${CSS.escape(v.id)}"]`);
    const repost = document.querySelector(`[data-repost-count="${CSS.escape(v.id)}"]`);
    if (like) like.textContent = c.likes;
    if (comment) comment.textContent = c.comments;
    if (repost) repost.textContent = c.reposts;
  }
}

function setupFeedAutoplay() {
  if (feedObserver) feedObserver.disconnect();

  const feed = document.querySelector("#vFeed");
  if (!feed) return;

  const items = feed.querySelectorAll("[data-feed-video]");

  feedObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
        items.forEach(other => {
          if (other !== video) other.pause();
        });
        video.play().catch(() => {});
        incrementViews(video.dataset.feedVideo);
      } else {
        video.pause();
      }
    });
  }, { root:feed, threshold:[0.25,0.65,0.9] });

  items.forEach(video => {
    feedObserver.observe(video);
    video.addEventListener("click", () => {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    });
  });
}

async function renderHome() {
  const page = document.querySelector("#vPage");
  const stories = await loadStories();

  page.innerHTML = `
    <h2 class="v-title">VYRO</h2>
    <div class="v-stories" id="storyRail">
      <button class="v-story" data-action="add-story">
        <div class="v-story-add">＋</div>
        Add Story
      </button>
      ${stories.map(s => `
        <button class="v-story" data-action="view-story" data-story="${esc(s.id)}">
          <div class="v-story-ring">
            <img src="${esc(s.owner?.avatar_url || "")}">
          </div>
          ${esc(s.owner?.username || "User")}
        </button>
      `).join("")}
    </div>
    <div class="v-feed" id="vFeed">
      ${
        videos.length
          ? videos.map(v => videoCard(v)).join("")
          : `<div class="v-empty">এখনো ভিডিও নেই। Upload করে শুরু করো!</div>`
      }
    </div>
  `;

  setupFeedAutoplay();
  await updateCardCounts();
}

/* VIDEO UPLOAD */

async function uploadVideoFile(file,title) {
  const path = `${currentUser.id}/${Date.now()}-${fileName(file.name)}`;

  const { error } = await supabase.storage.from("videos").upload(path,file,{
    contentType:file.type || "video/mp4",
    upsert:false
  });
  if (error) throw error;

  const { data } = supabase.storage.from("videos").getPublicUrl(path);

  const { error: dbError } = await supabase.from("videos").insert({
    user_id:currentUser.id,
    title:title || "VYRO Video",
    video_url:data.publicUrl,
    thumbnail_url:null,
    status:"approved",
    views:0
  });

  if (dbError) {
    await supabase.storage.from("videos").remove([path]);
    throw dbError;
  }
}

async function renderUpload() {
  document.querySelector("#vPage").innerHTML = `
    <h2 class="v-title">Upload Video</h2>
    <div class="v-card">
      <input class="v-input" id="title" maxlength="100" placeholder="Video title">
      <input class="v-input" id="file" type="file" accept="video/mp4,video/webm">
      <p class="v-muted">MP4/WebM · সর্বোচ্চ ৫০ MB</p>
      <button class="v-btn v-full" id="upload">Upload Video</button>
      <p class="v-muted" id="uploadMsg"></p>
    </div>
  `;

  document.querySelector("#upload").onclick = doUpload;
}

async function doUpload() {
  if (busy) return;

  const file = document.querySelector("#file")?.files?.[0];
  const title = document.querySelector("#title")?.value.trim();
  const out = document.querySelector("#uploadMsg");
  const button = document.querySelector("#upload");

  if (!file) return msg("ভিডিও নির্বাচন করো।");
  if (!["video/mp4","video/webm"].includes(file.type))
    return msg("MP4 অথবা WebM ভিডিও দিতে হবে।");
  if (file.size > 50 * 1024 * 1024)
    return msg("ভিডিও ৫০ MB-এর বেশি।");

  busy = true;
  button.disabled = true;
  out.textContent = "Upload হচ্ছে...";

  try {
    await uploadVideoFile(file,title);
    msg("ভিডিও Upload হয়েছে।");
    activeTab = "home";
    await renderApp();
  } catch (e) {
    out.textContent = "Upload Error: " + e.message;
  } finally {
    busy = false;
  }
}

async function deleteVideo(id) {
  if (!confirm("ভিডিও Delete করবে?")) return;

  const { data:v,error:fe } = await supabase.from("videos")
    .select("video_url")
    .eq("id",id)
    .eq("user_id",currentUser.id)
    .maybeSingle();

  if (fe || !v) return msg("ভিডিও পাওয়া যায়নি।");

  const marker = "/storage/v1/object/public/videos/";
  const idx = v.video_url.indexOf(marker);
  const path = idx < 0 ? null : decodeURIComponent(v.video_url.slice(idx + marker.length));

  const { error } = await supabase.from("videos").delete()
    .eq("id",id)
    .eq("user_id",currentUser.id);

  if (error) return msg("Delete Error: " + error.message);

  if (path) await supabase.storage.from("videos").remove([path]);
  await renderApp();
}

/* LIKES / COMMENTS / REPOSTS / SHARE */

async function toggleLike(id) {
  const liked = await hasLiked(id);

  const result = liked
    ? await supabase.from("likes").delete().eq("video_id",id).eq("user_id",currentUser.id)
    : await supabase.from("likes").insert({video_id:id,user_id:currentUser.id});

  if (result.error) return msg(result.error.message);

  const c = await getCounts(id);
  const el = document.querySelector(`[data-like-count="${CSS.escape(id)}"]`);
  if (el) el.textContent = c.likes;
}

async function toggleRepost(id) {
  const { data } = await supabase.from("reposts")
    .select("id")
    .eq("video_id",id)
    .eq("user_id",currentUser.id)
    .maybeSingle();

  const result = data
    ? await supabase.from("reposts").delete().eq("id",data.id)
    : await supabase.from("reposts").insert({video_id:id,user_id:currentUser.id});

  if (result.error) return msg("Repost Error: " + result.error.message);

  const c = await getCounts(id);
  const el = document.querySelector(`[data-repost-count="${CSS.escape(id)}"]`);
  if (el) el.textContent = c.reposts;
}

async function shareVideo(id) {
  const v = videos.find(x => x.id === id);
  if (!v) return;

  const data = {title:v.title || "VYRO Video",url:v.video_url};
  if (navigator.share) {
    try { await navigator.share(data); } catch {}
  } else {
    await copyLink(id);
  }
}

async function copyLink(id) {
  const v = videos.find(x => x.id === id);
  if (!v) return;
  try {
    await navigator.clipboard.writeText(v.video_url);
    msg("ভিডিও লিংক Copy হয়েছে।");
  } catch {
    msg(v.video_url);
  }
}

async function incrementViews(id) {
  const video = document.querySelector(`[data-feed-video="${CSS.escape(id)}"]`);
  if (!video || video.dataset.counted) return;
  video.dataset.counted = "1";

  // Views স্থানীয়ভাবে দেখানো হচ্ছে।
  // অন্যের ভিডিওর views update করার জন্য নিরাপদ database RPC প্রয়োজন।
}

/* COMMENTS */

async function showComments(id) {
  const box = document.querySelector(`[data-comments="${CSS.escape(id)}"]`);
  if (!box) return;

  const { data,error } = await supabase.from("comments")
    .select("id,user_id,content,created_at")
    .eq("video_id",id)
    .order("created_at",{ascending:true});

  if (error) return msg(error.message);

  let html = `<div class="v-modal"><div class="v-modal-inner v-card">
    <div class="v-between"><h3>Comments (${(data || []).length})</h3>
      <button class="v-btn v-secondary" data-action="close-comments" data-id="${esc(id)}">✕</button>
    </div>`;

  for (const c of (data || [])) {
    const p = await profileOf(c.user_id);
    html += `
      <div class="v-comment">
        <b>${esc(p.username || "User")}</b>
        <p>${esc(c.content)}</p>
        ${
          c.user_id === currentUser.id
            ? `<button class="v-btn v-danger" data-action="delete-comment" data-id="${esc(c.id)}">Delete</button>`
            : ""
        }
      </div>
    `;
  }

  html += `
    <input class="v-input" id="comment-input-${esc(id)}" placeholder="Comment লিখো...">
    <button class="v-btn v-full" data-action="send-comment" data-id="${esc(id)}">Send</button>
  </div></div>`;

  box.innerHTML = html;
}

async function addComment(id) {
  const input = document.querySelector(`#comment-input-${CSS.escape(id)}`);
  const content = input?.value.trim();
  if (!content) return;

  const { error } = await supabase.from("comments").insert({
    video_id:id,
    user_id:currentUser.id,
    content
  });

  if (error) return msg(error.message);
  await showComments(id);
}

async function deleteComment(id) {
  const { error } = await supabase.from("comments").delete()
    .eq("id",id)
    .eq("user_id",currentUser.id);

  if (error) return msg(error.message);
  await renderApp();
}

/* FOLLOW */

async function toggleFollow(id,button) {
  if (id === currentUser.id) return;

  const { data,error:findError } = await supabase.from("follows")
    .select("follower_id")
    .eq("follower_id",currentUser.id)
    .eq("following_id",id)
    .maybeSingle();

  if (findError) return msg(findError.message);

  if (data) {
    const { error } = await supabase.from("follows").delete()
      .eq("follower_id",currentUser.id)
      .eq("following_id",id);
    if (error) return msg(error.message);
    if (button) button.textContent = "＋ Follow";
  } else {
    const { error } = await supabase.from("follows").insert({
      follower_id:currentUser.id,
      following_id:id
    });
    if (error) return msg(error.message);
    if (button) button.textContent = "✓ Following";
  }
}

/* PROFILE */

async function renderProfile(userId = currentUser.id) {
  activeProfileId = userId;
  const page = document.querySelector("#vPage");
  const p = await profileOf(userId);

  const { data:mine,error } = await supabase.from("videos")
    .select("id,user_id,title,video_url,views,created_at")
    .eq("user_id",userId)
    .order("created_at",{ascending:false});

  if (error) return page.innerHTML = `<div class="v-card">${esc(error.message)}</div>`;

  const list = mine || [];
  let totalLikes = 0;

  for (const v of list) {
    const c = await getCounts(v.id);
    totalLikes += c.likes;
  }

  const [followers,following] = await Promise.all([
    supabase.from("follows").select("*",{count:"exact",head:true}).eq("following_id",userId),
    supabase.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",userId)
  ]);

  const isMe = userId === currentUser.id;

  page.innerHTML = `
    ${!isMe ? `<button class="v-btn v-secondary" data-action="back-profile">← Back</button>` : ""}
    <div class="v-card">
      <div style="text-align:center">
        ${avatar(p.avatar_url,90)}
        <h2>${esc(p.full_name || p.username || "VYRO User")}</h2>
        <p>@${esc(p.username || "user")}</p>
        <p>${esc(p.bio || "")}</p>
        <div class="v-between" style="justify-content:center;gap:20px">
          <div><b>${followers.count || 0}</b><div class="v-small">Followers</div></div>
          <div><b>${following.count || 0}</b><div class="v-small">Following</div></div>
          <div><b>${list.length}</b><div class="v-small">Videos</div></div>
          <div><b>${totalLikes}</b><div class="v-small">Likes</div></div>
        </div>
      </div>

      ${
        isMe
          ? `
            <button class="v-btn v-full" data-action="edit-profile">Edit Profile</button>
            <button class="v-btn v-secondary v-full" data-action="avatar">Change Profile Photo</button>
          `
          : `
            <div class="v-actions">
              <button class="v-btn" data-action="follow" data-user="${esc(userId)}">Follow / Unfollow</button>
              <button class="v-btn v-secondary" data-action="message-user" data-user="${esc(userId)}">✉ Message</button>
            </div>
          `
      }
    </div>

    <h3>${isMe ? "My Videos" : "Videos"}</h3>
    <div class="v-profile-grid">
      ${
        list.map(v => `
          <div>
            <video src="${esc(v.video_url)}" controls playsinline preload="metadata"></video>
            ${isMe ? `<button class="v-btn v-danger v-full" data-action="delete" data-id="${esc(v.id)}">Delete</button>` : ""}
          </div>
        `).join("")
      }
    </div>
    ${list.length ? "" : `<div class="v-empty">কোনো ভিডিও নেই।</div>`}
  `;
}

async function editProfile() {
  const p = await profileOf(currentUser.id);
  const name = prompt("Full name:",p.full_name || "");
  if (name === null) return;
  const username = prompt("Username:",p.username || "");
  if (username === null) return;
  const bio = prompt("Bio:",p.bio || "");
  if (bio === null) return;

  const { error } = await supabase.from("profiles").upsert({
    id:currentUser.id,
    full_name:name,
    username,
    bio
  });

  if (error) return msg("Profile update error: " + error.message);
  await renderApp();
}

async function setAvatar() {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*";

  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return msg("ছবি নির্বাচন করো।");
    if (file.size > 5 * 1024 * 1024) return msg("ছবি ৫ MB-এর বেশি।");

    const path = `${currentUser.id}/${Date.now()}-${fileName(file.name)}`;
    const { error:upError } = await supabase.storage.from("avatars").upload(path,file,{
      contentType:file.type,
      upsert:true
    });

    if (upError) return msg("Photo Upload Error: " + upError.message);

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error } = await supabase.from("profiles").upsert({
      id:currentUser.id,
      avatar_url:data.publicUrl
    });

    if (error) return msg("Profile update error: " + error.message);
    msg("Profile Photo পরিবর্তন হয়েছে।");
    await renderApp();
  };

  picker.click();
}

/* STORIES */

async function loadStories() {
  const { data,error } = await supabase.from("stories")
    .select("id,user_id,media_url,media_type,created_at,expires_at")
    .gt("expires_at",new Date().toISOString())
    .order("created_at",{ascending:false});

  if (error) {
    console.warn("Stories:",error.message);
    return [];
  }

  const result = [];
  for (const story of (data || [])) {
    const p = await profileOf(story.user_id);
    result.push({...story,owner:p});
  }
  return result;
}

async function addStory() {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/*,video/*";

  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
      return msg("ছবি অথবা ভিডিও নির্বাচন করো।");

    if (file.size > 30 * 1024 * 1024)
      return msg("Story ৩০ MB-এর বেশি হতে পারবে না।");

    const path = `${currentUser.id}/${Date.now()}-${fileName(file.name)}`;

    const { error:upError } = await supabase.storage.from("stories").upload(path,file,{
      contentType:file.type,
      upsert:false
    });
    if (upError) return msg("Story Upload Error: " + upError.message);

    const { data } = supabase.storage.from("stories").getPublicUrl(path);

    const { error } = await supabase.from("stories").insert({
      user_id:currentUser.id,
      media_url:data.publicUrl,
      media_type:file.type.startsWith("video/") ? "video" : "image"
    });

    if (error) {
      await supabase.storage.from("stories").remove([path]);
      return msg("Story Save Error: " + error.message);
    }

    msg("Story আপলোড হয়েছে।");
    await renderApp();
  };

  picker.click();
}

async function viewStory(id) {
  const { data:s,error } = await supabase.from("stories")
    .select("*")
    .eq("id",id)
    .maybeSingle();

  if (error || !s) return msg("Story পাওয়া যায়নি।");

  const media = s.media_type === "video"
    ? `<video class="v-modal-media" src="${esc(s.media_url)}" controls autoplay playsinline></video>`
    : `<img class="v-modal-media" src="${esc(s.media_url)}">`;

  const modal = document.createElement("div");
  modal.className = "v-modal";
  modal.innerHTML = `
    <div class="v-modal-inner">
      <button class="v-btn v-secondary v-full" id="closeStory">Close</button>
      ${media}
      <p class="v-small">২৪ ঘণ্টা পর Story নিজে থেকেই মেয়াদোত্তীর্ণ হবে।</p>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector("#closeStory").onclick = () => modal.remove();
}

/* CAMERA */

async function renderCamera() {
  document.querySelector("#vPage").innerHTML = `
    <h2 class="v-title">Camera</h2>
    <div class="v-card">
      <video id="cameraPreview" class="v-feed-video"
        style="height:55vh" autoplay muted playsinline></video>
      <input class="v-input" id="cameraTitle" placeholder="ভিডিওর নাম">
      <button class="v-btn v-full" id="cameraStart">Start Camera</button>
      <button class="v-btn v-full" id="cameraRecord" disabled>Record</button>
      <button class="v-btn v-secondary v-full" id="cameraStop" disabled>Stop & Upload</button>
      <p id="cameraMsg" class="v-muted"></p>
    </div>
  `;

  document.querySelector("#cameraStart").onclick = startCamera;
  document.querySelector("#cameraRecord").onclick = startRecord;
  document.querySelector("#cameraStop").onclick = stopRecord;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error("এই WebView-তে Camera API পাওয়া যাচ্ছে না।");

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:"user"},
      audio:true
    });

    document.querySelector("#cameraPreview").srcObject = cameraStream;
    document.querySelector("#cameraRecord").disabled = false;
    document.querySelector("#cameraMsg").textContent = "Camera চালু হয়েছে।";
  } catch (e) {
    msg("Camera Error: " + e.message);
  }
}

function startRecord() {
  if (!cameraStream) return;
  cameraChunks = [];

  const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
    ? "video/webm;codecs=vp8"
    : "video/webm";

  recorder = new MediaRecorder(cameraStream,{mimeType:type});
  recorder.ondataavailable = e => {
    if (e.data.size) cameraChunks.push(e.data);
  };
  recorder.start();

  document.querySelector("#cameraRecord").disabled = true;
  document.querySelector("#cameraStop").disabled = false;
  document.querySelector("#cameraMsg").textContent = "Recording চলছে...";
}

async function stopRecord() {
  if (!recorder || recorder.state === "inactive") return;

  recorder.onstop = async () => {
    const blob = new Blob(cameraChunks,{type:recorder.mimeType || "video/webm"});
    const file = new File([blob],`camera-${Date.now()}.webm`,{type:blob.type});

    try {
      document.querySelector("#cameraMsg").textContent = "Upload হচ্ছে...";
      await uploadVideoFile(file,document.querySelector("#cameraTitle").value.trim());
      msg("ভিডিও আপলোড হয়েছে।");
      stopCamera();
      activeTab = "home";
      await renderApp();
    } catch (e) {
      document.querySelector("#cameraMsg").textContent = "Upload Error: " + e.message;
    }
  };

  recorder.stop();
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(t => t.stop());
  cameraStream = null;
}

/* INBOX AND CHAT */

async function openChatWith(userId) {
  if (userId === currentUser.id) return msg("নিজেকে মেসেজ করা যাবে না।");

  const { data:mine,error:mineError } = await supabase.from("conversation_members")
    .select("conversation_id")
    .eq("user_id",currentUser.id);

  if (mineError) return msg(mineError.message);

  const ids = (mine || []).map(x => x.conversation_id);

  for (const id of ids) {
    const { data:members } = await supabase.from("conversation_members")
      .select("user_id")
      .eq("conversation_id",id);

    if ((members || []).length === 2 && members.some(m => m.user_id === userId)) {
      activeChat = id;
      activeTab = "inbox";
      await renderApp();
      return;
    }
  }

  const { data:conv,error:ce } = await supabase.from("conversations")
    .insert({})
    .select("id")
    .single();

  if (ce) return msg("Conversation Error: " + ce.message);

  const { error:me } = await supabase.from("conversation_members").insert([
    {conversation_id:conv.id,user_id:currentUser.id},
    {conversation_id:conv.id,user_id:userId}
  ]);

  if (me) return msg("Member Error: " + me.message);

  activeChat = conv.id;
  activeTab = "inbox";
  await renderApp();
}

async function startChat() {
  const username = document.querySelector("#chatUsername")?.value.trim();
  if (!username) return msg("Username লিখো।");

  const { data:p,error } = await supabase.from("profiles")
    .select("id,username")
    .eq("username",username)
    .maybeSingle();

  if (error || !p) return msg("User পাওয়া যায়নি।");
  await openChatWith(p.id);
}

async function renderInbox() {
  const page = document.querySelector("#vPage");

  if (activeChat) {
    await renderChat(activeChat);
    return;
  }

  const { data:memberships,error } = await supabase.from("conversation_members")
    .select("conversation_id")
    .eq("user_id",currentUser.id);

  if (error) {
    page.innerHTML = `<div class="v-card">Inbox Error: ${esc(error.message)}</div>`;
    return;
  }

  const ids = (memberships || []).map(x => x.conversation_id);

  let html = `
    <h2>Inbox</h2>
    <div class="v-card">
      <input class="v-input" id="chatUsername" placeholder="Username দিয়ে নতুন Chat">
      <button class="v-btn" id="newChat">Start Chat</button>
    </div>
  `;

  if (!ids.length) {
    page.innerHTML = html + `<div class="v-empty">কোনো মেসেজ নেই।</div>`;
    document.querySelector("#newChat").onclick = startChat;
    return;
  }

  const { data:chats,error:chatError } = await supabase.from("conversations")
    .select("*")
    .in("id",ids)
    .order("created_at",{ascending:false});

  if (chatError) {
    page.innerHTML = html + `<div class="v-card">${esc(chatError.message)}</div>`;
    return;
  }

  for (const c of (chats || [])) {
    const { data:members } = await supabase.from("conversation_members")
      .select("user_id")
      .eq("conversation_id",c.id);

    const other = (members || []).find(m => m.user_id !== currentUser.id);
    const p = other ? await profileOf(other.user_id) : {};

    html += `
      <div class="v-card v-row v-tap" data-action="open-chat" data-chat="${esc(c.id)}">
        ${avatar(p.avatar_url)}
        <div><b>${esc(p.username || p.full_name || "Chat")}</b>
          <div class="v-small">Open conversation</div>
        </div>
      </div>
    `;
  }

  page.innerHTML = html;
  document.querySelector("#newChat").onclick = startChat;
}

async function signedChatUrl(path) {
  const { data,error } = await supabase.storage.from("chat-media")
    .createSignedUrl(path,3600);

  if (error) throw error;
  return data.signedUrl;
}

async function renderChat(id) {
  const page = document.querySelector("#vPage");

  const { data:messages,error } = await supabase.from("messages")
    .select("*")
    .eq("conversation_id",id)
    .order("created_at",{ascending:true});

  if (error) {
    page.innerHTML = `<div class="v-card">Chat Error: ${esc(error.message)}</div>`;
    return;
  }

  let messageHtml = "";

  for (const m of (messages || [])) {
    let body = "";
    let mediaData = null;

    try {
      mediaData = JSON.parse(m.content);
    } catch {}

    if (mediaData && mediaData.kind === "media" && mediaData.path) {
      try {
        const url = await signedChatUrl(mediaData.path);

        if (mediaData.type === "image") {
          body = `<img class="v-chat-media" src="${esc(url)}">`;
        } else if (mediaData.type === "video") {
          body = `<video class="v-chat-media" src="${esc(url)}" controls playsinline></video>`;
        } else if (mediaData.type === "audio") {
          body = `<audio src="${esc(url)}" controls></audio>`;
        }
      } catch {
        body = `<span class="v-small">Media link expired or unavailable. Chat আবার খুলে দেখো।</span>`;
      }
    } else {
      body = esc(m.content);
    }

    messageHtml += `
      <div class="v-bubble ${m.sender_id === currentUser.id ? "mine" : ""}">
        ${body}
        <div class="v-small">${new Date(m.created_at).toLocaleString()}</div>
      </div>
    `;
  }

  page.innerHTML = `
    <button class="v-btn v-secondary" data-action="back-inbox">← Inbox</button>
    <h2>Messages</h2>
    <div class="v-card v-chat" id="chatMessages">${messageHtml}</div>

    <input class="v-input" id="messageInput" placeholder="Message লিখো...">
    <button class="v-btn v-full" id="sendMessage">Send</button>

    <div class="v-card">
      <p class="v-muted">ছবি, ভিডিও অথবা Voice Message পাঠাও</p>
      <div class="v-chat-controls">
        <button class="v-btn v-secondary" id="chatPhoto">📷 Photo</button>
        <button class="v-btn v-secondary" id="chatVideo">🎬 Video</button>
        <button class="v-btn v-secondary" id="voiceStart">🎙 Record Voice</button>
        <button class="v-btn v-danger" id="voiceStop" disabled>Stop & Send</button>
      </div>
      <p id="voiceMsg" class="v-small"></p>
    </div>
  `;

  const chatBox = document.querySelector("#chatMessages");
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

  document.querySelector("#sendMessage").onclick = async () => {
    const input = document.querySelector("#messageInput");
    const content = input.value.trim();
    if (!content) return;

    const { error:se } = await supabase.from("messages").insert({
      conversation_id:id,
      sender_id:currentUser.id,
      content,
      is_read:false
    });

    if (se) return msg("Send Error: " + se.message);
    await renderChat(id);
  };

  document.querySelector("#chatPhoto").onclick = () => chooseChatFile(id,"image");
  document.querySelector("#chatVideo").onclick = () => chooseChatFile(id,"video");
  document.querySelector("#voiceStart").onclick = startVoiceRecord;
  document.querySelector("#voiceStop").onclick = () => stopVoiceRecord(id);
}

async function chooseChatFile(conversationId,type) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = type === "image" ? "image/*" : "video/*";

  picker.onchange = async () => {
    const file = picker.files?.[0];
    if (!file) return;

    if (type === "image" && !file.type.startsWith("image/"))
      return msg("ছবি নির্বাচন করো।");
    if (type === "video" && !file.type.startsWith("video/"))
      return msg("ভিডিও নির্বাচন করো।");
    if (file.size > 30 * 1024 * 1024)
      return msg("ফাইল ৩০ MB-এর বেশি।");

    try {
      const path = `${conversationId}/${currentUser.id}/${Date.now()}-${fileName(file.name)}`;

      const { error:upError } = await supabase.storage.from("chat-media").upload(path,file,{
        contentType:file.type,
        upsert:false
      });
      if (upError) throw upError;

      const { error:se } = await supabase.from("messages").insert({
        conversation_id:conversationId,
        sender_id:currentUser.id,
        content:JSON.stringify({
          kind:"media",
          type,
          path
        }),
        is_read:false
      });

      if (se) throw se;
      await renderChat(conversationId);
    } catch (e) {
      msg("Media Send Error: " + e.message);
    }
  };

  picker.click();
}

async function startVoiceRecord() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio:true});
    voiceChunks = [];

    const type = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : "";

    voiceRecorder = new MediaRecorder(stream,type ? {mimeType:type} : undefined);
    voiceRecorder.ondataavailable = e => {
      if (e.data.size) voiceChunks.push(e.data);
    };
    voiceRecorder.start();

    document.querySelector("#voiceStart").disabled = true;
    document.querySelector("#voiceStop").disabled = false;
    document.querySelector("#voiceMsg").textContent = "Voice recording চলছে...";
  } catch (e) {
    msg("Microphone Error: " + e.message);
  }
}

async function stopVoiceRecord(conversationId) {
  if (!voiceRecorder || voiceRecorder.state === "inactive") return;

  const activeRecorder = voiceRecorder;
  activeRecorder.onstop = async () => {
    const blob = new Blob(voiceChunks,{type:activeRecorder.mimeType || "audio/webm"});
    activeRecorder.stream?.getTracks().forEach(t => t.stop());

    try {
      const path = `${conversationId}/${currentUser.id}/${Date.now()}-voice.webm`;
      const { error:upError } = await supabase.storage.from("chat-media").upload(path,blob,{
        contentType:blob.type || "audio/webm"
      });
      if (upError) throw upError;

      const { error:se } = await supabase.from("messages").insert({
        conversation_id:conversationId,
        sender_id:currentUser.id,
        content:JSON.stringify({kind:"media",type:"audio",path}),
        is_read:false
      });
      if (se) throw se;

      await renderChat(conversationId);
    } catch (e) {
      msg("Voice Send Error: " + e.message);
    }
  };

  activeRecorder.stop();
  voiceRecorder = null;
}

/* GLOBAL EVENTS */

function bindGlobal() {
  app.onclick = async e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;

    const action = el.dataset.action;

    if (action === "like") await toggleLike(el.dataset.id);
    if (action === "comment") await showComments(el.dataset.id);
    if (action === "send-comment") await addComment(el.dataset.id);
    if (action === "delete-comment") await deleteComment(el.dataset.id);
    if (action === "close-comments") {
      const box = document.querySelector(`[data-comments="${CSS.escape(el.dataset.id)}"]`);
      if (box) box.innerHTML = "";
    }
    if (action === "share") await shareVideo(el.dataset.id);
    if (action === "copy-link") await copyLink(el.dataset.id);
    if (action === "repost") await toggleRepost(el.dataset.id);
    if (action === "follow") await toggleFollow(el.dataset.user,el);
    if (action === "open-profile") await renderProfile(el.dataset.user);
    if (action === "message-user") await openChatWith(el.dataset.user);
    if (action === "edit-profile") await editProfile();
    if (action === "avatar") await setAvatar();
    if (action === "delete") await deleteVideo(el.dataset.id);
    if (action === "add-story") await addStory();
    if (action === "view-story") await viewStory(el.dataset.story);

    if (action === "open-chat") {
      activeChat = el.dataset.chat;
      await renderApp();
    }
    if (action === "back-inbox") {
      activeChat = null;
      activeTab = "inbox";
      await renderApp();
    }
    if (action === "back-profile") {
      activeProfileId = null;
      await renderProfile(currentUser.id);
    }
  };
}

/* MAIN APP */

async function renderApp() {
  if (feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  app.innerHTML = `
    <div class="v-app">
      <header class="v-header">
        <div class="v-logo">VYRO</div>
        <button class="v-btn v-secondary" id="logout">Logout</button>
      </header>

      <main class="v-page" id="vPage"></main>

      <nav class="v-nav">
        <button data-tab="home"><b>⌂</b>Home</button>
        <button data-tab="camera"><b>📷</b>Camera</button>
        <button data-tab="upload"><b>＋</b>Upload</button>
        <button data-tab="inbox"><b>✉</b>Inbox</button>
        <button data-tab="profile"><b>◉</b>Profile</button>
      </nav>
    </div>
  `;

  bindGlobal();

  document.querySelector("#logout").onclick = async () => {
    stopCamera();
    if (feedObserver) feedObserver.disconnect();
    await supabase.auth.signOut();
    currentUser = null;
    activeChat = null;
    showAuth();
  };

  document.querySelectorAll("[data-tab]").forEach(b => {
    b.classList.toggle("active",b.dataset.tab === activeTab);

    b.onclick = async () => {
      stopCamera();
      activeChat = null;
      activeTab = b.dataset.tab;
      await renderApp();
    };
  });

  const page = document.querySelector("#vPage");

  try {
    if (activeTab === "home") {
      await loadFeed();
      await renderHome();
    } else if (activeTab === "upload") {
      await renderUpload();
    } else if (activeTab === "camera") {
      await renderCamera();
    } else if (activeTab === "profile") {
      await renderProfile(currentUser.id);
    } else if (activeTab === "inbox") {
      await renderInbox();
    }
  } catch (e) {
    page.innerHTML = `<div class="v-card">Error: ${esc(e.message)}</div>`;
    console.error(e);
  }
}

async function home() {
  activeTab = "home";
  activeChat = null;
  await renderApp();
}

async function start() {
  styles();

  const { data,error } = await supabase.auth.getSession();
  if (error) {
    console.error(error);
    return showAuth();
  }

  currentUser = data.session?.user || null;

  if (currentUser) await home();
  else showAuth();
}

start();
