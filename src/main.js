import { supabase } from "./config.js";
import "./style.css";

const app = document.querySelector("#app");

let currentUser = null;
let activeTab = "home";
let videos = [];
let busy = false;
let cameraStream = null;
let recorder = null;
let cameraChunks = [];
let activeChat = null;

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const msg = text => alert(text);

const btn = (label, action, cls = "v-btn") =>
  `<button class="${cls}" data-action="${action}">${label}</button>`;

function styles() {
  if (document.getElementById("vyro-full-style")) return;

  const s = document.createElement("style");
  s.id = "vyro-full-style";
  s.textContent = `
    body {
      margin:0;
      background:#090909;
      color:#fff;
      font-family:Arial,sans-serif;
    }
    * { box-sizing:border-box; }
    .v-app {
      max-width:600px;
      margin:auto;
      min-height:100vh;
      background:#101010;
      padding-bottom:90px;
    }
    .v-header {
      position:sticky;
      top:0;
      z-index:10;
      background:#111;
      border-bottom:1px solid #333;
      padding:15px;
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
    .v-card {
      background:#191919;
      border:1px solid #333;
      border-radius:16px;
      padding:14px;
      margin-bottom:15px;
    }
    .v-title { font-size:21px; margin:10px 0 15px; }
    .v-video {
      width:100%;
      max-height:70vh;
      background:#000;
      object-fit:contain;
      border-radius:12px;
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
    .v-secondary { background:#303030; color:#fff; }
    .v-danger { background:#a83232; color:white; }
    .v-muted { color:#aaa; font-size:13px; line-height:1.5; }
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
      padding:9px 2px calc(9px + env(safe-area-inset-bottom));
      z-index:20;
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
    .v-empty { text-align:center; color:#aaa; padding:35px 10px; }
    .v-row { display:flex; align-items:center; gap:10px; }
    .v-between { display:flex; justify-content:space-between; align-items:center; gap:8px; }
    .v-avatar {
      width:48px;
      height:48px;
      border-radius:50%;
      background:#333;
      object-fit:cover;
      flex-shrink:0;
    }
    .v-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
    .v-comment { border-top:1px solid #333; padding:9px 0; }
    .v-chat { max-height:55vh; overflow:auto; }
    .v-bubble {
      padding:10px;
      border-radius:12px;
      background:#282828;
      margin:8px 0;
      max-width:85%;
      overflow-wrap:anywhere;
    }
    .v-bubble.mine { margin-left:auto; background:#66521b; }
    .v-small { font-size:12px; color:#aaa; }
    .v-auth { max-width:420px; margin:30px auto; padding:20px; }
    .v-auth h1 { text-align:center; color:#e9c45b; letter-spacing:5px; }
    .v-full { width:100%; }
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
    username: "user",
    full_name: "",
    avatar_url: "",
    bio: ""
  };
}

async function showAuth() {
  app.innerHTML = `
    <div class="v-auth">
      <h1>VYRO</h1>
      <p class="v-muted" style="text-align:center">Short Video Community</p>

      <div class="v-card">
        <h2>Login / Signup</h2>

        <input class="v-input" id="email" type="email" placeholder="Email">
        <input class="v-input" id="password" type="password" placeholder="Password">

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

  document.querySelector("#login").onclick = async () => {
    out.textContent = "Login হচ্ছে...";

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value.trim(),
      password: password.value
    });

    if (error) {
      out.textContent = error.message;
      return;
    }

    currentUser = data.user;
    await home();
  };

  document.querySelector("#signup").onclick = async () => {
    if (!email.value.trim()) {
      out.textContent = "Email লিখো।";
      return;
    }

    if (password.value.length < 6) {
      out.textContent = "Password কমপক্ষে ৬ অক্ষরের হতে হবে।";
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value
    });

    if (error) {
      out.textContent = error.message;
      return;
    }

    if (data.session) {
      currentUser = data.user;
      await home();
    } else {
      out.textContent =
        "Account তৈরি হয়েছে। Email confirmation লাগলে Email যাচাই করো।";
    }
  };

  document.querySelector("#reset").onclick = async () => {
    if (!email.value.trim()) {
      out.textContent = "আগে Email লিখো।";
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.value.trim()
    );

    out.textContent = error
      ? error.message
      : "Reset email পাঠানো হয়েছে।";
  };
}

async function loadFeed() {
  const { data, error } = await supabase.from("videos")
    .select("id,user_id,title,video_url,thumbnail_url,status,views,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  videos = data || [];

  const ids = [...new Set(videos.map(v => v.user_id))];

  if (!ids.length) return;

  const { data: people, error: profileError } = await supabase.from("profiles")
    .select("id,username,full_name,avatar_url")
    .in("id", ids);

  if (profileError) console.warn(profileError.message);

  const map = {};
  (people || []).forEach(p => map[p.id] = p);

  videos = videos.map(v => ({
    ...v,
    owner: map[v.user_id] || {}
  }));
}

async function myVideos() {
  const { data, error } = await supabase.from("videos")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const list = data || [];
  if (!list.length) return [];

  const { data: owner } = await supabase.from("profiles")
    .select("id,username,full_name,avatar_url")
    .eq("id", currentUser.id)
    .maybeSingle();

  return list.map(v => ({ ...v, owner: owner || {} }));
}

async function getCounts(videoId) {
  const [likes, comments] = await Promise.all([
    supabase.from("likes")
      .select("id", { count: "exact", head: true })
      .eq("video_id", videoId),

    supabase.from("comments")
      .select("id", { count: "exact", head: true })
      .eq("video_id", videoId)
  ]);

  return {
    likes: likes.count || 0,
    comments: comments.count || 0
  };
}

async function hasLiked(videoId) {
  const { data } = await supabase.from("likes")
    .select("id")
    .eq("video_id", videoId)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  return !!data;
}

function videoCard(v, mine = false) {
  return `
    <article class="v-card" data-video-card="${esc(v.id)}">

      <div class="v-row">
        <img class="v-avatar"
          src="${esc(v.owner?.avatar_url || "")}"
          onerror="this.style.display='none'">

        <div>
          <b>${esc(v.owner?.username || v.owner?.full_name || "VYRO User")}</b>
          <div class="v-small">
            ${esc(v.created_at ? new Date(v.created_at).toLocaleDateString() : "")}
          </div>
        </div>
      </div>

      <video class="v-video"
        controls
        playsinline
        preload="metadata"
        data-view-video="${esc(v.id)}"
        src="${esc(v.video_url)}">
      </video>

      <h3>${esc(v.title || "Video")}</h3>

      <p class="v-muted">
        <span data-views="${esc(v.id)}">${Number(v.views || 0)}</span> views
      </p>

      <div class="v-actions">
        <button class="v-btn v-secondary"
          data-action="like"
          data-id="${esc(v.id)}">
          ♥ Like <span data-like-count="${esc(v.id)}">…</span>
        </button>

        <button class="v-btn v-secondary"
          data-action="comment"
          data-id="${esc(v.id)}">
          💬 Comment
        </button>

        <button class="v-btn v-secondary"
          data-action="share"
          data-id="${esc(v.id)}">
          ↗ Share
        </button>

        ${
          v.user_id !== currentUser.id
            ? `<button class="v-btn v-secondary"
                 data-action="follow"
                 data-user="${esc(v.user_id)}">＋ Follow</button>`
            : ""
        }

        ${
          mine
            ? `<button class="v-btn v-danger"
                 data-action="delete"
                 data-id="${esc(v.id)}">Delete</button>`
            : ""
        }
      </div>

      <div data-comments="${esc(v.id)}"></div>

    </article>
  `;
}

async function updateCardCounts() {
  for (const v of videos) {
    const counts = await getCounts(v.id);

    const count = document.querySelector(
      `[data-like-count="${CSS.escape(v.id)}"]`
    );

    if (count) count.textContent = counts.likes;
  }
}

async function renderHome() {
  const page = document.querySelector("#vPage");

  page.innerHTML = `
    <h2 class="v-title">Discover</h2>
    ${
      videos.length
        ? videos.map(v => videoCard(v)).join("")
        : `<div class="v-empty">এখনো ভিডিও নেই। Upload করে শুরু করো!</div>`
    }
  `;

  document.querySelectorAll("[data-view-video]").forEach(video => {
    video.addEventListener("play", () => {
      incrementViews(video.dataset.viewVideo);
    }, { once: true });
  });

  await updateCardCounts();
}

async function renderUpload() {
  document.querySelector("#vPage").innerHTML = `
    <h2 class="v-title">Upload Video</h2>

    <div class="v-card">
      <input class="v-input" id="title" maxlength="100"
        placeholder="Video title">

      <input class="v-input" id="file"
        type="file"
        accept="video/mp4,video/webm">

      <p class="v-muted">MP4/WebM · সর্বোচ্চ ৫০ MB</p>

      <button class="v-btn v-full" id="upload">Upload Video</button>

      <p class="v-muted" id="uploadMsg"></p>
    </div>
  `;

  document.querySelector("#upload").onclick = doUpload;
}

async function uploadFile(file, title) {
  const safeName = file.name
    ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    : "camera-video.mp4";

  const path = `${currentUser.id}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from("videos").upload(
    path,
    file,
    {
      contentType: file.type || "video/mp4",
      upsert: false
    }
  );

  if (error) throw error;

  const { data: publicData } =
    supabase.storage.from("videos").getPublicUrl(path);

  const { error: dbError } = await supabase.from("videos").insert({
    user_id: currentUser.id,
    title: title || "VYRO Video",
    video_url: publicData.publicUrl,
    thumbnail_url: null,
    status: "approved",
    views: 0
  });

  if (dbError) {
    await supabase.storage.from("videos").remove([path]);
    throw dbError;
  }
}

async function doUpload() {
  if (busy) return;

  const file = document.querySelector("#file")?.files?.[0];
  const title = document.querySelector("#title")?.value.trim();
  const out = document.querySelector("#uploadMsg");
  const button = document.querySelector("#upload");

  if (!file) return msg("ভিডিও নির্বাচন করো।");

  if (!["video/mp4", "video/webm"].includes(file.type)) {
    return msg("MP4 অথবা WebM ভিডিও দিতে হবে।");
  }

  if (file.size > 50 * 1024 * 1024) {
    return msg("ভিডিও ৫০ MB-এর বেশি।");
  }

  busy = true;
  button.disabled = true;
  out.textContent = "Upload হচ্ছে...";

  try {
    await uploadFile(file, title);

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

  const { data: v, error: fetchError } = await supabase.from("videos")
    .select("video_url")
    .eq("id", id)
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (fetchError || !v) return msg("ভিডিও পাওয়া যায়নি।");

  const marker = "/storage/v1/object/public/videos/";
  const idx = v.video_url.indexOf(marker);

  const path = idx < 0
    ? null
    : decodeURIComponent(v.video_url.slice(idx + marker.length));

  const { error } = await supabase.from("videos").delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) return msg("Delete Error: " + error.message);

  if (path) {
    await supabase.storage.from("videos").remove([path]);
  }

  await renderApp();
}

async function toggleLike(id) {
  const liked = await hasLiked(id);

  if (liked) {
    const { error } = await supabase.from("likes").delete()
      .eq("video_id", id)
      .eq("user_id", currentUser.id);

    if (error) return msg(error.message);
  } else {
    const { error } = await supabase.from("likes").insert({
      video_id: id,
      user_id: currentUser.id
    });

    if (error) return msg(error.message);
  }

  const counts = await getCounts(id);
  const el = document.querySelector(
    `[data-like-count="${CSS.escape(id)}"]`
  );

  if (el) el.textContent = counts.likes;
}

async function showComments(id) {
  const box = document.querySelector(
    `[data-comments="${CSS.escape(id)}"]`
  );

  if (!box) return;

  const { data, error } = await supabase.from("comments")
    .select("id,user_id,content,created_at")
    .eq("video_id", id)
    .order("created_at", { ascending: true });

  if (error) return msg(error.message);

  const people = {};

  for (const c of (data || [])) {
    if (!people[c.user_id]) {
      people[c.user_id] = await profileOf(c.user_id);
    }
  }

  box.innerHTML = `
    <div class="v-card">
      <h4>Comments (${(data || []).length})</h4>

      ${
        (data || []).map(c => `
          <div class="v-comment">
            <b>${esc(people[c.user_id]?.username || "User")}</b>
            <p>${esc(c.content)}</p>

            ${
              c.user_id === currentUser.id
                ? `<button class="v-btn v-danger"
                     data-action="delete-comment"
                     data-id="${esc(c.id)}">Delete</button>`
                : ""
            }
          </div>
        `).join("")
      }

      <input class="v-input"
        id="comment-input-${esc(id)}"
        placeholder="Comment লিখো...">

      <button class="v-btn"
        data-action="send-comment"
        data-id="${esc(id)}">Send</button>
    </div>
  `;
}

async function addComment(id) {
  const input = document.querySelector(
    `#comment-input-${CSS.escape(id)}`
  );

  const content = input?.value.trim();

  if (!content) return;

  const { error } = await supabase.from("comments").insert({
    video_id: id,
    user_id: currentUser.id,
    content
  });

  if (error) return msg(error.message);

  await showComments(id);
}

async function deleteComment(id) {
  const { error } = await supabase.from("comments").delete()
    .eq("id", id)
    .eq("user_id", currentUser.id);

  if (error) return msg(error.message);

  await renderApp();
}

async function toggleFollow(id, button) {
  if (id === currentUser.id) return;

  const { data, error: findError } = await supabase.from("follows")
    .select("follower_id")
    .eq("follower_id", currentUser.id)
    .eq("following_id", id)
    .maybeSingle();

  if (findError) return msg(findError.message);

  if (data) {
    const { error } = await supabase.from("follows").delete()
      .eq("follower_id", currentUser.id)
      .eq("following_id", id);

    if (error) return msg(error.message);

    if (button) button.textContent = "＋ Follow";
  } else {
    const { error } = await supabase.from("follows").insert({
      follower_id: currentUser.id,
      following_id: id
    });

    if (error) return msg(error.message);

    if (button) button.textContent = "✓ Following";
  }
}

async function shareVideo(id) {
  const v = videos.find(x => x.id === id);
  if (!v) return;

  const shareData = {
    title: v.title || "VYRO Video",
    url: v.video_url
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(v.video_url);
      msg("ভিডিও লিংক Copy হয়েছে।");
    } catch {
      msg(v.video_url);
    }
  }
}

async function incrementViews(id) {
  const el = document.querySelector(`[data-views="${CSS.escape(id)}"]`);
  const video = document.querySelector(
    `[data-view-video="${CSS.escape(id)}"]`
  );

  if (!video || video.dataset.counted) return;

  video.dataset.counted = "1";

  const current = Number(el?.textContent || 0) + 1;

  if (el) el.textContent = current;

  const { error } = await supabase.from("videos")
    .update({ views: current })
    .eq("id", id);

  if (error) console.warn("View update:", error.message);
}

async function renderProfile() {
  const page = document.querySelector("#vPage");
  const profile = await profileOf(currentUser.id);
  const mine = await myVideos();

  const { count: followers } = await supabase.from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", currentUser.id);

  const { count: following } = await supabase.from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", currentUser.id);

  page.innerHTML = `
    <div class="v-card">
      <div style="text-align:center">

        <img class="v-avatar"
          style="width:90px;height:90px"
          src="${esc(profile.avatar_url || "")}"
          onerror="this.style.display='none'">

        <h2>${esc(profile.full_name || profile.username || "My Profile")}</h2>
        <p>@${esc(profile.username || "user")}</p>
        <p>${esc(profile.bio || "")}</p>

        <div class="v-between" style="justify-content:center;gap:25px">
          <div>
            <b>${followers || 0}</b>
            <div class="v-small">Followers</div>
          </div>

          <div>
            <b>${following || 0}</b>
            <div class="v-small">Following</div>
          </div>

          <div>
            <b>${mine.length}</b>
            <div class="v-small">Videos</div>
          </div>
        </div>
      </div>

      <button class="v-btn v-full" data-action="edit-profile">
        Edit Profile
      </button>

      <button class="v-btn v-secondary v-full" data-action="avatar">
        Set Profile Photo (URL)
      </button>
    </div>

    <h3>My Videos</h3>

    ${
      mine.length
        ? mine.map(v => videoCard(v, true)).join("")
        : `<div class="v-empty">তোমার ভিডিও নেই।</div>`
    }
  `;

  page.querySelectorAll("[data-view-video]").forEach(video => {
    video.addEventListener("play", () => {
      incrementViews(video.dataset.viewVideo);
    }, { once: true });
  });

  for (const v of mine) {
    const counts = await getCounts(v.id);
    const el = page.querySelector(
      `[data-like-count="${CSS.escape(v.id)}"]`
    );
    if (el) el.textContent = counts.likes;
  }
}

async function editProfile() {
  const p = await profileOf(currentUser.id);

  const name = prompt("Full name:", p.full_name || "");
  if (name === null) return;

  const username = prompt("Username:", p.username || "");
  if (username === null) return;

  const bio = prompt("Bio:", p.bio || "");
  if (bio === null) return;

  const { error } = await supabase.from("profiles").upsert({
    id: currentUser.id,
    full_name: name,
    username,
    bio
  });

  if (error) return msg("Profile update error: " + error.message);

  await renderApp();
}

async function setAvatar() {
  const p = await profileOf(currentUser.id);

  const url = prompt(
    "Profile image URL (https://):",
    p.avatar_url || ""
  );

  if (url === null) return;

  const { error } = await supabase.from("profiles").upsert({
    id: currentUser.id,
    avatar_url: url
  });

  if (error) return msg(error.message);

  await renderApp();
}

async function renderCamera() {
  document.querySelector("#vPage").innerHTML = `
    <h2 class="v-title">Camera</h2>

    <div class="v-card">
      <video id="cameraPreview"
        class="v-video"
        autoplay muted playsinline></video>

      <input class="v-input" id="cameraTitle" placeholder="ভিডিওর নাম">

      <button class="v-btn v-full" id="cameraStart">Start Camera</button>

      <button class="v-btn v-full" id="cameraRecord" disabled>
        Record
      </button>

      <button class="v-btn v-secondary v-full" id="cameraStop" disabled>
        Stop & Upload
      </button>

      <p id="cameraMsg" class="v-muted"></p>
    </div>
  `;

  document.querySelector("#cameraStart").onclick = startCamera;
  document.querySelector("#cameraRecord").onclick = startRecord;
  document.querySelector("#cameraStop").onclick = stopRecord;
}

async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    document.querySelector("#cameraPreview").srcObject = cameraStream;
    document.querySelector("#cameraRecord").disabled = false;
  } catch (e) {
    msg("Camera Permission বা Camera Error: " + e.message);
  }
}

function startRecord() {
  if (!cameraStream) return;

  cameraChunks = [];

  const type = MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
    ? "video/webm;codecs=vp8"
    : "video/webm";

  recorder = new MediaRecorder(cameraStream, { mimeType: type });

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
    const blob = new Blob(cameraChunks, {
      type: recorder.mimeType || "video/webm"
    });

    const file = new File(
      [blob],
      `camera-${Date.now()}.webm`,
      { type: blob.type }
    );

    try {
      document.querySelector("#cameraMsg").textContent = "Upload হচ্ছে...";

      await uploadFile(
        file,
        document.querySelector("#cameraTitle").value.trim()
      );

      msg("ভিডিও আপলোড হয়েছে।");

      stopCamera();

      activeTab = "home";
      await renderApp();
    } catch (e) {
      document.querySelector("#cameraMsg").textContent =
        "Upload Error: " + e.message;
    }
  };

  recorder.stop();
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
  }

  cameraStream = null;
}

async function renderInbox() {
  const page = document.querySelector("#vPage");

  if (activeChat) {
    await renderChat(activeChat);
    return;
  }

  const { data: memberships, error } = await supabase.from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUser.id);

  if (error) {
    page.innerHTML = `
      <div class="v-card">Inbox Error: ${esc(error.message)}</div>
    `;
    return;
  }

  const ids = (memberships || []).map(x => x.conversation_id);

  if (!ids.length) {
    page.innerHTML = `
      <h2>Inbox</h2>

      <div class="v-card">
        <input class="v-input" id="chatUsername"
          placeholder="Username দিয়ে নতুন Chat">

        <button class="v-btn" id="newChat">Start Chat</button>
      </div>

      <div class="v-empty">কোনো মেসেজ নেই।</div>
    `;

    document.querySelector("#newChat").onclick = startChat;
    return;
  }

  const { data: chats, error: chatError } = await supabase.from("conversations")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (chatError) {
    page.innerHTML = `Inbox Error: ${esc(chatError.message)}`;
    return;
  }

  let html = `
    <h2>Inbox</h2>

    <div class="v-card">
      <input class="v-input" id="chatUsername"
        placeholder="Username দিয়ে নতুন Chat">

      <button class="v-btn" id="newChat">Start Chat</button>
    </div>
  `;

  for (const c of (chats || [])) {
    const { data: members } = await supabase.from("conversation_members")
      .select("user_id")
      .eq("conversation_id", c.id);

    const other = (members || []).find(
      m => m.user_id !== currentUser.id
    );

    const p = other ? await profileOf(other.user_id) : {};

    html += `
      <div class="v-card v-row"
        data-action="open-chat"
        data-chat="${esc(c.id)}">

        <img class="v-avatar"
          src="${esc(p.avatar_url || "")}"
          onerror="this.style.display='none'">

        <div>
          <b>${esc(p.username || p.full_name || "Chat")}</b>
          <div class="v-small">Open conversation</div>
        </div>
      </div>
    `;
  }

  page.innerHTML = html;

  document.querySelector("#newChat").onclick = startChat;

  page.querySelectorAll("[data-action='open-chat']").forEach(el => {
    el.onclick = async () => {
      activeChat = el.dataset.chat;
      await renderApp();
    };
  });
}

async function startChat() {
  const username = document.querySelector("#chatUsername")?.value.trim();

  if (!username) return msg("Username লিখো।");

  const { data: p, error } = await supabase.from("profiles")
    .select("id,username")
    .eq("username", username)
    .maybeSingle();

  if (error || !p) return msg("User পাওয়া যায়নি।");

  if (p.id === currentUser.id) {
    return msg("নিজেকে মেসেজ করা যাবে না।");
  }

  const { data: mine, error: mineError } = await supabase.from("conversation_members")
    .select("conversation_id")
    .eq("user_id", currentUser.id);

  if (mineError) return msg(mineError.message);

  const myIds = (mine || []).map(x => x.conversation_id);

  for (const id of myIds) {
    const { data: members } = await supabase.from("conversation_members")
      .select("user_id")
      .eq("conversation_id", id);

    if (
      (members || []).length === 2 &&
      members.some(m => m.user_id === p.id)
    ) {
      activeChat = id;
      await renderApp();
      return;
    }
  }

  const { data: conv, error: ce } = await supabase.from("conversations")
    .insert({})
    .select("id")
    .single();

  if (ce) return msg("Conversation Error: " + ce.message);

  const { error: me } = await supabase.from("conversation_members")
    .insert([
      { conversation_id: conv.id, user_id: currentUser.id },
      { conversation_id: conv.id, user_id: p.id }
    ]);

  if (me) return msg("Member Error: " + me.message);

  activeChat = conv.id;
  await renderApp();
}

async function renderChat(id) {
  const page = document.querySelector("#vPage");

  const { data: messages, error } = await supabase.from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    page.innerHTML = `Chat Error: ${esc(error.message)}`;
    return;
  }

  page.innerHTML = `
    <button class="v-btn v-secondary" data-action="back-inbox">
      ← Inbox
    </button>

    <h2>Messages</h2>

    <div class="v-card v-chat" id="chatMessages">
      ${
        (messages || []).map(m => `
          <div class="v-bubble ${m.sender_id === currentUser.id ? "mine" : ""}">
            ${esc(m.content)}
            <div class="v-small">${new Date(m.created_at).toLocaleString()}</div>
          </div>
        `).join("")
      }
    </div>

    <input class="v-input" id="messageInput" placeholder="Message লিখো...">

    <button class="v-btn v-full" id="sendMessage">Send</button>
  `;

  const chatBox = document.querySelector("#chatMessages");
  if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

  document.querySelector("#sendMessage").onclick = async () => {
    const input = document.querySelector("#messageInput");
    const content = input.value.trim();

    if (!content) return;

    const { error: se } = await supabase.from("messages").insert({
      conversation_id: id,
      sender_id: currentUser.id,
      content,
      is_read: false
    });

    if (se) return msg("Send Error: " + se.message);

    await renderChat(id);
  };
}

function bindGlobal() {
  app.onclick = async e => {
    const el = e.target.closest("[data-action]");
    if (!el) return;

    const action = el.dataset.action;

    if (action === "like") await toggleLike(el.dataset.id);
    if (action === "comment") await showComments(el.dataset.id);
    if (action === "send-comment") await addComment(el.dataset.id);
    if (action === "delete-comment") await deleteComment(el.dataset.id);
    if (action === "share") await shareVideo(el.dataset.id);
    if (action === "follow") await toggleFollow(el.dataset.user, el);
    if (action === "delete") await deleteVideo(el.dataset.id);
    if (action === "edit-profile") await editProfile();
    if (action === "avatar") await setAvatar();

    if (action === "back-inbox") {
      activeChat = null;
      await renderApp();
    }
  };
}

async function renderApp() {
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

    await supabase.auth.signOut();

    currentUser = null;
    activeChat = null;

    showAuth();
  };

  document.querySelectorAll("[data-tab]").forEach(b => {
    b.classList.toggle("active", b.dataset.tab === activeTab);

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
      await renderProfile();
    } else if (activeTab === "inbox") {
      await renderInbox();
    }
  } catch (e) {
    page.innerHTML = `
      <div class="v-card">Error: ${esc(e.message)}</div>
    `;
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

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error(error);
    return showAuth();
  }

  currentUser = data.session?.user || null;

  if (currentUser) {
    await home();
  } else {
    showAuth();
  }
}

start();
