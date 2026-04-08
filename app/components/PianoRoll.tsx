"use client";

import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { getSampler, ensureSamplerLoaded } from "@/lib/tone";

const ROW_HEIGHT = 30;

type Note = {
  id: string;
  time: number;
  duration: number;
  pitch: number;
};

type PianoRollProps = {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
};

function midiToNote(midi: number) {
  return Tone.Frequency(midi, "midi").toNote();
}

function isSharp(note: string) {
  return note.includes("#");
}

export default function PianoRoll({ notes, onNotesChange }: PianoRollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number } | null>(null);

  // Sync with parent notes
  const [zoom, setZoom] = useState(60);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  // --- Logic for Saving ---
  const updateNotes = (newNotes: Note[]) => {
    onNotesChange(newNotes);
  };

  // Generate keys midi 60 to 84
  const keys = [];
  for (let midi = 84; midi >= 60; midi--) {
    const noteName = midiToNote(midi);
    keys.push({ midi, note: noteName, sharp: isSharp(noteName) });
  }

  // --- Handlers ---
  const handleAddNote = (e: React.MouseEvent, keyIndex: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const time = Math.floor((e.clientX - rect.left) / zoom);
    const newNote: Note = { 
        id: Date.now().toString(), 
        time, 
        duration: 1, 
        pitch: keys[keyIndex].midi 
    };
    updateNotes([...notes, newNote]);
  };

  const handleDelete = (id: string) => {
    updateNotes(notes.filter((n) => n.id !== id));
  };

  const handleMouseDown = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    dragRef.current = { id: note.id, offsetX: e.clientX };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.offsetX;
    if (Math.abs(dx) < 5) return; // threshold

    updateNotes(
      notes.map((n) =>
        n.id === dragRef.current!.id 
          ? { ...n, time: Math.max(0, Math.round((n.time * zoom + dx) / zoom)) } 
          : n
      )
    );
    dragRef.current.offsetX = e.clientX;
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  // --- Audio Engine ---
  const play = async () => {
    await Tone.start();
    const sampler = getSampler();
    await ensureSamplerLoaded();

    if (playing) {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      setPlaying(false);
      setPlayhead(0);
      return;
    }

    Tone.getTransport().cancel();
    notes.forEach((n) => {
      // Standardize to Musical Beats ("4n" = quarter note)
      Tone.getTransport().schedule((time) => {
        sampler.triggerAttackRelease(midiToNote(n.pitch), n.duration + "n", time);
      }, `${n.time}*4n`); 
    });

    Tone.getTransport().start();
    setPlaying(true);
  };

  useEffect(() => {
  let frame: number;
  const sync = () => {
    // Correct Formula: Total Seconds * (Beats Per Minute / 60 Seconds) = Total Beats
    const bpm = Tone.getTransport().bpm.value;
    const currentBeat = Tone.getTransport().seconds * (bpm / 120); 
    
    setPlayhead(currentBeat);
    frame = requestAnimationFrame(sync);
  };

  if (playing) {
    frame = requestAnimationFrame(sync);
  } else {
    setPlayhead(0); // Reset when stopped
  }

  return () => cancelAnimationFrame(frame);
}, [playing])

  return (
    <div 
        style={{ display: "flex", backgroundColor: "#1a1a1a", color: "white", padding: "10px", height: "100%" }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
    >
      {/* 1. PIANO KEYS */}
      <div style={{ width: 80, borderRight: "2px solid #000", flexShrink: 0 }}>
        {keys.map((key) => (
          <div
            key={key.midi}
            style={{
              height: ROW_HEIGHT,
              backgroundColor: key.sharp ? "#333" : "#eee",
              color: key.sharp ? "#fff" : "#333",
              borderBottom: "1px solid #999",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: "5px",
              fontSize: "10px",
              fontWeight: "bold",
              borderLeft: key.note.startsWith("C") && !key.sharp ? "4px solid #a582ff" : "none"
            }}
          >
            {key.note.startsWith("C") ? key.note : ""}
          </div>
        ))}
      </div>

      {/* 2. GRID */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          flex: 1,
          height: keys.length * ROW_HEIGHT,
          backgroundColor: "#120d2b",
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0,0,0,0.3) 1px, transparent 1px)
          `,
          backgroundSize: `${zoom}px ${ROW_HEIGHT}px`,
          overflow: "hidden"
        }}
      >
        {keys.map((key, i) => (
          <div
            key={`row-${key.midi}`}
            onClick={(e) => handleAddNote(e, i)}
            style={{
              height: ROW_HEIGHT,
              backgroundColor: key.sharp ? "rgba(0,0,0,0.2)" : "transparent",
              borderBottom: "1px solid rgba(255,255,255,0.02)"
            }}
          />
        ))}

        {/* Playhead */}
        <div style={{ position: "absolute", top: 0, left: playhead * zoom, width: 2, height: "100%", background: "#ff4d4d", zIndex: 10 }} />

        {/* Notes */}
        {notes.map((n) => {
          const rowIndex = keys.findIndex((k) => k.midi === n.pitch);
          if (rowIndex === -1) return null;
          return (
            <div
              key={n.id}
              onMouseDown={(e) => handleMouseDown(e, n)}
              onContextMenu={(e) => {
                e.preventDefault();
                handleDelete(n.id);
              }}
              style={{
                position: "absolute",
                left: n.time * zoom + 1,
                top: rowIndex * ROW_HEIGHT + 1,
                width: n.duration * zoom - 2,
                height: ROW_HEIGHT - 2,
                background: "#4ade80",
                borderRadius: "2px",
                border: "1px solid #22c55e",
                zIndex: 5,
                cursor: "move"
              }}
            />
          );
        })}
      </div>

      {/* 3. SIDE CONTROLS */}
      <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: "10px", position: "absolute", top: 10, right: 10 }}>
        <button onClick={play} style={{ padding: "10px", background: playing ? "red" : "green", color: "white", border: "none", borderRadius: 4 }}>
          {playing ? "STOP" : "PLAY"}
        </button>
        <button style={{ padding: "10px", background:"blue", color: "white", border: "none", borderRadius: 4 }} onClick={() => setZoom(z => z + 10)}>+</button>
        <button style={{ padding: "10px", background:"blue", color: "white", border: "none", borderRadius: 4 }} onClick={() => setZoom(z => Math.max(20, z - 10))}>-</button>
      </div>
    </div>
  );
}