// Controle de acesso com Firebase (Authentication + Firestore).
// Só entra em ação quando js/firebase-config.js define window.__FIREBASE__.
// Usuário e senha: o "usuário" vira um e-mail técnico (usuario@DOMINIO_ACESSO), que ninguém precisa conhecer.
const FB_VER = "10.12.2";
const fbUrl = (m) => `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}.js`;
const DOMINIO_ACESSO = "acesso.farol-itapua.app";
export const PERFIS = { admin: "Administrador", conselheiro: "Conselheiro", visualizacao: "Visualização" };
export const PERFIS_DESC = {
  admin: "Vê tudo, edita anotações, importa balancetes e cria acessos",
  conselheiro: "Vê tudo e registra respostas e anotações",
  visualizacao: "Só consulta: não altera nada",
};
export const AC = { ligado: false, fb: null, user: null, reg: null, perfil: null };
export const podeEditar = () => !AC.ligado || AC.perfil === "admin" || AC.perfil === "conselheiro";
export const ehAdmin = () => !AC.ligado || AC.perfil === "admin";

export function normUsuario(u) {
  return String(u || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9._-]/g, "");
}
const emailDe = (usuario, sufixo = "") => `${normUsuario(usuario)}${sufixo}@${DOMINIO_ACESSO}`;
export function senhaProvisoria() {
  // sem caracteres que confundem (0/O, 1/l/I)
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz", N = "23456789", T = L + N;
  const r = new Uint32Array(10); crypto.getRandomValues(r);
  let s = L[r[0] % L.length] + N[r[1] % N.length];
  for (let i = 2; i < 10; i++) s += T[r[i] % T.length];
  return s.split("").sort(() => (crypto.getRandomValues(new Uint8Array(1))[0] & 1) - 0.5).join("");
}
export function validarSenha(s, antiga) {
  if (s.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return "Use letras e números.";
  if (antiga && s === antiga) return "A nova senha precisa ser diferente da provisória.";
  return "";
}
export function mensagemErro(e) {
  const c = (e && e.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return "Usuário ou senha incorretos.";
  if (/too-many-requests/.test(c)) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (/network/.test(c)) return "Sem conexão com o serviço de acesso. Verifique a internet.";
  if (/email-already-in-use/.test(c)) return "Esse usuário já existe.";
  if (/weak-password/.test(c)) return "Senha fraca: use pelo menos 8 caracteres, com letras e números.";
  if (/requires-recent-login/.test(c)) return "Por segurança, saia e entre de novo antes de trocar a senha.";
  if (/permission-denied|insufficient/.test(c)) return "Permissão negada. Confira as regras do Firestore (aba Administração).";
  if (/unauthorized-domain|operation-not-allowed/.test(c)) return "O Firebase ainda não está liberado para este endereço. Confira o passo a passo na aba Administração.";
  return (e && e.message) || "Erro inesperado.";
}

export async function carregarFirebase(cfg) {
  const [app, auth, fs] = await Promise.all([import(fbUrl("app")), import(fbUrl("auth")), import(fbUrl("firestore"))]);
  const a = app.initializeApp(cfg);
  AC.fb = { app, auth, fs, a, au: auth.getAuth(a), db: fs.getFirestore(a), cfg };
  AC.ligado = true;
  return AC.fb;
}
const ref = (...p) => AC.fb.fs.doc(AC.fb.db, ...p);
const agora = () => AC.fb.fs.serverTimestamp();

export async function existeAdministrador() {
  const d = await AC.fb.fs.getDoc(ref("config", "inicial"));
  return d.exists();
}
export async function entrar(usuario, senha) {
  const { auth, fs, au } = AC.fb;
  const u = normUsuario(usuario);
  let email = usuario.includes("@") ? usuario.trim() : emailDe(u);
  if (!usuario.includes("@")) { const l = await fs.getDoc(ref("logins", u)); if (l.exists() && l.data().email) email = l.data().email; }
  return auth.signInWithEmailAndPassword(au, email, senha);
}
export const sair = () => AC.fb.auth.signOut(AC.fb.au);
export const aoMudarSessao = (cb) => AC.fb.auth.onAuthStateChanged(AC.fb.au, cb);

export async function lerPerfil(user) {
  const d = await AC.fb.fs.getDoc(ref("usuarios", user.uid));
  AC.user = user; AC.reg = d.exists() ? d.data() : null; AC.perfil = AC.reg && AC.reg.ativo ? AC.reg.perfil : null;
  return AC.reg;
}
export async function registrarAcesso() {
  try { await AC.fb.fs.updateDoc(ref("usuarios", AC.user.uid), { ultimoAcesso: agora() }); } catch {}
}
export async function trocarSenha(nova, atual) {
  const { auth, fs, au } = AC.fb;
  if (atual) await auth.reauthenticateWithCredential(au.currentUser, auth.EmailAuthProvider.credential(au.currentUser.email, atual));
  await auth.updatePassword(au.currentUser, nova);
  await fs.updateDoc(ref("usuarios", au.currentUser.uid), { trocarSenha: false, senhaAlteradaEm: agora() });
  if (AC.reg) AC.reg.trocarSenha = false;
}

// primeiro administrador: só funciona enquanto config/inicial não existir (garantido pelas regras)
export async function criarPrimeiroAdmin(nome, usuario, senha) {
  const { auth, fs, au, db } = AC.fb;
  const u = normUsuario(usuario), email = emailDe(u);
  let cred;
  // se uma tentativa anterior criou a conta mas não conseguiu gravar no banco, aproveita a conta
  try { cred = await auth.createUserWithEmailAndPassword(au, email, senha); }
  catch (e) { if (!/email-already-in-use/.test(e.code || "")) throw e; cred = await auth.signInWithEmailAndPassword(au, email, senha); }
  const b = fs.writeBatch(db), uid = cred.user.uid;
  b.set(ref("config", "inicial"), { admin: uid, criadoEm: agora() });
  b.set(ref("usuarios", uid), { usuario: u, nome, perfil: "admin", ativo: true, trocarSenha: false, criadoEm: agora(), criadoPor: uid });
  b.set(ref("logins", u), { email, uid });
  await b.commit();
  return cred.user;
}
// conta nova numa instância separada, para não derrubar a sessão do administrador
async function criarConta(email, senha) {
  const { app, auth, cfg } = AC.fb;
  const sec = app.initializeApp(cfg, "cadastro-" + Date.now());
  try {
    const sa = auth.initializeAuth(sec, { persistence: auth.inMemoryPersistence });
    const cred = await auth.createUserWithEmailAndPassword(sa, email, senha);
    await auth.signOut(sa);
    return cred.user.uid;
  } finally { try { await app.deleteApp(sec); } catch {} }
}
export async function criarAcesso({ nome, usuario, perfil }) {
  const { fs, db } = AC.fb;
  const u = normUsuario(usuario);
  if (!u) throw new Error("Informe um usuário com letras ou números.");
  if ((await fs.getDoc(ref("logins", u))).exists()) throw Object.assign(new Error("Esse usuário já existe."), { code: "email-already-in-use" });
  const senha = senhaProvisoria(), email = emailDe(u);
  const uid = await criarConta(email, senha);
  const b = fs.writeBatch(db);
  b.set(ref("usuarios", uid), { usuario: u, nome, perfil, ativo: true, trocarSenha: true, criadoEm: agora(), criadoPor: AC.user.uid });
  b.set(ref("logins", u), { email, uid });
  await b.commit();
  return { usuario: u, senha };
}
// o navegador não pode trocar a senha de outra pessoa; por isso a conta é refeita com senha provisória nova
export async function novaSenhaProvisoria(uidAntigo) {
  const { fs, db } = AC.fb;
  const antigo = (await fs.getDoc(ref("usuarios", uidAntigo))).data();
  const senha = senhaProvisoria(), email = emailDe(antigo.usuario, ".r" + Date.now().toString(36));
  const uid = await criarConta(email, senha);
  const b = fs.writeBatch(db);
  b.set(ref("usuarios", uid), { usuario: antigo.usuario, nome: antigo.nome, perfil: antigo.perfil, ativo: antigo.ativo !== false, trocarSenha: true, criadoEm: agora(), criadoPor: AC.user.uid, substitui: uidAntigo });
  b.update(ref("usuarios", uidAntigo), { ativo: false, substituidoPor: uid });
  b.set(ref("logins", antigo.usuario), { email, uid });
  await b.commit();
  return { usuario: antigo.usuario, senha };
}
export const atualizarAcesso = (uid, campos) => AC.fb.fs.updateDoc(ref("usuarios", uid), campos);
export async function listarAcessos() {
  const q = await AC.fb.fs.getDocs(AC.fb.fs.collection(AC.fb.db, "usuarios"));
  return q.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => !u.substituidoPor);
}

// ---------------------------------------------------------------- dados protegidos
export async function lerDados() {
  const { fs, db } = AC.fb;
  const [q, ac, an, orc] = await Promise.all([fs.getDocs(fs.collection(db, "balancetes")), fs.getDoc(ref("acompanhamento", "geral")), fs.getDoc(ref("conteudo", "analise")), fs.getDoc(ref("conteudo", "orcamento"))]);
  const meses = {};
  q.docs.forEach((d) => (meses[d.id] = d.data()));
  return { meses, acompanhamento: ac.exists() ? ac.data().itens || {} : {}, analise: an.exists() ? an.data().html || "" : "",
    orcamento: orc.exists() ? orc.data().previsoes || [] : [] };
}
export async function gravarMeses(meses) {
  const { fs, db } = AC.fb;
  const lista = Object.values(meses);
  for (let i = 0; i < lista.length; i += 400) {
    const b = fs.writeBatch(db);
    for (const m of lista.slice(i, i + 400)) b.set(ref("balancetes", m.mes), JSON.parse(JSON.stringify(m)));
    await b.commit();
  }
}
export const gravarOrcamento = (previsoes) => AC.fb.fs.setDoc(ref("conteudo", "orcamento"), { previsoes: JSON.parse(JSON.stringify(previsoes)), atualizado: agora() });
export const nomeUsuario = () => (AC.reg ? AC.reg.nome || AC.reg.usuario : "");
export const gravarAnalise = (html) => AC.fb.fs.setDoc(ref("conteudo", "analise"), { html, atualizado: agora() });
// grava só os itens alterados; merge preserva o que outros conselheiros gravaram
export const gravarAcomp = (itens) => AC.fb.fs.setDoc(ref("acompanhamento", "geral"), { itens: JSON.parse(JSON.stringify(itens)), atualizado: agora() }, { merge: true });
export const ouvirAcomp = (cb) => AC.fb.fs.onSnapshot(ref("acompanhamento", "geral"), (d) => cb(d.exists() ? d.data().itens || {} : {}), () => {});

export const REGRAS = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function logado() { return request.auth != null; }
    function reg() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
    function ativo() { return logado() && exists(/databases/$(database)/documents/usuarios/$(request.auth.uid)) && reg().ativo == true; }
    function admin() { return ativo() && reg().perfil == 'admin'; }
    function editor() { return ativo() && (reg().perfil == 'admin' || reg().perfil == 'conselheiro'); }
    function inicial() {
      return !exists(/databases/$(database)/documents/config/inicial)
        && existsAfter(/databases/$(database)/documents/config/inicial);
    }
    match /config/inicial {
      allow read: if true;
      allow create: if logado() && !exists(/databases/$(database)/documents/config/inicial)
        && request.resource.data.admin == request.auth.uid;
    }
    match /logins/{usuario} {
      allow read: if true;
      allow write: if admin() || (inicial() && request.resource.data.uid == request.auth.uid);
    }
    match /usuarios/{uid} {
      allow read: if admin() || (logado() && request.auth.uid == uid);
      allow create: if admin() || (inicial() && uid == request.auth.uid && request.resource.data.perfil == 'admin');
      allow update: if admin() || (logado() && request.auth.uid == uid
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['trocarSenha', 'senhaAlteradaEm', 'ultimoAcesso'])
        && request.resource.data.get('trocarSenha', false) == false);
      allow delete: if false;
    }
    match /balancetes/{mes} { allow read: if ativo(); allow write: if admin(); }
    match /conteudo/{doc} { allow read: if ativo(); allow write: if admin(); }
    match /acompanhamento/{doc} { allow read: if ativo(); allow write: if editor(); }
  }
}`;
