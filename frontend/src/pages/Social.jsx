import React, { useState, useEffect } from 'react';
import { 
  Users, MessageSquare, Heart, Share2, 
  Plus, MoreHorizontal, Globe, Clock,
  Image as ImageIcon, Video, FileText, Send
} from 'lucide-react';
import { getSocialFeed, createSocialPost, listGoals } from '../services/api';
import { useAuth } from '../context/AuthContext';

const Social = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState('');

  useEffect(() => {
    fetchFeed();
    fetchGoals();
  }, []);

  const fetchFeed = async () => {
    try {
      const data = await getSocialFeed();
      setPosts(data);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      const data = await listGoals();
      setGoals(data);
    } catch (err) {
      console.error("Failed to fetch goals:", err);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Create a simple text block for the content
      const contentBlocks = [
        { 
          id: 'block-' + Math.random().toString(36).substr(2, 9), 
          type: 'text', 
          content: newPostContent 
        }
      ];

      await createSocialPost({
        content: contentBlocks,
        goal_id: selectedGoalId || null,
        post_type: 'lesson'
      });

      setNewPostContent('');
      setSelectedGoalId('');
      fetchFeed();
    } catch (err) {
      console.error("Failed to create post:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = (content) => {
    if (typeof content === 'string') return <p>{content}</p>;
    if (Array.isArray(content)) {
      return content.map((block) => {
        switch (block.type) {
          case 'text':
            return <div key={block.id} className="text-slate-300 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: block.content }} />;
          case 'image':
            return <img key={block.id} src={block.url} alt={block.caption} className="rounded-xl mb-4 max-h-96 w-full object-cover" />;
          case 'video':
            return (
              <div key={block.id} className="aspect-video rounded-xl overflow-hidden mb-4 bg-slate-900">
                 <iframe className="w-full h-full" src={block.url.replace('watch?v=', 'embed/')} title="Video" frameBorder="0" allowFullScreen />
              </div>
            );
          case 'callout':
            return (
              <div key={block.id} className="bg-primary/10 border border-primary/20 rounded-xl p-4 mb-4 text-primary italic">
                {block.content}
              </div>
            );
          default:
            return null;
        }
      });
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black font-headline tracking-tighter text-white uppercase">Neural Feed</h1>
          <p className="text-slate-500 font-label uppercase tracking-widest text-xs mt-1">Proof of Learning • Global Network</p>
        </div>
        <div className="flex -space-x-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src={`https://i.pravatar.cc/150?u=${i*100}`} alt="user" className="w-full h-full object-cover opacity-80" />
            </div>
          ))}
          <div className="w-10 h-10 rounded-full border-2 border-background bg-primary flex items-center justify-center text-[10px] font-bold text-black">+24k</div>
        </div>
      </div>

      {/* Post Creator */}
      <div className="glass-panel rounded-2xl p-6 mb-8 border border-white/5 glow-gold">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black border border-primary/30 shrink-0">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="Share your latest insight or achievement..."
              className="w-full bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 resize-none min-h-[100px] text-lg"
            />
            
            <div className="h-px bg-white/5 my-4" />
            
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors" title="Add Image">
                  <ImageIcon size={20} />
                </button>
                <button className="p-2 rounded-lg hover:bg-white/5 text-slate-400 transition-colors" title="Add Video">
                  <Video size={20} />
                </button>
                <div className="h-6 w-px bg-white/10 mx-2" />
                <select 
                  value={selectedGoalId} 
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-400 outline-none hover:bg-white/10 transition-colors"
                >
                  <option value="">Tag a Goal (Optional)</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              
              <button
                onClick={handleCreatePost}
                disabled={isSubmitting || !newPostContent.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all active:scale-95 ${
                  newPostContent.trim() 
                    ? 'bg-primary text-black shadow-lg shadow-primary/20' 
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" /> : <Send size={18} />}
                Broadcast
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="glass-panel rounded-2xl h-64 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <Globe size={48} className="mx-auto text-slate-700 mb-4" />
          <h3 className="text-xl font-bold text-slate-400 italic">No broadcasts yet.</h3>
          <p className="text-slate-600 text-sm mt-2">Be the first to share your learning journey!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <div key={post.id} className="glass-panel rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all duration-300 group">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold border border-white/5">
                      {post.user_email?.[0].toUpperCase() || '?'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white tracking-tight">{post.user_email?.split('@')[0]}</span>
                        <div className="w-1 h-1 rounded-full bg-slate-600" />
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border border-primary/20">Verified Learner</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-label uppercase tracking-widest mt-0.5">
                        <Clock size={10} />
                        {new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-600 hover:text-white transition-colors">
                    <MoreHorizontal size={20} />
                  </button>
                </div>

                <div className="mb-6">
                  {renderContent(post.content)}
                </div>

                {post.goal_id && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/10 rounded-lg mb-6 group-hover:bg-primary/10 transition-colors">
                    <Plus size={14} className="text-primary" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Studying:</span>
                    <span className="text-xs font-bold text-white">Advanced Quantum Computing</span>
                  </div>
                )}

                <div className="h-px bg-white/5 mb-4" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <button className="flex items-center gap-2 text-slate-500 hover:text-rose-500 transition-colors group/btn">
                      <div className="p-2 rounded-lg group-hover/btn:bg-rose-500/10 transition-colors">
                        <Heart size={20} />
                      </div>
                      <span className="text-sm font-bold">12</span>
                    </button>
                    <button className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors group/btn">
                      <div className="p-2 rounded-lg group-hover/btn:bg-primary/10 transition-colors">
                        <MessageSquare size={20} />
                      </div>
                      <span className="text-sm font-bold">4</span>
                    </button>
                  </div>
                  <button className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors group/btn">
                    <div className="p-2 rounded-lg group-hover/btn:bg-white/5 transition-colors">
                      <Share2 size={20} />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Social;
