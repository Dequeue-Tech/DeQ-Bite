"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const auth_1 = require("../../middleware/auth");
const restaurant_1 = require("../../middleware/restaurant");
const analytics_service_1 = require("../../modules/analytics/analytics.service");
const database_1 = require("../../config/database");
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importDefault(require("openai"));
const router = (0, express_1.Router)();
const dateQuerySchema = zod_1.z.object({
    date: zod_1.z.string().optional(),
});
const overviewQuerySchema = zod_1.z.object({
    start: zod_1.z.string().optional(),
    end: zod_1.z.string().optional(),
});
const parseDateInput = (value) => {
    if (!value)
        return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error('Invalid date format');
    }
    return date;
};
router.use(auth_1.authenticate, restaurant_1.requireRestaurant, (0, restaurant_1.authorizeRestaurantRole)('OWNER', 'ADMIN', 'STAFF'));
const insightsBodySchema = zod_1.z.object({
    topDishes: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    pendingDeliveries: zod_1.z.number().int().nonnegative(),
    totalOrders: zod_1.z.number().int().nonnegative(),
});
const insightsResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z
        .array(zod_1.z.object({
        type: zod_1.z.enum(['growth', 'alert']),
        title: zod_1.z.string().min(1),
        desc: zod_1.z.string().min(1),
    }))
        .length(2),
});
const analyticsChatBodySchema = zod_1.z.object({
    question: zod_1.z.string().min(1).max(1000),
    topDishes: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    pendingDeliveries: zod_1.z.number().int().nonnegative(),
    totalOrders: zod_1.z.number().int().nonnegative(),
    activeOrders: zod_1.z.number().int().nonnegative(),
    totalRevenuePaise: zod_1.z.number().int().nonnegative(),
    avgOrderValuePaise: zod_1.z.number().int().nonnegative(),
    messages: zod_1.z
        .array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant']),
        content: zod_1.z.string().min(1).max(2000),
    }))
        .max(12)
        .optional()
        .default([]),
});
const analyticsChatResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        reply: zod_1.z.string().min(1),
        suggestedPrompts: zod_1.z.array(zod_1.z.string().min(1)).max(3).default([]),
    }),
});
const buildFallbackInsights = (payload) => {
    const topDish = payload.topDishes[0] || 'Top dish';
    const growthTitle = payload.totalOrders >= 20 ? 'Order flow is healthy' : 'Order volume can be improved';
    const growthDesc = payload.totalOrders >= 20
        ? `Keep spotlighting ${topDish} and combo offers to sustain this momentum through peak windows.`
        : `Promote ${topDish} with time-bound offers to lift order count in the next service window.`;
    const alertTitle = payload.pendingDeliveries > 5 ? 'Delivery queue is building up' : 'Delivery queue is under control';
    const alertDesc = payload.pendingDeliveries > 5
        ? 'Dispatch more riders or stagger kitchen prep to prevent SLA delays on pending deliveries.'
        : 'Current pending deliveries are manageable; maintain prep discipline to keep turnaround consistent.';
    return {
        success: true,
        data: [
            { type: 'growth', title: growthTitle, desc: growthDesc },
            { type: 'alert', title: alertTitle, desc: alertDesc },
        ],
    };
};
const buildFallbackChatReply = (payload) => {
    const topDish = payload.topDishes[0] || 'your best-selling item';
    const pendingPressure = payload.pendingDeliveries > 5
        ? 'Delivery operations are under pressure right now, so focus on dispatch speed and prep handoff first.'
        : 'Delivery load looks manageable, so you can focus on growing basket size and repeat orders.';
    const orderSignal = payload.totalOrders >= 20
        ? `Order throughput is solid with ${payload.totalOrders} orders, so test upsells around ${topDish} to lift average order value.`
        : `With ${payload.totalOrders} orders so far, spotlight ${topDish} in promos and homepage placements to increase conversion.`;
    const avgOrderInr = (payload.avgOrderValuePaise / 100).toFixed(2);
    return {
        success: true,
        data: {
            reply: `${orderSignal} ${pendingPressure} Your current average order value is INR ${avgOrderInr}, so pairing ${topDish} with a high-margin add-on is the clearest next experiment.`,
            suggestedPrompts: [
                'What should I push in the next two hours?',
                'How can I reduce delivery delays today?',
                'Give me one pricing experiment to test this week.',
            ],
        },
    };
};
const callGemini = async (systemPrompt, userPrompt) => {
    const apiKey = process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY'];
    if (!apiKey) {
        throw new Error('Google API Key not configured. Set GOOGLE_API_KEY or GOOGLE_CLOUD_API_KEY.');
    }
    const client = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
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
const callOpenAI = async (systemPrompt, userPrompt) => {
    const key = process.env['OPENAI_API_KEY'];
    if (!key) {
        throw new Error('OpenAI API Key not configured. Set OPENAI_API_KEY.');
    }
    const client = new openai_1.default({ apiKey: key });
    const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
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
const generateAIOperationalInsights = async (payload) => {
    const systemPrompt = `You are a restaurant operations consultant. Provide exactly 2 concise, actionable insights based on the provided live metrics. 
Return output as a valid JSON object matching this schema: 
{ "success": true, "data": [ { "type": "growth" or "alert", "title": "string", "desc": "string" } ] }. 
The 'desc' field MUST be a brief, actionable recommendation (1-2 sentences max). Do NOT wrap the JSON in markdown blocks.`;
    const userPrompt = `Live data:\n${JSON.stringify(payload, null, 2)}`;
    let rawText;
    if (process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY']) {
        rawText = await callGemini(systemPrompt, userPrompt);
    }
    else if (process.env['OPENAI_API_KEY']) {
        rawText = await callOpenAI(systemPrompt, userPrompt);
    }
    else {
        return buildFallbackInsights(payload);
    }
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(cleanedText);
    }
    catch (err) {
        throw new Error(`Failed to parse LLM response as JSON: ${err.message}\nRaw Output: ${cleanedText}`);
    }
    const shaped = insightsResponseSchema.safeParse(parsed);
    if (!shaped.success) {
        throw new Error(`LLM response does not match required schema: ${JSON.stringify(shaped.error.issues)}`);
    }
    return shaped.data;
};
const generateAnalyticsChatReply = async (payload) => {
    const systemPrompt = `You are Bite Copilot, an AI restaurant analytics advisor.
Answer the user's question using the provided live restaurant metrics and recent chat context.
Keep the answer practical, specific, and concise: 2 short paragraphs max.
Include concrete operational advice, not generic analytics theory.
Return valid JSON matching this schema exactly:
{
  "success": true,
  "data": {
    "reply": "string",
    "suggestedPrompts": ["string", "string", "string"]
  }
}
Do not wrap JSON in markdown.`;
    const userPrompt = `Live analytics context:
${JSON.stringify({
        topDishes: payload.topDishes,
        pendingDeliveries: payload.pendingDeliveries,
        totalOrders: payload.totalOrders,
        activeOrders: payload.activeOrders,
        totalRevenuePaise: payload.totalRevenuePaise,
        avgOrderValuePaise: payload.avgOrderValuePaise,
        recentMessages: payload.messages,
        question: payload.question,
    }, null, 2)}`;
    let rawText;
    if (process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY']) {
        rawText = await callGemini(systemPrompt, userPrompt);
    }
    else if (process.env['OPENAI_API_KEY']) {
        rawText = await callOpenAI(systemPrompt, userPrompt);
    }
    else {
        return buildFallbackChatReply(payload);
    }
    const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    let parsed;
    try {
        parsed = JSON.parse(cleanedText);
    }
    catch (err) {
        throw new Error(`Failed to parse LLM response as JSON: ${err.message}\nRaw Output: ${cleanedText}`);
    }
    const shaped = analyticsChatResponseSchema.safeParse(parsed);
    if (!shaped.success) {
        throw new Error(`LLM response does not match required schema: ${JSON.stringify(shaped.error.issues)}`);
    }
    return shaped.data;
};
router.post('/insights', async (req, res) => {
    console.log("Hit");
    try {
        const payload = insightsBodySchema.parse(req.body);
        const result = await generateAIOperationalInsights(payload);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        console.error("AI Insights Error:", error);
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return res.status(500).json({ success: false, error: message });
    }
});
router.post('/insights/chat', async (req, res) => {
    try {
        const payload = analyticsChatBodySchema.parse(req.body);
        const result = await generateAnalyticsChatReply(payload);
        return res.json(result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid payload', details: error.issues });
        }
        console.error('AI Analytics Chat Error:', error);
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return res.status(500).json({ success: false, error: message });
    }
});
router.get('/daily', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.DAILY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate daily analytics' });
    }
});
router.get('/weekly', async (req, res) => {
    try {
        const query = dateQuerySchema.parse(req.query);
        const date = parseDateInput(query.date) || new Date();
        const snapshot = await (0, analytics_service_1.generateAnalyticsSnapshot)({
            restaurantId: req.restaurant.id,
            periodType: client_1.AnalyticsPeriodType.WEEKLY,
            date,
        });
        return res.json({ success: true, data: snapshot });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error && error.message === 'Invalid date format') {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate weekly analytics' });
    }
});
router.get('/overview', async (req, res) => {
    try {
        const query = overviewQuerySchema.parse(req.query);
        const end = parseDateInput(query.end) || new Date();
        const start = parseDateInput(query.start) || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        const overview = await (0, analytics_service_1.getAnalyticsOverview)({
            restaurantId: req.restaurant.id,
            start,
            end,
        });
        return res.json({ success: true, data: overview });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: 'Invalid query', details: error.issues });
        }
        if (error instanceof Error) {
            return res.status(400).json({ success: false, error: error.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to generate analytics overview' });
    }
});
router.get('/history', async (req, res) => {
    const snapshots = await database_1.prisma.analyticsSnapshot.findMany({
        where: {
            restaurantId: req.restaurant.id,
        },
        orderBy: { generatedAt: 'desc' },
        take: 30,
    });
    return res.json({ success: true, data: snapshots });
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map