import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsPeriodType } from '@prisma/client';
import { authenticate } from '@/middleware/auth';
import { authorizeRestaurantRole, requireRestaurant } from '@/middleware/restaurant';
import { AuthenticatedRequest } from '@/types/api';
import { generateAnalyticsSnapshot, getAnalyticsOverview } from '@/modules/analytics/analytics.service';
import { prisma } from '@/config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const router = Router();

const dateQuerySchema = z.object({
  date: z.string().optional(),
});

const overviewQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const parseDateInput = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  return date;
};

// Middleware for auth & roles
router.use(authenticate, requireRestaurant, authorizeRestaurantRole('OWNER', 'ADMIN', 'STAFF'));

const insightsBodySchema = z.object({
  topDishes: z.array(z.string().min(1)).min(1),
  pendingDeliveries: z.number().int().nonnegative(),
  totalOrders: z.number().int().nonnegative(),
});

const insightsResponseSchema = z.object({
  success: z.literal(true),
  data: z
    .array(
      z.object({
        type: z.enum(['growth', 'alert']),
        title: z.string().min(1),
        desc: z.string().min(1),
      })
    )
    .length(2),
});

type InsightsRequestPayload = z.infer<typeof insightsBodySchema>;
type InsightsResponse = z.infer<typeof insightsResponseSchema>;

const callGemini = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const apiKey = process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY'];
  if (!apiKey) {
    throw new Error('Google API Key not configured. Set GOOGLE_API_KEY or GOOGLE_CLOUD_API_KEY.');
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json', // Forces Gemini to return pure JSON
    },
  });

  const response = await model.generateContent({
    systemInstruction: systemPrompt,
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
  });

  const text = response?.response?.text?.();
  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text;
};

const callOpenAI = async (systemPrompt: string, userPrompt: string): Promise<string> => {
  const key = process.env['OPENAI_API_KEY'];
  if (!key) {
    throw new Error('OpenAI API Key not configured. Set OPENAI_API_KEY.');
  }

  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' }, // Forces OpenAI to return pure JSON
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  const text = completion?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenAI returned empty response');
  }

  return text;
};

const generateAIOperationalInsights = async (payload: InsightsRequestPayload): Promise<InsightsResponse> => {
  const systemPrompt = `You are a restaurant operations consultant. Provide exactly 2 concise, actionable insights based on the provided live metrics. 
Return output as a valid JSON object matching this schema: 
{ "success": true, "data": [ { "type": "growth" or "alert", "title": "string", "desc": "string" } ] }. 
The 'desc' field MUST be a brief, actionable recommendation (1-2 sentences max). Do NOT wrap the JSON in markdown blocks.`;

  const userPrompt = `Live data:\n${JSON.stringify(payload, null, 2)}`;

  let rawText: string;
  if (process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY']) {
    rawText = await callGemini(systemPrompt, userPrompt);
  } else if (process.env['OPENAI_API_KEY']) {
    rawText = await callOpenAI(systemPrompt, userPrompt);
  } else {
    throw new Error('No LLM provider configured. Set GOOGLE_API_KEY/GOOGLE_CLOUD_API_KEY or OPENAI_API_KEY.');
  }

  // Bulletproof cleanup: strips out ```json and ``` if the LLM hallucinates them
  const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanedText);
  } catch (err) {
    throw new Error(`Failed to parse LLM response as JSON: ${(err as Error).message}\nRaw Output: ${cleanedText}`);
  }

  const shaped = insightsResponseSchema.safeParse(parsed);
  if (!shaped.success) {
    throw new Error(`LLM response does not match required schema: ${JSON.stringify(shaped.error.issues)}`);
  }

  return shaped.data;
};

// AI Insights Endpoint
router.post('/insights', async (req: AuthenticatedRequest, res) => {
  console.log("Hit");
  try {
    const payload = insightsBodySchema.parse(req.body);
    const result = await generateAIOperationalInsights(payload);
    return res.json(result);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
    }

    console.error("AI Insights Error:", error);
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return res.status(500).json({ success: false, error: message });
  }
});

// Analytics Endpoints
router.get('/daily', async (req: AuthenticatedRequest, res) => {
  try {
    const query = dateQuerySchema.parse(req.query);
    const date = parseDateInput(query.date) || new Date();
    const snapshot = await generateAnalyticsSnapshot({
      restaurantId: req.restaurant!.id,
      periodType: AnalyticsPeriodType.DAILY,
      date,
    });

    return res.json({ success: true, data: snapshot });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }
    if (error instanceof Error && error.message === 'Invalid date format') {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to generate daily analytics' });
  }
});

router.get('/weekly', async (req: AuthenticatedRequest, res) => {
  try {
    const query = dateQuerySchema.parse(req.query);
    const date = parseDateInput(query.date) || new Date();
    const snapshot = await generateAnalyticsSnapshot({
      restaurantId: req.restaurant!.id,
      periodType: AnalyticsPeriodType.WEEKLY,
      date,
    });

    return res.json({ success: true, data: snapshot });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }
    if (error instanceof Error && error.message === 'Invalid date format') {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to generate weekly analytics' });
  }
});

router.get('/overview', async (req: AuthenticatedRequest, res) => {
  try {
    const query = overviewQuerySchema.parse(req.query);
    const end = parseDateInput(query.end) || new Date();
    const start = parseDateInput(query.start) || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const overview = await getAnalyticsOverview({
      restaurantId: req.restaurant!.id,
      start,
      end,
    });
    return res.json({ success: true, data: overview });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
    }
    if (error instanceof Error) {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to generate analytics overview' });
  }
});

router.get('/history', async (req: AuthenticatedRequest, res) => {
  const snapshots = await prisma.analyticsSnapshot.findMany({
    where: {
      restaurantId: req.restaurant!.id,
    },
    orderBy: { generatedAt: 'desc' },
    take: 30,
  });

  return res.json({ success: true, data: snapshots });
});

export default router;