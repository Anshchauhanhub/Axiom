import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, 
  Image as ImageIcon, Video, Share2, 
  Trash2, GripVertical, ChevronDown, 
  Heading1, Heading2, Heading3, Type,
  Save, AlertCircle
} from 'lucide-react';

const MultimediaEditor = ({ initialContent, onSave, onShare, isSaving, user }) => {
  const [blocks, setBlocks] = useState([]);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const editorRefs = useRef({});
  const isInitialized = useRef(false);

  // Only initialize blocks from props on mount or when content is first available
  useEffect(() => {
    if (initialContent && !isInitialized.current) {
      if (Array.isArray(initialContent)) {
        setBlocks(initialContent);
      } else if (typeof initialContent === 'string' && initialContent.trim()) {
        setBlocks([{ id: 'block-' + Math.random().toString(36).substr(2, 9), type: 'text', content: initialContent }]);
      } else {
        setBlocks([{ id: 'block-' + Math.random().toString(36).substr(2, 9), type: 'text', content: '' }]);
      }
      isInitialized.current = true;
    }
  }, [initialContent]);

  // Reset initialization flag if activeGoal changes (handled by prop change or similar)
  // For now, we rely on the first load.

  const handleUpdateBlock = (id, updates) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    setBlocks(newBlocks);
    onSave(newBlocks);
  };

  const handleAddBlock = (type) => {
    const newBlock = {
      id: 'block-' + Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      url: type === 'text' ? '' : (type === 'image' ? 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=1000' : 'https://www.youtube.com/embed/dQw4w9WgXcQ'),
      caption: '',
      alignment: 'left'
    };
    const newBlocks = [...blocks, newBlock];
    setBlocks(newBlocks);
    onSave(newBlocks);
  };

  const handleRemoveBlock = (id) => {
    if (blocks.length === 1 && blocks[0].type === 'text') return;
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    onSave(newBlocks);
  };

  const applyFormatting = (command, value = null) => {
    if (activeBlockId && editorRefs.current[activeBlockId]) {
      editorRefs.current[activeBlockId].focus();
      document.execCommand(command, false, value);
      handleUpdateBlock(activeBlockId, { content: editorRefs.current[activeBlockId].innerHTML });
    }
  };

  const handleKeyDown = (e, id) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') { e.preventDefault(); applyFormatting('bold'); }
      if (e.key === 'i') { e.preventDefault(); applyFormatting('italic'); }
      if (e.key === 'u') { e.preventDefault(); applyFormatting('underline'); }
    }
    if (e.key === 'Enter') {
      // Logic for creating new block on enter could go here, 
      // but standard contentEditable handles internal newlines.
    }
  };

  const ToolbarButton = ({ icon: Icon, onClick, title, active = false, dropdown = false }) => (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-2 rounded-lg transition-all flex items-center justify-center gap-1 group relative ${
        active ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
      title={title}
    >
      <Icon size={18} />
      {dropdown && <ChevronDown size={12} />}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-[8px] font-label uppercase tracking-widest text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {title}
      </span>
    </button>
  );

  const renderBlock = (block) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="relative group/block py-2">
            <div 
              ref={el => editorRefs.current[block.id] = el}
              contentEditable
              onFocus={() => setActiveBlockId(block.id)}
              onBlur={(e) => handleUpdateBlock(block.id, { content: e.target.innerHTML })}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              dangerouslySetInnerHTML={{ __html: block.content }}
              className={`outline-none min-h-[1.5em] text-slate-800 font-serif text-xl leading-relaxed whitespace-pre-wrap selection:bg-primary/20 text-${block.alignment || 'left'}`}
              data-placeholder="Begin neural recording..."
            />
          </div>
        );
      case 'image':
        return (
          <div className={`my-12 flex flex-col group/image items-${block.alignment === 'center' ? 'center' : block.alignment === 'right' ? 'end' : 'start'}`}>
            <div className="relative overflow-hidden rounded-xl shadow-2xl border border-slate-200 transition-transform duration-500 hover:scale-[1.01]">
              <img src={block.url} alt={block.caption} className="max-w-full h-auto object-cover max-h-[600px] block" />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover/image:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    const url = prompt('Enter Image URL:', block.url);
                    if (url) handleUpdateBlock(block.id, { url });
                  }}
                  className="bg-white/95 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:text-primary transition-colors"
                >
                  <ImageIcon size={14} />
                </button>
              </div>
            </div>
            <input 
              className="mt-4 text-center text-sm font-label uppercase tracking-[0.2em] text-slate-400 bg-transparent border-none outline-none w-full italic"
              value={block.caption}
              placeholder="Figure caption..."
              onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })}
            />
          </div>
        );
      case 'video':
        return (
          <div className="my-12 flex flex-col items-center group/video">
            <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-900">
               {block.url.includes('youtube.com') || block.url.includes('youtu.be') ? (
                 <iframe 
                   className="w-full h-full"
                   src={block.url.replace('watch?v=', 'embed/')}
                   title="Video Player"
                   frameBorder="0"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   allowFullScreen
                 />
               ) : (
                 <video src={block.url} controls className="w-full h-full object-cover" />
               )}
              <div className="absolute top-4 right-4 opacity-0 group-hover/video:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    const url = prompt('Enter Video URL:', block.url);
                    if (url) handleUpdateBlock(block.id, { url });
                  }}
                  className="bg-white/95 backdrop-blur-sm p-2 rounded-lg shadow-lg hover:text-primary transition-colors"
                >
                  <Video size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col min-h-screen">
      
      {/* PROFESSIONAL RIBBON TOOLBAR */}
      <div className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-2 mb-10">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-1">
            {/* Font Styles */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
              <ToolbarButton icon={Bold} title="Bold (Ctrl+B)" onClick={() => applyFormatting('bold')} />
              <ToolbarButton icon={Italic} title="Italic (Ctrl+I)" onClick={() => applyFormatting('italic')} />
              <ToolbarButton icon={Underline} title="Underline (Ctrl+U)" onClick={() => applyFormatting('underline')} />
              <ToolbarButton icon={Strikethrough} title="Strikethrough" onClick={() => applyFormatting('strikethrough')} />
            </div>

            {/* Structure Styles */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
              <ToolbarButton icon={Heading1} title="H1" onClick={() => applyFormatting('formatBlock', 'H1')} />
              <ToolbarButton icon={Heading2} title="H2" onClick={() => applyFormatting('formatBlock', 'H2')} />
              <ToolbarButton icon={Type} title="Paragraph" onClick={() => applyFormatting('formatBlock', 'P')} />
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
              <ToolbarButton icon={AlignLeft} title="Align Left" onClick={() => applyFormatting('justifyLeft')} />
              <ToolbarButton icon={AlignCenter} title="Align Center" onClick={() => applyFormatting('justifyCenter')} />
              <ToolbarButton icon={AlignRight} title="Align Right" onClick={() => applyFormatting('justifyRight')} />
              <ToolbarButton icon={AlignJustify} title="Justify" onClick={() => applyFormatting('justifyFull')} />
            </div>

            {/* Lists */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
              <ToolbarButton icon={List} title="Bullets" onClick={() => applyFormatting('insertUnorderedList')} />
              <ToolbarButton icon={ListOrdered} title="Numbers" onClick={() => applyFormatting('insertOrderedList')} />
            </div>

            {/* Insert Media */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200">
              <ToolbarButton icon={ImageIcon} title="Insert Image" onClick={() => handleAddBlock('image')} />
              <ToolbarButton icon={Video} title="Insert Video" onClick={() => handleAddBlock('video')} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              {isSaving ? (
                <>
                  <CloudLightning size={14} className="animate-pulse text-primary" />
                  <span className="text-[10px] font-label uppercase tracking-widest font-black">Syncing</span>
                </>
              ) : (
                <>
                  <Save size={14} className="text-secondary" />
                  <span className="text-[10px] font-label uppercase tracking-widest">Secured</span>
                </>
              )}
            </div>
            <button 
              onClick={onShare}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-all duration-300 group"
            >
              <Share2 size={16} />
              <span className="text-[11px] font-label font-black uppercase tracking-widest">Share Synthesis</span>
            </button>
          </div>
        </div>
      </div>

      {/* DOCUMENT PAGE */}
      <div className="flex-grow flex flex-col items-center pb-32">
        <div className="w-full max-w-[850px] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.1),0_5px_15px_rgba(0,0,0,0.05)] rounded-sm min-h-[1100px] relative px-20 py-24 flex flex-col">
          
          {/* Subtle Document Header */}
          <div className="mb-16 border-b border-slate-100 pb-8 flex items-end justify-between transition-opacity duration-500 hover:opacity-100 opacity-40">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black font-headline tracking-tighter text-slate-900 border-l-4 border-primary pl-4 uppercase">Neural Archive</h1>
              <p className="text-[9px] font-label tracking-[0.4em] text-slate-400 uppercase">Axiom High-Level Protocol // {new Date().toLocaleDateString()}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[8px] font-label tracking-[0.5em] text-slate-400 uppercase italic">Subject: {user?.email?.split('@')[0]}</span>
              <span className="w-12 h-1 bg-primary/10 rounded-full"></span>
            </div>
          </div>

          {/* BLOCK FEED */}
          <div className="flex-grow space-y-4">
            {blocks.map((block) => (
              <div key={block.id} className="relative group/wrapper">
                {/* Block Controls - Only show on hover of the block area */}
                <div className="absolute -left-16 top-0 flex flex-col items-center gap-1 opacity-0 group-hover/wrapper:opacity-100 transition-opacity">
                  <div className="p-2 cursor-grab text-slate-200 hover:text-slate-400 transition-colors">
                    <GripVertical size={16} />
                  </div>
                  <button 
                    onClick={() => handleRemoveBlock(block.id)}
                    className="p-2 text-slate-200 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                {renderBlock(block)}
              </div>
            ))}
          </div>

          {/* Subtle Document Footer */}
          <div className="mt-20 pt-10 border-t border-slate-50 flex items-center justify-between opacity-20">
            <span className="text-[8px] font-label uppercase tracking-[0.6em] text-slate-400">Section Beta // Axiom Genesis Core</span>
            <span className="text-[8px] font-label uppercase tracking-[0.6em] text-slate-400">Protocol Page 01</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultimediaEditor;
