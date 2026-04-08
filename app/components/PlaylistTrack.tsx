"use client";

import { useEffect, useState, useRef } from "react";
import * as Tone from "tone";
import { getSampler, initAudio, setBPM } from "@/lib/tone";
import PianoRoll from "./PianoRoll"; 

type Note = { id: string; time: number; duration: number; pitch: number };
type PatternTemplate = { id: string; name: string; duration: number; notes: Note[] };
type PlacedPattern = PatternTemplate & { instanceId: string; start: number; trackIndex: number };

const GRID_SIZE = 50; 
const TRACK_HEIGHT = 60;
const TOTAL_TRACKS = 12;

export default function PlaylistEditor() {
  const [library, setLibrary] = useState<PatternTemplate[]>([]);
  const [placedPatterns, setPlacedPatterns] = useState<PlacedPattern[]>([]);
  const [activePatternId, setActivePatternId] = useState<string | null>(null);
  const [isPlayingPlaylist, setIsPlayingPlaylist] = useState(false);
  const [playhead, setPlayhead] = useState(0); 
  const [bpm, setLocalBpm] = useState(120);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Sync BPM to Tone.js
  const handleBpmChange = (val: number) => {
    setLocalBpm(val);
    setBPM(val);
  };

  // --- SYNC PLAYHEAD (Beats-based) ---
  useEffect(() => {
    let animationFrame: number;
    const syncPlayhead = () => {
      const currentBeat = Tone.getTransport().seconds * (Tone.getTransport().bpm.value/120);
      setPlayhead(currentBeat);
      animationFrame = requestAnimationFrame(syncPlayhead);
    };

    if (isPlayingPlaylist) {
      animationFrame = requestAnimationFrame(syncPlayhead);
    } else {
      setPlayhead(0);
    }
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlayingPlaylist]);

  // --- PLAYBACK MECHANIC ---
  useEffect(() => {
    if (isPlayingPlaylist) {
      const sampler = getSampler();
      Tone.getTransport().cancel(); 
      
      placedPatterns.forEach((pattern) => {
        pattern.notes.forEach((note) => {
          // Both are beats. We schedule in "4n" (Quarter Notes)
          const totalBeats = pattern.start + note.time;
          
          Tone.getTransport().schedule((time) => {
            sampler.triggerAttackRelease(
              Tone.Frequency(note.pitch, "midi").toNote(), 
              note.duration + "n", 
              time
            );
          }, `${totalBeats}*4n`); 
        });
      });

      Tone.getTransport().start();
    } else {
      Tone.getTransport().stop();
      Tone.getTransport().seconds = 0; 
      Tone.getTransport().cancel();
    }
  }, [isPlayingPlaylist, placedPatterns]);

  // --- Original Handlers ---
  const updatePatternNotes = (patternId: string, newNotes: Note[]) => {
    setLibrary(prev => prev.map(p => p.id === patternId ? { ...p, notes: newNotes } : p));
    setPlacedPatterns(prev => prev.map(p => p.id === patternId ? { ...p, notes: newNotes } : p));
  };

  const createNewPattern = () => {
    const id = `pat-${Date.now()}`;
    const newPat = { id, name: `Pattern ${library.length + 1}`, duration: 4, notes: [] };
    setLibrary([...library, newPat]);
    setActivePatternId(id);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const start = Math.max(0, Math.floor((e.clientX - rect.left) / GRID_SIZE));
    const trackIndex = Math.max(0, Math.min(TOTAL_TRACKS - 1, Math.floor((e.clientY - rect.top) / TRACK_HEIGHT)));

    const type = e.dataTransfer.getData("type");
    if (type === "NEW_PATTERN") {
      const patternId = e.dataTransfer.getData("patternId");
      const template = library.find(p => p.id === patternId);
      if (template) setPlacedPatterns([...placedPatterns, { ...template, instanceId: crypto.randomUUID(), start, trackIndex }]);
    } else if (type === "MOVE_PATTERN") {
      const id = e.dataTransfer.getData("instanceId");
      setPlacedPatterns(prev => prev.map(p => p.instanceId === id ? { ...p, start, trackIndex } : p));
    }
  };

  const activePattern = library.find(p => p.id === activePatternId);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1a0633", color: "#ccc", overflow: "hidden" }}>
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 220, background: "#250a45", borderRight: "1px solid #333", padding: 15 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={createNewPattern} style={{ flex: 1, padding: 12, background: "#a582ff", border: "none", borderRadius: 4, fontWeight: "bold", cursor: "pointer", color: "white" }}>+</button>
                <button onClick={async () => { await initAudio(); setIsPlayingPlaylist(!isPlayingPlaylist); }} 
                style={{ flex: 2, padding: 12, background: isPlayingPlaylist ? "#ff4d4d" : "#4ade80", border: "none", borderRadius: 4, fontWeight: "bold", cursor: "pointer", color: "white" }}>
                {isPlayingPlaylist ? "STOP" : "PLAY"}
                </button>
            </div>
            
            {/* BPM INPUT */}
            <div 
                    style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        background: "#1a0633", 
                        padding: "8px", 
                        borderRadius: "4px",
                        cursor: "ns-resize", // Shows the vertical resize cursor
                        userSelect: "none"   // Prevents text highlighting while dragging
                    }}
                    onMouseDown={(e) => {
                        const startY = e.clientY;
                        const startBpm = bpm;

                        const onMouseMove = (moveEvent: MouseEvent) => {
                        // Calculate how far the mouse moved
                        const deltaY = startY - moveEvent.clientY;
                        // Adjust sensitivity: divide by 2 so it doesn't jump too fast
                        const newBpm = Math.max(20, Math.min(300, startBpm + Math.round(deltaY / 2)));
                        handleBpmChange(newBpm);
                        };

                        const onMouseUp = () => {
                        window.removeEventListener("mousemove", onMouseMove);
                        window.removeEventListener("mouseup", onMouseUp);
                        };

                        window.addEventListener("mousemove", onMouseMove);
                        window.addEventListener("mouseup", onMouseUp);
                    }}
                    >
                    <span style={{ fontSize: "10px", color: "#888", marginRight: "10px" }}>BPM</span>
                    <span 
                        style={{ 
                        color: "#a582ff", 
                        fontWeight: "bold", 
                        fontSize: "14px",
                        fontFamily: "monospace" // Keeps numbers from jumping horizontally
                        }}
                    >
                        {bpm}
                    </span>
                    </div>
          </div>

          {library.map(p => (
            <div key={p.id} draggable onDragStart={(e) => { e.dataTransfer.setData("type", "NEW_PATTERN"); e.dataTransfer.setData("patternId", p.id); }}
              onDoubleClick={() => setActivePatternId(p.id)}
              style={{ padding: 10, background: "#3d146e", borderRadius: 4, cursor: "grab", borderLeft: "4px solid orange", fontSize: "0.8rem", marginBottom: 8 }}>
              {p.name}
            </div>
          ))}
        </div>

        <div ref={gridRef} onDragOver={e => e.preventDefault()} onDrop={onDrop} style={{ position: "relative", flex: 1, overflow: "auto", background: "#1a0633" }}>
           <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(90deg, #3d146e 1px, transparent 1px), linear-gradient(#3d146e 1px, transparent 1px)`, backgroundSize: `${GRID_SIZE}px 100%, 100% ${TRACK_HEIGHT}px`, opacity: 0.2 }} />
           <div style={{ position: "absolute", top: 0, left: playhead * GRID_SIZE, width: 2, height: "100%", background: "#ff4d4d", zIndex: 50, pointerEvents: "none", boxShadow: "0 0 10px rgba(255, 77, 77, 0.8)" }} />
           {placedPatterns.map(p => (
              <div key={p.instanceId} draggable onDoubleClick={() => setActivePatternId(p.id)}
                onDragStart={(e) => { e.dataTransfer.setData("type", "MOVE_PATTERN"); e.dataTransfer.setData("instanceId", p.instanceId); }}
                style={{ position: "absolute", left: p.start * GRID_SIZE, top: p.trackIndex * TRACK_HEIGHT + 5, width: p.duration * GRID_SIZE - 2, height: TRACK_HEIGHT - 10, background: "orange", borderRadius: 4, color: "black", fontSize: "0.7rem", fontWeight: "bold", paddingLeft: 8, display: "flex", alignItems: "center", cursor: "pointer", zIndex: 10 }}>
                {p.name}
              </div>
           ))}
        </div>
      </div>

      {activePattern && (
        <div style={{ height: "50%", background: "#1a1a1a", borderTop: "4px solid #a582ff", overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 10, right: 100, zIndex: 100 }}>
            <button onClick={() => setActivePatternId(null)} style={{ background: "#ff4d4d", border: "none", color: "white", padding: "5px 15px",marginBottom:"20px", borderRadius: 4, cursor: "pointer" }}> X</button>
          </div>
          <div style={{ overflow: "auto", height: "100%" }}>
            <PianoRoll notes={activePattern.notes} onNotesChange={(newNotes) => updatePatternNotes(activePattern.id, newNotes)} />
          </div>
        </div>
      )}
    </div>
  );
}