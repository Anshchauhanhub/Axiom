import React, { useState, useEffect } from 'react';
import { 
  Users, MessageSquare, Heart, Share2, 
  Plus, MoreHorizontal, Globe, Clock,
  Image as ImageIcon, Video, FileText, Send,
  Bookmark, Newspaper, Calendar, Layout,
  UserPlus, TrendingUp, Award, Zap
} from 'lucide-react';
import { 
  getSocialFeed, createSocialPost, listGoals, getProfile,
  toggleSocialLike, getSocialComments, addSocialComment 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Social = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [activeCommentsPostId, setActiveCommentsPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({}); // { postId: [comments] }
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    fetchFeed();
    fetchGoals();
    fetchProfile();
  }, []);

  useEffect(() => {
    // WebSocket for real-time updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host.includes('localhost') ? '127.0.0.1:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/social/`;
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_post') {
        setPosts(prev => {
          if (prev.some(p => p.id === data.post.id)) return prev;
          return [data.post, ...prev];
        });
      } else if (data.type === 'like_update') {
        setPosts(prev => prev.map(p => p.id === data.post_id ? { ...p, likes_count: data.likes_count } : p));
      } else if (data.type === 'new_comment') {
        setPosts(prev => prev.map(p => p.id === data.post_id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
        if (activeCommentsPostId === data.post_id) {
          setCommentsMap(prev => ({
            ...prev,
            [data.post_id]: [...(prev[data.post_id] || []), data.comment]
          }));
        }
      }
    };

    return () => socket.close();
  }, [activeCommentsPostId]); // We still need activeCommentsPostId to know which comment section to update if open

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

  const fetchProfile = async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  };

  const handleToggleLike = async (postId) => {
    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          is_liked_by_me: !p.is_liked_by_me,
          likes_count: p.is_liked_by_me ? p.likes_count - 1 : p.likes_count + 1
        };
      }
      return p;
    }));

    try {
      await toggleSocialLike(postId);
    } catch (err) {
      showToast("Failed to update like", "error");
      // Revert if failed (optional, for brevity skipped here)
    }
  };

  const handleToggleComments = async (postId) => {
    if (activeCommentsPostId === postId) {
      setActiveCommentsPostId(null);
      return;
    }

    setActiveCommentsPostId(postId);
    if (!commentsMap[postId]) {
      try {
        const comments = await getSocialComments(postId);
        setCommentsMap(prev => ({ ...prev, [postId]: comments }));
      } catch (err) {
        showToast("Failed to load comments", "error");
      }
    }
  };

  const handleAddComment = async (postId) => {
    if (!newCommentText.trim()) return;
    try {
      await addSocialComment(postId, newCommentText);
      setNewCommentText('');
    } catch (err) {
      showToast("Failed to add comment", "error");
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) return;
    
    setIsSubmitting(true);
    try {
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
      showToast("Post published!");
      // Fallback refresh to ensure user sees their post even if WS fails
      fetchFeed();
    } catch (err) {
      showToast("Failed to publish post", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = (content) => {
    if (typeof content === 'string') return <p className="text-sm text-slate-300 whitespace-pre-wrap">{content}</p>;
    if (Array.isArray(content)) {
      return content.map((block) => {
        switch (block.type) {
          case 'text':
            return <div key={block.id} className="text-sm text-slate-300 leading-relaxed mb-4 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: block.content }} />;
          case 'image':
            return <img key={block.id} src={block.url} alt={block.caption} className="rounded-lg mb-4 max-h-96 w-full object-cover border border-white/5" />;
          case 'video':
            return (
              <div key={block.id} className="aspect-video rounded-lg overflow-hidden mb-4 bg-slate-900 border border-white/5">
                 <iframe className="w-full h-full" src={block.url.replace('watch?v=', 'embed/')} title="Video" frameBorder="0" allowFullScreen />
              </div>
            );
          case 'callout':
            return (
              <div key={block.id} className="bg-primary/10 border-l-4 border-primary rounded-r-lg p-4 mb-4 text-primary italic text-sm">
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
    <div className="max-w-[1200px] mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Profile Summary */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
            <div className="h-16 bg-gradient-to-r from-primary/40 via-secondary/40 to-primary/40 relative">
               <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                 <div className="w-20 h-20 rounded-full bg-[#1c1b1d] border-4 border-[#0e0e10] overflow-hidden flex items-center justify-center shadow-2xl">
                    {user?.profile_image_url ? (
                      <img src={user.profile_image_url} alt="profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-black text-primary">{user?.full_name?.[0] || user?.email?.[0].toUpperCase() || 'U'}</span>
                    )}
                 </div>
               </div>
            </div>
            <div className="pt-10 pb-6 px-4 text-center">
              <h3 className="text-white font-bold text-lg tracking-tight truncate">{user?.full_name || user?.email?.split('@')[0]}</h3>
              <p className="text-slate-500 text-[10px] font-label uppercase tracking-widest mt-1">
                {user?.current_streak > 0 ? `🚀 ${user.current_streak} Day Streak` : 'Neural Explorer'}
              </p>
              
              <div className="mt-6 pt-4 border-t border-white/5 text-left space-y-3">
                <div className="flex justify-between items-center group cursor-pointer">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Profile views</span>
                  <span className="text-xs font-black text-primary">1,248</span>
                </div>
                <div className="flex justify-between items-center group cursor-pointer">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider group-hover:text-primary transition-colors">Neural Connections</span>
                  <span className="text-xs font-black text-primary">542</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 p-3 flex items-center gap-2 hover:bg-white/10 transition-colors cursor-pointer group">
               <Bookmark size={14} className="text-slate-400 group-hover:text-primary" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-white">My Items</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/5 sticky top-24">
             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Active Mastery</h4>
             <div className="space-y-3">
                {goals.slice(0, 3).map(goal => (
                  <div key={goal.id} className="flex items-center gap-2 group cursor-pointer">
                    <Zap size={12} className="text-primary opacity-50 group-hover:opacity-100" />
                    <span className="text-[11px] font-bold text-slate-400 group-hover:text-white truncate transition-colors">{goal.title}</span>
                  </div>
                ))}
             </div>
             <button className="w-full mt-4 py-2 text-[10px] font-black text-slate-500 hover:text-primary uppercase tracking-widest border-t border-white/5 pt-3">Discover more</button>
          </div>
        </div>

        {/* CENTER COLUMN: Feed */}
        <div className="lg:col-span-6 space-y-4">
          
          {/* LinkedIn-style "Start a post" */}
          <div className="glass-panel rounded-xl p-4 border border-white/5 shadow-xl">
            <div className="flex gap-3 mb-4">
               <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border border-white/5 shrink-0">
                 {user?.profile_image_url ? (
                   <img src={user.profile_image_url} alt="me" className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-primary font-black">{user?.full_name?.[0] || user?.email?.[0].toUpperCase() || 'U'}</span>
                 )}
               </div>
               <button 
                onClick={() => document.getElementById('post-modal')?.focus()}
                className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 text-left text-sm text-slate-500 hover:bg-white/10 transition-all font-medium"
               >
                 Start a post on your journey...
               </button>
            </div>
            <div className="flex justify-between items-center">
               <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                  <ImageIcon size={18} className="text-blue-500" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Photo</span>
               </button>
               <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                  <Video size={18} className="text-green-500" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Video</span>
               </button>
               <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                  <Calendar size={18} className="text-amber-500" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Milestone</span>
               </button>
               <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group">
                  <Newspaper size={18} className="text-rose-500" />
                  <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Write Article</span>
               </button>
            </div>
          </div>

          {/* New Post Editor (Inline for now) */}
          {newPostContent && (
            <div className="glass-panel rounded-xl p-4 border border-primary/20 animate-in fade-in slide-in-from-top-4 duration-300">
               <textarea
                id="post-modal"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 resize-none min-h-[80px] text-sm"
                autoFocus
              />
               <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                 <select 
                  value={selectedGoalId} 
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-slate-400 outline-none"
                >
                  <option value="">Link a Goal</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
                <div className="flex gap-2">
                   <button onClick={() => setNewPostContent('')} className="px-4 py-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white">Cancel</button>
                   <button 
                    onClick={handleCreatePost}
                    disabled={isSubmitting}
                    className="bg-primary text-black px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                   >
                     {isSubmitting ? 'Posting...' : 'Post'}
                   </button>
                </div>
               </div>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-2 py-2">
             <div className="h-px flex-1 bg-white/5" />
             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest flex items-center gap-1">
               Sort by: <span className="text-slate-400 cursor-pointer hover:text-primary">Recent <Clock size={10} className="inline" /></span>
             </span>
          </div>

          {/* Feed Posts */}
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="glass-panel rounded-xl h-64 animate-pulse border border-white/5" />)}
            </div>
          ) : (
            <div className="space-y-4 pb-20">
              {posts.map((post) => (
                <div key={post.id} className="glass-panel rounded-xl border border-white/5 overflow-hidden transition-all duration-300">
                  <div className="p-4">
                    {/* Post Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden border border-white/5 shadow-inner">
                          {post.user_profile_image ? (
                            <img src={post.user_profile_image} alt="user" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-400 font-bold">{post.user_full_name?.[0] || post.user_email?.[0].toUpperCase() || '?'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-sm text-white tracking-tight hover:text-primary hover:underline cursor-pointer truncate">
                              {post.user_full_name || post.user_email?.split('@')[0]}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">• 1st</span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-tight truncate">Neural Explorer • Learning Enthusiast</p>
                          <div className="flex items-center gap-1 text-slate-600 text-[10px] mt-0.5">
                            {new Date(post.created_at).toLocaleDateString()} • <Globe size={10} />
                          </div>
                        </div>
                      </div>
                      <button className="p-1 text-slate-600 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                        <MoreHorizontal size={20} />
                      </button>
                    </div>

                    {/* Post Content */}
                    <div className="mb-4 px-1">
                      {renderContent(post.content)}
                    </div>

                    {/* Goal Link Tag */}
                    {post.goal_id && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-full w-fit mb-4 hover:bg-primary/10 transition-colors cursor-pointer group">
                        <Award size={12} className="text-primary" />
                        <span className="text-[9px] font-black text-slate-400 group-hover:text-white uppercase tracking-widest transition-colors">Axiom Milestone Reached</span>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-2">
                       <div className="flex items-center -space-x-1">
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center border border-[#0e0e10] z-10"><Heart size={8} className="text-white fill-white" /></div>
                          <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center border border-[#0e0e10] z-20"><Zap size={8} className="text-black fill-black" /></div>
                          <span className="text-[10px] text-slate-500 ml-4 font-medium">
                            {post.likes_count} {post.likes_count === 1 ? 'like' : 'likes'}
                          </span>
                       </div>
                       <span className="text-[10px] text-slate-500 font-medium">
                        {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
                       </span>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-1">
                      <button 
                        onClick={() => handleToggleLike(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <Heart size={18} className={`${post.is_liked_by_me ? 'text-rose-500 fill-rose-500' : 'text-slate-500'} group-hover:text-rose-500 transition-colors`} />
                        <span className={`text-xs font-bold ${post.is_liked_by_me ? 'text-rose-500' : 'text-slate-500'} group-hover:text-slate-300`}>Like</span>
                      </button>
                      <button 
                        onClick={() => handleToggleComments(post.id)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <MessageSquare size={18} className={`${activeCommentsPostId === post.id ? 'text-primary' : 'text-slate-500'} group-hover:text-primary transition-colors`} />
                        <span className={`text-xs font-bold ${activeCommentsPostId === post.id ? 'text-primary' : 'text-slate-500'} group-hover:text-slate-300`}>Comment</span>
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-white/5 transition-colors group">
                        <Share2 size={18} className="text-slate-500 group-hover:text-secondary transition-colors" />
                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Repost</span>
                      </button>
                      <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg hover:bg-white/5 transition-colors group">
                        <Send size={18} className="text-slate-500 group-hover:text-white transition-colors" />
                        <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">Send</span>
                      </button>
                    </div>

                    {/* Comments Section */}
                    {activeCommentsPostId === post.id && (
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden">
                            <img src={user?.profile_image_url} alt="me" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 flex items-center bg-white/5 rounded-full px-4 border border-white/10 group focus-within:border-primary/50 transition-all">
                             <input 
                                type="text" 
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                placeholder="Add a comment..."
                                className="w-full bg-transparent border-none outline-none py-2 text-xs text-slate-200"
                             />
                             <button onClick={() => handleAddComment(post.id)} className="text-primary hover:text-white transition-colors">
                               <Send size={14} />
                             </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {commentsMap[post.id]?.map(comment => (
                            <div key={comment.id} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden">
                                <img src={comment.user_profile_image} alt="user" className="w-full h-full object-cover" />
                              </div>
                              <div className="flex-1 bg-white/5 rounded-2xl px-4 py-2">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[11px] font-bold text-white">{comment.user_full_name}</span>
                                  <span className="text-[9px] text-slate-600">{new Date(comment.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-slate-400">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Extras */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-xl p-4 border border-white/5">
             <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Trending</h4>
                <TrendingUp size={14} className="text-slate-600" />
             </div>
             <div className="space-y-4">
                <div className="group cursor-pointer">
                   <h5 className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">#QuantumSupremacy2026</h5>
                   <p className="text-[9px] text-slate-500 font-medium">1,245 learners tracking</p>
                </div>
                <div className="group cursor-pointer">
                   <h5 className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">LLM Safety Protocols</h5>
                   <p className="text-[9px] text-slate-500 font-medium">842 broadcasts today</p>
                </div>
                <div className="group cursor-pointer">
                   <h5 className="text-[11px] font-bold text-white group-hover:text-primary transition-colors">Proof of Learning vs Degree</h5>
                   <p className="text-[9px] text-slate-500 font-medium">Hot discussion • 2.4k comments</p>
                </div>
             </div>
             <button className="w-full mt-6 py-2 text-[10px] font-black text-primary hover:underline uppercase tracking-widest transition-all">View all trending</button>
          </div>

          <div className="glass-panel rounded-xl p-4 border border-white/5">
             <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Learners to connect</h4>
             <div className="space-y-4">
                {[
                  { name: 'Dr. Sarah Chen', role: 'AI Ethicist' },
                  { name: 'Alex Rivera', role: 'Fullstack Alchemist' },
                  { name: 'Elena Vance', role: 'Neuroscience Researcher' }
                ].map((p, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                     <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-white/5 shrink-0 overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?u=${i+200}`} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" alt="user" />
                     </div>
                     <div className="min-w-0">
                        <h5 className="text-[10px] font-bold text-white truncate">{p.name}</h5>
                        <p className="text-[9px] text-slate-500 truncate">{p.role}</p>
                        <button className="mt-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-700 hover:border-primary hover:bg-primary/5 text-slate-400 hover:text-primary transition-all">
                           <UserPlus size={10} />
                           <span className="text-[9px] font-black uppercase tracking-widest">Connect</span>
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>

          <div className="px-4 text-[9px] text-slate-600 font-medium space-y-2 text-center">
             <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                <span className="hover:text-primary cursor-pointer">About</span>
                <span className="hover:text-primary cursor-pointer">Accessibility</span>
                <span className="hover:text-primary cursor-pointer">Privacy Center</span>
                <span className="hover:text-primary cursor-pointer">Ad Choices</span>
             </div>
             <div className="flex items-center justify-center gap-2">
                <img src="/logo.png" className="h-2 opacity-30" alt="axiom" />
                <span>Axiom Corporation © 2026</span>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Social;
