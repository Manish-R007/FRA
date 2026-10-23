"use client";

import { motion, useReducedMotion } from "framer-motion";

const MOTES = [
  { left: "8%", top: "18%", size: 3, delay: 0, duration: 14 },
  { left: "22%", top: "72%", size: 2, delay: 1.4, duration: 18 },
  { left: "41%", top: "28%", size: 4, delay: 0.6, duration: 16 },
  { left: "63%", top: "14%", size: 2, delay: 2.1, duration: 20 },
  { left: "71%", top: "62%", size: 3, delay: 0.9, duration: 15 },
  { left: "88%", top: "34%", size: 2, delay: 1.8, duration: 17 },
  { left: "12%", top: "48%", size: 2, delay: 2.6, duration: 19 },
  { left: "54%", top: "81%", size: 3, delay: 0.3, duration: 13 },
];

export default function ForestAtmosphere() {
  const reduce = useReducedMotion();

  return (
    <div className="forest-atmosphere" aria-hidden="true">
      <div className="forest-atmosphere__grain" />
      <div className="forest-atmosphere__motif" />
      <motion.span
        className="forest-atmosphere__orb forest-atmosphere__orb--gold"
        animate={reduce ? undefined : { x: [0, 40, -20, 0], y: [0, 30, -16, 0], scale: [1, 1.12, 0.96, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="forest-atmosphere__orb forest-atmosphere__orb--moss"
        animate={reduce ? undefined : { x: [0, -50, 18, 0], y: [0, -28, 22, 0], scale: [1, 0.9, 1.14, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.span
        className="forest-atmosphere__orb forest-atmosphere__orb--ember"
        animate={reduce ? undefined : { x: [0, 24, -30, 0], y: [0, 18, -24, 0], opacity: [0.35, 0.7, 0.4, 0.35] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      />
      {MOTES.map((mote, index) => (
        <motion.span
          key={index}
          className="forest-atmosphere__mote"
          style={{ left: mote.left, top: mote.top, width: mote.size, height: mote.size }}
          animate={reduce ? undefined : { y: [0, -28, 0], opacity: [0.15, 0.9, 0.15], scale: [0.8, 1.4, 0.8] }}
          transition={{ duration: mote.duration, repeat: Infinity, ease: "easeInOut", delay: mote.delay }}
        />
      ))}
    </div>
  );
}
