import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Validation schema for suggestion creation/updates
const suggestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters long.')
    .max(60, 'Title cannot exceed 60 characters.'),
  description: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters long.')
    .max(200, 'Description cannot exceed 200 characters.'),
  category: z
    .enum(['Feature', 'Bug', 'UI/UX', 'General'])
    .default('General'),
  authorName: z
    .string()
    .trim()
    .max(30, 'Name cannot exceed 30 characters.')
    .optional()
    .default('Anonymous'),
});

// Validation schema for comments
const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Comment cannot be blank.')
    .max(200, 'Comment cannot exceed 200 characters.'),
  authorName: z
    .string()
    .trim()
    .max(30, 'Name cannot exceed 30 characters.')
    .optional()
    .default('Anonymous'),
});

// 1. GET: Fetch all suggestions including their comments
app.get('/api/suggestions', async (req, res, next) => {
  try {
    const suggestions = await prisma.suggestion.findMany({
      orderBy: { votes: 'desc' },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

// 2. POST: Create a new suggestion
app.post('/api/suggestions', async (req, res, next) => {
  try {
    const parsedData = suggestionSchema.parse(req.body);
    const authorToken = req.headers['x-author-token'] || '';

    const newSuggestion = await prisma.suggestion.create({
      data: {
        title: parsedData.title,
        description: parsedData.description,
        category: parsedData.category,
        authorName: parsedData.authorName && parsedData.authorName.length > 0 ? parsedData.authorName : 'Anonymous',
        authorToken,
      },
      include: {
        comments: true,
      },
    });

    res.status(201).json(newSuggestion);
  } catch (error) {
    next(error);
  }
});

// 3. POST: Add a comment/reply to a suggestion
app.post('/api/suggestions/:id/comments', async (req, res, next) => {
  try {
    const suggestionId = parseInt(req.params.id, 10);
    if (isNaN(suggestionId)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const parsedData = commentSchema.parse(req.body);

    const comment = await prisma.comment.create({
      data: {
        content: parsedData.content,
        authorName: parsedData.authorName && parsedData.authorName.length > 0 ? parsedData.authorName : 'Anonymous',
        suggestionId,
      },
    });

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

// 4. PATCH: Increment upvote
app.patch('/api/suggestions/:id/upvote', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const updated = await prisma.suggestion.update({
      where: { id },
      data: { votes: { increment: 1 } },
    });

    res.json({ success: true, votes: updated.votes });
  } catch (error) {
    next(error);
  }
});

// 5. PATCH: Edit an existing suggestion (Protected)
app.patch('/api/suggestions/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const existing = await prisma.suggestion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Suggestion not found.' });
    }

    const authorToken = req.headers['x-author-token'];
    if (existing.authorToken && existing.authorToken !== authorToken) {
      return res.status(403).json({ error: 'Unauthorized: You are not the author.' });
    }

    const parsedData = suggestionSchema.parse(req.body);

    const updated = await prisma.suggestion.update({
      where: { id },
      data: {
        title: parsedData.title,
        description: parsedData.description,
        category: parsedData.category,
      },
      include: {
        comments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// 6. DELETE: Delete a suggestion (Protected)
app.delete('/api/suggestions/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format.' });
    }

    const existing = await prisma.suggestion.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Suggestion not found.' });
    }

    const authorToken = req.headers['x-author-token'];
    if (existing.authorToken && existing.authorToken !== authorToken) {
      return res.status(403).json({ error: 'Unauthorized: You are not the author.' });
    }

    await prisma.suggestion.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Suggestion deleted.' });
  } catch (error) {
    next(error);
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError || err.name === 'ZodError') {
    const message = err.errors?.map((e) => e.message).join(' ') || 'Validation error.';
    return res.status(400).json({ error: message });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Suggestion not found.' });
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});