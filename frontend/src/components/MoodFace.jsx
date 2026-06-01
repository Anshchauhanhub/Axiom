import React from 'react';

/**
 * MoodFace — an inline SVG robot face that changes expression based on mood.
 * mood: 1 (angry) → 2 (disappointed) → 3 (neutral) → 4 (content) → 5 (happy)
 */
const MoodFace = ({ mood = 3, size = 64 }) => {
  // Eye config (same for all moods, but eyebrows change)
  const eyeY = 38;
  const leftEyeX = 35;
  const rightEyeX = 65;

  const getMouth = () => {
    switch (mood) {
      case 5: // Big happy smile
        return <path d="M30 62 Q50 80 70 62" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
      case 4: // Gentle smile
        return <path d="M33 62 Q50 72 67 62" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 3: // Neutral straight line
        return <line x1="33" y1="64" x2="67" y2="64" stroke="#fff" strokeWidth="3" strokeLinecap="round" />;
      case 2: // Slight frown
        return <path d="M33 68 Q50 58 67 68" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 1: // Angry frown with teeth
        return (
          <g>
            <path d="M30 70 Q50 56 70 70" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </g>
        );
      default:
        return <line x1="33" y1="64" x2="67" y2="64" stroke="#fff" strokeWidth="3" strokeLinecap="round" />;
    }
  };

  const getEyebrows = () => {
    switch (mood) {
      case 5: // Happy raised eyebrows
        return (
          <g>
            <path d={`M${leftEyeX - 8} ${eyeY - 14} Q${leftEyeX} ${eyeY - 20} ${leftEyeX + 8} ${eyeY - 14}`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M${rightEyeX - 8} ${eyeY - 14} Q${rightEyeX} ${eyeY - 20} ${rightEyeX + 8} ${eyeY - 14}`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        );
      case 4: // Slightly raised
        return (
          <g>
            <line x1={leftEyeX - 7} y1={eyeY - 13} x2={leftEyeX + 7} y2={eyeY - 15} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={rightEyeX - 7} y1={eyeY - 15} x2={rightEyeX + 7} y2={eyeY - 13} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 3: // Neutral flat
        return (
          <g>
            <line x1={leftEyeX - 7} y1={eyeY - 14} x2={leftEyeX + 7} y2={eyeY - 14} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={rightEyeX - 7} y1={eyeY - 14} x2={rightEyeX + 7} y2={eyeY - 14} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 2: // Slightly furrowed
        return (
          <g>
            <line x1={leftEyeX - 7} y1={eyeY - 16} x2={leftEyeX + 7} y2={eyeY - 12} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={rightEyeX - 7} y1={eyeY - 12} x2={rightEyeX + 7} y2={eyeY - 16} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 1: // Angry V-shaped eyebrows
        return (
          <g>
            <line x1={leftEyeX - 8} y1={eyeY - 18} x2={leftEyeX + 8} y2={eyeY - 10} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <line x1={rightEyeX - 8} y1={eyeY - 10} x2={rightEyeX + 8} y2={eyeY - 18} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-all duration-500"
    >
      {/* Face background */}
      <circle cx="50" cy="50" r="46" fill="#1a1a1e" />

      {/* Eyes */}
      <rect x={leftEyeX - 6} y={eyeY - 5} width="12" height="10" rx="2" fill="#F4F4F4" />
      <rect x={rightEyeX - 6} y={eyeY - 5} width="12" height="10" rx="2" fill="#F4F4F4" />

      {/* Eyebrows */}
      {getEyebrows()}

      {/* Mouth */}
      {getMouth()}
    </svg>
  );
};

export default MoodFace;
