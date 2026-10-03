import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

const API_URL = 'http://localhost:8000/api/v1';

export default function NotesPanel({ alertId }) {
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [newNote, setNewNote] = useState("");
    const [saving, setSaving] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editContent, setEditContent] = useState("");
    const MAX_CHARS = 1000;

    useEffect(() => {
        if (alertId) {
            fetchNotes();
        }
    }, [alertId]);

    const fetchNotes = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/notes/by-alert/${alertId}`);
            setNotes(res.data);
        } catch (err) {
            console.warn("Notes fetch error", err);
            setError(err.response?.data?.detail || err.message || "Failed to load notes");
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;
        if (newNote.length > MAX_CHARS) return;

        setSaving(true);
        setError(null);
        try {
            await axios.post(`${API_URL}/notes/by-alert/${alertId}`, { content: newNote });
            setNewNote("");
            await fetchNotes();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to add note");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async (noteId) => {
        if (!editContent.trim() || editContent.length > MAX_CHARS) return;

        setSaving(true);
        setError(null);
        try {
            await axios.patch(`${API_URL}/notes/${noteId}`, { content: editContent });
            setEditingId(null);
            setEditContent("");
            await fetchNotes();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update note");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (noteId) => {
        if (window.confirm("Are you sure you want to permanently delete this note? This action cannot be reversed.")) {
            setSaving(true);
            try {
                await axios.delete(`${API_URL}/notes/${noteId}`);
                await fetchNotes();
            } catch (err) {
                setError(err.response?.data?.detail || "Failed to delete note");
            } finally {
                setSaving(false);
            }
        }
    };

    const canEditOrDelete = (note) => {
        if (!user) return false;
        if (user.role === 'VIEWER') return false;
        if (user.role === 'SECURITY_ADMIN' || user.role === 'SENIOR_ANALYST') return true;
        return user.id === note.author_id; // Analyst can only edit their own
    };

    const canAddNote = user && user.role !== 'VIEWER';

    return (
        <div className="bg-surface rounded-lg border border-border p-5 flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-textLight uppercase tracking-widest flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    ANALYST NOTES
                </h3>
                <span className="text-xs text-textMuted bg-surfaceHover px-2 py-1 rounded">
                    {notes.length} RECORDED
                </span>
            </div>

            {error && (
                <div className="p-3 bg-red-900/40 border border-red-500/50 rounded text-red-100 text-sm">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar pr-2 flex flex-col">
                    {notes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg bg-background text-textMuted">
                            <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm font-semibold uppercase tracking-widest">No Notes Extracted</span>
                            <span className="text-xs opacity-70 mt-1">Investigators have not appended notes to this alert yet.</span>
                        </div>
                    ) : (
                        notes.map(note => (
                            <div key={note.id} className="relative group border border-border p-4 rounded-lg bg-background hover:border-textMuted/30 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="text-textLight font-semibold text-sm">{note.author_name}</span>
                                        <span className="text-textMuted text-xs ml-2">
                                            {format(new Date(note.created_at), 'MMM d, yyyy HH:mm')}
                                            {note.updated_at !== note.created_at && " (edited)"}
                                        </span>
                                    </div>
                                    {canEditOrDelete(note) && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                                            <button
                                                disabled={saving}
                                                onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                                                className="text-textMuted hover:text-primary transition-colors disabled:opacity-50" title="Edit Note">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button
                                                disabled={saving}
                                                onClick={() => handleDelete(note.id)}
                                                className="text-textMuted hover:text-red-400 transition-colors disabled:opacity-50" title="Delete Note">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editingId === note.id ? (
                                    <div className="mt-2 flex flex-col space-y-2">
                                        <textarea
                                            value={editContent}
                                            onChange={(e) => setEditContent(e.target.value)}
                                            className="w-full bg-surface border border-primary text-textLight text-sm p-3 rounded custom-scrollbar focus:outline-none"
                                            rows="3"
                                            maxLength={MAX_CHARS}
                                        />
                                        <div className="flex justify-between items-center text-xs">
                                            <span className={`${editContent.length >= MAX_CHARS ? 'text-red-400' : 'text-textMuted'}`}>
                                                {editContent.length}/{MAX_CHARS}
                                            </span>
                                            <div className="flex space-x-2">
                                                <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-surfaceHover text-textMuted hover:text-textLight rounded transition-colors" disabled={saving}>Cancel</button>
                                                <button onClick={() => handleSaveEdit(note.id)} className="px-3 py-1 bg-primary text-background font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center">
                                                    {saving ? "Saving..." : "Save Edits"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-textMuted text-sm whitespace-pre-wrap leading-relaxed">
                                        {note.content}
                                    </p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {canAddNote && !loading && (
                <form onSubmit={handleAddNote} className="mt-4 flex flex-col border border-border rounded-lg overflow-hidden focus-within:border-primary transition-colors">
                    <div className="p-3 bg-surface">
                        <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Append findings or context to this investigation..."
                            className="w-full bg-transparent text-textLight text-sm resize-none custom-scrollbar focus:outline-none"
                            rows="3"
                            maxLength={MAX_CHARS}
                            disabled={saving}
                        />
                    </div>
                    <div className="bg-background px-3 py-2 border-t border-border flex justify-between items-center text-xs">
                        <span className={`${newNote.length >= MAX_CHARS ? 'text-red-400 font-bold' : 'text-textMuted'}`}>
                            {newNote.length} / {MAX_CHARS} characters
                        </span>
                        <button
                            type="submit"
                            disabled={saving || !newNote.trim() || newNote.length > MAX_CHARS}
                            className="px-4 py-1.5 bg-primary text-background font-bold rounded shadow hover:bg-primary/90 disabled:opacity-50 transition-all tracking-wider text-xs flex items-center">
                            {saving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-background" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    SAVING...
                                </>
                            ) : "ADD NOTE"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
