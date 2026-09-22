import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'supersecretkey123';

// Setup CORS
const allowedOrigins = [
  'http://localhost:5173',
  'https://community-feedback-board.vercel.app',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow mobile apps, curl, server-to-server, or allowed domains
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  credentials: true
}));

app.use(express.json());

// Validation Schemas
const suggestionSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters.').max(100, 'Title cannot exceed 100 characters.'),
  description: z.string().trim().min(5, 'Description must be at least 5 characters.').max(1000, 'Description cannot exceed 1000 characters.'),
  category: z.enum(['Feature', 'Bug', 'Improvement', 'General']),
  authorName: z.string().trim().max(50).optional()
});

const updateSuggestionSchema = suggestionSchema.partial();

const commentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty.').max(500, 'Comment cannot exceed 500 characters.'),
  authorName: z.string().trim().max(50).optional()
});

// Helper function to check edit/delete permissions
const isAuthorized = (itemAuthorToken, req) => {
  const authorToken = req.headers['x-author-token'];
  const adminKey = req.headers['x-admin-key'];

  // Admin key override
  if (adminKey && adminKey === ADMIN_SECRET) {
    return true;
  }

  // Token ownership check
  if (itemAuthorToken && itemAuthorToken === authorToken) {
    return true;
  }

  return false;
};

// --- ROUTES ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Get All Suggestions (with replies count or details)
app.get('/api/suggestions', async (req, res, next) => {
  try {
    const suggestions = await prisma.suggestion.findMany({
      include: {
        comments: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { votes: 'desc' }
    });
    res.json(suggestions);
  } catch (error) {
    next(error);
  }
});

// 2. Create a Suggestion
app.post('/api/suggestions', async (req, res, next) => {
  try {
    const validatedData = suggestionSchema.parse(req.body);
    const authorToken = req.headers['x-author-token'] || null;

    const newSuggestion = await prisma.suggestion.create({
      data: {
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        authorName: validatedData.authorName || 'Anonymous',
        authorToken: authorToken,
        votes: 0
      },
      include: {
        comments: true
      }
    });

    res.status(201).json(newSuggestion);
  } catch (error) {
    next(error);
  }
});

// 3. Upvote a Suggestion
app.post('/api/suggestions/:id/upvote', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const updated = await prisma.suggestion.update({
      where: { id },
      data: { votes: { increment: 1 } },
      include: { comments: true }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// 4. Update a Suggestion (Author or Admin)
app.patch('/api/suggestions/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const existing = await prisma.suggestion.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Suggestion not found.' });

    if (!isAuthorized(existing.authorToken, req)) {
      return res.status(403).json({ error: 'Unauthorized to edit this suggestion.' });
    }

    const validatedData = updateSuggestionSchema.parse(req.body);

    const updated = await prisma.suggestion.update({
      where: { id },
      data: validatedData,
      include: { comments: true }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// 5. Delete a Suggestion (Author or Admin)
app.delete('/api/suggestions/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const existing = await prisma.suggestion.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Suggestion not found.' });

    if (!isAuthorized(existing.authorToken, req)) {
      return res.status(403).json({ error: 'Unauthorized to delete this suggestion.' });
    }

    // Delete comments first if foreign key constraints don't cascade
    await prisma.comment.deleteMany({ where: { suggestionId: id } });
    await prisma.suggestion.delete({ where: { id } });

    res.json({ success: true, message: 'Suggestion removed.' });
  } catch (error) {
    next(error);
  }
});

// 6. Add a Comment to a Suggestion
app.post('/api/suggestions/:id/comments', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID.' });

    const validatedData = commentSchema.parse(req.body);
    const authorToken = req.headers['x-author-token'] || null;

    const newComment = await prisma.comment.create({
      data: {
        content: validatedData.content,
        authorName: validatedData.authorName || 'Anonymous',
        authorToken: authorToken,
        suggestionId: id
      }
    });

    res.status(201).json(newComment);
  } catch (error) {
    next(error);
  }
});

// 7. Delete a Comment (Author or Admin)
app.delete('/api/comments/:commentId', async (req, res, next) => {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID.' });

    const existingComment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!existingComment) return res.status(404).json({ error: 'Comment not found.' });

    if (!isAuthorized(existingComment.authorToken, req)) {
      return res.status(403).json({ error: 'Unauthorized to delete this comment.' });
    }

    await prisma.comment.delete({ where: { id: commentId } });

    res.json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: err.issues.map(i => i.message).join(', ') });
  }
  console.error(err);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});