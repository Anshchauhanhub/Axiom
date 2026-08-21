import React from 'react';

/**
 * MoodFace — inline SVG robot face with clearly distinct expressions.
 * mood: 1 (strict/stern) → 2 (focused) → 3 (neutral) → 4 (cheerful) → 5 (very happy)
 */
const MoodFace = ({ mood = 3, size = 64 }) => {
  const eyeY = 40;
  const leftEyeX = 34;
  const rightEyeX = 66;

  const getMouth = () => {
    switch (mood) {
      case 5: // Big wide open smile
        return (
          <g>
            <path d="M24 62 Q50 84 76 62" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
            {/* Teeth hint */}
            <path d="M30 66 Q50 76 70 66" stroke="#ffffff55" strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Rosy cheeks */}
            <ellipse cx="22" cy="60" rx="8" ry="5" fill="#ff8fa3" opacity="0.35" />
            <ellipse cx="78" cy="60" rx="8" ry="5" fill="#ff8fa3" opacity="0.35" />
          </g>
        );
      case 4: // Clear friendly smile
        return <path d="M28 63 Q50 78 72 63" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
      case 3: // Slight upturn — not flat
        return <path d="M32 66 Q50 72 68 66" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 2: // Slight frown
        return <path d="M32 68 Q50 62 68 68" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 1: // Clear straight frown
        return (
          <g>
            <path d="M28 70 Q50 60 72 70" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </g>
        );
      default:
        return <path d="M28 63 Q50 78 72 63" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />;
    }
  };

  const getEyebrows = () => {
    switch (mood) {
      case 5: // Raised high + curved up — very happy
        return (
          <g>
            <path d={`M${leftEyeX - 10} ${eyeY - 16} Q${leftEyeX} ${eyeY - 24} ${leftEyeX + 10} ${eyeY - 16}`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d={`M${rightEyeX - 10} ${eyeY - 16} Q${rightEyeX} ${eyeY - 24} ${rightEyeX + 10} ${eyeY - 16}`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        );
      case 4: // Raised gently
        return (
          <g>
            <path d={`M${leftEyeX - 9} ${eyeY - 14} Q${leftEyeX} ${eyeY - 20} ${leftEyeX + 9} ${eyeY - 14}`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d={`M${rightEyeX - 9} ${eyeY - 14} Q${rightEyeX} ${eyeY - 20} ${rightEyeX + 9} ${eyeY - 14}`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        );
      case 3: // Flat neutral
        return (
          <g>
            <line x1={leftEyeX - 9} y1={eyeY - 15} x2={leftEyeX + 9} y2={eyeY - 15} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={rightEyeX - 9} y1={eyeY - 15} x2={rightEyeX + 9} y2={eyeY - 15} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 2: // Angled inward — slightly concerned
        return (
          <g>
            <line x1={leftEyeX - 9} y1={eyeY - 12} x2={leftEyeX + 9} y2={eyeY - 17} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <line x1={rightEyeX - 9} y1={eyeY - 17} x2={rightEyeX + 9} y2={eyeY - 12} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 1: // Strong V-shape — stern/strict
        return (
          <g>
            <line x1={leftEyeX - 10} y1={eyeY - 10} x2={leftEyeX + 10} y2={eyeY - 18} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <line x1={rightEyeX - 10} y1={eyeY - 18} x2={rightEyeX + 10} y2={eyeY - 10} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          </g>
        );
      default:
        return null;
    }
  };

  const getPupils = () => {
    // Pupils shift based on mood (looking up when happy, looking forward when neutral, angled when stern)
    const pupilY = mood >= 4 ? eyeY - 1 : mood === 3 ? eyeY + 0 : eyeY + 2;
    return (
      <g>
        <rect x={leftEyeX - 3} y={pupilY - 2} width="6" height="6" rx="1.5" fill="#111" />
        <rect x={rightEyeX - 3} y={pupilY - 2} width="6" height="6" rx="1.5" fill="#111" />
        {/* Eye shine */}
        <circle cx={leftEyeX + 1} cy={pupilY - 1} r="1.2" fill="white" opacity="0.8" />
        <circle cx={rightEyeX + 1} cy={pupilY - 1} r="1.2" fill="white" opacity="0.8" />
      </g>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-all duration-700"
    >
      {/* Face background */}
      <circle cx="50" cy="50" r="46" fill="#1a1a1e" />

      {/* Eye whites */}
      <rect x={leftEyeX - 8} y={eyeY - 7} width="16" height="13" rx="3" fill="#F4F4F4" />
      <rect x={rightEyeX - 8} y={eyeY - 7} width="16" height="13" rx="3" fill="#F4F4F4" />

      {/* Pupils */}
      {getPupils()}

      {/* Eyebrows */}
      {getEyebrows()}

      {/* Mouth */}
      {getMouth()}
    </svg>
  );
};

export default MoodFace;
