"use client";
import { useState, useEffect, useCallback } from "react";

interface Note {
  id: string; text: string; category: string;
  created_at: string; source: string; done: boolean; archived: boolean;
}
const SRC_LABELS: Record<string,string> = { telegram:"📱 TG", phone:"📞 Phone", mc:"🖥 MC" };
function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit",hour12:true});
}

export default function NotesPanel({ onNavigate }: { onNavigate:(id:string)=>void }) {
  const [notes, setNotes]       = useState<Note[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newText, setNewText]   = useState("");
  const [newCat, setNewCat]     = useState("");
  const [adding, setAdding]     = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/notes");
    const d = await r.json();
    if (d.ok) setNotes(d.notes);
    setLoading(false);
  }, []);

  // Poll every 30 s so notes filed from Telegram/phone appear automatically
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setAdding(true);
    await fetch("/api/notes", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ text:newText.trim(), category:newCat||undefined, source:"mc" }),
    });
    setNewText(""); setNewCat(""); setAdding(false); load();
  }

  async function act(id: string, action: "done"|"undone"|"archive") {
    await fetch("/api/notes", {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ id, action }),
    });
    load();
  }

  const cats = Array.from(new Set(notes.map(n=>n.category))).sort();
  const grouped: Record<string,Note[]> = {};
  for (const c of cats)
    grouped[c] = notes.filter(n=>n.category===c).sort((a,b)=>a.done===b.done?0:a.done?1:-1);
  const active = notes.filter(n=>!n.done).length;
  const done   = notes.filter(n=> n.done).length;

  return (
    <div className="h-full flex flex-col gap-4 text-white">
      <div className="flex items-center gap-3">
        <button onClick={()=>onNavigate("mission")} className="text-gray-400 hover:text-white text-sm">← Dashboard</button>
        <h1 className="text-xl font-bold">📝 Notes</h1>
        <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
          {active} active{done>0?` · ${done} done`:""}
        </span>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input type="text" value={newText} onChange={e=>setNewText(e.target.value)}
          placeholder="Add a note…"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        <input type="text" value={newCat} onChange={e=>setNewCat(e.target.value)}
          placeholder="Category (optional)"
          className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"/>
        <button type="submit" disabled={adding||!newText.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium">
          {adding?"…":"Add"}
        </button>
      </form>

      {loading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : notes.length===0 ? (
        <div className="text-gray-500 text-sm">No notes yet. Add one above or say &ldquo;add to notes: …&rdquo; on Telegram or phone.</div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {cats.map(cat=>(
            <div key={cat}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</div>
              <div className="space-y-2">
                {grouped[cat].map(note=>(
                  <div key={note.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${note.done?"bg-gray-900 border-gray-800 opacity-60":"bg-gray-800 border-gray-700"}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${note.done?"line-through text-gray-500":"text-white"}`}>{note.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{fmt(note.created_at)}</span>
                        {note.source&&note.source!=="mc"&&(
                          <span className="text-xs text-gray-500">{SRC_LABELS[note.source]??note.source}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {note.done?(
                        <button onClick={()=>act(note.id,"undone")} title="Mark undone"
                          className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300">↩</button>
                      ):(
                        <button onClick={()=>act(note.id,"done")} title="Mark done"
                          className="text-xs px-2 py-1 rounded bg-green-800 hover:bg-green-700 text-green-300">✓</button>
                      )}
                      <button onClick={()=>act(note.id,"archive")} title="Archive to vault"
                        className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300">🗄</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
