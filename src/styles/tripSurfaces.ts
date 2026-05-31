/** Shared elevation + surface tokens for trip details (VP-1 / P0). */
export const tripSurfaces = {
  canvas: 'bg-gradient-to-b from-slate-100 via-slate-50/80 to-slate-100',
  content:
    'rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-900/5',
  contentHover:
    'transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:shadow-slate-900/[0.08]',
  float:
    'rounded-2xl border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-900/[0.08] backdrop-blur-md',
  floatStrong:
    'rounded-[2rem] border border-slate-200/80 bg-white shadow-xl shadow-slate-900/[0.08]',
  segmentTrack:
    'rounded-full border border-slate-200 bg-slate-100/80 p-1 shadow-inner shadow-slate-900/5',
  segmentActive: 'bg-white text-slate-900 shadow-sm shadow-slate-900/10',
  primaryCta:
    'shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/25',
  dayHeaderToday:
    'border-blue-200 bg-blue-50/95 text-blue-950 shadow-md shadow-blue-900/10 ring-1 ring-blue-100',
  dayHeaderDefault:
    'border-slate-200 bg-white/95 text-slate-950 shadow-lg shadow-slate-900/[0.08] backdrop-blur-md',
  timelineSpine: 'bg-gradient-to-b from-blue-300 via-slate-200 to-transparent',
  timelineDot: 'border-2 border-white bg-slate-300 shadow-sm ring-2 ring-slate-100',
  timelineDotToday:
    'border-2 border-white bg-blue-500 shadow-md shadow-blue-500/30 ring-2 ring-blue-100',
  timelineDotActive:
    'border-2 border-white bg-blue-400 shadow ring-2 ring-blue-50',
  overlay:
    'rounded-2xl border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur-md',
  mapSegmentTrack:
    'rounded-full border border-white/20 bg-white/10 p-1 shadow-inner shadow-black/20 backdrop-blur-md',
  mapSegmentActive: 'bg-white text-slate-900 shadow-sm shadow-slate-900/10',
} as const;
