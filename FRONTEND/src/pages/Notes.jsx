import { useState, useEffect } from 'react';
import { useAppearance } from '../components/AppearanceProvider';
import { Plus, Search, Trash2, BookOpen, Clock, Tag, FileText, ArrowLeft, AlertCircle, Edit3, Save, X } from 'lucide-react';
import { fetchNotes, createNote, deleteNoteAPI, updateNoteAPI } from '../api/notesApi';

const subjectColors = {
  Mathematics: '#6366f1', Physics: '#22c55e', Chemistry: '#f97316',
  Biology: '#8b5cf6', English: '#06b6d4', History: '#fbbf24', General: '#94a3b8',
};

const subjects = ['General','Mathematics','Physics','Chemistry','Biology','English','History','Other...'];

function useWindowWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return width;
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function Notes() {
  const [notes,       setNotes]       = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [search,      setSearch]      = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState(false);
  const [editContent, setEditContent] = useState('');
  const [newNote,     setNewNote]     = useState({ title: '', content: '', subject: 'General', tags: '' });
  const [customSubject, setCustomSubject] = useState('');
  const [isSaving,    setIsSaving]    = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [mobilePanel, setMobilePanel] = useState('list'); // 'list' | 'detail'

  const { colors, accent } = useAppearance();
  const windowWidth = useWindowWidth();
  const isMobile   = windowWidth < 640;    // < sm
  const isTablet   = windowWidth >= 640;   // sm+: always show both panels

  const inputStyle = {
    background:  colors.card2,
    border:      `1px solid ${colors.border}`,
    color:       colors.text,
    outline:     'none',
  };

  useEffect(() => {
    fetchNotes()
      .then(data => setNotes(Array.isArray(data) ? data : []))
      .catch(() => setNotes([]));
  }, []);

  const safeNotes = Array.isArray(notes) ? notes : [];
  const filtered  = safeNotes.filter(n =>
    n?.title?.toLowerCase().includes(search.toLowerCase()) ||
    n?.content?.toLowerCase().includes(search.toLowerCase()) ||
    n?.subject?.toLowerCase().includes(search.toLowerCase())
  );

  const addNote = async () => {
    if (!newNote.title.trim() || !newNote.content.trim()) {
      setErrorMsg('Title and Content are required.');
      setTimeout(() => setErrorMsg(''), 3500);
      return;
    }
    const finalSubject = newNote.subject === 'Other...' ? (customSubject.trim() || 'General') : newNote.subject;
    setIsSaving(true);
    setErrorMsg('');
    try {
      const saved = await createNote({
        title:   newNote.title,
        content: newNote.content,
        subject: finalSubject,
        tags:    newNote.tags ? newNote.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        color:   subjectColors[finalSubject] || '#94a3b8',
      });
      setNotes(prev => [saved, ...prev]);
      setSelected(saved);
      setNewNote({ title: '', content: '', subject: 'General', tags: '' });
      setCustomSubject('');
      setShowForm(false);
      if (isMobile) setMobilePanel('detail');
    } catch {
      setErrorMsg('Failed to save. Please try again.');
      setTimeout(() => setErrorMsg(''), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteNote = async (id) => {
    try {
      await deleteNoteAPI(id);
      setNotes(prev => prev.filter(n => n._id !== id));
      if (selected?._id === id) { setSelected(null); if (isMobile) setMobilePanel('list'); }
    } catch {}
  };

  const saveEdit = async () => {
    if (!selected) return;
    try {
      const updated = await updateNoteAPI(selected._id, { content: editContent });
      setNotes(prev => prev.map(n => n._id === selected._id ? { ...n, content: updated.content } : n));
      setSelected(prev => prev ? { ...prev, content: updated.content } : null);
      setEditing(false);
    } catch { alert('Failed to save edits.'); }
  };

  const openNote = (note) => {
    setSelected(note);
    setEditing(false);
    if (isMobile) setMobilePanel('detail');
  };

  // Panel visibility
  const showList   = !isMobile || mobilePanel === 'list';
  const showDetail = !isMobile || mobilePanel === 'detail';

  // Sidebar width
  const sidebarWidth = windowWidth >= 1024 ? 300 : 260;

  return (
    <div className="flex h-full min-h-0" style={{ background: colors.bg }}>

      {/* ── Notes List Sidebar ─────────────────────────────────────────────── */}
      {showList && (
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width:       isMobile ? '100%' : sidebarWidth,
            minWidth:    isMobile ? 0       : sidebarWidth,
            maxWidth:    isMobile ? '100%'  : sidebarWidth,
            height:      '100%',
            background:  colors.card2,
            borderRight: `1px solid ${colors.border}`,
          }}>

          {/* Header */}
          <div className="flex-shrink-0 p-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base" style={{ fontWeight: 700, color: colors.text }}>Notes</h2>
              <button
                onClick={() => { setShowForm(v => !v); if (isMobile && !showForm) setMobilePanel('detail'); }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${accent.main}, ${accent.light})` }}>
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: colors.textMuted }} />
              <input
                className="bg-transparent text-sm outline-none flex-1"
                style={{ color: colors.text }}
                placeholder="Search notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ color: colors.textMuted, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-xs mt-2" style={{ color: colors.textMuted }}>
              {filtered.length} {filtered.length === 1 ? 'note' : 'notes'}
            </p>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="w-10 h-10 mb-3 opacity-30" style={{ color: colors.textMuted }} />
                <p className="text-sm" style={{ color: colors.textMuted, fontWeight: 500 }}>
                  {search ? 'No notes found' : 'No notes yet'}
                </p>
                <p className="text-xs mt-1" style={{ color: colors.textMuted }}>
                  {search ? 'Try a different search' : 'Tap + to create your first note'}
                </p>
              </div>
            ) : (
              filtered.map(note => (
                <div
                  key={note._id}
                  onClick={() => openNote(note)}
                  className="p-3.5 rounded-xl cursor-pointer group transition-all duration-150 relative active:scale-[0.98]"
                  style={{
                    background: selected?._id === note._id ? `rgba(${accent.rgb},0.10)` : colors.card,
                    border:     `1px solid ${selected?._id === note._id ? `rgba(${accent.rgb},0.35)` : colors.border}`,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: note.color }} />
                        <span className="text-xs truncate" style={{ fontWeight: 700, color: colors.text }}>{note.title}</span>
                      </div>
                      <p className="text-xs leading-5 mb-2" style={{ color: colors.textMuted, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {note.content.replace(/\*\*/g, '').substring(0, 90)}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md" style={{ background: note.color + '18', color: note.color, fontWeight: 600 }}>{note.subject}</span>
                        <span className="text-[10px]" style={{ color: colors.textMuted }}>{formatDate(note.createdAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNote(note._id); }}
                      className="opacity-0 group-hover:opacity-100 sm:flex p-1.5 rounded-lg transition-all flex-shrink-0 active:opacity-100"
                      style={{ color: colors.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Delete note">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Note Detail ────────────────────────────────────────────────────── */}
      {showDetail && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: colors.bg }}>

          {/* Mobile back button */}
          {isMobile && (
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ background: colors.card2, borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => setMobilePanel('list')} className="flex items-center gap-2 text-sm" style={{ color: accent.main, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                <ArrowLeft className="w-4 h-4" />
                All Notes
              </button>
              {selected && <span className="text-sm truncate ml-1" style={{ color: colors.textSub }}>{selected.title}</span>}
            </div>
          )}

          {/* New Note Form */}
          {showForm && (
            <div className="p-4 sm:p-5 flex-shrink-0" style={{ borderBottom: `1px solid ${colors.border}`, background: colors.card }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm" style={{ fontWeight: 700, color: colors.text }}>New Note</h3>
                <button onClick={() => setShowForm(false)} style={{ color: colors.textMuted, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {errorMsg && (
                <div className="mb-3 p-3 rounded-xl flex items-center gap-2 text-sm"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span style={{ fontWeight: 500 }}>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className="px-3 py-2.5 rounded-xl text-sm w-full" style={inputStyle}
                    placeholder="Note title..."
                    value={newNote.title} onChange={e => setNewNote({ ...newNote, title: e.target.value })} />
                  <div className="flex flex-col gap-2">
                    <select className="px-3 py-2.5 rounded-xl text-sm w-full" style={inputStyle}
                      value={newNote.subject} onChange={e => setNewNote({ ...newNote, subject: e.target.value })}>
                      {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {newNote.subject === 'Other...' && (
                      <input className="px-3 py-2.5 rounded-xl text-sm w-full" style={inputStyle}
                        placeholder="Custom subject..." autoFocus
                        value={customSubject} onChange={e => setCustomSubject(e.target.value)} />
                    )}
                  </div>
                </div>
                <input className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle}
                  placeholder="Tags: calculus, formula, exam"
                  value={newNote.tags} onChange={e => setNewNote({ ...newNote, tags: e.target.value })} />
                <textarea className="w-full px-3 py-2.5 rounded-xl text-sm resize-none" style={{ ...inputStyle, minHeight: 100 }}
                  placeholder="Write your notes... (supports **bold** text)"
                  value={newNote.content} onChange={e => setNewNote({ ...newNote, content: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={addNote} disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl text-white text-sm hover:opacity-90 disabled:opacity-50 transition-all"
                    style={{ background: `linear-gradient(135deg, ${accent.main}, ${accent.light})`, fontWeight: 600, border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                    {isSaving ? 'Saving...' : 'Save Note'}
                  </button>
                  <button onClick={() => setShowForm(false)} disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all"
                    style={{ background: colors.card2, border: `1px solid ${colors.border}`, color: colors.textSub, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Note content */}
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Note header */}
              <div className="flex items-start justify-between mb-5 gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selected.color }} />
                    <h1 className="text-lg sm:text-xl" style={{ fontWeight: 800, letterSpacing: '-0.3px', color: colors.text }}>{selected.title}</h1>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: `${selected.color}18`, color: selected.color, fontWeight: 600 }}>{selected.subject}</span>
                    <div className="flex items-center gap-1 text-xs" style={{ color: colors.textMuted }}>
                      <Clock className="w-3 h-3" /><span>{formatDate(selected.createdAt)}</span>
                    </div>
                    {selected.tags?.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Tag className="w-3 h-3" style={{ color: colors.textMuted }} />
                        {selected.tags.map(t => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded" style={{ color: colors.textMuted, background: colors.border }}>#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {editing ? (
                    <>
                      <button onClick={saveEdit}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm"
                        style={{ background: '#22c55e', fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                        <Save className="w-3.5 h-3.5" /> Save
                      </button>
                      <button onClick={() => setEditing(false)}
                        className="px-4 py-2 rounded-xl text-sm"
                        style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.textSub, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditContent(selected.content); setEditing(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm"
                        style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.textSub, fontWeight: 500, cursor: 'pointer' }}>
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => deleteNote(selected._id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Note body */}
              <div className="p-4 sm:p-5 rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                {editing ? (
                  <textarea
                    className="w-full bg-transparent text-sm outline-none resize-none leading-7"
                    style={{ minHeight: 300, color: colors.text }}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    autoFocus
                  />
                ) : (
                  <div className="text-sm leading-7 whitespace-pre-wrap" style={{ color: colors.textSub }}>
                    {selected.content.split('\n').map((line, i) => {
                      const rendered = line.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${colors.text}">$1</strong>`);
                      return <div key={i} dangerouslySetInnerHTML={{ __html: rendered || '&nbsp;' }} />;
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4"
                style={{ background: `rgba(${accent.rgb},0.10)` }}>
                <BookOpen className="w-8 h-8 sm:w-10 sm:h-10 opacity-60" style={{ color: accent.main }} />
              </div>
              <p className="text-sm mb-1" style={{ fontWeight: 600, color: colors.textSub }}>Select a note to read</p>
              <p className="text-xs" style={{ color: colors.textMuted }}>Or create a new one with the + button</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}