import React, { useState } from 'react';
import { 
  Calendar, Languages, Video, Globe, Upload, 
  Check, ArrowRight, FileText, Link, Sparkles 
} from 'lucide-react';

const InteractiveDiscoveryCard = ({ onSubmitPreferences, targetExam = "GATE DA" }) => {
  const [months, setMonths] = useState(6);
  const [language, setLanguage] = useState('Hinglish');
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dailyHours, setDailyHours] = useState(2);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Construct structured text response for the AI assistant
    let summaryText = `Here are my preferences for ${targetExam}:
- Target Timeline: ${months} months
- Daily Study Hours: ${dailyHours} hours/day
- Preferred Language: ${language}`;

    if (hasPlaylist && playlistUrl.trim()) {
      summaryText += `\n- YouTube Playlist/Channel: ${playlistUrl.trim()}`;
    } else {
      summaryText += `\n- YouTube Playlist: Please find the best playlists online for me.`;
    }

    if (websiteUrl.trim()) {
      summaryText += `\n- Additional Website Resource: ${websiteUrl.trim()}`;
    }

    if (selectedFile) {
      summaryText += `\n- Uploaded Reference Document: ${selectedFile.name}`;
    }

    summaryText += `\nPlease synthesize the best web-derived roadmap based on these preferences!`;

    onSubmitPreferences({
      months,
      dailyHours,
      language,
      playlistUrl: hasPlaylist ? playlistUrl : '',
      websiteUrl,
      fileName: selectedFile ? selectedFile.name : '',
      summaryText
    });
  };

  return (
    <div className="w-full my-6 bg-gradient-to-br from-[#121216] via-[#1a1a22] to-[#0e0e12] border border-primary/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 border-b border-white/10 pb-4">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
          <Sparkles size={20} />
        </div>
        <div>
          <span className="text-[10px] font-label font-bold text-primary uppercase tracking-[0.25em] block mb-0.5">Interactive Discovery Engine</span>
          <h3 className="text-lg font-headline font-black uppercase text-white tracking-tight">Tailor Your Preparation Roadmap</h3>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Question 1: Target Months & Daily Hours */}
        <div className="bg-black/30 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Calendar size={16} className="text-primary" />
            <span>1. Preparation Timeline & Hours</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-white/50 block mb-2">Target Months</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  max="36"
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-20 bg-surface-container-highest/80 border border-outline-variant/20 rounded-xl px-3 py-2 text-white text-xs font-bold focus:border-primary outline-none"
                />
                <div className="flex gap-1.5 flex-1">
                  {[3, 6, 12].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        months === m ? 'bg-primary text-black shadow-md' : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-white/50 block mb-2">Daily Study Hours</label>
              <div className="flex gap-2">
                {[1, 2, 4, 6].map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setDailyHours(h)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                      dailyHours === h ? 'bg-primary text-black shadow-md' : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {h} hrs/day
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Question 2: Preferred Teaching Language */}
        <div className="bg-black/30 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Languages size={16} className="text-secondary" />
            <span>2. Preferred Teaching Language</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'Hindi', label: '🇮🇳 Hindi' },
              { id: 'Hinglish', label: '💬 Hinglish' },
              { id: 'English', label: '🇬🇧 English' }
            ].map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguage(lang.id)}
                className={`py-3 px-4 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                  language === lang.id
                    ? 'bg-secondary/20 border-secondary text-secondary shadow-[0_0_15px_rgba(0,179,89,0.2)]'
                    : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                {lang.label}
                {language === lang.id && <Check size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Question 3: Existing YouTube Playlist / Channel */}
        <div className="bg-black/30 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                <Video size={16} className="text-red-400" />
              <span>3. Do you have a specific YouTube Playlist or Channel?</span>
            </div>
            <div className="flex gap-2 bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setHasPlaylist(true)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  hasPlaylist ? 'bg-red-500/20 border border-red-500/40 text-red-400' : 'text-white/40'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setHasPlaylist(false)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  !hasPlaylist ? 'bg-white/20 text-white' : 'text-white/40'
                }`}
              >
                No
              </button>
            </div>
          </div>

          {hasPlaylist && (
            <div className="animate-in fade-in zoom-in-95 duration-300">
              <input
                type="url"
                value={playlistUrl}
                onChange={(e) => setPlaylistUrl(e.target.value)}
                placeholder="Paste YouTube Playlist URL (e.g. https://www.youtube.com/playlist?list=...)"
                className="w-full bg-surface-container-highest/80 border border-red-500/30 rounded-xl px-4 py-3 text-white text-xs font-light focus:border-red-400 outline-none"
              />
            </div>
          )}
        </div>

        {/* Question 4: Extra Resources (Website Link & Document Upload) */}
        <div className="bg-black/30 p-4 sm:p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
            <Globe size={16} className="text-purple-400" />
            <span>4. Additional Resources (Website Link or Document)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Website URL Box */}
            <div>
              <label className="text-[10px] uppercase font-bold text-white/50 block mb-1.5 flex items-center gap-1">
                <Link size={12} /> Website / Article URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://geeksforgeeks.org/..."
                className="w-full bg-surface-container-highest/80 border border-outline-variant/20 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-purple-400"
              />
            </div>

            {/* Document Upload Box */}
            <div>
              <label className="text-[10px] uppercase font-bold text-white/50 block mb-1.5 flex items-center gap-1">
                <Upload size={12} /> Upload Study Syllabus / Doc (PDF, TXT)
              </label>
              <label className="w-full bg-surface-container-highest/60 hover:bg-surface-container-highest border border-dashed border-white/20 rounded-xl px-3.5 py-2 flex items-center justify-between cursor-pointer transition-all">
                <div className="flex items-center gap-2 text-xs text-white/70 truncate">
                  <FileText size={16} className="text-purple-400 shrink-0" />
                  <span className="truncate">{selectedFile ? selectedFile.name : 'Choose File...'}</span>
                </div>
                <input type="file" accept=".pdf,.txt,.docx" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="w-full py-4 bg-primary text-black font-headline font-black text-xs uppercase tracking-[0.2em] rounded-2xl hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(253,184,19,0.3)]"
        >
          Synthesize Master Roadmap <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
};

export default InteractiveDiscoveryCard;
