import React, { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://bcsgrgxxkrmeewoedqne.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2dyZ3h4a3JtZWV3b2VkcW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTAwMjcsImV4cCI6MjA5MTIyNjAyN30.oHQQTmRkee4jgB4_BccrbExlvRsfLg15QILZzwKBX3I";

const sbFetch = (path, options = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...(options.headers || {}),
    },
  });

async function dbLoad(uid) {
  const res = await sbFetch(`fitrival_users?id=eq.${uid}&select=data`);
  if (!res.ok) return null;
  const rows = await res.json();
  return rows.length ? JSON.parse(rows[0].data) : null;
}

async function dbSave(uid, userData) {
  const res = await sbFetch(`fitrival_users`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: uid, data: JSON.stringify(userData) }),
  });
  return res.ok;
}

// ─── Константы ────────────────────────────────────────────────────────────────
const USERS = {
  sofia:  { name: "София",    emoji: "🌸", color: "#E8628A", light: "#FDE8EF" },
  friend: { name: "Стефания", emoji: "🌷", color: "#A96CC8", light: "#F3E8FF" },
};

const EXERCISES = ["Бег","Велосипед","Тренажёрный зал","Плавание","Йога","Пилатес","HIIT","Ходьба","Танцы","Растяжка","Другое"];

const BADGES = [
  { id: "first_workout", icon: "✨", label: "Первый шаг",      desc: "Записать первую тренировку" },
  { id: "five_workouts", icon: "💫", label: "Всерьёз взялась", desc: "Записать 5 тренировок" },
  { id: "first_weight",  icon: "🎀", label: "Взвесилась!",     desc: "Записать первый вес" },
  { id: "weight_loss",   icon: "🌟", label: "Легче!",           desc: "Похудеть на 0,5 кг" },
  { id: "first_photo",   icon: "📸", label: "Красотка",         desc: "Поделиться фото прогресса" },
  { id: "three_photos",  icon: "🌺", label: "Фотограф",         desc: "Поделиться 3 фото" },
  { id: "beat_friend",   icon: "👑", label: "Королева",         desc: "Занять первое место" },
];

const POINTS = { workout: 10, weight: 5, photo: 15, badge: 20 };
// 👉 NEW: dynamic workout points
const getWorkoutPoints = (minutes) => {
  if (!minutes) return 0;
  return Math.round(minutes * 0.5);
};
const EMPTY = {
  workouts: [],
  weights: [],
  photos: [],
  badges: [],
  avatar: "",
  name: "",
  rival: ""
};

const today   = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
const calcPoints = (u = {}) =>
  (u.workouts || []).reduce((sum, w) => sum + (w?.points || 0), 0) +
  (u.weights || []).length * POINTS.weight +
  (u.photos || []).length * POINTS.photo +
  (u.badges || []).length * POINTS.badge;

function checkBadges(user) {
  const e = new Set(user.badges);
  if (user.workouts.length >= 1) e.add("first_workout");
  if (user.workouts.length >= 5) e.add("five_workouts");
  if (user.weights.length  >= 1) e.add("first_weight");
  if (user.photos.length   >= 1) e.add("first_photo");
  if (user.photos.length   >= 3) e.add("three_photos");
  if (user.weights.length  >= 2) {
    const s = [...user.weights].sort((a, b) => new Date(a.date) - new Date(b.date));
    if (s[0].value - s[s.length - 1].value >= 0.5) e.add("weight_loss");
  }
  return [...e];
}

export default function FitDuelia() {
  const [whoAmI,    setWhoAmI]    = React.useState(null);
  const [data,      setData]      = React.useState({ sofia: EMPTY, friend: EMPTY });
  const [loading,   setLoading]   = React.useState(true);
  const [dbError,   setDbError]   = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("dashboard");
  const [modal,     setModal]     = React.useState(null);
  const [form,      setForm]      = React.useState({});
  const [toast,     setToast]     = React.useState(null);
  const [saving,    setSaving]    = React.useState(false);

  const loadData = React.useCallback(async () => {
    try {
      const [sofiaData, friendData] = await Promise.all([dbLoad("sofia"), dbLoad("friend")]);
      setData({
  sofia: { ...EMPTY, ...(sofiaData || {}) },
  friend: { ...EMPTY, ...(friendData || {}) }
});
      setDbError(false);
    } catch (e) {
      setDbError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);
  React.useEffect(() => { const t = setInterval(loadData, 20000); return () => clearInterval(t); }, [loadData]);

  const saveUser = async (uid, userData) => {
    setSaving(true);
    const ok = await dbSave(uid, userData);
    setSaving(false);
    if (!ok) showToast("⚠️ Ошибка сохранения");
    return ok;
  };

  const addWorkout = async () => {
  if (!form.type || !form.minutes) return;

  const cur = { ...data[whoAmI] };

  const minutes = parseInt(form.minutes);

  cur.workouts = [
    {
      id: Date.now(),
      type: form.type,
      minutes: minutes,
      date: form.date || today(), // 📅 allows past date
      note: form.note || "",
      points: getWorkoutPoints(minutes) // 💪 dynamic points
    },
    ...cur.workouts
  ];

  cur.badges = checkBadges(cur);

  setData(p => ({ ...p, [whoAmI]: cur }));
  await saveUser(whoAmI, cur);

  showToast(`+${getWorkoutPoints(minutes)} очков! ${form.type} записана ✨`);

  setModal(null);
  setForm({});
};

  const addWeight = async () => {
    if (!form.weight) return;
    const cur = { ...data[whoAmI] };
    cur.weights = [{ value: parseFloat(form.weight), date: today() }, ...cur.weights];
    cur.badges = checkBadges(cur);
    setData(p => ({ ...p, [whoAmI]: cur }));
    await saveUser(whoAmI, cur);
    showToast(`+${POINTS.weight} очков! Вес записан 🎀`);
    setModal(null); setForm({});
  };

  const addPhoto = async () => {
    if (!form.photoUrl && !form.caption) return;
    const cur = { ...data[whoAmI] };
    cur.photos = [{ id: Date.now(), url: form.photoUrl || "", caption: form.caption || "Мой прогресс 🌸", date: today() }, ...cur.photos];
    cur.badges = checkBadges(cur);
    setData(p => ({ ...p, [whoAmI]: cur }));
    await saveUser(whoAmI, cur);
    showToast(`+${POINTS.photo} очков! Фото опубликовано 📸`);
    setModal(null); setForm({});
  };

  const resetData = async () => {
    if (!confirm("Сбросить все твои данные? Это нельзя отменить.")) return;
    setData(p => ({ ...p, [whoAmI]: EMPTY }));
    await saveUser(whoAmI, EMPTY);
    showToast("Данные сброшены.");
  };

  const friendId   = whoAmI === "sofia" ? "friend" : "sofia";
  const myData     = whoAmI ? data[whoAmI]   : EMPTY;
  const friendData = whoAmI ? data[friendId] : EMPTY;
  const myPts      = calcPoints(myData);
  const friendPts  = calcPoints(friendData);
  const iWin       = myPts >= friendPts;
  const diff       = Math.abs(myPts - friendPts);
  const latestWeight = (uid) => { const w = data[uid].weights; return w.length ? w[0].value : null; };
  const weightChange = (uid) => {
    const w = data[uid].weights;
    if (w.length < 2) return null;
    const s = [...w].sort((a, b) => new Date(a.date) - new Date(b.date));
    return (s[s.length - 1].value - s[0].value).toFixed(1);
  };

  // ── Экран выбора ──────────────────────────────────────────────────────────
  if (!whoAmI) {
    return (
      <div style={S.root}>
        <style>{css}</style>
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, background:"#FDF6F9" }}>
          <div style={{ fontSize:13, letterSpacing:6, color:"#C4819B", fontWeight:500, marginBottom:10, textTransform:"uppercase" }}>fitduelia</div>
          <div style={{ fontSize:30, fontWeight:700, color:"#2D1A24", marginBottom:6, textAlign:"center", fontFamily:"'Playfair Display', Georgia, serif" }}>Привет, красотка! 🌸</div>
          <div style={{ color:"#A0748A", fontSize:14, marginBottom:44, textAlign:"center", lineHeight:1.7, maxWidth:280 }}>
            Выбери свой профиль — ваш прогресс синхронизируется автоматически.
          </div>
          {dbError && (
            <div style={{ background:"#FDE8EF", border:"1px solid #E8628A44", borderRadius:14, padding:"12px 16px", marginBottom:20, fontSize:12, color:"#C0446A", maxWidth:300, lineHeight:1.6, textAlign:"center" }}>
              ⚠️ Не удалось подключиться к базе данных. Проверь таблицу fitrival_users в Supabase.
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:300 }}>
            {Object.entries(USERS).map(([key, u]) => (
              <button key={key} onClick={() => setWhoAmI(key)} className="profile-btn"
                style={{ background:"white", border:`1.5px solid ${u.color}33`, borderRadius:20, padding:"20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, fontFamily:"inherit", boxShadow:`0 4px 20px ${u.color}15` }}>
                <div style={{ width:52, height:52, borderRadius:"50%", background:u.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{u.emoji}</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:17, fontWeight:700, color:"#2D1A24" }}>{u.name}</div>
                  <div style={{ fontSize:12, color:"#A0748A", marginTop:2 }}>Нажми, чтобы войти</div>
                </div>
                <div style={{ marginLeft:"auto", color:u.color, fontSize:18 }}>›</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop:36, fontSize:11, color:"#C4A8B6", textAlign:"center", maxWidth:260, lineHeight:1.7 }}>
            🔒 Данные сохраняются навсегда и не исчезают при обновлении
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...S.root, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#FDF6F9" }}>
        <style>{css}</style>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }} className="spin">🌸</div>
          <div style={{ color:"#A0748A", fontSize:14 }}>Загружаем ваш прогресс…</div>
        </div>
      </div>
    );
  }

  const myUser    = USERS[whoAmI];
  const theirUser = USERS[friendId];

  const TABS = [
    { id:"dashboard", icon:"✨", label:"Главная" },
    { id:"workouts",  icon:"💪", label:"Тренировки" },
    { id:"weight",    icon:"🎀", label:"Вес" },
    { id:"photos",    icon:"📸", label:"Фото" },
    { id:"badges",    icon:"👑", label:"Значки" },
  ];

  return (
    <div style={{ ...S.root, background:"#FDF6F9" }}>
      <style>{css}</style>
      <div style={{ maxWidth:500, margin:"0 auto", padding:"0 0 40px" }}>

        {/* Шапка */}
        <div style={{ background:"white", padding:"18px 20px 14px", borderBottom:"1px solid #F2E6ED", marginBottom:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:11, letterSpacing:5, color:"#C4819B", fontWeight:500, textTransform:"uppercase", marginBottom:2 }}>fitduelia</div>
              <div style={{ fontSize:17, fontWeight:700, color:"#2D1A24" }}>Привет, {myUser.emoji} {myUser.name}!</div>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {saving && <div style={{ fontSize:10, color:"#C4A8B6" }}>сохраняем…</div>}
              <button onClick={() => { loadData(); showToast("Обновлено! 🌸"); }} className="soft-btn">↻</button>
              <button onClick={() => setWhoAmI(null)} className="soft-btn">Выйти</button>
            </div>
          </div>
        </div>

        <div style={{ padding:"16px 16px 0" }}>

          {/* Карточка очков */}
          <div style={{ background:"white", borderRadius:24, padding:20, marginBottom:16, border:"1px solid #F2E6ED", boxShadow:"0 4px 24px #E8628A0D" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <div style={{ textAlign:"center", flex:1 }}>
                <div style={{ fontSize:38, fontWeight:800, color:myUser.color, lineHeight:1 }}>{myPts}</div>
                <div style={{ fontSize:11, color:"#C4A8B6", marginTop:4 }}>{myUser.emoji} {myUser.name}</div>
              </div>
              <div style={{ textAlign:"center", padding:"0 16px" }}>
                <div style={{ fontSize:22, marginBottom:4 }}>{iWin ? "👑" : "🌷"}</div>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:1, color: iWin ? myUser.color : theirUser.color, textTransform:"uppercase" }}>
                  {iWin ? (diff === 0 ? "Ничья" : `+${diff} впереди`) : `${diff} позади`}
                </div>
              </div>
              <div style={{ textAlign:"center", flex:1 }}>
                <div style={{ fontSize:38, fontWeight:800, color:theirUser.color, lineHeight:1 }}>{friendPts}</div>
                <div style={{ fontSize:11, color:"#C4A8B6", marginTop:4 }}>{theirUser.emoji} {theirUser.name}</div>
              </div>
            </div>
            <div style={{ height:6, background:"#FAF0F4", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(myPts/(myPts+friendPts||1))*100}%`, background:`linear-gradient(90deg, ${myUser.color}, ${myUser.color}bb)`, borderRadius:99, transition:"width 0.6s ease" }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10, color:"#D4AABB" }}>
              <span>{myUser.name}: {Math.round((myPts/(myPts+friendPts||1))*100)}%</span>
              <span>{theirUser.name}: {Math.round((friendPts/(myPts+friendPts||1))*100)}%</span>
            </div>
          </div>

          {/* Вкладки */}
          <div style={{ display:"flex", gap:6, marginBottom:16, overflowX:"auto", paddingBottom:2 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} className="tab-btn"
                style={{ flexShrink:0, background: activeTab===t.id ? myUser.color : "white", border: activeTab===t.id ? "none" : "1px solid #F0E0E8", borderRadius:99, padding:"8px 16px", cursor:"pointer", color: activeTab===t.id ? "white" : "#A0748A", fontSize:12, fontWeight:600, fontFamily:"inherit", transition:"all 0.2s", boxShadow: activeTab===t.id ? `0 4px 14px ${myUser.color}40` : "none" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* ── ГЛАВНАЯ ── */}
          {activeTab === "dashboard" && (
            <div className="tab-content">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                {[
                  { label:"Тренировки",  my: myData.workouts.length,   their: friendData.workouts.length,   icon:"💪" },
                  { label:"Текущий вес", my: latestWeight(whoAmI) ? latestWeight(whoAmI)+" кг" : "—", their: latestWeight(friendId) ? latestWeight(friendId)+" кг" : "—", icon:"⚖️" },
                  { label:"Результат",   my: weightChange(whoAmI)  !== null ? Math.abs(weightChange(whoAmI))+" кг"  : "—", their: weightChange(friendId) !== null ? Math.abs(weightChange(friendId))+" кг" : "—", icon:"🌟" },
                  { label:"Значки",      my: myData.badges.length,     their: friendData.badges.length,     icon:"👑" },
                ].map(s => (
                  <div key={s.label} style={{ background:"white", borderRadius:18, padding:"14px 14px 12px", border:"1px solid #F0E0E8" }}>
                    <div style={{ fontSize:20, marginBottom:8 }}>{s.icon}</div>
                    <div style={{ fontSize:10, color:"#C4A8B6", marginBottom:8, fontWeight:500 }}>{s.label}</div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                      <div><div style={{ fontSize:17, fontWeight:700, color:myUser.color }}>{s.my}</div><div style={{ fontSize:9, color:"#D4AABB" }}>Я</div></div>
                      <div style={{ textAlign:"right" }}><div style={{ fontSize:17, fontWeight:700, color:theirUser.color }}>{s.their}</div><div style={{ fontSize:9, color:"#D4AABB" }}>Она</div></div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                {[
                  { icon:"💪", label:"Тренировка", pts:"+10", action:() => setModal("workout") },
                  { icon:"⚖️", label:"Вес",         pts:"+5",  action:() => setModal("weight") },
                  { icon:"📸", label:"Фото",         pts:"+15", action:() => setModal("photo") },
                ].map(a => (
                  <button key={a.label} onClick={a.action} className="action-btn"
                    style={{ background:"white", border:"1px solid #F0E0E8", borderRadius:18, padding:"16px 8px", cursor:"pointer", color:"#2D1A24", fontFamily:"inherit", textAlign:"center", transition:"all 0.2s" }}>
                    <div style={{ fontSize:24, marginBottom:6 }}>{a.icon}</div>
                    <div style={{ fontSize:11, fontWeight:600, marginBottom:3, color:"#5A3549" }}>{a.label}</div>
                    <div style={{ fontSize:10, color:myUser.color, fontWeight:700 }}>{a.pts} очков</div>
                  </button>
                ))}
              </div>

              <div style={{ fontSize:12, fontWeight:700, marginBottom:10, color:"#C4A8B6", letterSpacing:1, textTransform:"uppercase" }}>Последняя активность</div>
              {[
                ...myData.workouts.slice(0,2).map(w => ({ ...w, kind:"workout", owner:whoAmI })),
                ...friendData.workouts.slice(0,2).map(w => ({ ...w, kind:"workout", owner:friendId })),
                ...myData.weights.slice(0,1).map(w => ({ ...w, kind:"weight", owner:whoAmI })),
                ...friendData.weights.slice(0,1).map(w => ({ ...w, kind:"weight", owner:friendId })),
              ].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5).map((item,i) => {
                const u = USERS[item.owner];
                return (
                  <div key={i} style={{ background:"white", borderRadius:16, padding:"12px 14px", marginBottom:8, border:"1px solid #F0E0E8", borderLeft:`3px solid ${u.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:34, height:34, borderRadius:"50%", background:u.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>
                          {item.kind==="workout" ? "🏃" : "⚖️"}
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:"#2D1A24" }}>{item.kind==="workout" ? `${item.type} • ${item.minutes} мин` : `${item.value} кг`}</div>
                          {item.note && <div style={{ fontSize:11, color:"#C4A8B6" }}>{item.note}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:10, color:u.color, fontWeight:700 }}>{u.emoji} {u.name}</div>
                        <div style={{ fontSize:10, color:"#D4AABB" }}>{fmtDate(item.date)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {myData.workouts.length===0 && friendData.workouts.length===0 && (
                <div style={{ textAlign:"center", padding:36, color:"#D4AABB", fontSize:13 }}>Пока ничего нет — будь первой! 🌸</div>
              )}
            </div>
          )}

          {/* ── ТРЕНИРОВКИ ── */}
          {activeTab === "workouts" && (
            <div className="tab-content">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"#2D1A24" }}>Все тренировки</div>
                <button className="pill-btn" style={{ background:myUser.color }} onClick={() => setModal("workout")}>+ Добавить</button>
              </div>
              {[...myData.workouts.map(w => ({ ...w, owner:whoAmI })), ...friendData.workouts.map(w => ({ ...w, owner:friendId }))].sort((a,b) => b.id-a.id).map((w,i) => {
                const u = USERS[w.owner];
                return (
                  <div key={i} style={{ background:"white", borderRadius:16, padding:"14px 16px", marginBottom:10, border:"1px solid #F0E0E8", borderLeft:`3px solid ${u.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:"#2D1A24", marginBottom:4 }}>{w.type}
                          <span style={{ fontSize:10, background:u.light, color:u.color, padding:"2px 8px", borderRadius:99, marginLeft:8, fontWeight:600 }}>{u.emoji} {u.name}</span>
                        </div>
                        {w.note && <div style={{ fontSize:12, color:"#C4A8B6" }}>{w.note}</div>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:18, fontWeight:700, color:u.color }}>{w.minutes} мин</div>
                        <div style={{ fontSize:10, color:"#D4AABB" }}>{fmtDate(w.date)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {myData.workouts.length===0 && friendData.workouts.length===0 && (
                <div style={{ textAlign:"center", padding:40, color:"#D4AABB" }}>Тренировок пока нет. Вперёд! 💪</div>
              )}
            </div>
          )}

          {/* ── ВЕС ── */}
          {activeTab === "weight" && (
            <div className="tab-content">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"#2D1A24" }}>Дневник веса</div>
                <button className="pill-btn" style={{ background:myUser.color }} onClick={() => setModal("weight")}>+ Записать</button>
              </div>
              {[whoAmI, friendId].map(uid => {
                const u = USERS[uid]; const wts = data[uid].weights; const chg = weightChange(uid);
                return (
                  <div key={uid} style={{ background:"white", borderRadius:20, padding:16, marginBottom:14, border:"1px solid #F0E0E8" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <div style={{ width:36, height:36, borderRadius:"50%", background:u.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{u.emoji}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:"#2D1A24" }}>{u.name}</div>
                      </div>
                      {chg !== null && <div style={{ fontSize:12, fontWeight:700, color: parseFloat(chg)<=0 ? "#5CC98F" : "#E86262" }}>{parseFloat(chg)<=0 ? `↓ −${Math.abs(chg)} кг` : `↑ +${chg} кг`}</div>}
                    </div>
                    {wts.length > 0 ? (
                      <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
                        {[...wts].reverse().map((w,i) => (
                          <div key={i} style={{ background:u.light, borderRadius:12, padding:"10px 14px", textAlign:"center", flexShrink:0, minWidth:58 }}>
                            <div style={{ fontSize:15, fontWeight:700, color:u.color }}>{w.value}</div>
                            <div style={{ fontSize:9, color:u.color+"99", marginTop:2 }}>кг</div>
                            <div style={{ fontSize:9, color:u.color+"88", marginTop:4 }}>{fmtDate(w.date)}</div>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ color:"#D4AABB", fontSize:12, textAlign:"center", padding:16 }}>Записей пока нет</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── ФОТО ── */}
          {activeTab === "photos" && (
            <div className="tab-content">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontSize:16, fontWeight:700, color:"#2D1A24" }}>Фото прогресса</div>
                <button className="pill-btn" style={{ background:myUser.color }} onClick={() => setModal("photo")}>+ Добавить</button>
              </div>
              {[...myData.photos.map(p => ({ ...p, owner:whoAmI })), ...friendData.photos.map(p => ({ ...p, owner:friendId }))].sort((a,b) => b.id-a.id).length === 0 ? (
                <div style={{ background:"white", borderRadius:24, padding:48, textAlign:"center", border:"1px solid #F0E0E8" }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
                  <div style={{ color:"#D4AABB", fontSize:13 }}>Фото пока нет — добавь первое и получи 15 очков!</div>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[...myData.photos.map(p => ({ ...p, owner:whoAmI })), ...friendData.photos.map(p => ({ ...p, owner:friendId }))].sort((a,b) => b.id-a.id).map((p,i) => {
                    const u = USERS[p.owner];
                    return (
                      <div key={i} style={{ background:"white", borderRadius:20, overflow:"hidden", border:"1px solid #F0E0E8" }}>
                        <div style={{ height:130, background:u.light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:52 }}>
                          {p.url ? <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { e.target.style.display="none"; }} /> : u.emoji}
                        </div>
                        <div style={{ padding:10 }}>
                          <div style={{ fontSize:10, color:u.color, fontWeight:700, marginBottom:4 }}>{u.emoji} {u.name}</div>
                          <div style={{ fontSize:11, color:"#5A3549" }}>{p.caption}</div>
                          <div style={{ fontSize:9, color:"#D4AABB", marginTop:4 }}>{fmtDate(p.date)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ЗНАЧКИ ── */}
          {activeTab === "badges" && (
            <div className="tab-content">
              <div style={{ fontSize:16, fontWeight:700, color:"#2D1A24", marginBottom:14 }}>Достижения</div>
              {[whoAmI, friendId].map(uid => {
                const u = USERS[uid];
                return (
                  <div key={uid} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:12, color:"#C4A8B6", fontWeight:600, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ width:24, height:24, borderRadius:"50%", background:u.light, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>{u.emoji}</span>
                      {u.name} — {data[uid].badges.length} из {BADGES.length} получено
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                      {BADGES.map(b => {
                        const unlocked = data[uid].badges.includes(b.id);
                        return (
                          <div key={b.id} style={{ background: unlocked ? "white" : "#FAFAFA", borderRadius:16, padding:12, display:"flex", gap:10, alignItems:"center", opacity: unlocked?1:0.4, filter: unlocked?"none":"grayscale(1)", border: unlocked ? `1px solid ${u.color}22` : "1px solid #F0E0E8", boxShadow: unlocked ? `0 2px 12px ${u.color}10` : "none" }}>
                            <div style={{ width:36, height:36, borderRadius:"50%", background: unlocked ? u.light : "#F5F0F3", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{b.icon}</div>
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color: unlocked ? "#2D1A24" : "#C4A8B6" }}>{b.label}</div>
                              <div style={{ fontSize:9, color:"#D4AABB", marginTop:2 }}>{b.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <button onClick={resetData} style={{ background:"transparent", border:"1px solid #F0E0E8", borderRadius:10, padding:"10px 16px", cursor:"pointer", color:"#D4AABB", fontSize:12, fontFamily:"inherit", marginTop:8 }}>
                Сбросить мои данные
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ── МОДАЛЬНЫЕ ОКНА ── */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(45,26,36,0.4)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:100, backdropFilter:"blur(6px)" }} onClick={() => setModal(null)}>
          <div style={{ background:"white", width:"100%", maxWidth:500, borderRadius:"24px 24px 0 0", padding:"28px 24px 40px", animation:"slideUp 0.3s ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:40, height:4, background:"#F0E0E8", borderRadius:99, margin:"0 auto 24px" }} />

            {modal === "workout" && <>
              <div style={{ fontSize:18, fontWeight:700, color:"#2D1A24", marginBottom:18 }}>💪 Записать тренировку</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <select className="girly-input" value={form.type||""} onChange={e => setForm({...form, type:e.target.value})}>
                  <option value="">Выбери вид нагрузки…</option>
                  {EXERCISES.map(e => <option key={e}>{e}</option>)}
                </select>
                <input className="girly-input" type="number" placeholder="Длительность в минутах" value={form.minutes||""} onChange={e => setForm({...form, minutes:e.target.value})} />
                <input className="girly-input" type="text" placeholder="Заметка (необязательно) 🌸" value={form.note||""} onChange={e => setForm({...form, note:e.target.value})} />
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="ghost-btn" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="pill-btn" style={{ flex:2, background:myUser.color, padding:"13px 0" }} onClick={addWorkout}>Записать +10 очков ✨</button>
                </div>
              </div>
            </>}

            {modal === "weight" && <>
              <div style={{ fontSize:18, fontWeight:700, color:"#2D1A24", marginBottom:18 }}>🎀 Записать вес</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <input className="girly-input" type="number" step="0.1" placeholder="Вес в кг (напр. 65.5)" value={form.weight||""} onChange={e => setForm({...form, weight:e.target.value})} />
                <div style={{ fontSize:11, color:"#C4A8B6" }}>Сегодня: {today()}</div>
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="ghost-btn" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="pill-btn" style={{ flex:2, background:myUser.color, padding:"13px 0" }} onClick={addWeight}>Записать +5 очков 🎀</button>
                </div>
              </div>
            </>}

            {modal === "photo" && <>
              <div style={{ fontSize:18, fontWeight:700, color:"#2D1A24", marginBottom:18 }}>📸 Поделиться фото</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <input className="girly-input" type="url" placeholder="Ссылка на фото (Imgur, Google Фото…)" value={form.photoUrl||""} onChange={e => setForm({...form, photoUrl:e.target.value})} />
                <input className="girly-input" type="text" placeholder="Подпись (напр. Неделя 3 🌸)" value={form.caption||""} onChange={e => setForm({...form, caption:e.target.value})} />
                <div style={{ background:"#FDF0F5", borderRadius:12, padding:10, fontSize:11, color:"#C4819B", lineHeight:1.6 }}>
                  💡 Загрузи фото на <strong>imgur.com</strong>, правая кнопка → «Копировать адрес», вставь сюда.
                </div>
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="ghost-btn" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="pill-btn" style={{ flex:2, background:myUser.color, padding:"13px 0" }} onClick={addPhoto}>Поделиться +15 очков 📸</button>
                </div>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* Тост */}
      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:myUser?.color||"#E8628A", color:"white", padding:"12px 24px", borderRadius:99, fontSize:13, fontWeight:600, zIndex:200, whiteSpace:"nowrap", boxShadow:`0 8px 30px ${myUser?.color||"#E8628A"}55`, animation:"toastIn 0.3s ease" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const S = { root: { fontFamily:"'DM Sans', -apple-system, sans-serif", color:"#2D1A24", minHeight:"100vh" } };

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:#FDF0F5; }
  ::-webkit-scrollbar-thumb { background:#E8A0B8; border-radius:2px; }
  .profile-btn { transition:all 0.2s; }
  .profile-btn:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(232,98,138,0.15) !important; }
  .tab-btn { transition:all 0.2s; }
  .tab-btn:hover { transform:translateY(-1px); }
  .action-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(232,98,138,0.12) !important; border-color:#E8A0B8 !important; }
  .tab-content { animation:fadeUp 0.25s ease; }
  .soft-btn { background:#FDF0F5; border:none; border-radius:10px; padding:8px 12px; cursor:pointer; color:#C4819B; font-family:inherit; font-size:12px; font-weight:500; transition:all 0.2s; }
  .soft-btn:hover { background:#FAE0EA; }
  .pill-btn { color:white; border:none; border-radius:99px; padding:11px 20px; font-family:inherit; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s; }
  .pill-btn:hover { filter:brightness(1.05); transform:translateY(-1px); }
  .ghost-btn { background:white; color:#A0748A; border:1.5px solid #F0E0E8; border-radius:99px; padding:11px 20px; font-family:inherit; font-weight:500; font-size:13px; cursor:pointer; }
  .girly-input { background:#FDF6F9; border:1.5px solid #F0E0E8; border-radius:14px; padding:13px 16px; color:#2D1A24; font-family:inherit; font-size:14px; width:100%; outline:none; transition:border 0.2s; }
  .girly-input:focus { border-color:#E8628A; }
  .girly-input::placeholder { color:#D4AABB; }
  select.girly-input option { background:white; color:#2D1A24; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
  @keyframes toastIn { from { transform:translateX(-50%) translateY(20px); opacity:0; } to { transform:translateX(-50%) translateY(0); opacity:1; } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .spin { display:inline-block; animation:spin 1.5s linear infinite; }
`;
