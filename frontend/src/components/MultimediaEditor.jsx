import React, { useState, useEffect, useRef } from 'react';
import html2pdf from 'html2pdf.js';
import { 
  Bold, Italic, Underline, Strikethrough, 
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List as ListIcon, ListOrdered, 
  Image as ImageIcon, Video, Share2, 
  Trash2, GripVertical, ChevronDown, 
  Heading1, Heading2, Heading3, Heading4, Type,
  Save, AlertCircle, Info, AlertTriangle, CheckCircle,
  Code, Minus, CheckSquare, Table as TableIcon, Sigma,
  Highlighter, Palette, Plus, Download, FileText, File
} from 'lucide-react';

const EditableContent = ({ content, onUpdate, onSlashCommand, onKeyDown, onFocus, className, placeholder, editorRef }) => {
  const localRef = useRef(null);
  const contentRef = useRef(content);

  useEffect(() => {
    if (editorRef) editorRef(localRef.current);
  }, [editorRef]);

  useEffect(() => {
    if (localRef.current && content !== contentRef.current) {
      localRef.current.innerHTML = content;
      contentRef.current = content;
    }
  }, [content]);

  useEffect(() => {
    if (localRef.current && localRef.current.innerHTML === '') {
       localRef.current.innerHTML = content;
    }
  }, []);

  return (
    <div
      ref={localRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={onFocus}
      onInput={(e) => {
        const html = e.currentTarget.innerHTML;
        contentRef.current = html;
        onUpdate(html);
        if (html.endsWith('/')) {
           const rect = e.currentTarget.getBoundingClientRect();
           if (onSlashCommand) onSlashCommand({ x: rect.left, y: rect.bottom });
        } else {
           if (onSlashCommand) onSlashCommand(null);
        }
      }}
      onKeyDown={onKeyDown}
      className={className}
      data-placeholder={placeholder}
    />
  );
};

const MultimediaEditor = ({ initialContent, onSave, onShare, isSaving, user, activeGoalTitle }) => {
  const [blocks, setBlocks] = useState([]);
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [slashMenuContext, setSlashMenuContext] = useState(null); // { id, x, y }
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const documentRef = useRef(null);
  
  const editorRefs = useRef({});
  const isInitialized = useRef(false);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    if (!isInitialized.current) {
      if (Array.isArray(initialContent) && initialContent.length > 0) {
        setBlocks(initialContent);
        isInitialized.current = true;
      } else if (typeof initialContent === 'string' && initialContent.trim()) {
        try {
          // Attempt to parse if it's a stringified JSON array
          const parsed = JSON.parse(initialContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBlocks(parsed);
            isInitialized.current = true;
            return;
          }
        } catch (e) {
          // Not valid JSON, fall back to treating it as raw text
        }
        setBlocks([{ id: 'block-' + Math.random().toString(36).substr(2, 9), type: 'text', content: initialContent }]);
        isInitialized.current = true;
      } else {
        setBlocks([{ id: 'block-' + Math.random().toString(36).substr(2, 9), type: 'text', content: '' }]);
        isInitialized.current = true;
      }
    }
  }, [initialContent]);

  // Prevent backspace from navigating away (browser "go back") when not editing text
  useEffect(() => {
    const preventBackspaceNavigation = (e) => {
      if (e.key === 'Backspace') {
        const el = document.activeElement;
        const isEditable = el && (
          el.tagName === 'INPUT' || 
          el.tagName === 'TEXTAREA' || 
          el.isContentEditable
        );
        if (!isEditable) {
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', preventBackspaceNavigation);
    return () => document.removeEventListener('keydown', preventBackspaceNavigation);
  }, []);

  const handleUpdateBlock = (id, updates) => {
    setBlocks(prev => {
      const newBlocks = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      // Debounce saving
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        onSave(newBlocks);
      }, 500);
      return newBlocks;
    });
  };

  const insertBlockAfter = (currentId, type = 'text', overrides = {}) => {
    const newBlock = {
      id: 'block-' + Math.random().toString(36).substr(2, 9),
      type,
      content: '',
      alignment: 'left',
      ...overrides
    };
    
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === currentId);
      const newBlocks = [...prev];
      if (idx !== -1) {
        newBlocks.splice(idx + 1, 0, newBlock);
      } else {
        newBlocks.push(newBlock);
      }
      onSave(newBlocks);
      return newBlocks;
    });
    
    // Focus new block slightly later to let it render
    setTimeout(() => {
      if (editorRefs.current[newBlock.id] && type === 'text') {
        editorRefs.current[newBlock.id].focus();
      }
    }, 50);
  };

  const handleAddBlock = (type) => {
    const lastBlockId = blocks.length > 0 ? blocks[blocks.length - 1].id : null;
    let overrides = {};
    if (type === 'image') overrides = { url: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?q=80&w=1000', caption: '' };
    if (type === 'video') overrides = { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' };
    if (type === 'callout') overrides = { calloutType: 'info' };
    if (type === 'checklist') overrides = { items: [{ id: 'item-1', text: '', checked: false }] };
    if (type === 'table') overrides = { rows: [['Term', 'Definition'], ['', '']] };
    
    insertBlockAfter(lastBlockId, type, overrides);
  };

  const handleRemoveBlock = (id) => {
    if (blocks.length === 1) return;
    setBlocks(prev => {
      const newBlocks = prev.filter(b => b.id !== id);
      onSave(newBlocks);
      return newBlocks;
    });
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
    
    if (e.key === 'Enter' && !e.shiftKey) {
      const block = blocks.find(b => b.id === id);
      if (block && block.type === 'text') {
        // Prevent default to create a new block instead of a div inside the current one
        // Wait, standard contentEditable handles newlines. For an exam editor, we might want to split blocks, 
        // but let's stick to simple multiline for now unless it's empty
      }
    }

    if (e.key === '/' && blocks.find(b => b.id === id)?.type === 'text') {
       // Slash command
       const rect = editorRefs.current[id].getBoundingClientRect();
       setSlashMenuContext({ id, x: rect.left, y: rect.bottom });
    } else {
       if (e.key !== 'Shift') setSlashMenuContext(null);
    }
  };

  const ToolbarButton = ({ icon: Icon, onClick, title, active = false, dropdown = false, iconColor = "" }) => (
    <button 
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`p-2 rounded-lg transition-all flex items-center justify-center gap-1 group relative ${
        active ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
      title={title}
    >
      <Icon size={18} className={iconColor} />
      {dropdown && <ChevronDown size={12} />}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-[8px] font-label uppercase tracking-widest text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {title}
      </span>
    </button>
  );

  const applyColor = (color, isBg = false) => {
    const command = isBg ? 'hiliteColor' : 'foreColor';
    // Use hiliteColor for non-IE, backColor for IE. hiliteColor works in modern browsers.
    applyFormatting(isBg ? 'backColor' : 'foreColor', color);
  };

  const handleDownloadPDF = () => {
    if (!documentRef.current) return;
    const element = documentRef.current;
    const opt = {
      margin:       10,
      filename:     `${(activeGoalTitle || 'Neural_Notes').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
    setShowDownloadMenu(false);
  };

  const handleDownloadWord = () => {
    if (!documentRef.current) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + documentRef.current.innerHTML + footer;
    
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${(activeGoalTitle || 'Neural_Notes').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
    setShowDownloadMenu(false);
  };

  const renderBlock = (block) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="relative group/block py-2">
            <EditableContent
              editorRef={el => editorRefs.current[block.id] = el}
              content={block.content}
              onUpdate={(html) => handleUpdateBlock(block.id, { content: html })}
              onSlashCommand={(rect) => {
                if (rect) setSlashMenuContext({ id: block.id, x: rect.x, y: rect.y });
                else setSlashMenuContext(null);
              }}
              onFocus={() => setActiveBlockId(block.id)}
              onKeyDown={(e) => handleKeyDown(e, block.id)}
              className={`outline-none min-h-[1.5em] text-slate-800 font-serif text-lg leading-relaxed whitespace-pre-wrap selection:bg-primary/20 text-${block.alignment || 'left'}`}
              placeholder="Start typing or press '/' for commands..."
            />
          </div>
        );
      case 'callout':
        const calloutStyles = {
          info: "bg-blue-50 border-blue-200 text-blue-900",
          warning: "bg-amber-50 border-amber-200 text-amber-900",
          success: "bg-emerald-50 border-emerald-200 text-emerald-900",
          important: "bg-rose-50 border-rose-200 text-rose-900"
        };
        const icons = {
          info: <Info className="text-blue-500 mt-1" size={20} />,
          warning: <AlertTriangle className="text-amber-500 mt-1" size={20} />,
          success: <CheckCircle className="text-emerald-500 mt-1" size={20} />,
          important: <AlertCircle className="text-rose-500 mt-1" size={20} />
        };
        return (
          <div className={`my-4 p-4 rounded-xl border flex gap-4 ${calloutStyles[block.calloutType || 'info']}`}>
            <div className="flex-shrink-0">
              {icons[block.calloutType || 'info']}
            </div>
            <div className="flex-1">
               <EditableContent
                editorRef={el => editorRefs.current[block.id] = el}
                content={block.content}
                onUpdate={(html) => handleUpdateBlock(block.id, { content: html })}
                onFocus={() => setActiveBlockId(block.id)}
                className="outline-none min-h-[1.5em] font-serif text-lg leading-relaxed whitespace-pre-wrap"
                placeholder="Enter callout note..."
              />
            </div>
            {/* Callout type switcher on hover */}
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover/wrapper:opacity-100 transition-opacity">
               {['info', 'success', 'warning', 'important'].map(t => (
                 <button key={t} onClick={() => handleUpdateBlock(block.id, { calloutType: t })} className={`w-4 h-4 rounded-full border border-black/10 ${
                   t === 'info' ? 'bg-blue-400' : t === 'success' ? 'bg-emerald-400' : t === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                 }`} />
               ))}
            </div>
          </div>
        );
      case 'code':
        return (
          <div className="my-6 rounded-xl overflow-hidden border border-slate-800 bg-[#0e0e10] shadow-xl">
             <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                </div>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Code Snippet</span>
             </div>
             <div className="p-4">
                <textarea
                  value={block.content}
                  onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
                  onFocus={() => setActiveBlockId(block.id)}
                  className="w-full bg-transparent border-none outline-none font-mono text-sm text-slate-300 resize-none min-h-[100px]"
                  placeholder="// write code here..."
                  spellCheck="false"
                />
             </div>
          </div>
        );
      case 'checklist':
        return (
          <div className="my-4 space-y-2">
            {(block.items || []).map((item, idx) => (
              <div key={item.id} className="flex items-start gap-3 group/item">
                <button 
                  onClick={() => {
                    const newItems = [...block.items];
                    newItems[idx].checked = !newItems[idx].checked;
                    handleUpdateBlock(block.id, { items: newItems });
                  }}
                  className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    item.checked ? 'bg-primary border-primary text-white' : 'border-slate-300 text-transparent'
                  }`}
                >
                  <CheckSquare size={14} />
                </button>
                <input
                  value={item.text}
                  onChange={(e) => {
                    const newItems = [...block.items];
                    newItems[idx].text = e.target.value;
                    handleUpdateBlock(block.id, { items: newItems });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const newItems = [...block.items];
                      newItems.splice(idx + 1, 0, { id: 'item-' + Math.random(), text: '', checked: false });
                      handleUpdateBlock(block.id, { items: newItems });
                    } else if (e.key === 'Backspace' && item.text === '' && block.items.length > 1) {
                      e.preventDefault();
                      const newItems = block.items.filter((_, i) => i !== idx);
                      handleUpdateBlock(block.id, { items: newItems });
                    }
                  }}
                  className={`flex-1 bg-transparent border-none outline-none font-serif text-lg transition-all ${
                    item.checked ? 'text-slate-400 line-through' : 'text-slate-800'
                  }`}
                  placeholder="To-do item..."
                />
                <button 
                  onClick={() => {
                    if (block.items.length > 1) {
                      const newItems = block.items.filter((_, i) => i !== idx);
                      handleUpdateBlock(block.id, { items: newItems });
                    }
                  }}
                  className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-400 hover:text-error transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        );
      case 'table':
        return (
          <div className="my-6 w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left border-collapse">
               <tbody>
                 {(block.rows || [['','']]).map((row, rIdx) => (
                   <tr key={rIdx} className="border-b border-slate-200 last:border-0 group/row">
                     {row.map((cell, cIdx) => (
                       <td key={cIdx} className={`p-0 border-r border-slate-200 last:border-0 ${rIdx === 0 ? 'bg-slate-50 font-bold' : 'bg-white'}`}>
                          <input
                            value={cell}
                            onChange={(e) => {
                              const newRows = [...block.rows];
                              newRows[rIdx][cIdx] = e.target.value;
                              handleUpdateBlock(block.id, { rows: newRows });
                            }}
                            className="w-full h-full p-3 bg-transparent border-none outline-none font-sans text-sm text-slate-800"
                            placeholder={rIdx === 0 ? "Header" : "Data"}
                          />
                       </td>
                     ))}
                     {/* Add row button */}
                     <td className="w-8 p-0 border-none bg-transparent opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            const newRows = [...block.rows];
                            newRows.splice(rIdx + 1, 0, ['', '']);
                            handleUpdateBlock(block.id, { rows: newRows });
                          }}
                          className="w-full h-full flex items-center justify-center text-primary hover:bg-primary/10"
                        >
                          <Plus size={14} />
                        </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        );
      case 'formula':
        return (
          <div className="my-6 p-6 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center relative">
            <div className="absolute top-2 left-3 flex items-center gap-2 opacity-50">
               <Sigma size={14} className="text-primary" />
               <span className="text-[10px] font-label uppercase tracking-widest font-bold text-slate-500">Formula</span>
            </div>
            <input
              value={block.content}
              onChange={(e) => handleUpdateBlock(block.id, { content: e.target.value })}
              className="w-full text-center bg-transparent border-none outline-none font-serif italic text-2xl text-slate-800 tracking-wide mt-4"
              placeholder="e.g. E = mc² or a² + b² = c²"
            />
          </div>
        );
      case 'divider':
        return (
          <div className="my-10 flex items-center justify-center">
            <div className="w-full max-w-sm h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
            <div className="px-4 text-slate-300">
              <Minus size={16} />
            </div>
            <div className="w-full max-w-sm h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
          </div>
        );
      case 'image':
      case 'video':
        // Keeping the existing image and video renderers for now, slightly tweaked
        return (
          <div className={`my-12 flex flex-col items-center group/media`}>
             {block.type === 'image' ? (
                <div className="relative overflow-hidden rounded-xl shadow-xl border border-slate-200">
                  <img src={block.url} alt={block.caption} className="max-w-full h-auto object-cover max-h-[600px] block" />
                  <div className="absolute top-4 right-4 opacity-0 group-hover/media:opacity-100 transition-opacity">
                    <button onClick={() => { const url = prompt('Enter Image URL:', block.url); if (url) handleUpdateBlock(block.id, { url }); }} className="bg-white/95 p-2 rounded-lg shadow-lg hover:text-primary"><ImageIcon size={14} /></button>
                  </div>
                </div>
             ) : (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-xl border border-slate-200 bg-slate-900">
                  {block.url.includes('youtube.com') || block.url.includes('youtu.be') ? (
                    <iframe className="w-full h-full" src={block.url.replace('watch?v=', 'embed/')} title="Video" frameBorder="0" allowFullScreen />
                  ) : (
                    <video src={block.url} controls className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-4 right-4 opacity-0 group-hover/media:opacity-100 transition-opacity">
                    <button onClick={() => { const url = prompt('Enter Video URL:', block.url); if (url) handleUpdateBlock(block.id, { url }); }} className="bg-white/95 p-2 rounded-lg shadow-lg hover:text-primary"><Video size={14} /></button>
                  </div>
                </div>
             )}
             <input className="mt-4 text-center text-sm font-label uppercase tracking-[0.2em] text-slate-400 bg-transparent border-none outline-none w-full italic" value={block.caption} placeholder="Figure caption..." onChange={(e) => handleUpdateBlock(block.id, { caption: e.target.value })} />
          </div>
        );
      default:
        return null;
    }
  };

  const wordCount = blocks.reduce((acc, b) => acc + (b.type === 'text' && typeof b.content === 'string' ? b.content.replace(/<[^>]*>?/gm, '').trim().split(/\s+/).filter(Boolean).length : 0), 0);

  return (
    <div className="w-full flex flex-col min-h-full bg-slate-50 relative">
      
      {/* PROFESSIONAL RIBBON TOOLBAR */}
      <div className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm pl-6 pr-16 py-2 mb-6">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {/* Font Styles */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200 shrink-0">
              <ToolbarButton icon={Bold} title="Bold" onClick={() => applyFormatting('bold')} />
              <ToolbarButton icon={Italic} title="Italic" onClick={() => applyFormatting('italic')} />
              <ToolbarButton icon={Underline} title="Underline" onClick={() => applyFormatting('underline')} />
            </div>

            {/* Structure Styles */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200 shrink-0">
              <ToolbarButton icon={Heading1} title="H1" onClick={() => applyFormatting('formatBlock', 'H1')} />
              <ToolbarButton icon={Heading2} title="H2" onClick={() => applyFormatting('formatBlock', 'H2')} />
              <ToolbarButton icon={Heading3} title="H3" onClick={() => applyFormatting('formatBlock', 'H3')} />
              <ToolbarButton icon={Heading4} title="H4" onClick={() => applyFormatting('formatBlock', 'H4')} />
            </div>

            {/* Alignment & Lists */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 border-r border-slate-200 shrink-0">
              <ToolbarButton icon={AlignLeft} title="Align Left" onClick={() => applyFormatting('justifyLeft')} />
              <ToolbarButton icon={AlignCenter} title="Align Center" onClick={() => applyFormatting('justifyCenter')} />
              <ToolbarButton icon={ListIcon} title="Bullets" onClick={() => applyFormatting('insertUnorderedList')} />
            </div>

            {/* Colors */}
            <div className="flex items-center gap-0.5 pr-2 mr-2 shrink-0 group relative">
              <ToolbarButton icon={Highlighter} title="Highlight Text" onClick={() => applyColor('#fef08a', true)} iconColor="text-yellow-500" />
              <ToolbarButton icon={Palette} title="Text Color" onClick={() => applyColor('#ef4444')} iconColor="text-rose-500" />
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-slate-400">
              {isSaving ? (
                <><Save size={14} className="animate-pulse text-primary" /><span className="text-[10px] font-label uppercase tracking-widest font-black">Syncing</span></>
              ) : (
                <><Save size={14} className="text-emerald-500" /><span className="text-[10px] font-label uppercase tracking-widest text-emerald-600 font-bold">Secured</span></>
              )}
            </div>
            <div className="relative">
              <button 
                onClick={() => setShowDownloadMenu(!showDownloadMenu)} 
                className="flex items-center justify-center p-2 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-500/20 hover:brightness-110 transition-all active:scale-95"
                title="Download Note"
              >
                <Download size={20} />
              </button>
              
              {showDownloadMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in duration-200">
                  <button 
                    onClick={handleDownloadPDF}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors"
                  >
                    <FileText size={16} className="text-rose-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">PDF Document</span>
                      <span className="text-[9px] text-slate-400">Best for printing</span>
                    </div>
                  </button>
                  <button 
                    onClick={handleDownloadWord}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors border-t border-slate-100"
                  >
                    <File size={16} className="text-blue-500" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-700">Word Document</span>
                      <span className="text-[9px] text-slate-400">Editable format</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DOCUMENT PAGE */}
      <div className="flex-grow flex flex-col items-center pb-40 px-4">
        <div ref={documentRef} className="w-full max-w-[850px] bg-white shadow-xl border border-slate-200/60 rounded-lg min-h-[1100px] relative px-6 sm:px-12 py-8 sm:py-12 flex flex-col">
          
          {/* Subtle Document Header */}
          <div className="mb-4 border-b border-slate-100 pb-4 transition-opacity duration-500 opacity-60 hover:opacity-100">
            <h1 className="text-3xl font-black font-headline tracking-tighter text-slate-900 border-l-4 border-primary pl-4 uppercase">{activeGoalTitle || "Neural Notes"}</h1>
          </div>

          {/* BLOCK FEED */}
          <div className="flex-grow flex flex-col neural-editor">
            {blocks.map((block) => (
              <div key={block.id} className="relative group/wrapper min-h-[1.5rem]">
                {/* Drag / Remove Controls */}
                <div className="absolute -left-12 top-2 flex flex-col items-center gap-1 opacity-0 group-hover/wrapper:opacity-100 transition-opacity z-10">
                  <button onClick={() => insertBlockAfter(block.id)} className="p-1 text-slate-300 hover:text-primary transition-colors" title="Add block below"><Plus size={14}/></button>
                  <button className="p-1 cursor-grab text-slate-300 hover:text-slate-500 transition-colors"><GripVertical size={14} /></button>
                  <button onClick={() => handleRemoveBlock(block.id)} className="p-1 text-slate-300 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>
                </div>
                
                {renderBlock(block)}
              </div>
            ))}
            {/* Clickable area at bottom to add new block */}
            <div 
              className="h-32 w-full mt-4 cursor-text"
              onClick={() => {
                if (blocks.length === 0 || blocks[blocks.length-1].content !== '') {
                  handleAddBlock('text');
                } else if (blocks.length > 0 && editorRefs.current[blocks[blocks.length-1].id]) {
                  editorRefs.current[blocks[blocks.length-1].id].focus();
                }
              }}
            ></div>
          </div>

          {/* Slash Command Menu Popover */}
          {slashMenuContext && (
            <div 
              className="absolute z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 w-64 animate-in fade-in zoom-in duration-200"
              style={{ top: slashMenuContext.y + 10, left: Math.max(20, slashMenuContext.x) }}
            >
              <div className="px-4 py-2 border-b border-slate-100 mb-2">
                <span className="text-[10px] font-label font-bold uppercase tracking-widest text-slate-400">Insert Block</span>
              </div>
              
              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'callout'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><Info size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">Callout Note</div><div className="text-[10px] text-slate-400">Important info box</div></div>
              </button>
              
              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'checklist'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-500 flex items-center justify-center"><CheckSquare size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">To-do List</div><div className="text-[10px] text-slate-400">Track tasks</div></div>
              </button>

              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'code'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-slate-300 flex items-center justify-center"><Code size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">Code Snippet</div><div className="text-[10px] text-slate-400">Monospace editor</div></div>
              </button>

              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'table'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center"><TableIcon size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">Table</div><div className="text-[10px] text-slate-400">Grid comparisons</div></div>
              </button>

              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'formula'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors">
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center"><Sigma size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">Formula</div><div className="text-[10px] text-slate-400">Math equations</div></div>
              </button>
              
              <button onClick={() => { handleUpdateBlock(slashMenuContext.id, { content: '' }); insertBlockAfter(slashMenuContext.id, 'divider'); setSlashMenuContext(null); }} className="w-full px-4 py-2 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors border-t border-slate-100 mt-2 pt-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center"><Minus size={16}/></div>
                <div><div className="text-sm font-bold text-slate-700">Divider</div><div className="text-[10px] text-slate-400">Visual break</div></div>
              </button>
            </div>
          )}

        </div>
      </div>
      
      {/* Sticky Bottom Stats Bar */}
      <div className="sticky bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-3 flex justify-between items-center z-[100] text-xs font-label uppercase tracking-widest text-slate-500">
        <div className="flex gap-6">
          <span>{wordCount} Words</span>
          <span>{blocks.length} Blocks</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
           <span className="hidden sm:inline">Use</span> <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 font-sans font-bold text-slate-800">/</span> <span className="hidden sm:inline">for commands</span>
        </div>
      </div>
    </div>
  );
};

export default MultimediaEditor;
