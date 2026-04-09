import { useState, useEffect, useCallback } from "react";

// ─── Supabase config ──────────────────────────────────────────────────────────
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
  // upsert — insert or update
  const res = await sbFetch(`fitrival_users`, {
    method: "POST",
    headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ id: uid, data: JSON.stringify(userData) }),
  });
  return res.ok;
}

// ─── Константы ────────────────────────────────────────────────────────────────
const USERS = {
  sofia:  { name: "София",    emoji: "🔥", color: "#FF6B35" },
  friend: { name: "Стефания", emoji: "⚡", color: "#7C3AED" },
};

const EXERCISES = [
  "Бег","Велосипед","Тренажёрный зал","Плавание",
  "Йога","HIIT","Ходьба","Танцы","Другое",
];

const BADGES = [
  { id: "first_workout",  icon: "👟", label: "Первый шаг",      desc: "Записать первую тренировку" },
  { id: "five_workouts",  icon: "🏅", label: "Всерьёз взялась", desc: "Записать 5 тренировок" },
  { id: "first_weight",   icon: "⚖️", label: "Взвесилась!",     desc: "Записать первый вес" },
  { id: "weight_loss",    icon: "📉", label: "Легче!",           desc: "Похудеть на 0,5 кг" },
  { id: "first_photo",    icon: "📸", label: "Хвастушка",        desc: "Поделиться фото прогресса" },
  { id: "three_photos",   icon: "🖼️", label: "Фотограф",         desc: "Поделиться 3 фото" },
  { id: "beat_friend",    icon: "🏆", label: "Лидер",            desc: "Занять первое место" },
];

const POINTS = { workout: 10, weight: 5, photo: 15, badge: 20 };
const EMPTY  = { workouts: [], weights: [], photos: [], badges: [] };

// ─── Утилиты ─────────────────────────────────────────────────────────────────
const today   = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "short" });

const calcPoints = (u) =>
  u.workouts.length * POINTS.workout +
  u.weights.length  * POINTS.weight  +
  u.photos.length   * POINTS.photo   +
  u.badges.length   * POINTS.badge;

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

// ─── Компонент ────────────────────────────────────────────────────────────────
export default function FitRivals() {
  const [whoAmI,    setWhoAmI]    = useState(null);
  const [data,      setData]      = useState({ sofia: EMPTY, friend: EMPTY });
  const [loading,   setLoading]   = useState(true);
  const [dbError,   setDbError]   = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [modal,     setModal]     = useState(null);
  const [form,      setForm]      = useState({});
  const [toast,     setToast]     = useState(null);
  const [saving,    setSaving]    = useState(false);

  // ── Загрузка данных ────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [sofiaData, friendData] = await Promise.all([
        dbLoad("sofia"),
        dbLoad("friend"),
      ]);
      setData({
        sofia:  sofiaData  || EMPTY,
        friend: friendData || EMPTY,
      });
      setDbError(false);
    } catch (e) {
      console.error("Ошибка загрузки:", e);
      setDbError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Авто-обновление каждые 20 сек
  useEffect(() => {
    const t = setInterval(loadData, 20000);
    return () => clearInterval(t);
  }, [loadData]);

  // ── Сохранение ────────────────────────────────────────────────────────────
  const saveUser = async (uid, userData) => {
    setSaving(true);
    const ok = await dbSave(uid, userData);
    setSaving(false);
    if (!ok) showToast("⚠️ Ошибка сохранения — проверь таблицу в Supabase");
    return ok;
  };

  // ── Тост ──────────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── Мутации ───────────────────────────────────────────────────────────────
  const addWorkout = async () => {
    if (!form.type || !form.minutes) return;
    const cur = { ...data[whoAmI] };
    cur.workouts = [{ id: Date.now(), type: form.type, minutes: parseInt(form.minutes), date: today(), note: form.note || "" }, ...cur.workouts];
    cur.badges = checkBadges(cur);
    setData(p => ({ ...p, [whoAmI]: cur }));
    await saveUser(whoAmI, cur);
    showToast(`+${POINTS.workout} очков! ${form.type} записана 🎉`);
    setModal(null); setForm({});
  };

  const addWeight = async () => {
    if (!form.weight) return;
    const cur = { ...data[whoAmI] };
    cur.weights = [{ value: parseFloat(form.weight), date: today() }, ...cur.weights];
    cur.badges = checkBadges(cur);
    setData(p => ({ ...p, [whoAmI]: cur }));
    await saveUser(whoAmI, cur);
    showToast(`+${POINTS.weight} очков! Вес записан ⚖️`);
    setModal(null); setForm({});
  };

  const addPhoto = async () => {
    if (!form.photoUrl && !form.caption) return;
    const cur = { ...data[whoAmI] };
    cur.photos = [{ id: Date.now(), url: form.photoUrl || "", caption: form.caption || "Мой прогресс 💪", date: today() }, ...cur.photos];
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

  // ── Вычисляемые ───────────────────────────────────────────────────────────
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
        <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
          <div style={{ fontFamily:"'Space Mono',monospace", color:"#FF6B35", fontSize:11, letterSpacing:4, marginBottom:12 }}>FIT RIVALS</div>
          <div style={{ fontSize:26, fontWeight:900, marginBottom:8, textAlign:"center" }}>Кто ты? 👀</div>
          <div style={{ color:"#666", fontSize:14, marginBottom:40, textAlign:"center", lineHeight:1.6 }}>
            Выбери свой профиль — данные сохраняются навсегда и синхронизируются автоматически.
          </div>
          {dbError && (
            <div style={{ background:"#2a1515", border:"1px solid #f8717144", borderRadius:12, padding:"12px 16px", marginBottom:20, fontSize:12, color:"#f87171", maxWidth:320, lineHeight:1.6 }}>
              ⚠️ Не удалось подключиться к базе данных. Убедись, что таблица <strong>fitrival_users</strong> создана в Supabase.
            </div>
          )}
          <div style={{ display:"flex", flexDirection:"column", gap:14, width:"100%", maxWidth:320 }}>
            {Object.entries(USERS).map(([key, u]) => (
              <button key={key} onClick={() => { setWhoAmI(key); }} className="profile-btn"
                style={{ background:"#18181D", border:`2px solid ${u.color}44`, borderRadius:16, padding:"20px 24px", cursor:"pointer", display:"flex", alignItems:"center", gap:16, fontFamily:"'Outfit',sans-serif" }}>
                <div style={{ fontSize:40 }}>{u.emoji}</div>
                <div style={{ textAlign:"left" }}>
                  <div style={{ fontSize:18, fontWeight:700, color:u.color }}>{u.name}</div>
                  <div style={{ fontSize:12, color:"#555", marginTop:2 }}>Нажми, чтобы войти</div>
                </div>
              </button>
            ))}
          </div>
          <div style={{ marginTop:32, fontSize:11, color:"#444", textAlign:"center", maxWidth:280, lineHeight:1.6 }}>
            🔒 Данные хранятся в базе данных и не исчезнут при обновлении страницы.
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...S.root, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <style>{css}</style>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:12 }} className="spin">⚡</div>
          <div style={{ color:"#666", fontSize:14 }}>Загружаем данные…</div>
        </div>
      </div>
    );
  }

  const myUser    = USERS[whoAmI];
  const theirUser = USERS[friendId];

  const TABS = [
    { id:"dashboard", icon:"🏆", label:"Доска" },
    { id:"workouts",  icon:"💪", label:"Тренировки" },
    { id:"weight",    icon:"⚖️", label:"Вес" },
    { id:"photos",    icon:"📸", label:"Фото" },
    { id:"badges",    icon:"🎖️", label:"Значки" },
  ];

  return (
    <div style={S.root}>
      <style>{css}</style>
      <div style={{ maxWidth:500, margin:"0 auto", padding:"20px 16px 0" }}>

        {/* Шапка */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#FF6B35", letterSpacing:3, marginBottom:3 }}>FIT RIVALS</div>
            <div style={{ fontSize:20, fontWeight:900 }}>Привет, {myUser.emoji} {myUser.name}!</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {saving && <div style={{ fontSize:10, color:"#555" }}>сохраняем…</div>}
            <button onClick={() => { loadData(); showToast("Обновлено! 🔄"); }} className="icon-btn">↻</button>
            <button onClick={() => setWhoAmI(null)} className="icon-btn">Выйти</button>
          </div>
        </div>

        {/* Таблица очков */}
        <div className="card" style={{ padding:20, marginBottom:18, background: iWin ? "linear-gradient(135deg,#1e1208,#251808)" : "linear-gradient(135deg,#12101e,#1a1528)", border:`1px solid ${iWin ? "#FF6B3530" : "#7C3AED30"}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:36, fontFamily:"'Space Mono',monospace", color:myUser.color, fontWeight:700 }}>{myPts}</div>
              <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{myUser.emoji} Я</div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:20, marginBottom:4 }}>{iWin ? "🏆" : "😤"}</div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:1, color: iWin ? myUser.color : theirUser.color }}>
                {iWin ? (diff === 0 ? "НИЧЬЯ" : `+${diff} ВПЕРЕДИ`) : `${diff} ПОЗАДИ`}
              </div>
            </div>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:36, fontFamily:"'Space Mono',monospace", color:theirUser.color, fontWeight:700 }}>{friendPts}</div>
              <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{theirUser.emoji} {theirUser.name}</div>
            </div>
          </div>
          <div style={{ height:8, background:"#2a2a32", borderRadius:99, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(myPts/(myPts+friendPts||1))*100}%`, background:`linear-gradient(90deg,${myUser.color},${myUser.color}cc)`, borderRadius:99, transition:"width 0.6s ease" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:10, color:"#444" }}>
            <span>Моя доля: {Math.round((myPts/(myPts+friendPts||1))*100)}%</span>
            <span>{Math.round((friendPts/(myPts+friendPts||1))*100)}%: {theirUser.name}</span>
          </div>
        </div>

        {/* Вкладки */}
        <div style={{ display:"flex", gap:6, marginBottom:18, overflowX:"auto", paddingBottom:2 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className="tab-btn"
              style={{ flexShrink:0, background: activeTab===t.id ? myUser.color : "#18181D", border: activeTab===t.id ? "none" : "1px solid #2a2a32", borderRadius:10, padding:"9px 14px", cursor:"pointer", color:"white", fontSize:12, fontWeight:600, fontFamily:"'Outfit',sans-serif" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── ДОСКА ── */}
        {activeTab === "dashboard" && (
          <div className="tab-content">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { label:"Тренировки",    my: myData.workouts.length,   their: friendData.workouts.length,   icon:"🏃" },
                { label:"Текущий вес",   my: latestWeight(whoAmI)  ? latestWeight(whoAmI)  + " кг" : "—", their: latestWeight(friendId) ? latestWeight(friendId) + " кг" : "—", icon:"⚖️" },
                { label:"Результат",     my: weightChange(whoAmI)  !== null ? Math.abs(weightChange(whoAmI))  + " кг" : "—", their: weightChange(friendId) !== null ? Math.abs(weightChange(friendId)) + " кг" : "—", icon:"📉" },
                { label:"Значки",        my: myData.badges.length,     their: friendData.badges.length,     icon:"🎖️" },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding:"14px 12px" }}>
                  <div style={{ fontSize:18, marginBottom:8 }}>{s.icon}</div>
                  <div style={{ fontSize:10, color:"#666", marginBottom:8 }}>{s.label}</div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <div><div style={{ fontSize:16, fontWeight:700, color:myUser.color }}>{s.my}</div><div style={{ fontSize:9, color:"#555" }}>Я</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:16, fontWeight:700, color:theirUser.color }}>{s.their}</div><div style={{ fontSize:9, color:"#555" }}>Она</div></div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {[
                { icon:"💪", label:"Тренировка", pts:"+10", action:() => setModal("workout") },
                { icon:"⚖️", label:"Вес",         pts:"+5",  action:() => setModal("weight")  },
                { icon:"📸", label:"Фото",         pts:"+15", action:() => setModal("photo")   },
              ].map(a => (
                <button key={a.label} onClick={a.action} className="action-btn"
                  style={{ background:"#18181D", border:"1px solid #2a2a32", borderRadius:14, padding:"16px 8px", cursor:"pointer", color:"white", fontFamily:"'Outfit',sans-serif", textAlign:"center", transition:"all 0.2s" }}>
                  <div style={{ fontSize:26, marginBottom:6 }}>{a.icon}</div>
                  <div style={{ fontSize:11, fontWeight:600, marginBottom:4 }}>{a.label}</div>
                  <div style={{ fontSize:10, color:myUser.color, fontWeight:700 }}>{a.pts} очков</div>
                </button>
              ))}
            </div>

            <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:"#888" }}>Последняя активность</div>
            {[
              ...myData.workouts.slice(0,2).map(w => ({ ...w, kind:"workout", owner:whoAmI })),
              ...friendData.workouts.slice(0,2).map(w => ({ ...w, kind:"workout", owner:friendId })),
              ...myData.weights.slice(0,1).map(w => ({ ...w, kind:"weight", owner:whoAmI })),
              ...friendData.weights.slice(0,1).map(w => ({ ...w, kind:"weight", owner:friendId })),
            ].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5).map((item,i) => {
              const u = USERS[item.owner];
              return (
                <div key={i} className="card" style={{ padding:"12px 14px", marginBottom:8, borderLeft:`3px solid ${u.color}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:20 }}>{item.kind==="workout" ? "🏃" : "⚖️"}</span>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600 }}>{item.kind==="workout" ? `${item.type} • ${item.minutes} мин` : `${item.value} кг`}</div>
                        {item.note && <div style={{ fontSize:11, color:"#666" }}>{item.note}</div>}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:10, color:u.color, fontWeight:700 }}>{u.emoji} {u.name}</div>
                      <div style={{ fontSize:10, color:"#555" }}>{fmtDate(item.date)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {myData.workouts.length===0 && friendData.workouts.length===0 && (
              <div style={{ textAlign:"center", padding:32, color:"#444", fontSize:13 }}>Пока ничего нет — будь первой! 🚀</div>
            )}
          </div>
        )}

        {/* ── ТРЕНИРОВКИ ── */}
        {activeTab === "workouts" && (
          <div className="tab-content">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Все тренировки</div>
              <button className="btn-primary" style={{ background:myUser.color }} onClick={() => setModal("workout")}>+ Добавить</button>
            </div>
            {[...myData.workouts.map(w => ({ ...w, owner:whoAmI })), ...friendData.workouts.map(w => ({ ...w, owner:friendId }))]
              .sort((a,b) => b.id-a.id).map((w,i) => {
                const u = USERS[w.owner];
                return (
                  <div key={i} className="card" style={{ padding:"14px 16px", marginBottom:10, borderLeft:`3px solid ${u.color}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, marginBottom:4 }}>{w.type}
                          <span style={{ fontSize:10, background:u.color+"22", color:u.color, padding:"2px 8px", borderRadius:99, marginLeft:8, fontWeight:600 }}>{u.emoji} {u.name}</span>
                        </div>
                        {w.note && <div style={{ fontSize:12, color:"#777" }}>{w.note}</div>}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:18, fontWeight:700, color:u.color }}>{w.minutes} мин</div>
                        <div style={{ fontSize:10, color:"#555" }}>{fmtDate(w.date)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            {myData.workouts.length===0 && friendData.workouts.length===0 && (
              <div style={{ textAlign:"center", padding:40, color:"#555" }}>Тренировок пока нет. Вперёд! 💪</div>
            )}
          </div>
        )}

        {/* ── ВЕС ── */}
        {activeTab === "weight" && (
          <div className="tab-content">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Дневник веса</div>
              <button className="btn-primary" style={{ background:myUser.color }} onClick={() => setModal("weight")}>+ Записать</button>
            </div>
            {[whoAmI, friendId].map(uid => {
              const u   = USERS[uid];
              const wts = data[uid].weights;
              const chg = weightChange(uid);
              return (
                <div key={uid} className="card" style={{ padding:16, marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{u.emoji} {u.name}</div>
                    {chg !== null && (
                      <div style={{ fontSize:12, fontWeight:700, color: parseFloat(chg)<=0 ? "#4ade80" : "#f87171" }}>
                        {parseFloat(chg)<=0 ? `↓ −${Math.abs(chg)} кг` : `↑ +${chg} кг`}
                      </div>
                    )}
                  </div>
                  {wts.length > 0 ? (
                    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4 }}>
                      {[...wts].reverse().map((w,i) => (
                        <div key={i} style={{ background:"#25252D", borderRadius:10, padding:"10px 14px", textAlign:"center", flexShrink:0, minWidth:58 }}>
                          <div style={{ fontSize:15, fontWeight:700, color:u.color }}>{w.value}</div>
                          <div style={{ fontSize:9, color:"#555", marginTop:2 }}>кг</div>
                          <div style={{ fontSize:9, color:"#666", marginTop:4 }}>{fmtDate(w.date)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color:"#555", fontSize:12, textAlign:"center", padding:16 }}>Записей пока нет</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── ФОТО ── */}
        {activeTab === "photos" && (
          <div className="tab-content">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Фото прогресса</div>
              <button className="btn-primary" style={{ background:myUser.color }} onClick={() => setModal("photo")}>+ Добавить</button>
            </div>
            {[...myData.photos.map(p => ({ ...p, owner:whoAmI })), ...friendData.photos.map(p => ({ ...p, owner:friendId }))].sort((a,b) => b.id-a.id).length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
                <div style={{ color:"#666", fontSize:13 }}>Фото пока нет — добавь первое и получи 15 очков!</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                {[...myData.photos.map(p => ({ ...p, owner:whoAmI })), ...friendData.photos.map(p => ({ ...p, owner:friendId }))]
                  .sort((a,b) => b.id-a.id).map((p,i) => {
                    const u = USERS[p.owner];
                    return (
                      <div key={i} className="card" style={{ overflow:"hidden" }}>
                        <div style={{ height:130, background:`linear-gradient(135deg,${u.color}22,#25252D)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:52 }}>
                          {p.url ? <img src={p.url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { e.target.style.display="none"; }} /> : "💪"}
                        </div>
                        <div style={{ padding:10 }}>
                          <div style={{ fontSize:10, color:u.color, fontWeight:700, marginBottom:4 }}>{u.emoji} {u.name}</div>
                          <div style={{ fontSize:11, color:"#ccc" }}>{p.caption}</div>
                          <div style={{ fontSize:9, color:"#555", marginTop:4 }}>{fmtDate(p.date)}</div>
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
            <div style={{ fontSize:16, fontWeight:700, marginBottom:14 }}>Достижения</div>
            {[whoAmI, friendId].map(uid => {
              const u = USERS[uid];
              return (
                <div key={uid} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:12, color:"#777", fontWeight:600, marginBottom:10 }}>
                    {u.emoji} {u.name} — {data[uid].badges.length} из {BADGES.length} получено
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {BADGES.map(b => {
                      const unlocked = data[uid].badges.includes(b.id);
                      return (
                        <div key={b.id} className="card" style={{ padding:12, display:"flex", gap:10, alignItems:"center", opacity: unlocked?1:0.35, filter: unlocked?"none":"grayscale(1)", background: unlocked?`linear-gradient(135deg,${u.color}11,#18181D)`:"#18181D", border: unlocked?`1px solid ${u.color}33`:"1px solid #2a2a32" }}>
                          <div style={{ fontSize:26 }}>{b.icon}</div>
                          <div>
                            <div style={{ fontSize:11, fontWeight:700 }}>{b.label}</div>
                            <div style={{ fontSize:9, color:"#666", marginTop:2 }}>{b.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button onClick={resetData} style={{ background:"transparent", border:"1px solid #3a3a45", borderRadius:10, padding:"10px 16px", cursor:"pointer", color:"#555", fontSize:12, fontFamily:"'Outfit',sans-serif", marginTop:8 }}>
              Сбросить мои данные
            </button>
          </div>
        )}

        <div style={{ height:40 }} />
      </div>

      {/* ── МОДАЛЬНЫЕ ОКНА ── */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" }} onClick={() => setModal(null)}>
          <div className="card animate-in" style={{ width:"90%", maxWidth:380, padding:24 }} onClick={e => e.stopPropagation()}>

            {modal === "workout" && <>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:18 }}>💪 Записать тренировку</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <select className="input" value={form.type||""} onChange={e => setForm({...form, type:e.target.value})}>
                  <option value="">Выбери вид нагрузки…</option>
                  {EXERCISES.map(e => <option key={e}>{e}</option>)}
                </select>
                <input className="input" type="number" placeholder="Длительность в минутах" value={form.minutes||""} onChange={e => setForm({...form, minutes:e.target.value})} />
                <input className="input" type="text" placeholder="Заметка (необязательно)" value={form.note||""} onChange={e => setForm({...form, note:e.target.value})} />
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="btn-sec" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="btn-primary" style={{ flex:2, background:myUser.color }} onClick={addWorkout}>Записать +10 очков 🎉</button>
                </div>
              </div>
            </>}

            {modal === "weight" && <>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:18 }}>⚖️ Записать вес</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <input className="input" type="number" step="0.1" placeholder="Вес в кг (напр. 65.5)" value={form.weight||""} onChange={e => setForm({...form, weight:e.target.value})} />
                <div style={{ fontSize:11, color:"#555" }}>Сегодня: {today()}</div>
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="btn-sec" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="btn-primary" style={{ flex:2, background:myUser.color }} onClick={addWeight}>Записать +5 очков ⚖️</button>
                </div>
              </div>
            </>}

            {modal === "photo" && <>
              <div style={{ fontSize:18, fontWeight:700, marginBottom:18 }}>📸 Поделиться фото</div>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <input className="input" type="url" placeholder="Ссылка на фото (Imgur, Google Фото…)" value={form.photoUrl||""} onChange={e => setForm({...form, photoUrl:e.target.value})} />
                <input className="input" type="text" placeholder="Подпись (напр. Неделя 3 💪)" value={form.caption||""} onChange={e => setForm({...form, caption:e.target.value})} />
                <div style={{ background:"#25252D", borderRadius:10, padding:10, fontSize:11, color:"#777", lineHeight:1.6 }}>
                  💡 Совет: загрузи фото на <strong style={{ color:"#aaa" }}>imgur.com</strong>, нажми правой кнопкой → «Копировать адрес изображения» и вставь сюда.
                </div>
                <div style={{ display:"flex", gap:10, marginTop:6 }}>
                  <button className="btn-sec" style={{ flex:1 }} onClick={() => setModal(null)}>Отмена</button>
                  <button className="btn-primary" style={{ flex:2, background:myUser.color }} onClick={addPhoto}>Поделиться +15 очков 📸</button>
                </div>
              </div>
            </>}

          </div>
        </div>
      )}

      {/* Тост */}
      {toast && (
        <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)", background:myUser?.color||"#FF6B35", color:"white", padding:"12px 24px", borderRadius:99, fontSize:13, fontWeight:700, zIndex:200, whiteSpace:"nowrap", boxShadow:"0 8px 30px rgba(0,0,0,0.4)", animation:"toastIn 0.3s ease" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

const S = {
  root: { fontFamily:"'Outfit',sans-serif", background:"#0D0D0F", color:"#F0EDE8", minHeight:"100vh" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&family=Space+Mono:wght@700&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  ::-webkit-scrollbar { width:4px; height:4px; }
  ::-webkit-scrollbar-track { background:#1a1a1f; }
  ::-webkit-scrollbar-thumb { background:#FF6B35; border-radius:2px; }
  .card { background:#18181D; border:1px solid #2a2a32; border-radius:16px; }
  .btn-primary { background:#FF6B35; color:white; border:none; border-radius:10px; padding:11px 18px; font-family:'Outfit',sans-serif; font-weight:600; font-size:13px; cursor:pointer; transition:all 0.2s; }
  .btn-primary:hover { filter:brightness(1.1); transform:translateY(-1px); }
  .btn-sec { background:#25252D; color:#F0EDE8; border:1px solid #3a3a45; border-radius:10px; padding:11px 18px; font-family:'Outfit',sans-serif; font-weight:500; font-size:13px; cursor:pointer; }
  .icon-btn { background:#25252D; border:1px solid #3a3a45; border-radius:10px; padding:8px 12px; cursor:pointer; color:#888; font-family:'Outfit',sans-serif; font-size:12px; }
  .input { background:#25252D; border:1px solid #3a3a45; border-radius:10px; padding:12px 14px; color:#F0EDE8; font-family:'Outfit',sans-serif; font-size:14px; width:100%; outline:none; transition:border 0.2s; }
  .input:focus { border-color:#FF6B35; }
  .input::placeholder { color:#555; }
  select.input option { background:#25252D; }
  .tab-btn { transition:all 0.2s; }
  .tab-btn:hover { transform:translateY(-2px); }
  .action-btn:hover { border-color:#FF6B35 !important; transform:translateY(-2px); }
  .profile-btn { transition:all 0.2s; }
  .profile-btn:hover { transform:translateY(-2px); }
  .tab-content { animation:fadeUp 0.25s ease; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  @keyframes toastIn { from { transform:translateX(-50%) translateY(20px); opacity:0; } to { transform:translateX(-50%) translateY(0); opacity:1; } }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .animate-in { animation:fadeUp 0.3s ease; }
  .spin { display:inline-block; animation:spin 1s linear infinite; }
`;
