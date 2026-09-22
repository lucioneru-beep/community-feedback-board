import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/suggestions';
const CATEGORIES = ['All', 'Feature', 'Bug', 'Improvement', 'General'];
const TITLE_MAX = 60;
const DESC_MAX = 200;

const getAuthorToken = () => {
  let token = localStorage.getItem('author_token');
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem('author_token', token);
  }
  return token;
};

export default function App() {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('votes');
  const [loading, setLoading] = useState(true);

  // Form states
  const [authorName, setAuthorName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Feature');

  // Edit states
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Feature');

  // Comment UI states
  const [expandedComments, setExpandedComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentAuthors, setCommentAuthors] = useState({});

  // Authorship & vote tracking
  const [myCreatedIds, setMyCreatedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('my_created_suggestions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [upvotedIds, setUpvotedIds] = useState(() => {
    try {
      const saved = localStorage.getItem('upvoted_suggestions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    localStorage.setItem('my_created_suggestions', JSON.stringify(myCreatedIds));
  }, [myCreatedIds]);

  useEffect(() => {
    localStorage.setItem('upvoted_suggestions', JSON.stringify(upvotedIds));
  }, [upvotedIds]);

  const loadSuggestions = async () => {
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSuggestions(data);
      } else {
        setSuggestions([]);
        if (data.error) showToast(data.error, 'error');
      }
    } catch (err) {
      console.error(err);
      setSuggestions([]);
      showToast('Could not load suggestions.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
  }, []);

  const handleUpvote = async (id) => {
    if (upvotedIds.includes(id)) {
      showToast('You already upvoted this idea!', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/${id}/upvote`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((item) => (item.id === id ? { ...item, upvotes: data.upvotes ?? (item.upvotes || 0) + 1, votes: data.votes ?? data.upvotes } : item))
        );
        setUpvotedIds((prev) => [...prev, id]);
        showToast('Upvote recorded!');
      } else {
        showToast(data.error || 'Failed to record upvote.', 'error');
      }
    } catch {
      showToast('Failed to record upvote.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedName = authorName.trim();

    if (!trimmedTitle || !trimmedDesc) {
      showToast('Please provide both a title and description.', 'error');
      return;
    }

    if (trimmedTitle.length < 3) {
      showToast('Title must be at least 3 characters long.', 'error');
      return;
    }

    if (trimmedDesc.length < 5) {
      showToast('Description must be at least 5 characters long.', 'error');
      return;
    }

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-author-token': getAuthorToken(),
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDesc,
          category,
          authorName: trimmedName || 'Anonymous',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuggestions((prev) => [{ ...data, comments: [] }, ...prev]);
        setMyCreatedIds((prev) => [...prev, data.id]);
        setTitle('');
        setDescription('');
        setAuthorName('');
        showToast('Suggestion submitted!');
      } else {
        showToast(data.error || 'Failed to save suggestion.', 'error');
      }
    } catch {
      showToast('Unable to connect to the server.', 'error');
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditCategory(item.category);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const handleSaveEdit = async (id) => {
    const trimmedTitle = editTitle.trim();
    const trimmedDesc = editDescription.trim();

    if (!trimmedTitle || !trimmedDesc) {
      showToast('Fields cannot be blank.', 'error');
      return;
    }

    if (trimmedTitle.length < 3) {
      showToast('Title must be at least 3 characters long.', 'error');
      return;
    }

    if (trimmedDesc.length < 5) {
      showToast('Description must be at least 5 characters long.', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-author-token': getAuthorToken(),
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDesc,
          category: editCategory,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((item) => (item.id === id ? { ...item, ...data } : item))
        );
        setEditingId(null);
        showToast('Suggestion updated!');
      } else {
        showToast(data.error || 'Failed to update.', 'error');
      }
    } catch {
      showToast('Unable to connect to the server.', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: {
          'x-author-token': getAuthorToken(),
        },
      });

      const data = await res.json();

      if (res.ok) {
        setSuggestions((prev) => prev.filter((item) => item.id !== id));
        setUpvotedIds((prev) => prev.filter((votedId) => votedId !== id));
        setMyCreatedIds((prev) => prev.filter((createdId) => createdId !== id));
        showToast('Suggestion deleted.');
      } else {
        showToast(data.error || 'Failed to delete item.', 'error');
      }
    } catch {
      showToast('Failed to delete item.', 'error');
    }
  };

  const toggleComments = (id) => {
    setExpandedComments((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddComment = async (suggestionId) => {
    const text = (commentInputs[suggestionId] || '').trim();
    const author = (commentAuthors[suggestionId] || '').trim();
    if (!text) return;

    try {
      const res = await fetch(`${API_BASE}/${suggestionId}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-author-token': getAuthorToken(),
        },
        body: JSON.stringify({
          content: text,
          authorName: author || 'Anonymous',
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuggestions((prev) =>
          prev.map((item) =>
            item.id === suggestionId
              ? { ...item, comments: [...(item.comments || []), data] }
              : item
          )
        );
        setCommentInputs((prev) => ({ ...prev, [suggestionId]: '' }));
        setCommentAuthors((prev) => ({ ...prev, [suggestionId]: '' }));
        showToast('Reply posted!');
      } else {
        showToast(data.error || 'Failed to post reply.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to connect to the server.', 'error');
    }
  };

  const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];

  const processedSuggestions = safeSuggestions
    .filter((item) => {
      const itemCategory = item?.category || 'General';
      const itemTitle = item?.title || '';
      const itemDesc = item?.description || '';

      const matchesCategory =
        selectedCategory === 'All' ||
        itemCategory.toLowerCase() === selectedCategory.toLowerCase();

      const matchesSearch =
        itemTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        itemDesc.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const votesA = a?.upvotes ?? a?.votes ?? 0;
      const votesB = b?.upvotes ?? b?.votes ?? 0;
      if (sortBy === 'votes') {
        return votesB - votesA;
      }
      return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0);
    });

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1.5rem 0 3rem' }}>
      
      {toast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
            fontWeight: '500',
            zIndex: 9999,
          }}
        >
          {toast.message}
        </div>
      )}

      <header>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Community Wishlist</h1>
        <p style={{ color: '#94a3b8' }}>Vote on features and submit your own ideas.</p>
      </header>

      {/* Suggestion Form */}
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: '#1e293b',
          padding: '1.5rem',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          border: '1px solid #334155',
        }}
      >
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Suggest a Feature</h2>

        <div>
          <input
            type="text"
            placeholder="Your name (optional, defaults to Anonymous)..."
            maxLength={30}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <input
            type="text"
            placeholder="Idea title..."
            maxLength={TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right', marginTop: '0.25rem' }}>
            {title.length}/{TITLE_MAX}
          </div>
        </div>

        <div>
          <textarea
            rows={3}
            placeholder="Explain the context or why it is useful..."
            maxLength={DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right', marginTop: '0.25rem' }}>
            {description.length}/{DESC_MAX}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="Feature">Feature</option>
            <option value="Bug">Bug Fix</option>
            <option value="Improvement">Improvement</option>
            <option value="General">General</option>
          </select>

          <button
            type="submit"
            style={{
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              border: 'none',
              borderRadius: '8px',
              padding: '0.6rem 1.25rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Submit Idea
          </button>
        </div>
      </form>

      {/* Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: '1 1 auto',
              minWidth: 0,
              boxSizing: 'border-box',
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              padding: '0.65rem 1rem',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              flex: '0 0 auto',
              width: 'auto',
              minWidth: '160px',
              boxSizing: 'border-box',
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              cursor: 'pointer',
            }}
          >
            <option value="votes">🔥 Most Upvoted</option>
            <option value="newest">🕒 Newest First</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  backgroundColor: isActive ? '#38bdf8' : '#1e293b',
                  color: isActive ? '#0f172a' : '#94a3b8',
                  fontWeight: isActive ? '600' : '400',
                  border: isActive ? '1px solid #38bdf8' : '1px solid #334155',
                  borderRadius: '9999px',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Suggestions Feed */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <p style={{ color: '#94a3b8' }}>Loading suggestions...</p>
        ) : processedSuggestions.length === 0 ? (
          <p style={{ color: '#64748b', textAlign: 'center', margin: '2rem 0' }}>
            No matching suggestions found.
          </p>
        ) : (
          processedSuggestions.map((item) => {
            const hasVoted = upvotedIds.includes(item.id);
            const isAuthor = myCreatedIds.includes(item.id);
            const isEditing = editingId === item.id;
            const comments = Array.isArray(item.comments) ? item.comments : [];
            const isCommentsOpen = !!expandedComments[item.id];
            const displayVotes = item.upvotes ?? item.votes ?? 0;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#1e293b',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid #38bdf8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                    >
                      <option value="Feature">Feature</option>
                      <option value="Bug">Bug Fix</option>
                      <option value="Improvement">Improvement</option>
                      <option value="General">General</option>
                    </select>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={cancelEditing}
                        style={{
                          backgroundColor: 'transparent',
                          color: '#94a3b8',
                          border: '1px solid #475569',
                          borderRadius: '6px',
                          padding: '0.4rem 0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        style={{
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.4rem 0.75rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: '#38bdf8',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {item.category || 'General'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        by <strong style={{ color: '#cbd5e1' }}>{item.authorName || 'Anonymous'}</strong>
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', margin: '0.2rem 0' }}>{item.title}</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{item.description}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleUpvote(item.id)}
                      title={hasVoted ? 'Already upvoted' : 'Upvote'}
                      style={{
                        backgroundColor: hasVoted ? '#0284c7' : '#334155',
                        color: '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '55px',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: hasVoted ? 'default' : 'pointer',
                        transition: 'background 0.2s',
                      }}
                    >
                      ▲ <span>{displayVotes}</span>
                    </button>

                    {isAuthor && (
                      <>
                        <button
                          onClick={() => startEditing(item)}
                          title="Edit suggestion"
                          style={{
                            backgroundColor: 'transparent',
                            color: '#38bdf8',
                            border: '1px solid #0369a1',
                            borderRadius: '8px',
                            padding: '0.6rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                          }}
                        >
                          ✎
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          title="Delete suggestion"
                          style={{
                            backgroundColor: 'transparent',
                            color: '#ef4444',
                            border: '1px solid #7f1d1d',
                            borderRadius: '8px',
                            padding: '0.6rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                          }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer bar */}
                <div
                  style={{
                    backgroundColor: '#162032',
                    padding: '0.5rem 1.25rem',
                    borderTop: '1px solid #293548',
                    display: 'flex',
                    justifyContent: 'flex-start',
                  }}
                >
                  <button
                    onClick={() => toggleComments(item.id)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: isCommentsOpen ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: 0,
                    }}
                  >
                    💬 {comments.length} {comments.length === 1 ? 'Reply' : 'Replies'}
                  </button>
                </div>

                {/* Discussion Thread */}
                {isCommentsOpen && (
                  <div
                    style={{
                      backgroundColor: '#0f172a',
                      padding: '1rem 1.25rem',
                      borderTop: '1px solid #1e293b',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    {comments.length === 0 ? (
                      <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                        No replies yet. Be the first to start the discussion!
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {comments.map((c) => (
                          <div
                            key={c.id || Math.random()}
                            style={{
                              backgroundColor: '#1e293b',
                              padding: '0.6rem 0.85rem',
                              borderRadius: '6px',
                              fontSize: '0.88rem',
                              color: '#cbd5e1',
                              borderLeft: '3px solid #38bdf8',
                            }}
                          >
                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: '600', marginBottom: '0.15rem' }}>
                              {c.authorName || 'Anonymous'}
                            </div>
                            <div>{c.content}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply Input Form */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <input
                        type="text"
                        placeholder="Your name (optional)..."
                        maxLength={30}
                        value={commentAuthors[item.id] || ''}
                        onChange={(e) =>
                          setCommentAuthors((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        style={{
                          width: '130px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          color: '#f8fafc',
                          fontSize: '0.85rem',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Write a reply..."
                        maxLength={200}
                        value={commentInputs[item.id] || ''}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [item.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddComment(item.id);
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: '150px',
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          color: '#f8fafc',
                          fontSize: '0.85rem',
                        }}
                      />
                      <button
                        onClick={() => handleAddComment(item.id)}
                        style={{
                          backgroundColor: '#38bdf8',
                          color: '#0f172a',
                          fontWeight: '600',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}