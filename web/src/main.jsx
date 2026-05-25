import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import heroImage from './assets/rembug-hero.png';

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const initialState = {
  apiBase: localStorage.getItem('forum_api_base') || DEFAULT_API_BASE,
  accessToken: localStorage.getItem('forum_access_token') || '',
  refreshToken: localStorage.getItem('forum_refresh_token') || '',
  session: JSON.parse(localStorage.getItem('forum_session') || 'null'),
};

function parseRoute() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  if (hash.startsWith('/thread/')) {
    return { name: 'thread', id: decodeURIComponent(hash.replace('/thread/', '')) };
  }
  if (hash === '/login') return { name: 'login' };
  if (hash === '/register') return { name: 'register' };
  if (hash === '/forum') return { name: 'forum' };
  return { name: 'landing' };
}

function navigate(path) {
  window.location.hash = path;
}

function LogoMark({ className = 'h-10 w-10' }) {
  return (
    <img className={className} src="/rembug-logo.svg" alt="Rembug" />
  );
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch (error) {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initial(username) {
  return (username || '?').slice(0, 1).toUpperCase();
}

function score(thread) {
  return Number(thread.commentCount || 0) + Number(thread.replyCount || 0) + 1;
}

function App() {
  const [route, setRoute] = useState(parseRoute);
  const [apiBase] = useState(initialState.apiBase);
  const [accessToken, setAccessToken] = useState(initialState.accessToken);
  const [refreshToken, setRefreshToken] = useState(initialState.refreshToken);
  const [session, setSession] = useState(initialState.session);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2800);
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.message || 'Request gagal');
    }
    return body;
  }, [apiBase]);

  const authHeaders = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  ), [accessToken]);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await request('/threads');
      setThreads(response.data.threads);
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }, [notify, request]);

  const loadThread = useCallback(async (threadId) => {
    setLoading(true);
    setSelectedThread(null);
    try {
      const response = await request(`/threads/${threadId}`);
      setSelectedThread(response.data.thread);
    } catch (error) {
      notify(error.message);
      navigate('/forum');
    } finally {
      setLoading(false);
    }
  }, [notify, request]);

  useEffect(() => {
    if (route.name === 'forum') {
      loadThreads();
    }
    if (route.name === 'thread') {
      loadThread(route.id);
      loadThreads();
    }
  }, [loadThread, loadThreads, route]);

  const persistSession = useCallback((authData, fallbackUsername) => {
    const payload = decodeJwtPayload(authData.accessToken) || {};
    const nextSession = {
      id: payload.id,
      username: payload.username || fallbackUsername,
    };
    setAccessToken(authData.accessToken);
    setRefreshToken(authData.refreshToken);
    setSession(nextSession);
    localStorage.setItem('forum_access_token', authData.accessToken);
    localStorage.setItem('forum_refresh_token', authData.refreshToken);
    localStorage.setItem('forum_session', JSON.stringify(nextSession));
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken('');
    setRefreshToken('');
    setSession(null);
    localStorage.removeItem('forum_access_token');
    localStorage.removeItem('forum_refresh_token');
    localStorage.removeItem('forum_session');
  }, []);

  const requireLogin = useCallback(() => {
    if (accessToken) return true;
    notify('Silakan login terlebih dahulu.');
    navigate('/login');
    return false;
  }, [accessToken, notify]);

  const actions = {
    notify,
    async login(payload) {
      const auth = await request('/authentications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      persistSession(auth.data, payload.username);
      notify('Berhasil masuk.');
      navigate('/forum');
    },
    async register(payload) {
      await request('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await actions.login({
        username: payload.username,
        password: payload.password,
      });
    },
    async logout() {
      try {
        if (refreshToken) {
          await request('/authentications', {
            method: 'DELETE',
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch (error) {
        notify(error.message);
      } finally {
        clearSession();
      }
    },
    async createThread(payload) {
      if (!requireLogin()) return;
      const response = await request('/threads', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      notify('Thread berhasil dibuat.');
      await loadThreads();
      navigate(`/thread/${encodeURIComponent(response.data.addedThread.id)}`);
    },
    async createComment(threadId, content) {
      if (!requireLogin()) return;
      await request(`/threads/${threadId}/comments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content }),
      });
      notify('Komentar terkirim.');
      await loadThread(threadId);
      await loadThreads();
    },
    async createReply(threadId, commentId, content) {
      if (!requireLogin()) return;
      await request(`/threads/${threadId}/comments/${commentId}/replies`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ content }),
      });
      notify('Reply terkirim.');
      await loadThread(threadId);
      await loadThreads();
    },
    async likeComment(threadId, commentId) {
      if (!requireLogin()) return;
      await request(`/threads/${threadId}/comments/${commentId}/likes`, {
        method: 'PUT',
        headers: authHeaders,
      });
      await loadThread(threadId);
      await loadThreads();
    },
    async deleteComment(threadId, commentId) {
      if (!requireLogin()) return;
      await request(`/threads/${threadId}/comments/${commentId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      await loadThread(threadId);
      await loadThreads();
    },
    async deleteReply(threadId, commentId, replyId) {
      if (!requireLogin()) return;
      await request(`/threads/${threadId}/comments/${commentId}/replies/${replyId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      await loadThread(threadId);
      await loadThreads();
    },
  };

  return (
    <>
      <Shell session={session} onLogout={actions.logout}>
        {route.name === 'landing' && <LandingPage />}
        {route.name === 'login' && <AuthPage mode="login" actions={actions} />}
        {route.name === 'register' && <AuthPage mode="register" actions={actions} />}
        {route.name === 'forum' && (
          <ForumPage
            actions={actions}
            loading={loading}
            session={session}
            threads={threads}
          />
        )}
        {route.name === 'thread' && (
          <ThreadPage
            actions={actions}
            loading={loading}
            selectedThread={selectedThread}
            session={session}
            threads={threads}
          />
        )}
      </Shell>
      <Toast message={toast} />
    </>
  );
}

function Shell({ children, onLogout, session }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <button className="flex items-center gap-3" onClick={() => navigate('/')}>
            <LogoMark />
            <span className="hidden text-lg font-black sm:block">Rembug</span>
          </button>
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="mx-auto max-w-xl rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-sm text-muted">
              Cari thread dan komentar
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <button className="rounded-full px-4 py-2 text-sm font-black hover:bg-slate-100" onClick={() => navigate('/forum')}>Forum</button>
            {session ? (
              <>
                <button className="hidden rounded-full px-4 py-2 text-sm font-black hover:bg-slate-100 sm:inline-flex" onClick={onLogout}>Logout</button>
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-sm font-black">{initial(session.username)}</span>
              </>
            ) : (
              <>
                <button className="rounded-full px-4 py-2 text-sm font-black hover:bg-slate-100" onClick={() => navigate('/login')}>Login</button>
                <button className="btn-primary" onClick={() => navigate('/register')}>Register</button>
              </>
            )}
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}

function LandingPage() {
  const [activeFeature, setActiveFeature] = useState('feed');
  const features = {
    feed: {
      label: 'Feed',
      title: 'Feed yang mudah dipindai',
      body: 'Thread ditampilkan sebagai daftar ringkas dengan skor, jumlah komentar, dan ringkasan isi agar pengguna cepat menemukan pembahasan yang relevan.',
      points: ['Kartu thread terstruktur', 'Jumlah komentar dan reply', 'Navigasi cepat ke detail'],
    },
    auth: {
      label: 'Auth',
      title: 'Akses pengguna yang jelas',
      body: 'Halaman login dan register dipisahkan agar alur masuk lebih fokus. Token dari backend dipakai otomatis untuk aksi yang membutuhkan autentikasi.',
      points: ['Login dan register terpisah', 'JWT untuk request aman', 'Session tersimpan lokal'],
    },
    interact: {
      label: 'Interaksi',
      title: 'Interaksi diskusi lengkap',
      body: 'Pengguna dapat membuat thread, menulis komentar, membalas komentar, memberi like, dan menghapus konten miliknya sendiri dari halaman detail.',
      points: ['Komentar dan reply bertingkat', 'Toggle like komentar', 'Kontrol hapus konten sendiri'],
    },
  };

  return (
    <main>
      <section className="relative min-h-[680px] overflow-hidden">
        <img className="absolute inset-0 h-full w-full object-cover" src={heroImage} alt="" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,0.96)_0%,rgba(15,23,42,0.88)_42%,rgba(15,23,42,0.38)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent" />
        <div className="relative mx-auto grid min-h-[680px] max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="text-white">
            <span className="mb-4 inline-flex rounded-full bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-100 ring-1 ring-blue-300/30">Forum diskusi modern</span>
            <h1 className="max-w-3xl text-5xl font-black leading-tight tracking-normal md:text-7xl">Rembug</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-blue-50">Ruang diskusi untuk mencatat keputusan teknis, mengumpulkan pertanyaan, dan menjaga percakapan tim tetap rapi dalam satu forum yang nyaman dibaca setiap hari.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button className="btn-primary min-h-12 px-6" onClick={() => navigate('/forum')}>Masuk Forum</button>
              <button className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/40 bg-white/10 px-6 text-sm font-black text-white backdrop-blur transition hover:bg-white/20" onClick={() => navigate('/register')}>Buat Akun</button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-sm font-bold text-blue-100">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">Thread</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">Komentar</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">Reply</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur">Like</span>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              <Metric value="3" label="halaman utama" />
              <Metric value="6" label="aksi forum" />
              <Metric value="JWT" label="akses aman" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-panel backdrop-blur-md">
            <div className="rounded-xl bg-white p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogoMark className="h-9 w-9" />
                  <strong>Komunitas Rembug</strong>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-brandDark">Aktif</span>
              </div>
              <PreviewPost category="Arsitektur" title="Clean Architecture" score="42" comments="18" />
              <PreviewPost category="Database" title="Migration PostgreSQL" score="27" comments="9" />
              <PreviewPost category="Moderasi" title="Soft delete komentar" score="31" comments="14" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-3">
          <FeatureCard title="Feed terstruktur" body="Setiap thread punya konteks, ringkasan, dan indikator aktivitas agar forum tetap mudah dipantau." />
          <FeatureCard title="Autentikasi jelas" body="Pengguna masuk melalui halaman khusus, lalu token dipakai untuk membuat thread dan berinteraksi." />
          <FeatureCard title="Percakapan bertingkat" body="Komentar dan reply membantu diskusi tetap tersusun tanpa kehilangan konteks pembahasan." />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-12 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="panel bg-gradient-to-br from-white to-blue-50/50 p-5">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-brandDark">Kapabilitas</p>
          <h2 className="mb-4 text-2xl font-black">Fitur utama</h2>
          <div className="grid gap-2">
            {Object.entries(features).map(([key, item]) => (
              <button
                className={`rounded-lg border px-4 py-3 text-left font-black transition ${activeFeature === key ? 'border-brand bg-blue-50 text-brandDark' : 'border-slate-200 bg-white hover:border-brand'}`}
                key={key}
                onClick={() => setActiveFeature(key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div className="panel overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-blue-100 via-blue-50 to-white p-6">
            <h2 className="text-2xl font-black">{features[activeFeature].title}</h2>
            <p className="mt-2 leading-7 text-muted">{features[activeFeature].body}</p>
          </div>
          <div className="grid gap-3 border-b border-slate-200 p-6 md:grid-cols-3">
            {features[activeFeature].points.map((point) => (
              <div className="rounded-xl border border-blue-100 bg-white p-4" key={point}>
                <span className="mb-2 block h-2 w-8 rounded-full bg-brand" />
                <p className="text-sm font-black text-slate-700">{point}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 p-6 md:grid-cols-3">
            <WorkflowStep number="01" title="Buka feed" detail="Lihat thread terbaru dan indikator aktivitas." />
            <WorkflowStep number="02" title="Pilih thread" detail="Masuk ke pembahasan dengan konteks lengkap." />
            <WorkflowStep number="03" title="Mulai aksi" detail="Komentar, reply, like, atau kelola konten sendiri." />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 lg:grid-cols-3">
        <div className="panel bg-white p-5 lg:col-span-2">
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-brandDark">Operasional forum</p>
          <h2 className="mb-4 text-2xl font-black">Aktivitas yang didukung</h2>
          <div className="grid gap-3">
            <ActivityItem title="Publikasi thread" detail="Pengguna terautentikasi dapat membuka topik baru dengan judul dan isi yang langsung masuk ke feed." />
            <ActivityItem title="Diskusi berlapis" detail="Komentar dan reply menjaga percakapan tetap tertata, terutama untuk pembahasan teknis yang panjang." />
            <ActivityItem title="Kontrol konten pribadi" detail="Pemilik komentar atau reply dapat menghapus kontennya tanpa mengganggu struktur thread." />
          </div>
        </div>
        <div className="panel overflow-hidden bg-gradient-to-br from-slate-950 to-blue-950 text-white">
          <div className="border-b border-white/10 p-5">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-blue-200">Contoh thread</p>
            <h2 className="text-2xl font-black">Preview diskusi</h2>
            <p className="mt-2 text-sm leading-6 text-blue-100">Contoh tampilan percakapan yang akan dilihat pengguna saat membuka forum.</p>
          </div>
          <ExampleDiscussion compact />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-brandDark">Tentang Rembug</p>
            <h2 className="text-3xl font-black leading-tight md:text-4xl">Forum internal yang menjaga diskusi teknis tetap terdokumentasi.</h2>
            <p className="mt-4 max-w-2xl leading-8 text-muted">Rembug dirancang sebagai antarmuka web forum yang siap dipakai untuk kebutuhan tim. Fokusnya sederhana: membantu tim menyimpan pertanyaan, keputusan, catatan implementasi, dan percakapan teknis dalam format yang mudah dibaca kembali.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <AboutStat value="Dokumentasi" label="percakapan tidak hilang di chat singkat" />
            <AboutStat value="Kolaborasi" label="thread terbuka untuk konteks tim" />
            <AboutStat value="Konsistensi" label="alur data dan UI dibuat selaras" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-brandDark">Insight</p>
            <h2 className="text-3xl font-black">Artikel dan panduan</h2>
          </div>
          <button className="btn-ghost w-fit" onClick={() => navigate('/forum')}>Lihat forum</button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ArticleCard category="Architecture" title="Merapikan batas antara domain, use case, dan repository" />
          <ArticleCard category="Database" title="Membaca migration PostgreSQL sebagai kontrak data" />
          <ArticleCard category="Testing" title="Menjaga test integration tetap stabil saat schema berubah" />
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="mb-4 text-xs font-black uppercase tracking-wide text-blue-200">Obrolan yang jadi pengetahuan</p>
            <blockquote className="text-2xl font-black leading-snug md:text-4xl">
              "Ide terbaik tidak seharusnya tenggelam di percakapan singkat. Rembug mengubah diskusi menjadi ruang belajar yang tetap hidup, rapi, dan mudah ditemukan kembali."
            </blockquote>
            <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50">Dari pertanyaan kecil sampai keputusan penting, setiap thread punya tempat untuk berkembang menjadi referensi yang bisa dibaca ulang oleh tim.</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/10 p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <LogoMark className="h-12 w-12" />
              <div>
                <h2 className="text-2xl font-black">Rembug</h2>
                <p className="text-sm text-blue-100">Forum diskusi modern untuk tim.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 text-sm font-bold text-blue-50">
              <QuotePoint title="Terstruktur" detail="Thread, komentar, dan reply punya ruang masing-masing." />
              <QuotePoint title="Kolaboratif" detail="Setiap pengguna bisa ikut memberi konteks dan respon." />
              <QuotePoint title="Mudah dipindai" detail="Feed dirancang untuk membaca aktivitas dengan cepat." />
            </div>
          </div>
        </div>
      </section>

      <FooterNav />
    </main>
  );
}

function AboutStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-5">
      <span className="block text-lg font-black text-brandDark">{value}</span>
      <p className="mt-3 text-sm leading-6 text-muted">{label}</p>
    </div>
  );
}

function ArticleCard({ category, title }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-panel">
      <p className="mb-3 text-xs font-black uppercase tracking-wide text-brandDark">{category}</p>
      <h3 className="text-xl font-black leading-snug">{title}</h3>
      <p className="mt-4 text-sm leading-7 text-muted">Ringkasan pendek untuk kebutuhan company profile, changelog, atau dokumentasi produk.</p>
    </article>
  );
}

function QuotePoint({ detail, title }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4">
      <h3 className="font-black leading-snug">{title}</h3>
      <p className="mt-2 leading-6 text-blue-100">{detail}</p>
    </div>
  );
}

function FooterNav() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <LogoMark className="h-10 w-10" />
            <strong className="text-lg">Rembug</strong>
          </div>
          <p className="max-w-sm text-sm leading-7 text-muted">Tempat mencatat pertanyaan, keputusan, dan percakapan penting agar diskusi tim tetap rapi dan mudah dibuka kembali.</p>
        </div>
        <FooterColumn title="Produk" links={['Forum', 'Thread', 'Komentar', 'Reply']} />
        <FooterColumn title="Ruang" links={['Tentang', 'Artikel', 'Panduan', 'Komunitas']} />
        <FooterColumn title="Aksi" links={['Login', 'Register', 'Masuk Forum', 'Kontak']} />
      </div>
      <div className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-5 text-center text-sm font-bold text-muted">
          <span>Copyright © 2026 Rembug. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ links, title }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-900">{title}</h3>
      <div className="grid gap-2 text-sm font-bold text-muted">
        {links.map((link) => (
          <button className="w-fit transition hover:text-brandDark" key={link} onClick={() => {
            if (link === 'Login') navigate('/login');
            if (link === 'Register') navigate('/register');
            if (link === 'Forum' || link === 'Masuk Forum') navigate('/forum');
          }}
          >
            {link}
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur transition hover:bg-white/15">
      <span className="block text-2xl font-black">{value}</span>
      <p className="mt-1 text-xs font-bold uppercase text-blue-100">{label}</p>
    </div>
  );
}

function WorkflowStep({ detail, number, title }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <span className="text-sm font-black text-brandDark">{number}</span>
      <h3 className="mt-2 font-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function ActivityItem({ detail, title }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
      <span className="mt-1 h-3 w-3 rounded-full bg-brand" />
      <div>
        <h3 className="font-black">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{detail}</p>
      </div>
    </div>
  );
}

function ExampleDiscussion({ compact = false }) {
  return (
    <div className={compact ? 'grid gap-3 p-5 text-slate-950' : 'grid gap-4'}>
      <article className={`${compact ? 'bg-white/95' : 'bg-white'} overflow-hidden rounded-xl border border-slate-200`}>
        <div className="grid grid-cols-[44px_1fr]">
          <div className="grid content-start justify-items-center gap-1 bg-blue-50 py-4 text-xs font-black text-brandDark">
            <span>^</span>
            <span>58</span>
            <span>v</span>
          </div>
          <div className="p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
              <span>Produk</span>
              <span>-</span>
              <span>Oleh nadia</span>
              <span>-</span>
              <span>14 komentar</span>
            </div>
            <h3 className="text-lg font-black leading-snug">Bagaimana cara membuat forum diskusi terasa aktif sejak halaman pertama?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">Aku ingin pengguna baru langsung memahami topik populer, alur komentar, dan aksi yang bisa dilakukan tanpa harus membaca panduan panjang.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-muted">
              <span className="rounded-full bg-slate-100 px-3 py-1">Komentar</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Reply</span>
              <span className="rounded-full bg-slate-100 px-3 py-1">Like</span>
            </div>
          </div>
        </div>
      </article>

      <div className="ml-4 grid gap-3 border-l-2 border-blue-100 pl-4">
        <ExampleComment
          author="bima"
          body="Mulai dari thread unggulan dan komentar yang ringkas. Kalau konteksnya jelas, pengguna biasanya lebih berani ikut berdiskusi."
          likes="12"
        />
        <ExampleComment
          author="salsa"
          body="Aku juga suka kalau ada indikator aktivitas seperti jumlah komentar, reply, dan status akun. Feed jadi terasa hidup tanpa terlalu ramai."
          likes="8"
          reply="Setuju. Label kecil seperti kategori dan jumlah interaksi sudah cukup membantu untuk scanning cepat."
        />
      </div>
    </div>
  );
}

function ExampleComment({
  author, body, likes, reply,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-black text-brandDark">{initial(author)}</span>
        <div>
          <strong className="block text-sm">{author}</strong>
          <p className="text-xs text-muted">baru saja</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-700">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-muted">
        <span className="rounded-full bg-slate-100 px-3 py-1">{likes} like</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">Balas</span>
      </div>
      {reply && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="mb-1 text-xs font-black text-brandDark">Reply dari arya</p>
          <p className="text-sm leading-6 text-slate-700">{reply}</p>
        </div>
      )}
    </div>
  );
}

function PreviewPost({
  category, comments, score: scoreValue, title,
}) {
  return (
    <div className="mb-3 grid grid-cols-[42px_1fr] overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-sm">
      <div className="grid justify-items-center gap-1 bg-blue-50 py-3 text-xs font-black text-brandDark">
        <span>^</span>
        <span>{scoreValue}</span>
        <span>v</span>
      </div>
      <div className="p-3">
        <p className="mb-1 text-xs font-bold text-muted">{category}</p>
        <h3 className="font-black leading-snug">{title}</h3>
        <p className="mt-2 text-xs font-bold text-muted">{comments} komentar</p>
      </div>
    </div>
  );
}

function FeatureCard({ body, title }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-panel">
      <h2 className="mb-2 font-black">{title}</h2>
      <p className="leading-7 text-muted">{body}</p>
    </article>
  );
}

function AuthPage({ actions, mode }) {
  const isRegister = mode === 'register';
  const title = isRegister ? 'Bikin akun, langsung ikut ngobrol.' : 'Balik lagi ke ruang diskusi.';
  const subtitle = isRegister
    ? 'Gabung ke Rembug untuk membuka thread, ikut komentar, dan menyimpan percakapan tim dalam format yang rapi.'
    : 'Masuk untuk lanjut membuat thread, membalas komentar, dan mengikuti diskusi yang sedang ramai.';

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      username: form.get('username'),
      password: form.get('password'),
    };

    try {
      if (isRegister) {
        await actions.register({ ...payload, fullname: form.get('fullname') });
      } else {
        await actions.login(payload);
      }
    } catch (error) {
      actions.notify(error.message);
    }
  }

  return (
    <main className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[linear-gradient(135deg,#f8fbff_0%,#eef6ff_48%,#f7f9fc_100%)]">
      <section className="relative mx-auto grid min-h-[calc(100vh-64px)] max-w-7xl items-center gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden lg:grid gap-5">
          <div className="max-w-xl">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/75 px-4 py-2 text-sm font-black text-brandDark shadow-sm backdrop-blur">
              <LogoMark className="h-6 w-6" />
              Rembug Space
            </span>
            <h1 className="text-5xl font-black leading-tight text-slate-950">{title}</h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-slate-600">{subtitle}</p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <AuthBenefit value="Cepat" label="Masuk dan mulai diskusi tanpa alur rumit." />
            <AuthBenefit value="Rapi" label="Thread, komentar, dan reply tetap tersusun." />
            <AuthBenefit value="Aktif" label="Pantau percakapan yang sedang bergerak." />
          </div>
          <AuthPreviewCard isRegister={isRegister} />
        </div>

        <section className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-white/70 bg-white/90 shadow-panel backdrop-blur-xl">
          <div className="border-b border-slate-200 bg-gradient-to-br from-blue-600 via-brand to-cyan-500 p-6 text-white">
            <div className="mb-8 flex items-center justify-between">
              <LogoMark className="h-11 w-11" />
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-white ring-1 ring-white/20">
                {isRegister ? 'New member' : 'Welcome back'}
              </span>
            </div>
            <h1 className="text-3xl font-black leading-tight">{isRegister ? 'Buat akun' : 'Login'}</h1>
            <p className="mt-3 text-sm leading-6 text-blue-50">{subtitle}</p>
          </div>

          <div className="p-6">
            <form className="grid gap-3" onSubmit={submit}>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Username
                <input className="input" name="username" placeholder="contoh: dhanar" autoComplete="username" required />
              </label>
              <label className="grid gap-2 text-sm font-black text-slate-700">
                Password
                <input className="input" name="password" placeholder="Minimal 6 karakter" type="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required />
              </label>
              {isRegister && (
                <label className="grid gap-2 text-sm font-black text-slate-700">
                  Nama lengkap
                  <input className="input" name="fullname" placeholder="Nama kamu" required />
                </label>
              )}
              <button className="btn-primary mt-2 h-12 shadow-lg shadow-blue-500/20" type="submit">
                {isRegister ? 'Mulai bergabung' : 'Masuk ke forum'}
              </button>
            </form>
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-slate-700">
              {isRegister ? 'Setelah daftar, akun akan langsung diarahkan ke forum utama.' : 'Session tersimpan lokal agar kamu bisa lanjut berdiskusi lebih cepat.'}
            </div>
            <p className="mt-5 text-center text-sm text-muted">
              {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
              <button className="font-black text-brandDark" onClick={() => navigate(isRegister ? '/login' : '/register')}>
                {isRegister ? 'Login' : 'Register'}
              </button>
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}

function AuthBenefit({ label, value }) {
  return (
    <div className="rounded-lg border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <span className="block text-lg font-black text-brandDark">{value}</span>
      <p className="mt-2 text-sm leading-6 text-slate-600">{label}</p>
    </div>
  );
}

function AuthPreviewCard({ isRegister }) {
  return (
    <div className="max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-panel">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-cyan-400" />
          <strong>Rembug Today</strong>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-brandDark">
          {isRegister ? 'Siap onboarding' : '3 diskusi baru'}
        </span>
      </div>
      <div className="grid gap-3 p-5">
        <PreviewPost category="Product" title="Apa saja indikator forum yang bikin feed terasa hidup?" score="58" comments="14" />
        <PreviewPost category="Team" title="Template thread untuk merangkum keputusan meeting" score="34" comments="8" />
      </div>
    </div>
  );
}

function ForumPage({
  actions, loading, session, threads,
}) {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-[linear-gradient(180deg,#eef6ff_0%,#f7f9fc_34%,#f7f9fc_100%)]">
      <section className="mx-auto max-w-7xl px-4 py-5">
        <div className="mb-4 overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
          <div className="grid gap-4 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <span className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-blue-100 ring-1 ring-white/15">Community feed</span>
              <h1 className="text-3xl font-black leading-tight md:text-4xl">Forum Utama</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">Tempat thread terbaru, pertanyaan cepat, dan diskusi tim berkumpul dalam satu feed yang mudah dipindai.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <ForumMetric label="thread" value={threads.length} />
              <ForumMetric label="komentar" value={threads.reduce((sum, thread) => sum + Number(thread.commentCount || 0), 0)} />
              <ForumMetric label="aktif" value={session ? '1' : '0'} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <TrendPill active label="All" />
              <TrendPill label="Popular" />
              <TrendPill label="Newest" />
              <TrendPill label="Team notes" />
            </div>
            <button className="btn-ghost" onClick={() => window.location.reload()}>Refresh feed</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
          <LeftSidebar />
          <section className="grid content-start gap-3">
            <ThreadComposer actions={actions} session={session} />
            <FeedList loading={loading} threads={threads} />
          </section>
          <RightSidebar actions={actions} session={session} threads={threads} />
        </div>
      </section>
    </main>
  );
}

function ForumMetric({ label, value }) {
  return (
    <div className="min-w-20 rounded-lg border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
      <span className="block text-xl font-black">{value}</span>
      <p className="text-xs font-bold uppercase text-blue-100">{label}</p>
    </div>
  );
}

function TrendPill({ active = false, label }) {
  return (
    <button className={`rounded-full px-4 py-2 text-sm font-black transition ${active ? 'bg-brand text-white shadow-sm shadow-blue-500/20' : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-brandDark'}`}>
      {label}
    </button>
  );
}

function LeftSidebar() {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-gradient-to-br from-blue-50 to-white p-4">
          <p className="text-xs font-black uppercase tracking-wide text-brandDark">Ruang</p>
          <h2 className="mt-1 font-black">Explore</h2>
        </div>
        <div className="grid gap-1 p-3">
          <button className="flex w-full items-center justify-between rounded-lg bg-blue-50 px-3 py-2 text-left text-sm font-black text-brandDark">
            Home
            <span className="h-2 w-2 rounded-full bg-brand" />
          </button>
          <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-muted hover:bg-slate-100">Popular</button>
          <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-muted hover:bg-slate-100">Newest</button>
          <button className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-muted hover:bg-slate-100">Saved</button>
        </div>
        <div className="border-t border-slate-200 p-3">
          <p className="mb-2 px-3 text-xs font-black uppercase text-muted">Topik hangat</p>
          <TopicChip label="Backend" />
          <TopicChip label="Hapi" />
          <TopicChip label="PostgreSQL" />
          <TopicChip label="Testing" />
        </div>
      </div>
    </aside>
  );
}

function TopicChip({ label }) {
  return (
    <p className="mb-1 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"># {label}</p>
  );
}

function ThreadComposer({ actions, session }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await actions.createThread({
        title: form.get('title'),
        body: form.get('body'),
      });
      event.currentTarget.reset();
    } catch (error) {
      actions.notify(error.message);
    }
  }

  if (!session) {
    return (
      <div className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="p-4">
            <h2 className="font-black">Punya ide buat dibahas?</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Login dulu untuk membuka thread baru dan ikut percakapan.</p>
          </div>
          <div className="px-4 pb-4 sm:pb-0">
            <button className="btn-primary" onClick={() => navigate('/login')}>Login</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm transition focus-within:border-blue-300 focus-within:shadow-panel" onSubmit={submit}>
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-100 text-sm font-black text-brandDark">{initial(session.username)}</span>
          <div>
            <strong className="block text-sm">{session.username}</strong>
            <p className="text-xs text-muted">Siap membuka diskusi baru</p>
          </div>
        </div>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-700">Draft</span>
      </div>
      <div className="p-4">
      <div className="mb-3 flex items-center gap-3">
        <input className="input flex-1" name="title" placeholder="Buat judul thread" required />
      </div>
      <textarea className="textarea" name="body" placeholder="Tulis isi thread..." required />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 text-xs font-black text-muted">
          <span className="rounded-full bg-slate-100 px-3 py-1">Question</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Discussion</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">Update</span>
        </div>
        <button className="btn-primary" type="submit">Post</button>
      </div>
      </div>
    </form>
  );
}

function FeedList({ loading, threads }) {
  if (loading) {
    return <div className="rounded-lg border border-blue-100 bg-white p-8 text-center font-bold text-muted shadow-sm">Memuat feed...</div>;
  }

  if (!threads.length) {
    return (
      <div className="rounded-lg border border-dashed border-blue-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-black">Belum ada thread.</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Jadilah yang pertama membuka topik di forum ini.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {threads.map((thread) => <PostCard key={thread.id} thread={thread} />)}
    </div>
  );
}

function PostCard({ thread }) {
  return (
    <article className="group grid grid-cols-[54px_1fr] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-panel">
      <div className="grid content-start justify-items-center gap-1 bg-gradient-to-b from-blue-50 to-cyan-50 py-4 text-xs font-black text-brandDark">
        <button className="grid h-7 w-7 place-items-center rounded-full bg-white text-brandDark shadow-sm transition group-hover:bg-brand group-hover:text-white">^</button>
        <span>{score(thread)}</span>
        <button className="grid h-7 w-7 place-items-center rounded-full bg-white text-slate-400 shadow-sm">v</button>
      </div>
      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-brandDark">Diskusi</span>
          <span>Oleh {thread.username}</span>
          <span>-</span>
          <span>{formatDate(thread.date)}</span>
        </div>
        <button className="text-left" onClick={() => navigate(`/thread/${encodeURIComponent(thread.id)}`)}>
          <h2 className="text-xl font-black leading-snug text-slate-950 transition hover:text-brandDark">{thread.title}</h2>
        </button>
        <p className="mt-2 line-clamp-3 leading-7 text-slate-600">{thread.body}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-black text-muted">
          <button className="rounded-full bg-slate-100 px-3 py-1 transition hover:bg-blue-50 hover:text-brandDark" onClick={() => navigate(`/thread/${encodeURIComponent(thread.id)}`)}>{Number(thread.commentCount || 0)} komentar</button>
          <span className="rounded-full bg-slate-100 px-3 py-1">{Number(thread.replyCount || 0)} reply</span>
          <button className="rounded-full bg-slate-950 px-3 py-1 text-white transition hover:bg-brand" onClick={() => navigate(`/thread/${encodeURIComponent(thread.id)}`)}>Buka thread</button>
        </div>
      </div>
    </article>
  );
}

function RightSidebar({
  actions, session, threads,
}) {
  const totalComments = threads.reduce((sum, thread) => sum + Number(thread.commentCount || 0), 0);

  return (
    <aside className="grid gap-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 to-blue-800 p-4 text-white">
          <h2 className="font-black">Akun</h2>
          <p className="mt-1 text-sm text-blue-100">{session ? 'Kamu sedang online.' : 'Masuk untuk ikut diskusi.'}</p>
        </div>
        <div className="p-4">
        {session ? (
          <>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-100 font-black text-brandDark ring-4 ring-blue-50">{initial(session.username)}</span>
              <div>
                <strong className="block">{session.username}</strong>
                <p className="text-sm text-muted">Online sekarang</p>
              </div>
            </div>
            <button className="btn-ghost w-full" onClick={actions.logout}>Logout</button>
          </>
        ) : (
          <div className="grid gap-2">
            <button className="btn-primary" onClick={() => navigate('/login')}>Login</button>
            <button className="btn-ghost" onClick={() => navigate('/register')}>Register</button>
          </div>
        )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-black">Statistik</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white p-3 ring-1 ring-blue-100">
            <span className="block text-2xl font-black text-brandDark">{threads.length}</span>
            <p className="text-sm text-muted">thread</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-cyan-50 to-white p-3 ring-1 ring-cyan-100">
            <span className="block text-2xl font-black text-cyan-700">{totalComments}</span>
            <p className="text-sm text-muted">komentar</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-black">Trending</h2>
        <div className="grid gap-2">
          <TrendingItem title="Diskusi arsitektur" count="24 obrolan" />
          <TrendingItem title="Testing stabil" count="18 obrolan" />
          <TrendingItem title="PostgreSQL notes" count="12 obrolan" />
        </div>
      </section>

      <section className="rounded-lg border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
        <h2 className="mb-3 font-black">Fitur forum</h2>
        <div className="grid gap-2 text-sm font-bold text-slate-700">
          <span className="rounded-lg bg-white px-3 py-2 text-brandDark ring-1 ring-blue-100">Buat thread baru</span>
          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">Tulis komentar dan reply</span>
          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">Like komentar yang membantu</span>
          <span className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-100">Kelola konten milik sendiri</span>
        </div>
      </section>
    </aside>
  );
}

function TrendingItem({ count, title }) {
  return (
    <button className="rounded-lg bg-slate-50 px-3 py-3 text-left transition hover:bg-blue-50">
      <strong className="block text-sm">{title}</strong>
      <span className="mt-1 block text-xs font-bold text-muted">{count}</span>
    </button>
  );
}

function ThreadPage({
  actions, loading, selectedThread, session, threads,
}) {
  if (loading || !selectedThread) {
    return (
      <main className="min-h-[calc(100vh-64px)] bg-[linear-gradient(180deg,#eef6ff_0%,#f7f9fc_45%,#f7f9fc_100%)] px-4 py-6">
        <div className="mx-auto max-w-5xl rounded-lg border border-blue-100 bg-white p-8 text-center font-bold text-muted shadow-sm">Memuat thread...</div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[linear-gradient(180deg,#eef6ff_0%,#f7f9fc_36%,#f7f9fc_100%)]">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="grid content-start gap-3">
          <button className="btn-ghost w-fit" onClick={() => navigate('/forum')}>Kembali ke feed</button>
          <article className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 p-5 text-white">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs font-bold text-blue-100">
                <span className="rounded-full bg-white/10 px-3 py-1 ring-1 ring-white/15">Thread detail</span>
                <span>Oleh {selectedThread.username}</span>
                <span>-</span>
                <span>{formatDate(selectedThread.date)}</span>
              </div>
              <h1 className="text-3xl font-black leading-tight md:text-5xl">{selectedThread.title}</h1>
            </div>
            <div className="grid grid-cols-[54px_1fr]">
              <div className="grid content-start justify-items-center gap-1 bg-gradient-to-b from-blue-50 to-cyan-50 py-5 text-sm font-black text-brandDark">
                <span>^</span>
                <span>{selectedThread.comments.length + 1}</span>
                <span>v</span>
              </div>
              <div className="p-5">
                <p className="whitespace-pre-wrap leading-8 text-slate-700">{selectedThread.body}</p>
              </div>
            </div>
          </article>
          <CommentComposer actions={actions} session={session} threadId={selectedThread.id} />
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
              <h2 className="font-black">{selectedThread.comments.length} komentar</h2>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-brandDark">Diskusi aktif</span>
            </div>
            <div className="grid gap-4 p-4">
              {selectedThread.comments.length ? (
                selectedThread.comments.map((comment) => (
                  <CommentCard actions={actions} comment={comment} key={comment.id} session={session} threadId={selectedThread.id} />
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-blue-200 p-4 text-sm font-bold text-muted">Belum ada komentar.</p>
              )}
            </div>
          </section>
        </section>
        <RightSidebar actions={actions} session={session} threads={threads} />
      </div>
    </main>
  );
}

function CommentComposer({ actions, session, threadId }) {
  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await actions.createComment(threadId, form.get('content'));
      event.currentTarget.reset();
    } catch (error) {
      actions.notify(error.message);
    }
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-bold text-muted">Login untuk ikut komentar di thread ini.</p>
          <button className="btn-primary" onClick={() => navigate('/login')}>Login</button>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm" onSubmit={submit}>
      <textarea className="textarea" name="content" placeholder="Apa pendapatmu?" required />
      <div className="mt-3 flex justify-end">
        <button className="btn-primary" type="submit">Komentar</button>
      </div>
    </form>
  );
}

function CommentCard({
  actions, comment, session, threadId,
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const canDelete = session && comment.username === session.username;

  async function submitReply(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await actions.createReply(threadId, comment.id, form.get('content'));
      setReplyOpen(false);
    } catch (error) {
      actions.notify(error.message);
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="p-4">
        <div className="flex flex-col gap-1 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-black text-brandDark">{initial(comment.username)}</span>
            <strong className="text-ink">{comment.username}</strong>
          </div>
          <span>{formatDate(comment.date)}</span>
        </div>
        <p className="my-3 whitespace-pre-wrap leading-7 text-slate-700">{comment.content}</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost min-h-8 px-3" onClick={() => actions.likeComment(threadId, comment.id)}>Like {Number(comment.likeCount || 0)}</button>
          <button className="btn-ghost min-h-8 px-3" onClick={() => setReplyOpen((value) => !value)}>Reply</button>
          {canDelete && <button className="btn-ghost min-h-8 border-slate-300 px-3 text-slate-600" onClick={() => actions.deleteComment(threadId, comment.id)}>Hapus</button>}
        </div>
        {replyOpen && (
          <form className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3" onSubmit={submitReply}>
            <textarea className="textarea min-h-20" name="content" placeholder="Tulis reply..." required />
            <button className="btn-primary justify-self-end" type="submit">Kirim reply</button>
          </form>
        )}
      </div>
      {!!comment.replies.length && (
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4">
          {comment.replies.map((reply) => (
            <ReplyCard actions={actions} commentId={comment.id} key={reply.id} reply={reply} session={session} threadId={threadId} />
          ))}
        </div>
      )}
    </article>
  );
}

function ReplyCard({
  actions, commentId, reply, session, threadId,
}) {
  const canDelete = session && reply.username === session.username;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-1 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <strong className="text-ink">{reply.username}</strong>
        <span>{formatDate(reply.date)}</span>
      </div>
      <p className="my-2 whitespace-pre-wrap leading-7 text-slate-700">{reply.content}</p>
      {canDelete && (
        <button className="btn-ghost min-h-8 border-slate-300 px-3 text-slate-600" onClick={() => actions.deleteReply(threadId, commentId, reply.id)}>Hapus reply</button>
      )}
    </article>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-panel">
      {message}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
